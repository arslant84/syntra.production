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
      // Fetch statistics for ALL TSRs and flight bookings
      const flightStats = await sql`
        SELECT 
          COUNT(tr.id) as total,
          COUNT(CASE WHEN tr.status = 'Approved' AND tfb.id IS NULL THEN 1 END) as pending,
          COUNT(CASE WHEN tfb.id IS NOT NULL THEN 1 END) as booked,
          COUNT(CASE WHEN tr.status = 'Rejected' THEN 1 END) as rejected
        FROM travel_requests tr
        LEFT JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
      `;

      const stats = flightStats[0] || {
        total: 0,
        pending: 0,
        booked: 0,
        rejected: 0
      };

      return NextResponse.json({ stats });
    }

    // Fetch ALL TSRs with booking details if available
    const allTrfs = await sql`
      SELECT 
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
        tfb.departure_date,
        tfb.arrival_date,
        tfb.booking_reference,
        tfb.status as flight_status,
        tfb.remarks
      FROM travel_requests tr
      LEFT JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
      ORDER BY tr.submitted_at DESC
      LIMIT ${limit}
    `;

    const formattedTrfs = allTrfs.map(trf => ({
      id: trf.id,
      requestorName: trf.requestor_name || trf.external_full_name,
      travelType: trf.travel_type,
      department: trf.department,
      purpose: trf.purpose,
      status: trf.status,
      submittedAt: trf.submitted_at,
      hasFlightBooking: !!trf.flight_booking_id,
      flightDetails: trf.flight_booking_id ? {
        id: trf.flight_booking_id,
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