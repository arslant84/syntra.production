// src/app/api/trf/[trfId]/action/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import type { TravelRequestForm, TrfStatus } from '@/types/trf';
import { NotificationService } from '@/lib/notification-service';
import { UnifiedNotificationService } from '@/lib/unified-notification-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { generateRequestFingerprint, checkAndMarkRequest, markRequestCompleted } from '@/lib/request-deduplication';

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
  // All travel requests require HOD approval regardless of type or cost
  return true;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ trfId: string }> }) {
  // Properly await params to fix the Next.js warning
      const { trfId } = await params;
  console.log(`API_TRF_ACTION_POST_START (PostgreSQL): Action for TRF ${trfId}.`);
  if (!sql) {
    console.error("API_TRF_ACTION_POST_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  let requestFingerprint: string | undefined;

  try {
    const body = await request.json();
    const validationResult = actionSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("API_TRF_ACTION_POST_VALIDATION_ERROR (PostgreSQL):", validationResult.error.flatten());
      return NextResponse.json({ error: "Validation failed for action", details: validationResult.error.flatten() }, { status: 400 });
    }
    const { action, comments, approverRole, approverName } = validationResult.data;

    // Check for duplicate action submission using request deduplication
    requestFingerprint = generateRequestFingerprint(
      trfId,
      'trf_action',
      {
        action: action,
        approverRole: approverRole,
        approverName: approverName,
        timestamp: Date.now().toString()
      }
    );

    const deduplicationResult = checkAndMarkRequest(requestFingerprint, 15000); // 15 seconds TTL for actions
    if (deduplicationResult.isDuplicate) {
      console.warn(`API_TRF_ACTION_POST_DUPLICATE: Duplicate TRF action detected for ${trfId}. Time remaining: ${deduplicationResult.timeRemaining}s`);
      return NextResponse.json({ 
        error: 'Duplicate action detected', 
        message: `Please wait ${deduplicationResult.timeRemaining} seconds before trying again.`,
        details: 'This action was recently performed. To prevent duplicates, please wait before trying again.'
      }, { status: 429 });
    }
    
    const [currentTrf] = await sql`SELECT id, status, travel_type, estimated_cost, requestor_name, external_full_name FROM travel_requests WHERE id = ${trfId}`;

    if (!currentTrf) {
      return NextResponse.json({ error: "TRF not found" }, { status: 404 });
    }
    const currentTrfStatus = currentTrf.status as TrfStatus;
    const requestorEmailVal = currentTrf.email || (currentTrf.travel_type === 'External Parties' ? `${currentTrf.external_full_name}@external.com` : `${currentTrf.requestor_name}@example.com`);


    // Allow flight admin to reject approved TSRs when no flights are available
    const isFlightAdminRejectingApproved = action === "reject" && currentTrfStatus === "Approved" && approverRole === "Flight Admin";
    
    if (terminalOrProcessingStatuses.includes(currentTrfStatus) && !isFlightAdminRejectingApproved) {
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

    // Mark deduplication request as completed (successful action)
    markRequestCompleted(requestFingerprint);
    
    // Return response immediately, then process notifications asynchronously
    const response = NextResponse.json({ message: `TRF ${action}ed successfully.`, trf: updated });

    // Process notifications asynchronously (non-blocking)
    setImmediate(async () => {
      try {
        console.log(`🔔 TRF_ACTION_NOTIFICATION: Starting async notification process for TRF ${trfId} ${action}`);
        
        // Create enhanced workflow notifications with approval confirmation
        const session = await getServerSession(authOptions);
        
        // Get TRF details including requestor information and travel dates
        const trfDetails = await sql`
          SELECT tr.staff_id, tr.requestor_name, tr.department, tr.purpose, tr.estimated_cost, u.email, u.id as user_id,
                 MIN(its.segment_date) as start_date, MAX(its.segment_date) as end_date
          FROM travel_requests tr
          LEFT JOIN users u ON (tr.staff_id = u.staff_id OR tr.staff_id = u.id OR tr.staff_id = u.email)
          LEFT JOIN trf_itinerary_segments its ON tr.id = its.trf_id
          WHERE tr.id = ${trfId}
          GROUP BY tr.staff_id, tr.requestor_name, tr.department, tr.purpose, tr.estimated_cost, u.email, u.id
        `;

        if (trfDetails.length > 0) {
          const trfInfo = trfDetails[0];
          
          // Determine next approver
          const nextApprover = updated.status === 'Pending Line Manager' ? 'Line Manager' :
                             updated.status === 'Pending HOD' ? 'HOD' :
                             updated.status === 'Approved' ? 'Completed' : 'Processing';
          
          if (action === 'approve') {
            // Send approval notification (includes confirmation to approver)
            await UnifiedNotificationService.notifyApproval({
              entityType: 'trf',
              entityId: trfId,
              requestorId: trfInfo.user_id,
              requestorName: trfInfo.requestor_name || 'User',
              requestorEmail: trfInfo.email,
              department: trfInfo.department,
              currentStatus: updated.status,
              previousStatus: currentTrf.status,
              approverName: approverName,
              approverRole: approverRole,
              approverId: session?.user?.id,
              approverEmail: session?.user?.email,
              nextApprover: nextApprover,
              entityTitle: `Travel Request - ${trfInfo.purpose || 'Business Travel'}`,
              entityAmount: trfInfo.estimated_cost ? trfInfo.estimated_cost.toString() : '',
              entityDates: trfInfo.start_date && trfInfo.end_date 
                ? `${trfInfo.start_date} to ${trfInfo.end_date}` 
                : trfInfo.start_date 
                ? `From ${trfInfo.start_date}` 
                : '',
              travelPurpose: trfInfo.purpose || 'Business Travel',
              comments: comments
            });
          } else if (action === 'reject') {
            // Send rejection notification
            await UnifiedNotificationService.notifyRejection({
              entityType: 'trf',
              entityId: trfId,
              requestorId: trfInfo.user_id,
              requestorName: trfInfo.requestor_name || 'User',
              requestorEmail: trfInfo.email,
              department: trfInfo.department,
              approverName: approverName,
              approverRole: approverRole,
              rejectionReason: comments || 'No reason provided',
              entityTitle: `Travel Request - ${trfInfo.purpose || 'Business Travel'}`,
              travelPurpose: trfInfo.purpose || 'Business Travel',
              travelDates: trfInfo.start_date && trfInfo.end_date 
                ? `${trfInfo.start_date} to ${trfInfo.end_date}` 
                : trfInfo.start_date 
                ? `From ${trfInfo.start_date}` 
                : 'Not specified'
            });
          }
          
          // REMOVED: Legacy enhanced workflow notification to prevent duplicates
          // Only using UnifiedNotificationService now for clean, single email per stage
        }

        console.log(`✅ TRF_ACTION_NOTIFICATION: Sent async workflow notifications for TRF ${trfId} ${action} by ${approverName}`);
      } catch (notificationError) {
        console.error(`❌ TRF_ACTION_NOTIFICATION: Error sending async notifications for TRF ${trfId}:`, notificationError);
        // Notification failures don't affect the completed action
      }
    });

    console.log(`API_TRF_ACTION_POST (PostgreSQL): TRF ${trfId} ${action} completed successfully`);
    return response;

  } catch (error: any) {
    // Clean up deduplication on error
    if (requestFingerprint) {
      markRequestCompleted(requestFingerprint);
    }
    
    console.error(`API_TRF_ACTION_POST_ERROR (PostgreSQL) for TRF ${trfId}:`, error.message, error.stack);
    return NextResponse.json({ error: `Failed to perform action on TRF.`, details: error.message }, { status: 500 });
  }
}
