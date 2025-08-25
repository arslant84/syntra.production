import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';

export const DELETE = withAuth(async function(request: NextRequest, { params }: { params: Promise<{ flightId: string }> }) {
  const { flightId } = await params;
  const session = (request as any).user;
  
  // Check if user has permission to manage flights
  if (!hasPermission(session, 'manage_flights') && !hasPermission(session, 'admin_all')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }

  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { reason } = body;

    // Get flight booking details before deletion
    const flightBooking = await sql`
      SELECT tfb.*, tr.requestor_name, tr.external_full_name
      FROM trf_flight_bookings tfb
      JOIN travel_requests tr ON tfb.trf_id = tr.id
      WHERE tfb.id = ${flightId}
    `;

    if (!flightBooking || flightBooking.length === 0) {
      return NextResponse.json({ error: 'Flight booking not found' }, { status: 404 });
    }

    const booking = flightBooking[0];

    // Delete the flight booking
    await sql`
      DELETE FROM trf_flight_bookings 
      WHERE id = ${flightId}
    `;

    // Optionally, you might want to revert the TSR status back to "Approved" 
    // so it can be processed again
    await sql`
      UPDATE travel_requests 
      SET status = 'Approved'
      WHERE id = ${booking.trf_id}
    `;

    // Log the cancellation
    await sql`
      INSERT INTO trf_approval_steps (trf_id, step_role, step_name, status, step_date, comments)
      VALUES (${booking.trf_id}, 'Flight Admin', 'Flight Administrator', 'Cancelled', NOW(), ${reason || 'Flight booking cancelled by Flight Admin'})
    `;

    return NextResponse.json({ 
      message: 'Flight booking cancelled successfully',
      trfId: booking.trf_id,
      flightNumber: booking.flight_number
    });

  } catch (error: any) {
    console.error('Error cancelling flight booking:', error);
    return NextResponse.json(
      { error: 'Failed to cancel flight booking', details: error.message },
      { status: 500 }
    );
  }
});