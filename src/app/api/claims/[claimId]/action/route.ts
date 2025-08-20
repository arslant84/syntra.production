// src/app/api/claims/[claimId]/action/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { NotificationService } from '@/lib/notification-service';
import { UnifiedNotificationService } from '@/lib/unified-notification-service';

// Placeholder for claim actions
const claimActionSchema = z.object({
  action: z.enum(["approve", "verify", "approve_manager", "approve_hod", "approve_finance", "reject", "process_payment"]),
  comments: z.string().optional().nullable(),
  approverRole: z.string().optional(),
  approverName: z.string().optional()
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  // Ensure params is awaited before accessing its properties
      const { claimId } = await params;
  console.log(`API_CLAIMS_ACTION_POST_START (PostgreSQL): Action for claim ${claimId}.`);
  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const validationResult = claimActionSchema.safeParse(body);
    if (!validationResult.success) {
        return NextResponse.json({ error: "Validation failed", details: validationResult.error.flatten()}, { status: 400 });
    }
    const { action, comments } = validationResult.data;

    const [currentClaim] = await sql`SELECT id, status FROM expense_claims WHERE id = ${claimId}`;
    if (!currentClaim) {
        return NextResponse.json({ error: "Claim not found"}, { status: 404 });
    }

    let nextStatus = currentClaim.status;
    let effectiveAction = action;
    
    // Handle generic 'approve' action by mapping it to the appropriate specific action based on the current status
    if (action === "approve") {
      if (currentClaim.status === "Pending Department Focal") effectiveAction = "approve";
      else if (currentClaim.status === "Pending Verification") effectiveAction = "verify"; // Legacy support
      else if (currentClaim.status === "Pending Line Manager") effectiveAction = "approve_manager";
      else if (currentClaim.status === "Pending HOD" || currentClaim.status === "Pending HOD Approval") effectiveAction = "approve_hod";
      else if (currentClaim.status === "Pending Finance Approval") effectiveAction = "approve_finance"; // Legacy - will be removed
      else if (currentClaim.status === "Approved") effectiveAction = "process_payment";
      else {
        return NextResponse.json({ error: `Cannot approve claim in status '${currentClaim.status}'`}, {status: 400});
      }
    }
    
    // Standard workflow following TSR pattern
    if (effectiveAction === "approve" && currentClaim.status === "Pending Department Focal") nextStatus = "Pending Line Manager";
    else if (effectiveAction === "verify" && currentClaim.status === "Pending Verification") nextStatus = "Pending Line Manager"; // Legacy support
    else if (effectiveAction === "approve_manager" && currentClaim.status === "Pending Line Manager") nextStatus = "Pending HOD";
    else if (effectiveAction === "approve_hod" && (currentClaim.status === "Pending HOD" || currentClaim.status === "Pending HOD Approval")) nextStatus = "Approved";
    else if (effectiveAction === "approve_finance" && currentClaim.status === "Pending Finance Approval") nextStatus = "Approved"; // Legacy support
    else if (effectiveAction === "process_payment" && currentClaim.status === "Approved") nextStatus = "Processed";
    else if (effectiveAction === "reject") nextStatus = "Rejected";
    else {
        // Invalid action for current status
        return NextResponse.json({ error: `Action '${effectiveAction}' not allowed for current status '${currentClaim.status}'`}, {status: 400});
    }

    const [updatedClaim] = await sql`
        UPDATE expense_claims 
        SET status = ${nextStatus}, updated_at = NOW() 
        WHERE id = ${claimId}
        RETURNING *
    `;
    
    // Log the approval action in claims_approval_steps table (matches TSR pattern)
    const approverRole = validationResult.data.approverRole || 'System';
    const approverName = validationResult.data.approverName || 'Admin';
    
    // Map action to proper approval status
    let approvalStatus = "Pending";
    if (effectiveAction === "approve" && currentClaim.status === "Pending Department Focal") approvalStatus = "Approved";
    else if (effectiveAction === "verify") approvalStatus = "Verified";
    else if (effectiveAction === "approve_hod") approvalStatus = "Approved"; 
    else if (effectiveAction === "approve_finance") approvalStatus = "Approved";
    else if (effectiveAction === "process_payment") approvalStatus = "Processed";
    else if (action === "reject") approvalStatus = "Rejected";
    else if (action === "approve") approvalStatus = "Approved";
    
    const approvalComments = comments || 
      (effectiveAction === "approve" && currentClaim.status === "Pending Department Focal" ? "Approved by Department Focal." :
       effectiveAction === "verify" ? "Verified." :
       effectiveAction === "approve_hod" ? "Approved by HOD." :
       effectiveAction === "approve_finance" ? "Approved by Finance." :
       effectiveAction === "process_payment" ? "Payment processed." :
       action === "reject" ? "Rejected." : 
       "Approved.");
    
    await sql`
        INSERT INTO claims_approval_steps (claim_id, step_role, step_name, status, step_date, comments)
        VALUES (${claimId}, ${approverRole}, ${approverName}, ${approvalStatus}, NOW(), ${approvalComments})
    `;

    // Create notifications for claim action
    try {
      // Get the claim requestor information
      const claimDetails = await sql`
        SELECT staff_name, staff_no, department_code 
        FROM expense_claims 
        WHERE id = ${claimId}
      `;

      if (claimDetails.length > 0) {
        const claimInfo = claimDetails[0];
        
        // Notify the requestor about status update
        const requestorUser = await sql`
          SELECT id FROM users 
          WHERE staff_id = ${claimInfo.staff_no} OR name = ${claimInfo.staff_name}
          LIMIT 1
        `;
        
        if (requestorUser.length > 0) {
          await NotificationService.createStatusUpdate({
            requestorId: requestorUser[0].id,
            status: updatedClaim.status,
            entityType: 'claim',
            entityId: claimId,
            approverName: validationResult.data.approverName || 'System',
            comments: comments || undefined
          });
        }

        // Send comprehensive workflow notifications based on action
        if (action === 'reject') {
          // Handle rejection notification
          await UnifiedNotificationService.notifyRejection({
            entityType: 'claims',
            entityId: claimId,
            requestorId: requestorUser[0]?.id || '',
            requestorName: claimInfo.staff_name,
            requestorEmail: requestorUser[0]?.email || '',
            approverName: validationResult.data.approverName || 'System',
            approverRole: validationResult.data.approverRole || 'Approver',
            rejectionReason: comments || 'No reason provided',
            entityTitle: `${claimInfo.document_type || 'Expense Claim'} - ${claimInfo.purpose_of_claim}`
          });
        } else {
          // Handle approval notification (includes progression to next step)
          await UnifiedNotificationService.notifyApproval({
            entityType: 'claims',
            entityId: claimId,
            requestorId: requestorUser[0]?.id || '',
            requestorName: claimInfo.staff_name,
            requestorEmail: requestorUser[0]?.email || '',
            currentStatus: nextStatus,
            previousStatus: currentClaim.status,
            approverName: validationResult.data.approverName || 'System',
            approverRole: validationResult.data.approverRole || 'Approver',
            nextApprover: nextStatus === 'Pending HOD Approval' ? 'HOD' : 
                         nextStatus === 'Pending Finance Approval' ? 'Finance' : 
                         nextStatus === 'Approved' ? 'Completed' : 'Next Approver',
            entityTitle: `${claimInfo.document_type || 'Expense Claim'} - ${claimInfo.purpose_of_claim}`,
            comments: comments
          });
        }

        console.log(`Created notifications for claim ${claimId} ${effectiveAction} action`);
      }
    } catch (notificationError) {
      console.error(`Failed to create notifications for claim ${claimId}:`, notificationError);
      // Don't fail the claim action due to notification errors
    }

    console.log(`API_CLAIMS_ACTION_POST (PostgreSQL): Claim ${claimId} action '${action}' processed. New status: ${updatedClaim.status}`);
    return NextResponse.json({ message: `Claim action '${action}' processed.`, claim: updatedClaim });

  } catch (error: any) {
    console.error(`API_CLAIMS_ACTION_POST_ERROR (PostgreSQL) for claim ${claimId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to process claim action.', details: error.message }, { status: 500 });
  }
}
