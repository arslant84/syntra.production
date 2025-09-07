// src/app/api/claims/[claimId]/action/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { NotificationService } from '@/lib/notification-service';
import { UnifiedNotificationService } from '@/lib/unified-notification-service';
import { formatCurrency } from '@/lib/currency-utils';

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
    
    // Updated workflow: Department Focal → Line Manager → HOD → Claims Admin (direct processing like transport)
    if (effectiveAction === "approve" && currentClaim.status === "Pending Department Focal") nextStatus = "Pending Line Manager";
    else if (effectiveAction === "verify" && currentClaim.status === "Pending Verification") nextStatus = "Pending Line Manager"; // Legacy support
    else if (effectiveAction === "approve_manager" && currentClaim.status === "Pending Line Manager") nextStatus = "Pending HOD";
    else if (effectiveAction === "approve_hod" && (currentClaim.status === "Pending HOD" || currentClaim.status === "Pending HOD Approval")) nextStatus = "Processing with Claims Admin"; // Like transport: go directly to Claims Admin
    else if (effectiveAction === "approve_finance" && currentClaim.status === "Pending Finance Approval") nextStatus = "Processing with Claims Admin"; // Legacy support - redirect to Claims Admin
    else if (effectiveAction === "process_payment" && (currentClaim.status === "Approved" || currentClaim.status === "Processing with Claims Admin")) nextStatus = "Processed"; // Claims Admin processes
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

    // Return response immediately, then process notifications asynchronously
    const response = NextResponse.json({ 
      message: `Claim action '${action}' processed.`, 
      claim: updatedClaim 
    });

    // Send enhanced workflow notifications using unified system (like transport requests)
    try {
      // Get claim details including requestor information
      const claimDetails = await sql`
        SELECT ec.created_by, ec.staff_name, ec.department_code, ec.purpose_of_claim, ec.document_number, ec.total_advance_claim_amount, u.email, u.id as user_id
        FROM expense_claims ec
        LEFT JOIN users u ON ec.created_by = u.id OR u.staff_id = ec.staff_no OR u.name = ec.staff_name
        WHERE ec.id = ${claimId}
        LIMIT 1
      `;

      if (claimDetails.length > 0) {
        const claimInfo = claimDetails[0];
        
        // Send unified workflow notification based on action
        if (action === 'reject') {
          // Handle rejection notification
          await UnifiedNotificationService.notifyRejection({
            entityType: 'claims',
            entityId: claimInfo.document_number || claimId,
            requestorId: claimInfo.user_id || '',
            requestorName: claimInfo.staff_name,
            requestorEmail: claimInfo.email,
            department: claimInfo.department_code || 'Unknown',
            approverName: validationResult.data.approverName || 'System',
            approverRole: validationResult.data.approverRole || 'Approver',
            rejectionReason: comments || 'No reason provided',
            entityTitle: `Expense Claim - ${claimInfo.purpose_of_claim || 'General'}`,
            entityAmount: claimInfo.total_advance_claim_amount ? formatCurrency(claimInfo.total_advance_claim_amount, 'USD', false) : formatCurrency(0, 'USD', false)
          });
        } else if (nextStatus === 'Processing with Claims Admin' && currentClaim.status === "Pending HOD") {
          // HOD approved - send TWO notifications:
          // 1. To Claims Admin for processing (like transport workflow)
          await UnifiedNotificationService.notifyApproval({
            entityType: 'claims',
            entityId: claimInfo.document_number || claimId,
            requestorId: claimInfo.user_id || '',
            requestorName: claimInfo.staff_name,
            requestorEmail: claimInfo.email,
            department: claimInfo.department_code || 'Unknown',
            currentStatus: nextStatus,
            previousStatus: currentClaim.status,
            approverName: validationResult.data.approverName || 'HOD',
            approverRole: validationResult.data.approverRole || 'HOD',
            entityTitle: `Expense Claim - ${claimInfo.purpose_of_claim || 'General'}`,
            entityAmount: claimInfo.total_advance_claim_amount ? formatCurrency(claimInfo.total_advance_claim_amount, 'USD', false) : formatCurrency(0, 'USD', false),
            comments: comments,
            // Add purpose for claims
            ...(claimInfo.purpose_of_claim && { claimPurpose: claimInfo.purpose_of_claim })
          });

          // 2. SEPARATE notification directly to requestor about the approval
          await UnifiedNotificationService.sendWorkflowNotification({
            eventType: 'claims_hod_approved_to_requestor',
            entityType: 'claims',
            entityId: claimInfo.document_number || claimId,
            requestorId: claimInfo.user_id || '',
            requestorName: claimInfo.staff_name,
            requestorEmail: claimInfo.email,
            department: claimInfo.department_code || 'Unknown',
            currentStatus: nextStatus,
            previousStatus: currentClaim.status,
            approverName: validationResult.data.approverName || 'HOD',
            approverRole: validationResult.data.approverRole || 'HOD',
            entityTitle: `Expense Claim - ${claimInfo.purpose_of_claim || 'General'}`,
            entityAmount: claimInfo.total_advance_claim_amount ? formatCurrency(claimInfo.total_advance_claim_amount, 'USD', false) : formatCurrency(0, 'USD', false),
            comments: comments,
            claimPurpose: claimInfo.purpose_of_claim || 'General'
          });
        } else if (nextStatus === 'Processed') {
          // Finance Admin completed processing - send completion notification to requestor only
          await UnifiedNotificationService.notifyAdminCompletion({
            entityType: 'claims',
            entityId: claimInfo.document_number || claimId,
            requestorId: claimInfo.user_id || '',
            requestorName: claimInfo.staff_name,
            requestorEmail: claimInfo.email,
            adminName: validationResult.data.approverName || 'Finance Admin',
            entityTitle: `Expense Claim - ${claimInfo.purpose_of_claim || 'General'}`,
            completionDetails: comments || 'Your expense claim has been processed and payment is being arranged'
          });
        } else {
          // Handle approval progression notifications (like transport workflow)
          await UnifiedNotificationService.notifyApproval({
            entityType: 'claims',
            entityId: claimInfo.document_number || claimId,
            requestorId: claimInfo.user_id || '',
            requestorName: claimInfo.staff_name,
            requestorEmail: claimInfo.email,
            department: claimInfo.department_code || 'Unknown',
            currentStatus: nextStatus,
            previousStatus: currentClaim.status,
            approverName: validationResult.data.approverName || 'System',
            approverRole: validationResult.data.approverRole || 'Approver',
            entityTitle: `Expense Claim - ${claimInfo.purpose_of_claim || 'General'}`,
            entityAmount: claimInfo.total_advance_claim_amount ? formatCurrency(claimInfo.total_advance_claim_amount, 'USD', false) : formatCurrency(0, 'USD', false),
            comments: comments,
            // Add purpose for claims
            ...(claimInfo.purpose_of_claim && { claimPurpose: claimInfo.purpose_of_claim })
          });
        }

        console.log(`✅ CLAIM_UNIFIED_NOTIFICATION: Successfully sent unified notifications for claim ${claimId} ${effectiveAction} action`);
      }
    } catch (notificationError) {
      console.error(`❌ CLAIM_UNIFIED_NOTIFICATION: Failed to send unified notifications for claim ${claimId}:`, notificationError);
      // Don't fail the claim action due to notification errors
    }

    console.log(`API_CLAIMS_ACTION_POST (PostgreSQL): Claim ${claimId} action '${action}' processed. New status: ${updatedClaim.status}`);
    return response;

  } catch (error: any) {
    console.error(`API_CLAIMS_ACTION_POST_ERROR (PostgreSQL) for claim ${claimId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to process claim action.', details: error.message }, { status: 500 });
  }
}
