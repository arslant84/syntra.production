// src/app/api/visa/[visaId]/action/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import type { VisaStatus } from '@/types/visa';

const visaActionSchema = z.object({
  action: z.enum(["approve", "reject", "mark_processing", "upload_visa", "cancel"]),
  comments: z.string().optional().nullable(),
  approverRole: z.string().min(1, "Approver role is required"),
  approverName: z.string().min(1, "Approver name is required"),
  visaCopyFilename: z.string().optional().nullable(), // For upload_visa action
});

// Define the visa approval workflow sequence
const visaApprovalWorkflow: Record<string, VisaStatus | null> = {
  "Pending Department Focal": "Pending Line Manager/HOD",
  "Pending Line Manager/HOD": "Pending Visa Clerk",
  "Pending Visa Clerk": "Processing with Embassy", // Visa clerk marks as processing
  // "Processing with Embassy" can then become "Approved" or "Rejected" by Visa Clerk via "upload_visa" or "reject"
};

const terminalVisaStatuses: VisaStatus[] = ["Approved", "Rejected"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ visaId: string }> }) {
  const { visaId } = await params;
  console.log(`API_VISA_ACTION_POST_START (PostgreSQL): Action for visa ${visaId}.`);
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

    const [currentVisaApp] = await sql`SELECT id, status, applicant_name FROM visa_applications WHERE id = ${visaId}`;
    if (!currentVisaApp) {
      return NextResponse.json({ error: "Visa application not found" }, { status: 404 });
    }
    const currentStatus = currentVisaApp.status as VisaStatus;

    if (terminalVisaStatuses.includes(currentStatus) && action !== "upload_visa") { // Allow upload_visa even if approved
        return NextResponse.json({ error: `Visa application is already in a terminal state: ${currentStatus}.` }, { status: 400 });
    }
    
    let nextStatus: VisaStatus = currentStatus;
    let stepStatus = action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "Processed";
    let updateFields: any = {};

    if (action === "approve") {
      nextStatus = visaApprovalWorkflow[currentStatus] || "Approved"; // Default to Approved if at end
    } else if (action === "reject") {
      if (!comments || comments.trim() === "") {
        return NextResponse.json({ error: "Rejection comments are required." }, { status: 400 });
      }
      nextStatus = "Rejected";
      updateFields.rejection_reason = comments;
    } else if (action === "mark_processing") {
      if (currentStatus === "Pending Visa Clerk") {
        nextStatus = "Processing with Embassy";
      } else {
        return NextResponse.json({ error: `Cannot mark as processing from status: ${currentStatus}` }, { status: 400 });
      }
    } else if (action === "upload_visa") {
      if (!visaCopyFilename) {
        return NextResponse.json({ error: "Visa copy filename is required for this action." }, { status: 400 });
      }
      nextStatus = "Approved"; // Assume uploading visa means it's approved
      updateFields.visa_copy_filename = visaCopyFilename;
      stepStatus = "Visa Uploaded"; // For the approval step log
    } else if (action === "cancel") {
      nextStatus = "Cancelled";
    } else {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    updateFields.status = nextStatus;
    updateFields.last_updated_at = sql`NOW()`;

    const setClauses = Object.entries(updateFields).map(([key, value]) => sql`${sql(key)} = ${value}`);

    const [updatedApp] = await sql.begin(async tx => {
      const [app] = await tx`
        UPDATE visa_applications
        SET ${sql.join(setClauses, sql`, `)}
        WHERE id = ${visaId}
        RETURNING *
      `;
      await tx`
        INSERT INTO visa_approval_steps (visa_application_id, step_name, approver_name, status, step_date, comments)
        VALUES (${visaId}, ${approverRole}, ${approverName}, ${stepStatus}, NOW(), ${comments || null})
      `;
      return app;
    });
    
    console.log(`API_VISA_ACTION_POST (PostgreSQL): Visa App ${visaId} action '${action}' processed. New status: ${updatedApp.status}`);
    // TODO: Placeholder for notification
    return NextResponse.json({ message: `Visa application action '${action}' processed.`, visaApplication: updatedApp });

  } catch (error: any) {
    console.error(`API_VISA_ACTION_POST_ERROR (PostgreSQL) for visa ${visaId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to process visa application action.', details: error.message }, { status: 500 });
  }
}
