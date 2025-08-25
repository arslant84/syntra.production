import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';

export const GET = withAuth(async function(request: NextRequest) {
  const session = (request as any).user;
  
  // Check if user has permission to view flights admin
  if (!hasPermission(session, 'manage_flights') && !hasPermission(session, 'admin_all')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const stats = url.searchParams.get('stats') === 'true';

  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    if (stats) {
      // Fetch statistics for flights
      const flightStats = await sql`
        SELECT 
          COUNT(CASE WHEN tr.travel_type IN ('Overseas', 'Home Leave Passage') AND tr.status = 'Approved' THEN 1 END) as pending_bookings,
          COUNT(CASE WHEN tfb.id IS NOT NULL THEN 1 END) as booked_flights,
          COUNT(CASE WHEN tr.travel_type IN ('Overseas', 'Home Leave Passage') AND tr.status IN ('Awaiting Visa', 'TRF Processed') THEN 1 END) as completed,
          COUNT(CASE WHEN tr.travel_type IN ('Overseas', 'Home Leave Passage') AND tr.status = 'Rejected' THEN 1 END) as rejected,
          COUNT(CASE WHEN tr.travel_type IN ('Overseas', 'Home Leave Passage') THEN 1 END) as total_flight_requests
        FROM travel_requests tr
        LEFT JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
        WHERE tr.travel_type IN ('Overseas', 'Home Leave Passage')
          AND tr.submitted_at >= NOW() - INTERVAL '6 months'
      `;

      const stats = flightStats[0] || {
        pending_bookings: 0,
        booked_flights: 0,
        completed: 0,
        rejected: 0,
        total_flight_requests: 0
      };

      return NextResponse.json({ stats });
    }

    // Fetch flight bookings with TRF details
    const flights = await sql`
      SELECT 
        tfb.id,
        tfb.trf_id,
        tfb.flight_number,
        tfb.departure_location,
        tfb.arrival_location,
        tfb.departure_date,
        tfb.arrival_date,
        tfb.booking_reference,
        tfb.status,
        tfb.remarks,
        tfb.created_at,
        tr.requestor_name,
        tr.external_full_name,
        tr.travel_type,
        tr.department,
        tr.purpose,
        tr.status as trf_status
      FROM trf_flight_bookings tfb
      JOIN travel_requests tr ON tfb.trf_id = tr.id
      ORDER BY tfb.created_at DESC
      LIMIT ${limit}
    `;

    const formattedFlights = flights.map(flight => ({
      id: flight.id,
      trfId: flight.trf_id,
      flightNumber: flight.flight_number,
      departureLocation: flight.departure_location,
      arrivalLocation: flight.arrival_location,
      departureDate: flight.departure_date,
      arrivalDate: flight.arrival_date,
      bookingReference: flight.booking_reference,
      status: flight.status,
      remarks: flight.remarks,
      requestorName: flight.requestor_name || flight.external_full_name,
      travelType: flight.travel_type,
      department: flight.department,
      purpose: flight.purpose,
      trfStatus: flight.trf_status,
      createdAt: flight.created_at
    }));

    return NextResponse.json({ flights: formattedFlights });

  } catch (error: any) {
    console.error('Error fetching flight data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flight data', details: error.message },
      { status: 500 }
    );
  }
});