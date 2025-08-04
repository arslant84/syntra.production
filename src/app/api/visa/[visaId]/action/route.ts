// src/app/api/visa/[visaId]/action/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import type { VisaStatus } from '@/types/visa';

const visaActionSchema = z.object({
  action: z.enum(["approve", "reject", "mark_processing", "upload_visa", "cancel"]),
  comments: z.string().optional().nullable(),
  approverRole: z.string().optional().nullable(),
  approverName: z.string().optional().nullable(),
  visaCopyFilename: z.string().optional().nullable(), // For upload_visa action
});

// Define the visa approval workflow sequence
const visaApprovalWorkflow: Record<string, VisaStatus | null> = {
  "Pending Department Focal": "Pending Line Manager/HOD",
  "Pending Line Manager/HOD": "Pending Visa Clerk",
  "Pending Visa Clerk": "Processing with Embassy", // Visa clerk marks as processing
  // "Processing with Embassy" can then become "Approved" or "Rejected" by Visa Clerk via "upload_visa" or "reject"
};

const terminalVisaStatuses: VisaStatus[] = ["Approved", "Rejected", "Cancelled"];

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

    const [currentVisaApp] = await sql`SELECT id, status, requestor_name FROM visa_applications WHERE id = ${visaId}`;
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
    updateFields.last_updated_date = sql`NOW()`;

    // Construct SET clause manually without using sql.join which doesn't exist
    const setClauses = Object.entries(updateFields).map(([key, value]) => sql`${sql(key)} = ${value}`);
    let setClause = setClauses[0];
    for (let i = 1; i < setClauses.length; i++) {
      setClause = sql`${setClause}, ${setClauses[i]}`;
    }

    const [updatedApp] = await sql.begin(async tx => {
      const [app] = await tx`
        UPDATE visa_applications
        SET ${setClause}
        WHERE id = ${visaId}
        RETURNING *
      `;
      await tx`
        INSERT INTO visa_approval_steps (visa_application_id, step_name, approver_name, status, step_date, comments)
        VALUES (${visaId}, ${approverRole || 'User'}, ${approverName || currentVisaApp.requestor_name || 'User'}, ${stepStatus}, NOW(), ${comments || null})
      `;
      return app;
    });
    
    console.log(`API_VISA_ACTION_POST (PostgreSQL): Visa App ${visaId} action '${action}' processed. New status: ${updatedApp.status}`);
    
    // Format the response to match what the frontend expects (similar to GET endpoint)
    const formattedVisa = {
      id: updatedApp.id,
      userId: updatedApp.user_id || '',
      applicantName: updatedApp.requestor_name,
      requestorName: updatedApp.requestor_name,
      travelPurpose: updatedApp.travel_purpose,
      destination: updatedApp.destination,
      employeeId: updatedApp.staff_id || '',
      staffId: updatedApp.staff_id || '',
      nationality: '', // Default empty string since column doesn't exist
      department: updatedApp.department || '',
      position: updatedApp.position || '',
      email: updatedApp.email || '',
      visaType: updatedApp.visa_type || '',
      tripStartDate: updatedApp.trip_start_date ? new Date(updatedApp.trip_start_date) : null,
      tripEndDate: updatedApp.trip_end_date ? new Date(updatedApp.trip_end_date) : null,
      passportNumber: updatedApp.passport_number || '',
      passportExpiryDate: updatedApp.passport_expiry_date ? new Date(updatedApp.passport_expiry_date) : null,
      itineraryDetails: updatedApp.additional_comments ? updatedApp.additional_comments.split('\n\nSupporting Documents:')[0] : '',
      supportingDocumentsNotes: updatedApp.additional_comments && updatedApp.additional_comments.includes('\n\nSupporting Documents:') 
        ? updatedApp.additional_comments.split('\n\nSupporting Documents:')[1] 
        : '',
      additionalComments: updatedApp.additional_comments || '',
      status: updatedApp.status,
      submittedDate: updatedApp.submitted_date ? new Date(updatedApp.submitted_date) : new Date(),
      lastUpdatedDate: updatedApp.last_updated_date ? new Date(updatedApp.last_updated_date) : new Date(),
      passportCopy: null,
      supportingDocumentsNotes: '',
      approvalHistory: [] // Will be populated by a separate query if needed
    };
    
    // TODO: Placeholder for notification
    return NextResponse.json(formattedVisa);

  } catch (error: any) {
    console.error(`API_VISA_ACTION_POST_ERROR (PostgreSQL) for visa ${visaId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to process visa application action.', details: error.message }, { status: 500 });
  }
}
