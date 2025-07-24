// src/app/api/visa/[visaId]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { formatISO, parseISO } from 'date-fns';
import type { VisaApplication, VisaApprovalStep } from '@/types/visa';

export async function GET(request: NextRequest, { params }: { params: Promise<{ visaId: string }> }) {
  const { visaId } = await params;
  console.log(`API_VISA_VISAID_GET_START (PostgreSQL): Fetching visa application ${visaId}.`);
  
  if (!sql) {
    console.error("API_VISA_GET_BY_ID_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized. Check server logs.' }, { status: 503 });
  }
  
  try {
    console.log(`API_VISA_GET_BY_ID (PostgreSQL): Attempting to query visa application with ID: ${visaId}`);
    
    const result = await sql`
      SELECT 
        id, 
        user_id,
        requestor_name, 
        travel_purpose, 
        destination, 
        status, 
        submitted_date, 
        trip_start_date, 
        trip_end_date,
        visa_type,
        last_updated_date,
        staff_id,
        department,
        position,
        email,
        passport_number,
        passport_expiry_date,
        additional_comments
      FROM visa_applications 
      WHERE id = ${visaId}
    `;
    
    if (result.length === 0) {
      console.log(`API_VISA_GET_BY_ID (PostgreSQL): No visa application found with ID: ${visaId}`);
      return NextResponse.json({ error: `Visa Application with ID ${visaId} not found.` }, { status: 404 });
    }
    
    console.log(`API_VISA_GET_BY_ID (PostgreSQL): Found visa application with ID: ${visaId}`);
    
    const app = result[0];
    
    // Get approval steps for this visa application
    const approvalSteps = await sql`
      SELECT 
        id,
        step_number as "stepNumber",
        step_role as "stepRole",
        step_name as "stepName",
        status,
        step_date as "stepDate",
        approver_id as "approverId",
        approver_name as "approverName",
        comments
      FROM visa_approval_steps
      WHERE visa_application_id = ${visaId}
      ORDER BY step_number ASC
    `;
    
    // Map database fields to frontend expected format
    const visaApplication: VisaApplication = {
      id: app.id,
      userId: app.user_id || '',
      applicantName: app.requestor_name,
      travelPurpose: app.travel_purpose as any, // Cast to expected enum type
      destination: app.destination,
      employeeId: app.staff_id || '',
      nationality: app.department || '', // Using department as nationality
      tripStartDate: app.trip_start_date ? new Date(app.trip_start_date) : null,
      tripEndDate: app.trip_end_date ? new Date(app.trip_end_date) : null,
      itineraryDetails: app.additional_comments || '',
      status: app.status as any, // Cast to expected enum type
      submittedDate: app.submitted_date ? new Date(app.submitted_date) : new Date(),
      lastUpdatedDate: app.last_updated_date ? new Date(app.last_updated_date) : new Date(),
      // Optional fields
      passportCopy: null,
      supportingDocumentsNotes: '',
      approvalHistory: approvalSteps.map(step => ({
        stepName: step.stepName || '',
        approverName: step.approverName || undefined,
        status: step.status as "Pending" | "Approved" | "Rejected",
        date: step.stepDate ? new Date(step.stepDate) : undefined,
        comments: step.comments || undefined
      })) as VisaApprovalStep[]
    };
    
    return NextResponse.json({ visaApplication });
  } catch (error: any) {
    console.error(`API_VISA_GET_BY_ID_ERROR (PostgreSQL): ${error.message}`, error.stack);
    return NextResponse.json({ error: 'Failed to fetch visa application.', details: error.message }, { status: 500 });
  }
}

// Placeholder for PUT (Update Visa App - e.g. Visa Clerk uploads visa copy)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ visaId: string }> }) {
    const { visaId } = await params;
    // Example: body could contain { visaCopyFilename: "new_visa.pdf", status: "Approved" }
    // Needs Zod validation
    console.warn(`API_VISA_VISAID_PUT (PostgreSQL): Update for visa ${visaId} - NOT IMPLEMENTED YET`);
    return NextResponse.json({ error: 'Update visa application not implemented for PostgreSQL yet.' }, { status: 501 });
}
