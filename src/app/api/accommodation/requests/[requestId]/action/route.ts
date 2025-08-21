// src/app/api/accommodation/requests/[requestId]/action/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { z } from 'zod';
import { hasPermission } from '@/lib/permissions';
import { NotificationService } from '@/lib/notification-service';
import { EnhancedWorkflowNotificationService } from '@/lib/enhanced-workflow-notification-service';

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
    // Check if user has permission to approve accommodation requests
    if (!await hasPermission('approve_accommodation_requests')) {
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    }

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
    
    // Send enhanced workflow notifications
    try {
      // Get accommodation request details including requestor information
      const accommodationDetails = await sql`
        SELECT tr.staff_id, tr.requestor_name, u.email, u.id as user_id, u.department
        FROM travel_requests tr
        LEFT JOIN users u ON (tr.staff_id = u.staff_id OR tr.staff_id = u.id OR tr.staff_id = u.email)
        WHERE tr.id = ${requestId}
      `;

      if (accommodationDetails.length > 0) {
        const accommodationInfo = accommodationDetails[0];
        
        // Send enhanced workflow notification for status change
        await EnhancedWorkflowNotificationService.sendStatusChangeNotification({
          entityType: 'accommodation',
          entityId: requestId,
          requestorName: accommodationInfo.requestor_name || 'User',
          requestorEmail: accommodationInfo.email,
          requestorId: accommodationInfo.user_id,
          department: accommodationInfo.department,
          purpose: 'Accommodation request',
          newStatus: newStatus,
          approverName: approverName || 'Administrator',
          comments: comments
        });

        console.log(`✅ Created enhanced workflow notifications for accommodation ${requestId} ${action} by ${approverName || 'Administrator'}`);
      }
    } catch (notificationError) {
      console.error(`❌ Failed to create enhanced workflow notifications for accommodation ${requestId}:`, notificationError);
      // Don't fail the accommodation action due to notification errors
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
    console.error(`API_ACCOM_REQ_ACTION_POST_ERROR (PostgreSQL):`, error.message, error.stack);
    return NextResponse.json({ 
      error: 'Failed to process accommodation request.' 
    }, { status: 500 });
  }
}
