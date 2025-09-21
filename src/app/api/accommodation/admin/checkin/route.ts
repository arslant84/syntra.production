// src/app/api/accommodation/admin/checkin/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';

const checkinSchema = z.object({
  requestId: z.string().min(1, "Request ID is required."),
  action: z.enum(['checkin', 'checkout'], { required_error: "Action must be 'checkin' or 'checkout'" }),
  notes: z.string().optional(),
});

export const POST = withAuth(async function(request: NextRequest) {
  const session = (request as any).user;

  // Check if user has permission to manage accommodation
  if (!hasPermission(session, 'approve_accommodation_requests')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }

  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const validationResult = checkinSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        error: "Validation failed",
        details: validationResult.error.flatten()
      }, { status: 400 });
    }

    const { requestId, action, notes } = validationResult.data;

    // Check if the accommodation request exists
    const [accommodationRequest] = await sql`
      SELECT id, status, requestor_name
      FROM travel_requests
      WHERE id = ${requestId}
        AND (travel_type = 'Accommodation' OR id LIKE 'ACCOM-%')
    `;

    if (!accommodationRequest) {
      return NextResponse.json({
        error: "Accommodation request not found"
      }, { status: 404 });
    }

    // Determine the new status based on action
    let newStatus: string;
    let logMessage: string;

    if (action === 'checkin') {
      if (accommodationRequest.status !== 'Accommodation Assigned') {
        return NextResponse.json({
          error: "Can only check-in accommodation that has been assigned"
        }, { status: 400 });
      }
      newStatus = 'Checked-in';
      logMessage = `Guest checked in by ${session.name || session.email}`;
    } else { // checkout
      if (accommodationRequest.status !== 'Checked-in') {
        return NextResponse.json({
          error: "Can only check-out accommodation for checked-in guests"
        }, { status: 400 });
      }
      newStatus = 'Checked-out';
      logMessage = `Guest checked out by ${session.name || session.email}`;
    }

    // Update the accommodation request status and booking records
    await sql.begin(async (tx) => {
      // Update the main request status
      await tx`
        UPDATE travel_requests
        SET status = ${newStatus},
            additional_comments = COALESCE(additional_comments || E'\n\n', '') || ${logMessage + (notes ? `. Notes: ${notes}` : '')},
            updated_at = NOW()
        WHERE id = ${requestId}
      `;

      // Update all booking records for this request
      await tx`
        UPDATE accommodation_bookings
        SET status = ${newStatus === 'Checked-in' ? 'Active' : 'Completed'},
            notes = COALESCE(notes || E'\n\n', '') || ${logMessage + (notes ? `. Notes: ${notes}` : '')},
            updated_at = NOW()
        WHERE trf_id = ${requestId}
      `;

      // Add approval step record
      await tx`
        INSERT INTO trf_approval_steps (trf_id, step_role, step_name, status, step_date, comments)
        VALUES (${requestId}, 'Accommodation Admin', ${session.name || session.email}, ${newStatus}, NOW(), ${logMessage + (notes ? `. Notes: ${notes}` : '')})
      `;
    });

    return NextResponse.json({
      message: `Guest successfully ${action === 'checkin' ? 'checked in' : 'checked out'}`,
      requestId,
      newStatus,
      action
    });

  } catch (error: any) {
    console.error('Accommodation check-in/check-out error:', error);
    return NextResponse.json({
      error: 'Failed to process check-in/check-out',
      details: error.message
    }, { status: 500 });
  }
});