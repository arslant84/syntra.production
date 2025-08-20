// src/app/api/accommodation/requests/[requestId]/action/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { z } from 'zod';
import { requireAuth, requireRoles, createAuthError } from '@/lib/auth-utils';
import { NotificationService } from '@/lib/notification-service';

const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'cancel']),
  comments: z.string().optional(),
  approverRole: z.string().optional(),
  approverName: z.string().optional(),
});

interface RouteParams {
  params: Promise<{
    requestId: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // SECURITY: Require authentication and authorization
    const user = await requireRoles(['Department Focal', 'Line Manager', 'HOD', 'admin']);
    console.log(`API_ACCOM_REQ_ACTION_POST_START: User ${user.email} (${user.role}) processing action`);

    const { requestId } = await params;
    console.log(`API_ACCOM_REQ_ACTION_POST_START (PostgreSQL): Processing action for accommodation request ${requestId}.`);
  
    if (!sql) {
      console.error("API_ACCOM_REQ_ACTION_POST_ERROR (PostgreSQL): SQL client is not initialized.");
      return NextResponse.json({ error: 'Database client not initialized. Check server logs.' }, { status: 503 });
    }
    const body = await request.json();
    console.log(`API_ACCOM_REQ_ACTION_POST_BODY: ${JSON.stringify(body)}`);
    const validationResult = actionSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error("API_ACCOM_REQ_ACTION_POST_VALIDATION_ERROR (PostgreSQL):", validationResult.error.flatten());
      return NextResponse.json({ error: "Validation failed", details: validationResult.error.flatten() }, { status: 400 });
    }
    
    const { action, comments, approverRole, approverName } = validationResult.data;
    
    // Get the accommodation request directly from travel_requests table
    console.log(`API_ACCOM_REQ_ACTION_POST: Querying travel_requests for ID ${requestId}`);
    const accommodationRequests = await sql`
      SELECT id, status, travel_type, requestor_name, staff_id
      FROM travel_requests 
      WHERE id = ${requestId}
    `;
    
    console.log(`API_ACCOM_REQ_ACTION_POST: Query result:`, accommodationRequests);
    
    if (accommodationRequests.length === 0) {
      console.log(`API_ACCOM_REQ_ACTION_POST: No accommodation request found with ID ${requestId}`);
      return NextResponse.json({ error: `Accommodation request with ID ${requestId} not found.` }, { status: 404 });
    }
    
    const accommodationRequest = accommodationRequests[0];
    
    const currentStatus = accommodationRequest.status;
    
    // Define approval workflow sequence
    const approvalWorkflowSequence: Record<string, string> = {
      'Pending Department Focal': 'Pending Line Manager',
      'Pending Line Manager': 'Pending HOD', 
      'Pending HOD': 'Approved'
    };
    
    // Terminal statuses that don't allow further actions
    const terminalStatuses = ['Approved', 'Rejected', 'Cancelled', 'Processing', 'Completed'];
    
    if (terminalStatuses.includes(currentStatus)) {
      return NextResponse.json({ 
        error: `Accommodation request is already in a terminal state: ${currentStatus}. No further actions allowed.` 
      }, { status: 400 });
    }
    
    let newStatus = currentStatus;
    
    if (action === 'approve') {
      // Move to next step in approval workflow
      const nextStep = approvalWorkflowSequence[currentStatus];
      newStatus = nextStep || 'Approved';
    } else if (action === 'reject') {
      newStatus = 'Rejected';
    } else if (action === 'cancel') {
      newStatus = 'Cancelled';
    }
    
    console.log(`API_ACCOM_REQ_ACTION_POST: Updating status from ${currentStatus} to ${newStatus} for request ${requestId}`);
    
    await sql`
      UPDATE travel_requests
      SET 
        status = ${newStatus},
        updated_at = NOW()
      WHERE id = ${requestId}
    `;
    
    console.log(`API_ACCOM_REQ_ACTION_POST: Status updated successfully`);
    
    // Add an approval step record (only for approve/reject actions)
    if (action !== 'cancel' && approverRole && approverName) {
      console.log(`API_ACCOM_REQ_ACTION_POST: Adding approval step for action ${action}`);
      await sql`
        INSERT INTO trf_approval_steps (trf_id, step_role, step_name, status, step_date, comments)
        VALUES (
          ${requestId}, 
          ${approverRole}, 
          ${approverName}, 
          ${action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Cancelled'}, 
          NOW(), 
          ${comments || (action === 'cancel' ? 'Cancelled by user/admin.' : (action === 'approve' ? 'Approved.' : 'Rejected.'))}
        )
      `;
      console.log(`API_ACCOM_REQ_ACTION_POST: Approval step added successfully`);
    }
    
    // Send notifications
    try {
      // Notify the requestor about status update
      if (accommodationRequest.staff_id) {
        // Get the user ID from staff_id
        const requestorUser = await sql`
          SELECT id FROM users WHERE staff_id = ${accommodationRequest.staff_id} LIMIT 1
        `;
        
        if (requestorUser.length > 0) {
          await NotificationService.createStatusUpdate({
            requestorId: requestorUser[0].id,
            status: newStatus,
            entityType: 'accommodation',
            entityId: requestId,
            approverName: approverName || 'Unknown',
            comments: comments || undefined
          });
        }
      }

      // If moving to next approval step, notify the next approver
      if (action === 'approve' && newStatus !== 'Approved') {
        // Map next status to specific approval permission
        const nextApproverPermission = newStatus === 'Pending Line Manager' ? 'approve_accommodation_manager' : 
                                     newStatus === 'Pending HOD' ? 'approve_accommodation_hod' : null;
        
        if (nextApproverPermission) {
          let approvers;
          
          // HODs can approve accommodation from any department, others are department-specific
          if (nextApproverPermission === 'approve_accommodation_hod') {
            approvers = await sql`
              SELECT u.id, u.name 
              FROM users u
              INNER JOIN role_permissions rp ON u.role_id = rp.role_id
              INNER JOIN permissions p ON rp.permission_id = p.id
              WHERE p.name = ${nextApproverPermission}
                AND u.status = 'Active'
            `;
          } else {
            approvers = await sql`
              SELECT u.id, u.name 
              FROM users u
              INNER JOIN role_permissions rp ON u.role_id = rp.role_id
              INNER JOIN permissions p ON rp.permission_id = p.id
              WHERE p.name = ${nextApproverPermission}
                AND u.department = ${accommodationRequest.department || 'Unknown'}
                AND u.status = 'Active'
            `;
          }

          for (const approver of approvers) {
            await NotificationService.createApprovalRequest({
              approverId: approver.id,
              requestorName: accommodationRequest.requestor_name || 'Unknown',
              entityType: 'accommodation',
              entityId: requestId,
              entityTitle: `Accommodation Request ${requestId}`
            });
          }
        }
      }
    } catch (notificationError) {
      console.error('Error sending notifications for accommodation action:', notificationError);
      // Don't fail the main operation due to notification errors
    }

    console.log(`API_ACCOM_REQ_ACTION_POST (PostgreSQL): Successfully ${action}ed accommodation request ${requestId}.`);
    
    const actionMessage = action === 'approve' 
      ? 'approved' 
      : action === 'reject'
      ? 'rejected'
      : 'cancelled';
    
    return NextResponse.json({ 
      message: `Accommodation request ${actionMessage} successfully.`,
      status: newStatus
    });

  } catch (error: any) {
    // Handle authentication/authorization errors
    if (error.message === 'UNAUTHORIZED') {
      const authError = createAuthError('UNAUTHORIZED');
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    
    if (error.message === 'FORBIDDEN') {
      const authError = createAuthError('FORBIDDEN');
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    console.error(`API_ACCOM_REQ_ACTION_POST_ERROR (PostgreSQL):`, error.message, error.stack);
    return NextResponse.json({ 
      error: 'Failed to process accommodation request.' 
    }, { status: 500 });
  }
}
