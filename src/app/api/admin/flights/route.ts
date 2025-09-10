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
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const stats = url.searchParams.get('stats') === 'true';

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
        
        // Fetch statistics for ALL flight-related TSRs (including those with flight itineraries)
        const flightStats = await sqlInstance`
          SELECT 
            COUNT(DISTINCT tr.id) as total,
            COUNT(CASE WHEN tr.status = 'Approved' AND tfb.id IS NULL THEN 1 END) as pending,
            COUNT(CASE WHEN tfb.id IS NOT NULL THEN 1 END) as booked,
            COUNT(CASE WHEN tr.status = 'Rejected' THEN 1 END) as rejected
          FROM travel_requests tr
          LEFT JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
          LEFT JOIN trf_itinerary_segments tis ON tr.id = tis.trf_id
          WHERE tr.travel_type IN ('Overseas', 'Home Leave Passage') 
             OR tfb.id IS NOT NULL
             OR (tis.flight_number IS NOT NULL AND tis.flight_number <> '')
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
        WHERE tr.travel_type IN ('Overseas', 'Home Leave Passage') 
           OR tfb.id IS NOT NULL
           OR (tis.flight_number IS NOT NULL AND tis.flight_number <> '')
        ORDER BY tr.submitted_at DESC
        LIMIT ${limit}
      `;
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

    const formattedTrfs = allTrfs.map(trf => ({
      id: String(trf.id),
      requestorName: trf.requestor_name || trf.external_full_name,
      travelType: trf.travel_type,
      department: trf.department,
      purpose: trf.purpose,
      status: trf.status,
      submittedAt: trf.submitted_at,
      hasFlightBooking: !!trf.flight_booking_id,
      flightDetails: trf.flight_booking_id ? {
        id: Number(trf.flight_booking_id),
        flightNumber: trf.flight_number,
        departureLocation: trf.departure_location,
        arrivalLocation: trf.arrival_location,
        departureDate: trf.departure_date,
        arrivalDate: trf.arrival_date,
        bookingReference: trf.booking_reference,
        status: trf.flight_status,
        remarks: trf.remarks
      } : null
    }));

    return NextResponse.json({ trfs: formattedTrfs });

  } catch (error: any) {
    console.error('Error fetching flight data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flight data', details: error.message },
      { status: 500 }
    );
  }
});