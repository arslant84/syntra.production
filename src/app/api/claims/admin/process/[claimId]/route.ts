import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { UnifiedNotificationService } from '@/lib/unified-notification-service';

const processClaimSchema = z.object({
  action: z.enum(["process", "complete"]),
  reimbursementDetails: z.object({
    paymentMethod: z.string().optional(),
    bankTransferReference: z.string().optional(), 
    chequeNumber: z.string().optional(),
    paymentDate: z.string().optional(),
    amountPaid: z.number().optional(),
    taxDeducted: z.number().optional(),
    netAmount: z.number().optional(),
    processingNotes: z.string().optional(),
    verifiedBy: z.string().optional(),
    authorizedBy: z.string().optional()
  }).optional(),
  comments: z.string().optional()
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params;
  console.log(`API_CLAIMS_ADMIN_PROCESS_POST_START: Processing claim ${claimId}.`);
  
  // Check if user has permission to process claims
  if (!await hasPermission('process_claims') && !await hasPermission('manage_claims')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }
  
  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const validationResult = processClaimSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("API_CLAIMS_ADMIN_PROCESS_POST_VALIDATION_ERROR:", validationResult.error.flatten());
      return NextResponse.json({ error: "Validation failed for claim processing", details: validationResult.error.flatten() }, { status: 400 });
    }
    
    const { action, reimbursementDetails, comments } = validationResult.data;

    const [currentClaim] = await sql`SELECT id, status, staff_name FROM expense_claims WHERE id = ${claimId}`;
    if (!currentClaim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    // Only allow processing if status is "Approved" or "Processing with Claims Admin"
    if (currentClaim.status !== 'Approved' && currentClaim.status !== 'Processing with Claims Admin') {
      return NextResponse.json({ error: `Cannot process claim with status: ${currentClaim.status}` }, { status: 400 });
    }

    let nextStatus = currentClaim.status;
    let stepStatus = "Processed";
    let notificationMessage = "";

    if (action === "process") {
      // Claims admin starts processing
      nextStatus = "Processing with Claims Admin";
      stepStatus = "Processing";
      notificationMessage = `Your expense claim (${claimId}) is now being processed by Claims Admin.`;
    } else if (action === "complete") {
      // Claims admin completes processing with reimbursement details
      if (!reimbursementDetails) {
        return NextResponse.json({ error: "Reimbursement details are required when completing claim processing" }, { status: 400 });
      }
      nextStatus = "Processed";
      stepStatus = "Completed";
      notificationMessage = `Your expense claim (${claimId}) has been completed. Reimbursement details have been finalized.`;
    }

    const result = await sql.begin(async tx => {
      // Update claim status
      const updateFields: any = {
        status: nextStatus,
        updated_at: 'NOW()'
      };

      // Set processing timestamps
      if (action === "process") {
        updateFields.processing_started_at = 'NOW()';
      } else if (action === "complete") {
        updateFields.reimbursement_completed_at = 'NOW()';
      }

      // If completing, update reimbursement details
      if (action === "complete" && reimbursementDetails) {
        const reimbursementDetailsJson = JSON.stringify(reimbursementDetails);
        const [updatedClaim] = await tx`
          UPDATE expense_claims
          SET status = ${nextStatus}, 
              updated_at = NOW(), 
              reimbursement_details = ${reimbursementDetailsJson},
              reimbursement_completed_at = NOW()
          WHERE id = ${claimId}
          RETURNING *
        `;
        
        // Add approval step
        await tx`
          INSERT INTO claims_approval_steps (claim_id, step_role, step_name, status, step_date, comments)
          VALUES (${claimId}, 'Claims Admin', 'Claims Admin', ${stepStatus}, NOW(), ${comments || `Claim ${action}ed with reimbursement details`})
        `;
        
        return updatedClaim;
      } else {
        const [updatedClaim] = await tx`
          UPDATE expense_claims
          SET status = ${nextStatus}, 
              updated_at = NOW(),
              processing_started_at = NOW()
          WHERE id = ${claimId}
          RETURNING *
        `;
        
        // Add approval step
        await tx`
          INSERT INTO claims_approval_steps (claim_id, step_role, step_name, status, step_date, comments)
          VALUES (${claimId}, 'Claims Admin', 'Claims Admin', ${stepStatus}, NOW(), ${comments || `Claim ${action}ed`})
        `;
        
        return updatedClaim;
      }
    });

    const updated = result && result.length > 0 ? result[0] : result;
    
    if (!updated) {
      console.error(`API_CLAIMS_ADMIN_PROCESS_POST_ERROR: Failed to update claim ${claimId}`);
      return NextResponse.json({ error: 'Failed to update claim' }, { status: 500 });
    }
    
    // Send enhanced workflow notifications
    try {
      // Get claim details including claimant information
      const claimDetails = await sql`
        SELECT ec.created_by, ec.staff_name, ec.department_code, ec.purpose_of_claim, u.email, u.id as user_id
        FROM expense_claims ec
        LEFT JOIN users u ON ec.created_by = u.id
        WHERE ec.id = ${claimId}
      `;

      if (claimDetails.length > 0) {
        const claimInfo = claimDetails[0];
        
        // Send 5-stage workflow notification
        if (action === 'complete') {
          // This is the final admin completion stage
          await UnifiedNotificationService.notifyAdminCompletion({
            entityType: 'claim',
            entityId: claimId,
            requestorId: claimInfo.user_id,
            requestorName: claimInfo.staff_name || 'User',
            requestorEmail: claimInfo.email,
            adminName: 'Claims Admin',
            entityTitle: claimInfo.purpose_of_claim || `Expense Claim ${claimId}`,
            completionDetails: comments || 'Claim processing completed with reimbursement details',
            claimPurpose: claimInfo.purpose_of_claim || 'General'
          });
        } else {
          // For processing, notify status change
          await UnifiedNotificationService.notifyStatusUpdate({
            entityType: 'claim',
            entityId: claimId,
            requestorId: claimInfo.user_id,
            requestorName: claimInfo.staff_name || 'User',
            requestorEmail: claimInfo.email,
            newStatus: updated.status,
            previousStatus: currentClaim.status,
            updateReason: 'Claim processing started by admin',
            entityTitle: claimInfo.purpose_of_claim || `Expense Claim ${claimId}`,
            claimPurpose: claimInfo.purpose_of_claim || 'General'
          });
        }

        console.log(`✅ Created enhanced workflow notifications for claim ${claimId} ${action} by Claims Admin`);
      }
    } catch (notificationError) {
      console.error(`❌ Failed to create enhanced workflow notifications for claim ${claimId}:`, notificationError);
      // Don't fail the claim action due to notification errors
    }

    console.log(`API_CLAIMS_ADMIN_PROCESS_POST: Claim ${claimId} ${action} processed. New status: ${updated.status}`);
    
    return NextResponse.json({ 
      message: `Claim ${action}ed successfully.`, 
      claim: updated,
      reimbursementDetails: action === "complete" ? reimbursementDetails : undefined
    });

  } catch (error: any) {
    console.error(`API_CLAIMS_ADMIN_PROCESS_POST_ERROR for claim ${claimId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to process claim.', details: error.message }, { status: 500 });
  }
}