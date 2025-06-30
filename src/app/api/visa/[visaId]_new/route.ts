// src/app/api/visa/[visaId]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { formatISO } from 'date-fns';

export async function GET(
  request: NextRequest,
  { params }: { params: { visaId: string } }
) {
  const visaId = params.visaId;
  console.log(`API_VISA_GET_BY_ID_START (PostgreSQL): Fetching visa application with ID: ${visaId}`);
  
  if (!sql) {
    console.error("API_VISA_GET_BY_ID_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized. Check server logs.' }, { status: 503 });
  }
  
  try {
    console.log(`API_VISA_GET_BY_ID (PostgreSQL): Attempting to query visa application with ID: ${visaId}`);
    
    const result = await sql`
      SELECT 
        id, 
        user_id as "userId",
        requestor_name as "requestorName", 
        travel_purpose as "travelPurpose", 
        destination, 
        status, 
        submitted_date as "submittedDate", 
        trip_start_date as "tripStartDate", 
        trip_end_date as "tripEndDate",
        visa_type as "visaType",
        last_updated_date as "lastUpdatedDate",
        staff_id as "staffId",
        department,
        position,
        email,
        passport_number as "passportNumber",
        passport_expiry_date as "passportExpiryDate",
        additional_comments as "additionalComments"
      FROM visa_applications 
      WHERE id = ${visaId}
    `;
    
    if (result.length === 0) {
      console.log(`API_VISA_GET_BY_ID (PostgreSQL): No visa application found with ID: ${visaId}`);
      return NextResponse.json({ error: `Visa Application with ID ${visaId} not found.` }, { status: 404 });
    }
    
    console.log(`API_VISA_GET_BY_ID (PostgreSQL): Found visa application with ID: ${visaId}`);
    
    // Map database field names to frontend field names
    const app = result[0];
    const formattedApp = {
      id: app.id,
      userId: app.userId || '',
      applicantName: app.requestorName, // Map requestorName to applicantName for frontend
      travelPurpose: app.travelPurpose,
      destination: app.destination,
      employeeId: app.staffId || '', // Map staffId to employeeId for frontend
      nationality: app.department || '', // Use department as nationality for now
      tripStartDate: app.tripStartDate ? formatISO(new Date(app.tripStartDate)) : null,
      tripEndDate: app.tripEndDate ? formatISO(new Date(app.tripEndDate)) : null,
      itineraryDetails: app.additionalComments || '', // Use additionalComments as itineraryDetails
      status: app.status,
      submittedDate: app.submittedDate ? formatISO(new Date(app.submittedDate)) : null,
      lastUpdatedDate: app.lastUpdatedDate ? formatISO(new Date(app.lastUpdatedDate)) : null,
    };
    
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
    
    const formattedApprovalSteps = approvalSteps.map(step => ({
      ...step,
      stepDate: step.stepDate ? formatISO(new Date(step.stepDate)) : null
    }));
    
    return NextResponse.json({ 
      visaApplication: formattedApp,
      approvalSteps: formattedApprovalSteps
    });
  } catch (error: any) {
    console.error(`API_VISA_GET_BY_ID_ERROR (PostgreSQL): ${error.message}`, error.stack);
    return NextResponse.json({ error: 'Failed to fetch visa application.', details: error.message }, { status: 500 });
  }
}
