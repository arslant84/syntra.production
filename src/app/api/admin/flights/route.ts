import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';

export const GET = withAuth(async function(request: NextRequest) {
  const session = (request as any).user;
  
  // Check if user has permission to view flights admin
  if (!hasPermission(session, 'process_flights') && !hasPermission(session, 'admin_all')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const stats = url.searchParams.get('stats') === 'true';
  const bookedOnly = url.searchParams.get('bookedOnly') === 'true';

  if (!sql) {
    console.error('Database client is null - checking initialization...');
    try {
      const { getSql } = await import('@/lib/db');
      const sqlInstance = getSql();
      if (!sqlInstance) {
        console.error('Failed to get SQL instance from getSql()');
        return NextResponse.json({ 
          error: 'Database client not initialized.',
          details: 'SQL instance is null after initialization attempt'
        }, { status: 503 });
      }
    } catch (dbError: any) {
      console.error('Database initialization error:', dbError);
      return NextResponse.json({ 
        error: 'Database connection failed.',
        details: dbError.message 
      }, { status: 503 });
    }
  }

  try {
    if (stats) {
      try {
        // Ensure we have a valid SQL connection
        const { getSql } = await import('@/lib/db');
        const sqlInstance = getSql();
        
        // Fetch statistics for ALL flight-related TSRs (any travel type with flight requirements)
        const flightStats = await sqlInstance`
          SELECT
            -- Total: All TSRs requiring flights (Overseas/HLP by default + any with flight numbers in itinerary)
            (SELECT COUNT(DISTINCT tr.id)
             FROM travel_requests tr
             LEFT JOIN trf_itinerary_segments tis ON tr.id = tis.trf_id
             WHERE tr.travel_type IN ('Overseas', 'Home Leave Passage')
                OR (tis.flight_number IS NOT NULL AND tis.flight_number <> '')) as total,

            -- Pending: Approved TSRs awaiting flight booking (only approved status, not processed yet)
            (SELECT COUNT(DISTINCT tr.id)
             FROM travel_requests tr
             LEFT JOIN trf_itinerary_segments tis ON tr.id = tis.trf_id
             WHERE tr.status = 'Approved'
               AND (tr.travel_type IN ('Overseas', 'Home Leave Passage')
                   OR (tis.flight_number IS NOT NULL AND tis.flight_number <> ''))) as pending,

            -- Booked: TSRs with status "TRF Processed" (flight admin completed processing)
            (SELECT COUNT(DISTINCT tr.id)
             FROM travel_requests tr
             LEFT JOIN trf_itinerary_segments tis ON tr.id = tis.trf_id
             WHERE tr.status = 'TRF Processed'
               AND (tr.travel_type IN ('Overseas', 'Home Leave Passage')
                   OR (tis.flight_number IS NOT NULL AND tis.flight_number <> ''))) as booked,

            -- Rejected: Flight-related TSRs that were rejected
            (SELECT COUNT(DISTINCT tr.id)
             FROM travel_requests tr
             LEFT JOIN trf_itinerary_segments tis ON tr.id = tis.trf_id
             WHERE tr.status = 'Rejected'
               AND (tr.travel_type IN ('Overseas', 'Home Leave Passage')
                   OR (tis.flight_number IS NOT NULL AND tis.flight_number <> ''))) as rejected,

            -- In Approval: TSRs still in approval workflow (Pending Department Focal, Line Manager, HOD)
            (SELECT COUNT(DISTINCT tr.id)
             FROM travel_requests tr
             LEFT JOIN trf_itinerary_segments tis ON tr.id = tis.trf_id
             WHERE tr.status IN ('Pending Department Focal', 'Pending Line Manager', 'Pending HOD')
               AND (tr.travel_type IN ('Overseas', 'Home Leave Passage')
                   OR (tis.flight_number IS NOT NULL AND tis.flight_number <> ''))) as in_approval
        `;

        const rawStats = flightStats[0] || {
          total: 0,
          pending: 0,
          booked: 0,
          rejected: 0
        };

        // Convert BigInt values to numbers to avoid JSON serialization errors
        const stats = {
          total: Number(rawStats.total || 0),
          pending: Number(rawStats.pending || 0),
          booked: Number(rawStats.booked || 0),
          rejected: Number(rawStats.rejected || 0)
        };

        return NextResponse.json({ stats });
      } catch (statsError: any) {
        console.error('Error fetching flight statistics:', statsError);
        
        // Check if it's a table missing error
        if (statsError.message && statsError.message.includes('relation') && statsError.message.includes('does not exist')) {
          return NextResponse.json({ 
            error: 'Database table not found',
            details: 'Required tables (travel_requests or trf_flight_bookings) do not exist',
            stats: { total: 0, pending: 0, booked: 0, rejected: 0 }
          }, { status: 200 }); // Return default stats instead of error
        }
        
        return NextResponse.json({
          error: 'Failed to fetch flight statistics',
          details: statsError.message,
          stats: { total: 0, pending: 0, booked: 0, rejected: 0 }
        }, { status: 200 }); // Return default stats instead of error
      }
    }

    // Fetch TSRs that require flights (Overseas and Home Leave Passage)
    let allTrfs;
    try {
      // Ensure we have a valid SQL connection
      const { getSql } = await import('@/lib/db');
      const sqlInstance = getSql();

      if (bookedOnly) {
        // For booked flights only - TSRs that have formal flight bookings AND status 'TRF Processed'
        allTrfs = await sqlInstance`
          SELECT DISTINCT ON (tr.id)
            tr.id,
            tr.requestor_name,
            tr.external_full_name,
            tr.travel_type,
            tr.department,
            tr.purpose,
            tr.status,
            tr.submitted_at,
            tfb.id as flight_booking_id,
            tfb.flight_number,
            tfb.airline,
            tfb.departure_location,
            tfb.arrival_location,
            tfb.departure_date,
            tfb.departure_time,
            tfb.arrival_date,
            tfb.arrival_time,
            tfb.booking_reference,
            tfb.status as flight_status,
            tfb.remarks,
            tis.flight_number as itinerary_flight_number,
            tis.from_location as itinerary_departure,
            tis.to_location as itinerary_arrival,
            tis.segment_date as itinerary_segment_date,
            tis.departure_time as itinerary_departure_time,
            tis.arrival_time as itinerary_arrival_time
          FROM travel_requests tr
          INNER JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
          LEFT JOIN trf_itinerary_segments tis ON tr.id = tis.trf_id AND
                   (tis.flight_number IS NOT NULL AND tis.flight_number <> '')
          WHERE tr.status = 'TRF Processed'
            AND tfb.id IS NOT NULL
          ORDER BY tr.id, tr.submitted_at DESC, tfb.id DESC NULLS LAST, tis.segment_date ASC
          LIMIT ${limit}
        `;
      } else {
        // Query for ALL flight-related TRFs for Flight Administration dashboard
        // Includes: Overseas/HLP by default + ANY travel type with flight numbers in itinerary
        allTrfs = await sqlInstance`
          SELECT DISTINCT
            tr.id,
            tr.requestor_name,
            tr.external_full_name,
            tr.travel_type,
            tr.department,
            tr.purpose,
            tr.status,
            tr.submitted_at,
            tfb.id as flight_booking_id,
            tfb.flight_number,
            tfb.departure_location,
            tfb.arrival_location,
            tfb.departure_datetime as departure_date,
            tfb.arrival_datetime as arrival_date,
            tfb.booking_reference,
            tfb.status as flight_status,
            tfb.remarks
          FROM travel_requests tr
          LEFT JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
          LEFT JOIN trf_itinerary_segments tis ON tr.id = tis.trf_id
          WHERE (tr.travel_type IN ('Overseas', 'Home Leave Passage')
             OR tfb.id IS NOT NULL
             OR (tis.flight_number IS NOT NULL AND tis.flight_number <> ''))
          ORDER BY tr.submitted_at DESC
          LIMIT ${limit}
        `;
      }
    } catch (queryError: any) {
      console.error('Error fetching flight applications:', queryError);
      
      // Check if it's a table missing error
      if (queryError.message && queryError.message.includes('relation') && queryError.message.includes('does not exist')) {
        return NextResponse.json({ 
          trfs: [],
          error: 'Database table not found',
          details: 'Required tables (travel_requests or trf_flight_bookings) do not exist'
        }, { status: 200 }); // Return empty array instead of error
      }
      
      return NextResponse.json({
        trfs: [],
        error: 'Failed to fetch flight applications',
        details: queryError.message
      }, { status: 200 }); // Return empty array instead of error
    }

    const formattedTrfs = allTrfs.map(trf => {
      // Determine if this TRF has flight booking data
      const hasFormalBooking = !!trf.flight_booking_id;
      const hasItineraryFlight = !!(trf.itinerary_flight_number && trf.itinerary_flight_number !== '');
      const hasAnyFlightData = hasFormalBooking || hasItineraryFlight;

      // Create flight details from formal booking or itinerary data
      let flightDetails = null;
      if (hasFormalBooking) {
        // Combine separate date and time fields into datetime format
        const departureDateTime = trf.departure_date && trf.departure_time
          ? `${trf.departure_date}T${trf.departure_time}:00`
          : trf.departure_date;
        const arrivalDateTime = trf.arrival_date && trf.arrival_time
          ? `${trf.arrival_date}T${trf.arrival_time}:00`
          : trf.arrival_date;

        // Use formal flight booking data - ensure all fields are properly populated
        flightDetails = {
          id: Number(trf.flight_booking_id),
          flightNumber: trf.flight_number || 'N/A',
          airline: trf.airline || 'N/A',
          departureLocation: trf.departure_location || 'N/A',
          arrivalLocation: trf.arrival_location || 'N/A',
          departureDate: departureDateTime,
          arrivalDate: arrivalDateTime,
          bookingReference: trf.booking_reference || 'N/A',
          status: trf.flight_status || 'Confirmed',
          remarks: trf.remarks || 'Flight booked by admin'
        };
      } else if (hasItineraryFlight) {
        // Use itinerary segment data as flight details
        // Combine segment_date with departure/arrival times for datetime format
        const departureDateTime = trf.itinerary_segment_date && trf.itinerary_departure_time
          ? `${trf.itinerary_segment_date}T${trf.itinerary_departure_time}:00`
          : trf.itinerary_segment_date;
        const arrivalDateTime = trf.itinerary_segment_date && trf.itinerary_arrival_time
          ? `${trf.itinerary_segment_date}T${trf.itinerary_arrival_time}:00`
          : trf.itinerary_segment_date;

        flightDetails = {
          id: `itinerary-${trf.id}`, // Generate pseudo-ID for itinerary flights
          flightNumber: trf.itinerary_flight_number,
          departureLocation: trf.itinerary_departure || 'N/A',
          arrivalLocation: trf.itinerary_arrival || 'N/A',
          departureDate: departureDateTime,
          arrivalDate: arrivalDateTime,
          bookingReference: trf.itinerary_flight_number, // Use flight number as reference
          status: 'From Itinerary', // Default status for itinerary flights
          remarks: 'Flight details from user itinerary'
        };
      }

      return {
        id: String(trf.id),
        requestorName: trf.requestor_name || trf.external_full_name,
        travelType: trf.travel_type,
        department: trf.department,
        purpose: trf.purpose,
        status: trf.status,
        submittedAt: trf.submitted_at,
        hasFlightBooking: hasAnyFlightData,
        flightDetails: flightDetails
      };
    });

    return NextResponse.json({ trfs: formattedTrfs });

  } catch (error: any) {
    console.error('Error fetching flight data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flight data', details: error.message },
      { status: 500 }
    );
  }
});