// src/app/api/visa/[visaId]/action/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import type { VisaStatus } from '@/types/visa';
import { hasPermission } from '@/lib/permissions';
import { NotificationService } from '@/lib/notification-service';
import { UnifiedNotificationService } from '@/lib/unified-notification-service';

const visaActionSchema = z.object({
  action: z.enum(["approve", "reject", "mark_processing", "upload_visa", "cancel"]),
  comments: z.string().optional().nullable(),
  approverRole: z.string(), // Make required like TSR
  approverName: z.string(), // Make required like TSR
  visaCopyFilename: z.string().optional().nullable(), // For upload_visa action
});

// Define the visa approval workflow sequence (matching TSR pattern)
const visaApprovalWorkflow: Record<string, VisaStatus | null> = {
  "Pending Department Focal": "Pending Line Manager",
  "Pending Line Manager": "Pending HOD",
  "Pending HOD": "Pending Visa Clerk",
  "Pending Visa Clerk": "Processing with Embassy", // Visa clerk marks as processing
  "Processing with Embassy": "Approved", // Processing can lead to approval
};

const terminalVisaStatuses: VisaStatus[] = ["Approved", "Rejected", "Cancelled"];
const cancellableStatuses: VisaStatus[] = ["Pending Department Focal", "Pending Line Manager", "Pending HOD", "Pending Visa Clerk", "Draft"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ visaId: string }> }) {
  const { visaId } = await params;
  console.log(`API_VISA_ACTION_POST_START (PostgreSQL): Action for visa ${visaId}.`);
  
  // Check if user has permission to process visa applications
  if (!await hasPermission('process_visa_applications')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }
  
  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const validationResult = visaActionSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("API_VISA_ACTION_POST_VALIDATION_ERROR (PostgreSQL):", validationResult.error.flatten());
      return NextResponse.json({ error: "Validation failed for visa action", details: validationResult.error.flatten() }, { status: 400 });
    }
    const { action, comments, approverRole, approverName, visaCopyFilename } = validationResult.data;

    const [currentVisaApp] = await sql`SELECT id, status, requestor_name FROM visa_applications WHERE id = ${visaId}`;
    if (!currentVisaApp) {
      return NextResponse.json({ error: "Visa application not found" }, { status: 404 });
    }
    const currentStatus = currentVisaApp.status as VisaStatus;

    if (terminalVisaStatuses.includes(currentStatus) && action !== "upload_visa") {
        console.log(`API_VISA_ACTION_POST (PostgreSQL): Visa ${visaId} is already in a terminal state: ${currentStatus}. No action taken.`);
        return NextResponse.json({ error: `Visa application is already in a terminal state: ${currentStatus}. No further actions allowed.` }, { status: 400 });
    }
    
    let nextStatus: VisaStatus = currentStatus;
    let stepStatus = "Processed";
    let updateFields: any = {};
    let notificationMessage = "";
    let nextNotificationRecipient = "Requestor";

    if (action === "approve") {
      // Follow the approval workflow sequence
      let nextStepInSequence = visaApprovalWorkflow[currentStatus];
      
      if (nextStepInSequence) {
        nextStatus = nextStepInSequence;
        if (nextStatus !== "Approved") {
          nextNotificationRecipient = `Next Approver (${nextStatus}) & Requestor`;
        } else {
          nextNotificationRecipient = `Visa Clerk & Requestor`;
        }
      } else if (currentStatus === "Processing with Embassy") {
        // If processing and being approved, it's final approval
        nextStatus = "Approved";
        nextNotificationRecipient = `Requestor`;
      } else {
        // Default to approved if no specific workflow
        nextStatus = "Approved";
        nextNotificationRecipient = `Requestor`;
      }
      stepStatus = "Approved";
      notificationMessage = `Your visa application (${visaId}) has been approved by ${approverName} (${approverRole}) and is now ${nextStatus}.`;

    } else if (action === "reject") {
      if (!comments || comments.trim() === "") {
        return NextResponse.json({ error: "Rejection comments are required." }, { status: 400 });
      }
      nextStatus = "Rejected";
      updateFields.rejection_reason = comments;
      stepStatus = "Rejected";
      notificationMessage = `Your visa application (${visaId}) has been rejected by ${approverName} (${approverRole}). Reason: ${comments}`;
      nextNotificationRecipient = `Requestor`;
    } else if (action === "mark_processing") {
      if (currentStatus === "Pending Visa Clerk") {
        nextStatus = "Processing with Embassy";
        stepStatus = "Processing";
        notificationMessage = `Your visa application (${visaId}) is now being processed with the embassy.`;
        nextNotificationRecipient = `Requestor`;
      } else {
        return NextResponse.json({ error: `Cannot mark as processing from status: ${currentStatus}` }, { status: 400 });
      }
    } else if (action === "upload_visa") {
      if (!visaCopyFilename) {
        return NextResponse.json({ error: "Visa copy filename is required for this action." }, { status: 400 });
      }
      nextStatus = "Approved";
      updateFields.visa_copy_filename = visaCopyFilename;
      stepStatus = "Visa Uploaded";
      notificationMessage = `Your visa application (${visaId}) has been completed and the visa copy has been uploaded.`;
      nextNotificationRecipient = `Requestor`;
    } else if (action === "cancel") {
      if (!cancellableStatuses.includes(currentStatus)) {
        return NextResponse.json({ error: `Visa application with status ${currentStatus} cannot be cancelled.` }, { status: 400 });
      }
      nextStatus = "Cancelled";
      stepStatus = "Cancelled";
      notificationMessage = `Your visa application (${visaId}) has been cancelled.`;
      nextNotificationRecipient = `Requestor & Relevant Approvers`;
    } else {
      return NextResponse.json({ error: "Invalid action specified." }, { status: 400 });
    }

    // Fix the iterable error by handling the transaction result properly (following TSR pattern)
    const result = await sql.begin(async tx => {
        // Handle additional fields separately if needed
        let updatedVisaResult;
        if (updateFields.rejection_reason) {
            updatedVisaResult = await tx`
                UPDATE visa_applications
                SET status = ${nextStatus}, last_updated_date = NOW(), rejection_reason = ${updateFields.rejection_reason}
                WHERE id = ${visaId}
                RETURNING *
            `;
        } else if (updateFields.visa_copy_filename) {
            updatedVisaResult = await tx`
                UPDATE visa_applications
                SET status = ${nextStatus}, last_updated_date = NOW(), visa_copy_filename = ${updateFields.visa_copy_filename}
                WHERE id = ${visaId}
                RETURNING *
            `;
        } else {
            updatedVisaResult = await tx`
                UPDATE visa_applications
                SET status = ${nextStatus}, last_updated_date = NOW()
                WHERE id = ${visaId}
                RETURNING *
            `;
        }
        
        await tx`
            INSERT INTO visa_approval_steps (visa_id, step_role, step_name, status, step_date, comments, created_at, updated_at)
            VALUES (${visaId}, ${approverRole}, ${approverName}, ${stepStatus}, NOW(), ${comments || (action === "cancel" ? "Cancelled by user/admin." : (action === "approve" ? "Approved." : ""))}, NOW(), NOW())
        `;
        return updatedVisaResult;
    });
    
    // Safely extract the first result
    const updated = result && result.length > 0 ? result[0] : null;
    
    if (!updated) {
      console.error(`API_VISA_ACTION_POST_ERROR (PostgreSQL): Failed to update visa application ${visaId}`);
      return NextResponse.json({ error: 'Failed to update visa application' }, { status: 500 });
    }
    
    // Send enhanced workflow notifications
    try {
      // Get visa application details including requestor information
      const visaDetails = await sql`
        SELECT va.staff_id, va.requestor_name, va.destination, va.travel_purpose, 
               va.trip_start_date, va.trip_end_date, va.department,
               u.email, u.id as user_id, u.department as user_department
        FROM visa_applications va
        LEFT JOIN users u ON (va.staff_id = u.staff_id OR va.staff_id = u.id OR va.staff_id = u.email)
        WHERE va.id = ${visaId}
      `;

      if (visaDetails.length > 0) {
        const visaInfo = visaDetails[0];
        
        // Send 5-stage workflow notification
        if (action === 'approve') {
          await UnifiedNotificationService.notifyApproval({
            entityType: 'visa',
            entityId: visaId,
            requestorId: visaInfo.user_id,
            requestorName: visaInfo.requestor_name || 'User',
            requestorEmail: visaInfo.email,
            department: visaInfo.user_department || visaInfo.department,
            currentStatus: updated.status,
            previousStatus: currentStatus,
            approverName: approverName,
            approverRole: approverRole,
            entityTitle: `Visa Application - ${visaInfo.destination || 'Travel'}`,
            travelPurpose: visaInfo.travel_purpose || 'Business Travel',
            travelDates: visaInfo.trip_start_date && visaInfo.trip_end_date 
              ? `${visaInfo.trip_start_date} to ${visaInfo.trip_end_date}` 
              : visaInfo.trip_start_date 
              ? `From ${visaInfo.trip_start_date}` 
              : 'Not specified',
            destination: visaInfo.destination || 'Not specified',
            employeeId: visaInfo.staff_id || 'Not specified',
            comments: comments
          });
        } else if (action === 'reject') {
          await UnifiedNotificationService.notifyRejection({
            entityType: 'visa',
            entityId: visaId,
            requestorId: visaInfo.user_id,
            requestorName: visaInfo.requestor_name || 'User',
            requestorEmail: visaInfo.email,
            department: visaInfo.user_department || visaInfo.department,
            approverName: approverName,
            approverRole: approverRole,
            rejectionReason: comments || 'No reason provided',
            entityTitle: `Visa Application - ${visaInfo.destination || 'Travel'}`,
            travelPurpose: visaInfo.travel_purpose || 'Business Travel',
            travelDates: visaInfo.trip_start_date && visaInfo.trip_end_date 
              ? `${visaInfo.trip_start_date} to ${visaInfo.trip_end_date}` 
              : visaInfo.trip_start_date 
              ? `From ${visaInfo.trip_start_date}` 
              : 'Not specified',
            destination: visaInfo.destination || 'Not specified',
            employeeId: visaInfo.staff_id || 'Not specified'
          });
        }

        console.log(`✅ Created enhanced workflow notifications for visa ${visaId} ${action} by ${approverName}`);
      }
    } catch (notificationError) {
      console.error(`❌ Failed to create enhanced workflow notifications for visa ${visaId}:`, notificationError);
      // Don't fail the visa action due to notification errors
    }

    console.log(`API_VISA_ACTION_POST (PostgreSQL): Visa App ${visaId} action '${action}' processed. New status: ${updated.status}`);
    
    return NextResponse.json({ message: `Visa application ${action}ed successfully.`, visa: updated });

  } catch (error: any) {
    console.error(`API_VISA_ACTION_POST_ERROR (PostgreSQL) for visa ${visaId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to process visa application action.', details: error.message }, { status: 500 });
  }
}
