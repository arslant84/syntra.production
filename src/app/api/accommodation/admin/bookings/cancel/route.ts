import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';
import { z } from 'zod';
import { UnifiedNotificationService } from '@/lib/unified-notification-service';

const cancelBookingSchema = z.object({
  staffId: z.string().min(1).optional(), // Cancel all bookings for this person
  trfId: z.string().min(1).optional(),   // Cancel all bookings related to this TRF
  bookingIds: z.array(z.string().min(1)).optional(), // Cancel specific booking IDs
  dateRange: z.object({
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    staffId: z.string().min(1)
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
    console.log('Cancel booking request body:', JSON.stringify(body, null, 2));
    
    const validation = cancelBookingSchema.safeParse(body);
    
    if (!validation.success) {
      console.error('Cancel booking validation failed:', validation.error.format());
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { staffId, trfId, bookingIds, dateRange } = validation.data;

    // Validate that at least one criterion is provided
    if (!staffId && !trfId && !bookingIds && !dateRange) {
      console.error('Cancel booking error: No valid criteria provided. Request data:', {
        staffId, trfId, bookingIds, dateRange,
        originalBody: body
      });
      return NextResponse.json(
        { 
          error: 'At least one cancellation criterion must be provided (staffId, trfId, bookingIds, or dateRange)',
          debug: {
            providedStaffId: staffId,
            providedTrfId: trfId,
            providedBookingIds: bookingIds,
            providedDateRange: dateRange
          }
        },
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

    // If no bookings found but we have a trfId, check if this is a TSR in Processing Accommodation status
    if (bookingsToCancel.length === 0 && trfId) {
      const trfStatus = await sql`
        SELECT tr.status, tr.travel_type, tr.requestor_name
        FROM travel_requests tr
        WHERE tr.id = ${trfId}
      `;
      
      if (trfStatus.length > 0 && trfStatus[0].status === 'Processing Accommodation') {
        console.log(`No bookings found for TRF ${trfId}, but it's in Processing Accommodation status - reverting to Approved`);
        
        // Revert TSR status back to Approved so it can be re-processed
        await sql`
          UPDATE travel_requests 
          SET status = 'Approved'
          WHERE id = ${trfId}
        `;

        // Send notification to user
        try {
          const userDetails = await sql`
            SELECT u.id, u.name, u.email, tr.requestor_name, tr.department, tr.purpose
            FROM travel_requests tr
            LEFT JOIN users u ON tr.staff_id = u.staff_id
            WHERE tr.id = ${trfId}
          `;

          if (userDetails.length > 0) {
            const user = userDetails[0];
            await UnifiedNotificationService.notifyStatusUpdate({
              entityType: 'accommodation',
              entityId: trfId,
              requestorId: user.id,
              requestorName: user.name || user.requestor_name || 'User',
              requestorEmail: user.email,
              newStatus: 'Approved',
              previousStatus: 'Processing Accommodation',
              updateReason: 'Accommodation processing has been cancelled. Your request has been reverted to Approved status and can be re-processed.',
              entityTitle: user.purpose || 'Travel/Accommodation Request'
            });
          }
        } catch (notificationError) {
          console.error('Failed to send cancellation notification:', notificationError);
        }

        return NextResponse.json({
          message: 'TSR accommodation processing cancelled successfully. Request reverted to Approved status.',
          cancelledCount: 0,
          cancelledBookingIds: [],
          revertedTrfIds: [trfId]
        }, { status: 200 });
      }
      
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
          // Check if this is a TSR or pure accommodation request
          const trfDetails = await sql`
            SELECT tr.travel_type, tr.status
            FROM travel_requests tr
            WHERE tr.id = ${trfId}
          `;
          
          if (trfDetails.length > 0) {
            if (trfDetails[0].travel_type === 'Accommodation') {
              // Pure accommodation request - revert to appropriate status
              await sql`
                UPDATE travel_requests 
                SET status = 'Pending Accommodation Admin'
                WHERE id = ${trfId}
              `;
              console.log(`Reverted accommodation request ${trfId} status to 'Pending Accommodation Admin'`);
            } else {
              // TSR request - revert to Approved so it can go through accommodation processing again
              await sql`
                UPDATE travel_requests 
                SET status = 'Approved'
                WHERE id = ${trfId}
              `;
              console.log(`Reverted TSR ${trfId} status to 'Approved' for re-processing`);
            }
          }

          // Note: Accommodation assignment info is stored in additional_comments 
          // and doesn't need to be cleared when bookings are cancelled
        }
      }

      return {
        cancelledCount: cancelledBookingIds.length,
        cancelledBookingIds,
        revertedTrfIds: Array.from(trfIdsToRevert),
        bookingsToCancel // Include booking details for notifications
      };
    });

    // Send notifications to affected users
    try {
      // Group bookings by user/TRF to avoid sending multiple notifications to the same person
      const notificationGroups = new Map<string, any[]>();
      
      for (const booking of bookingsToCancel) {
        const key = booking.staff_id || booking.trf_id;
        if (key) {
          if (!notificationGroups.has(key)) {
            notificationGroups.set(key, []);
          }
          notificationGroups.get(key).push(booking);
        }
      }

      // Send notification for each user/TRF group
      for (const [userKey, userBookings] of notificationGroups.entries()) {
        try {
          // Get user details
          const userDetails = await sql`
            SELECT u.id, u.name, u.email, u.staff_id, tr.id as trf_id, tr.requestor_name
            FROM users u
            LEFT JOIN travel_requests tr ON (tr.staff_id = u.staff_id OR tr.id = ${userKey})
            WHERE u.staff_id = ${userKey} OR u.id = ${userKey} OR tr.id = ${userKey}
            LIMIT 1
          `;

          if (userDetails.length > 0) {
            const user = userDetails[0];
            const bookingCount = userBookings.length;
            const dateRange = userBookings.length > 1 ? 
              `${new Date(Math.min(...userBookings.map(b => new Date(b.date).getTime()))).toLocaleDateString()} - ${new Date(Math.max(...userBookings.map(b => new Date(b.date).getTime()))).toLocaleDateString()}` :
              new Date(userBookings[0].date).toLocaleDateString();

            await UnifiedNotificationService.notifyStatusUpdate({
              entityType: 'accommodation',
              entityId: user.trf_id || userKey,
              requestorId: user.id,
              requestorName: user.name || user.requestor_name || 'User',
              requestorEmail: user.email,
              newStatus: 'Cancelled',
              previousStatus: 'Confirmed',
              updateReason: `${bookingCount} accommodation booking${bookingCount > 1 ? 's have' : ' has'} been cancelled by the administrator. Please contact accommodation services if you need to make new arrangements.`,
              entityTitle: `Accommodation booking${bookingCount > 1 ? 's' : ''} for ${dateRange}`
            });

            console.log(`✅ Sent cancellation notification to ${user.email} for ${bookingCount} booking(s)`);
          }
        } catch (notificationError) {
          console.error(`❌ Failed to send cancellation notification for user ${userKey}:`, notificationError);
          // Don't fail the main operation due to notification errors
        }
      }
    } catch (error) {
      console.error('❌ Error sending cancellation notifications:', error);
      // Don't fail the main operation due to notification errors
    }

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