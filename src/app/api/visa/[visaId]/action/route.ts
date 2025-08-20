// src/app/api/visa/[visaId]/action/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import type { VisaStatus } from '@/types/visa';
import { hasPermission } from '@/lib/permissions';
import { NotificationService } from '@/lib/notification-service';

const visaActionSchema = z.object({
  action: z.enum(["approve", "reject", "mark_processing", "upload_visa", "cancel"]),
  comments: z.string().optional().nullable(),
  approverRole: z.string(), // Make required like TSR
  approverName: z.string(), // Make required like TSR
  visaCopyFilename: z.string().optional().nullable(), // For upload_visa action
});

// Define the visa approval workflow sequence (matching TSR pattern)
const visaApprovalWorkflow: Record<string, VisaStatus | null> = {
  "Pending Department Focal": "Pending Line Manager/HOD",
  "Pending Line Manager/HOD": "Pending Visa Clerk",
  "Pending Visa Clerk": "Processing with Embassy", // Visa clerk marks as processing
  "Processing with Embassy": "Approved", // Processing can lead to approval
};

const terminalVisaStatuses: VisaStatus[] = ["Approved", "Rejected", "Cancelled"];
const cancellableStatuses: VisaStatus[] = ["Pending Department Focal", "Pending Line Manager/HOD", "Pending Visa Clerk", "Draft"];

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
        
        // Get the next step number for this visa application
        const stepNumberResult = await tx`
            SELECT COALESCE(MAX(step_number), 0) + 1 as next_step_number 
            FROM visa_approval_steps 
            WHERE visa_application_id = ${visaId}
        `;
        const nextStepNumber = stepNumberResult[0]?.next_step_number || 1;

        await tx`
            INSERT INTO visa_approval_steps (visa_application_id, step_number, step_role, step_name, approver_name, status, step_date, comments, created_at, updated_at)
            VALUES (${visaId}, ${nextStepNumber}, ${approverRole}, ${approverRole}, ${approverName}, ${stepStatus}, NOW(), ${comments || (action === "cancel" ? "Cancelled by user/admin." : (action === "approve" ? "Approved." : ""))}, NOW(), NOW())
        `;
        return updatedVisaResult;
    });
    
    // Safely extract the first result
    const updated = result && result.length > 0 ? result[0] : null;
    
    if (!updated) {
      console.error(`API_VISA_ACTION_POST_ERROR (PostgreSQL): Failed to update visa application ${visaId}`);
      return NextResponse.json({ error: 'Failed to update visa application' }, { status: 500 });
    }
    
    // Send notifications
    try {
      // Notify the requestor about status update
      if (updated.staff_id) {
        // Get the user ID from staff_id
        const requestorUser = await sql`
          SELECT id FROM users WHERE staff_id = ${updated.staff_id} LIMIT 1
        `;
        
        if (requestorUser.length > 0) {
          await NotificationService.createStatusUpdate({
            requestorId: requestorUser[0].id,
            status: updated.status,
            entityType: 'visa',
            entityId: visaId,
            approverName,
            comments: comments || undefined
          });
        }
      }

      // If moving to next approval step, notify the next approver
      if (action === 'approve' && nextStatus !== 'Approved' && nextStatus !== 'Processing with Embassy') {
        // Map next status to specific approval permission
        const nextApproverPermission = nextStatus === 'Pending Line Manager/HOD' ? 'approve_trf_manager' : 
                                     nextStatus === 'Pending Visa Clerk' ? 'process_visa_applications' : null;
        
        if (nextApproverPermission) {
          let approvers;
          
          // Visa Clerks can process visas from any department, managers are department-specific
          if (nextApproverPermission === 'process_visa_applications') {
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
                AND u.department = ${updated.department || 'Unknown'}
                AND u.status = 'Active'
            `;
          }

          for (const approver of approvers) {
            await NotificationService.createApprovalRequest({
              approverId: approver.id,
              requestorName: updated.requestor_name || 'Unknown',
              entityType: 'visa',
              entityId: visaId,
              entityTitle: `Visa Application ${visaId}`
            });
          }
        }
      }
    } catch (notificationError) {
      console.error('Error sending notifications for visa action:', notificationError);
      // Don't fail the main operation due to notification errors
    }

    console.log(`API_VISA_ACTION_POST (PostgreSQL): Visa App ${visaId} action '${action}' processed. New status: ${updated.status}`);
    
    return NextResponse.json({ message: `Visa application ${action}ed successfully.`, visa: updated });

  } catch (error: any) {
    console.error(`API_VISA_ACTION_POST_ERROR (PostgreSQL) for visa ${visaId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to process visa application action.', details: error.message }, { status: 500 });
  }
}
