// src/app/api/trf/[trfId]/action/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import type { TravelRequestForm, TrfStatus } from '@/types/trf';

const actionSchema = z.object({
  action: z.enum(["approve", "reject", "cancel"]),
  comments: z.string().optional().nullable(),
  approverRole: z.string(), 
  approverName: z.string(), 
});

// Simplified workflow sequence
const approvalWorkflowSequence: Record<string, TrfStatus | null> = {
  "Pending Department Focal": "Pending Line Manager",
  "Pending Line Manager": "Pending HOD",
  "Pending HOD": "Approved", // Final approval step
};

const cancellableStatuses: TrfStatus[] = ["Pending Department Focal", "Pending Line Manager", "Pending HOD", "Draft"];
const terminalOrProcessingStatuses: TrfStatus[] = ["Approved", "Rejected", "Cancelled", "Processing Flights", "Processing Accommodation", "Awaiting Visa", "TRF Processed"];

function requiresHodApproval(trf: { travel_type?: string | null, estimated_cost?: number | string | null }): boolean {
  if (trf.travel_type === 'Overseas' || trf.travel_type === 'Home Leave Passage') {
    return true;
  }
  if (trf.estimated_cost && Number(trf.estimated_cost) > 1000) {
      return true;
  }
  return false; 
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ trfId: string }> }) {
  // Properly await params to fix the Next.js warning
      const { trfId } = await params;
  console.log(`API_TRF_ACTION_POST_START (PostgreSQL): Action for TRF ${trfId}.`);
  if (!sql) {
    console.error("API_TRF_ACTION_POST_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const validationResult = actionSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("API_TRF_ACTION_POST_VALIDATION_ERROR (PostgreSQL):", validationResult.error.flatten());
      return NextResponse.json({ error: "Validation failed for action", details: validationResult.error.flatten() }, { status: 400 });
    }
    const { action, comments, approverRole, approverName } = validationResult.data;
    
    const [currentTrf] = await sql`SELECT id, status, travel_type, estimated_cost, requestor_name, external_full_name FROM travel_requests WHERE id = ${trfId}`;

    if (!currentTrf) {
      return NextResponse.json({ error: "TRF not found" }, { status: 404 });
    }
    const currentTrfStatus = currentTrf.status as TrfStatus;
    const requestorEmailVal = currentTrf.email || (currentTrf.travel_type === 'External Parties' ? `${currentTrf.external_full_name}@external.com` : `${currentTrf.requestor_name}@example.com`);


    if (terminalOrProcessingStatuses.includes(currentTrfStatus)) {
        console.log(`API_TRF_ACTION_POST (PostgreSQL): TRF ${trfId} is already in a terminal/processing state: ${currentTrfStatus}. No action taken.`);
        return NextResponse.json({ error: `TRF is already in a terminal or processing state: ${currentTrfStatus}. No further actions allowed.` }, { status: 400 });
    }
    
    // Placeholder for RBAC: Verify if approverRole can perform 'action' on currentTrfStatus
    // e.g., if (currentTrfStatus === "Pending Department Focal" && approverRole !== "Department Focal") return 403;

    let nextStatus: TrfStatus = currentTrfStatus;
    let notificationMessage = "";
    let nextNotificationRecipient = "Requestor";

    if (action === "approve") {
      // Conceptual RBAC check for mock
      // if (currentTrfStatus === "Pending Department Focal" && approverRole !== "Department Focal" && approverRole !== "Admin Approver") { /* ... */ }

      let nextStepInSequence = approvalWorkflowSequence[currentTrfStatus];
      
      if (nextStepInSequence === "Pending HOD" && !requiresHodApproval(currentTrf)) {
        nextStatus = "Approved"; 
        nextNotificationRecipient = `Admin Teams (Flights/Accommodation) & Requestor`;
      } else if (nextStepInSequence) {
        nextStatus = nextStepInSequence;
        if (nextStatus !== "Approved") {
            nextNotificationRecipient = `Next Approver (${nextStatus}) & Requestor`;
        } else {
            nextNotificationRecipient = `Admin Teams (Flights/Accommodation) & Requestor`;
        }
      } else if (currentTrfStatus === "Pending HOD" && requiresHodApproval(currentTrf)){ // If it was pending HOD and HOD approved
        nextStatus = "Approved";
        nextNotificationRecipient = `Admin Teams (Flights/Accommodation) & Requestor`;
      } else {
        // If no next step (e.g. already approved, or unhandled status for approval)
        // or if it's an unrecognised status to approve from, we might keep current or error.
        // For simplicity, if it's an unknown approval step, let's default to Approved.
        // This should ideally be caught by the RBAC/workflow engine.
        console.warn(`API_TRF_ACTION_POST (PostgreSQL): Approving TRF ${trfId} from status ${currentTrfStatus} which has no defined next step or requires HOD but isn't. Setting to Approved.`);
        nextStatus = "Approved";
        nextNotificationRecipient = `Admin Teams (Flights/Accommodation) & Requestor`;
      }
      notificationMessage = `Your TRF (${trfId}) has been approved by ${approverName} (${approverRole}) and is now ${nextStatus}.`;

    } else if (action === "reject") {
      if (!comments || comments.trim() === "") {
        return NextResponse.json({ error: "Rejection comments are required." }, { status: 400 });
      }
      nextStatus = "Rejected";
      notificationMessage = `Your TRF (${trfId}) has been rejected by ${approverName} (${approverRole}). Reason: ${comments}`;
      nextNotificationRecipient = `Requestor`;
    } else if (action === "cancel") {
      if (!cancellableStatuses.includes(currentTrfStatus)) {
        return NextResponse.json({ error: `TRF with status ${currentTrfStatus} cannot be cancelled.` }, { status: 400 });
      }
      nextStatus = "Cancelled";
      notificationMessage = `Your TRF (${trfId}) has been cancelled.`;
      nextNotificationRecipient = `Requestor & Relevant Approvers`;
    } else {
      return NextResponse.json({ error: "Invalid action specified." }, { status: 400 });
    }
    
    // Fix the iterable error by handling the transaction result properly
    const result = await sql.begin(async tx => {
        const updatedTrfResult = await tx`
            UPDATE travel_requests
            SET status = ${nextStatus}, updated_at = NOW()
            WHERE id = ${trfId}
            RETURNING *
        `;
        await tx`
            INSERT INTO trf_approval_steps (trf_id, step_role, step_name, status, step_date, comments)
            VALUES (${trfId}, ${approverRole}, ${approverName}, ${action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "Cancelled"}, NOW(), ${comments || (action === "cancel" ? "Cancelled by user/admin." : (action === "approve" ? "Approved." : ""))})
        `;
        return updatedTrfResult;
    });
    
    // Safely extract the first result
    const updated = result && result.length > 0 ? result[0] : null;
    
    if (!updated) {
      console.error(`API_TRF_ACTION_POST_ERROR (PostgreSQL): Failed to update TRF ${trfId}`);
      return NextResponse.json({ error: 'Failed to update TRF' }, { status: 500 });
    }
    
    const finalNotificationLog = `Placeholder: Send Notification - TRF ${trfId} - Action: ${action.toUpperCase()} by ${approverName} (${approverRole}). Old Status: ${currentTrfStatus}. New Status: ${updated.status}. Comments: ${comments || 'N/A'}. Notify ${nextNotificationRecipient}. To Requestor (${requestorEmailVal}): "${notificationMessage}"`;
    console.log(finalNotificationLog);

    return NextResponse.json({ message: `TRF ${action}ed successfully.`, trf: updated });

  } catch (error: any) {
    console.error(`API_TRF_ACTION_POST_ERROR (PostgreSQL) for TRF ${trfId}:`, error.message, error.stack);
    return NextResponse.json({ error: `Failed to perform action on TRF.`, details: error.message }, { status: 500 });
  }
}
