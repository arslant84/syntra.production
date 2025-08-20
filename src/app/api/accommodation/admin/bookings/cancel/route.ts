import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';
import { z } from 'zod';

const cancelBookingSchema = z.object({
  staffId: z.string().optional(), // Cancel all bookings for this person
  trfId: z.string().optional(),   // Cancel all bookings related to this TRF
  bookingIds: z.array(z.string()).optional(), // Cancel specific booking IDs
  dateRange: z.object({
    startDate: z.string(),
    endDate: z.string(),
    staffId: z.string()
  }).optional() // Cancel bookings for specific person in date range
});

export const POST = withAuth(async function(request: NextRequest) {
  try {
    const session = (request as any).user;

    // Check if user has permission to manage accommodation bookings
    if (!hasPermission(session, 'manage_accommodation_bookings')) {
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const validation = cancelBookingSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { staffId, trfId, bookingIds, dateRange } = validation.data;

    // Validate that at least one criterion is provided
    if (!staffId && !trfId && !bookingIds && !dateRange) {
      return NextResponse.json(
        { error: 'At least one cancellation criterion must be provided (staffId, trfId, bookingIds, or dateRange)' },
        { status: 400 }
      );
    }

    let bookingsToCancelQuery;
    let queryParams: any[] = [];

    // Build query based on criteria
    if (bookingIds && bookingIds.length > 0) {
      // Cancel specific booking IDs
      bookingsToCancelQuery = sql`
        SELECT id, staff_id, trf_id, date, room_id, staff_house_id, status, notes
        FROM accommodation_bookings 
        WHERE id = ANY(${bookingIds}) 
        AND status != 'Cancelled'
      `;
    } else if (dateRange) {
      // Cancel bookings for specific person in date range
      bookingsToCancelQuery = sql`
        SELECT id, staff_id, trf_id, date, room_id, staff_house_id, status, notes
        FROM accommodation_bookings 
        WHERE staff_id = ${dateRange.staffId}
        AND date >= ${dateRange.startDate}::date
        AND date <= ${dateRange.endDate}::date
        AND status != 'Cancelled'
      `;
    } else if (staffId) {
      // Cancel all bookings for specific person
      bookingsToCancelQuery = sql`
        SELECT id, staff_id, trf_id, date, room_id, staff_house_id, status, notes
        FROM accommodation_bookings 
        WHERE staff_id = ${staffId}
        AND status != 'Cancelled'
      `;
    } else if (trfId) {
      // Cancel all bookings for specific TRF
      bookingsToCancelQuery = sql`
        SELECT id, staff_id, trf_id, date, room_id, staff_house_id, status, notes
        FROM accommodation_bookings 
        WHERE trf_id = ${trfId}
        AND status != 'Cancelled'
      `;
    }

    const bookingsToCancel = await bookingsToCancelQuery;

    if (bookingsToCancel.length === 0) {
      return NextResponse.json(
        { message: 'No active bookings found matching the criteria' },
        { status: 200 }
      );
    }

    // Begin transaction to ensure atomicity
    const result = await sql.begin(async (sql) => {
      const cancelledBookingIds: string[] = [];
      
      // Cancel all matching bookings
      for (const booking of bookingsToCancel) {
        await sql`
          UPDATE accommodation_bookings 
          SET 
            status = 'Cancelled',
            notes = COALESCE(notes || ' ', '') || '[CANCELLED BY ADMIN - BATCH CANCELLATION]',
            updated_at = NOW()
          WHERE id = ${booking.id}
        `;
        cancelledBookingIds.push(booking.id);
      }

      // If there's a TRF ID, revert the accommodation request status to pending
      const trfIdsToRevert = new Set<string>();
      
      // Collect all TRF IDs that need to be reverted
      for (const booking of bookingsToCancel) {
        if (booking.trf_id) {
          trfIdsToRevert.add(booking.trf_id);
        }
      }

      // Revert accommodation request status for affected TRFs
      for (const trfId of trfIdsToRevert) {
        // Check if this TRF has any remaining active bookings
        const remainingBookings = await sql`
          SELECT id FROM accommodation_bookings 
          WHERE trf_id = ${trfId} 
          AND status NOT IN ('Cancelled')
        `;

        // Only revert to pending if ALL bookings for this TRF are cancelled
        if (remainingBookings.length === 0) {
          // Update TRF status back to pending accommodation
          await sql`
            UPDATE trf_requests 
            SET status = 'Pending Accommodation'
            WHERE id = ${trfId}
          `;

          // Also clear any accommodation assignment details if they exist
          await sql`
            UPDATE trf_accommodation_details 
            SET 
              assigned_room_id = NULL,
              assigned_room_name = NULL,
              assigned_staff_house_id = NULL,
              assigned_staff_house_name = NULL
            WHERE trf_id = ${trfId}
          `;

          console.log(`Reverted TRF ${trfId} status to 'Pending Accommodation' due to booking cancellation`);
        }
      }

      return {
        cancelledCount: cancelledBookingIds.length,
        cancelledBookingIds,
        revertedTrfIds: Array.from(trfIdsToRevert)
      };
    });

    return NextResponse.json({
      message: `Successfully cancelled ${result.cancelledCount} booking(s)`,
      cancelledCount: result.cancelledCount,
      cancelledBookingIds: result.cancelledBookingIds,
      revertedTrfIds: result.revertedTrfIds
    }, { status: 200 });

  } catch (error) {
    console.error('Error cancelling bookings:', error);
    return NextResponse.json(
      { 
        error: 'Failed to cancel bookings',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});