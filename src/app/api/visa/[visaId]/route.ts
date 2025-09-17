// src/app/api/visa/[visaId]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { formatISO, parseISO } from 'date-fns';
import type { VisaApplication, VisaApprovalStep } from '@/types/visa';
import { hasPermission } from '@/lib/permissions';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const visaUpdateSchema = z.object({
  applicantName: z.string(),
  travelPurpose: z.string(),
  destination: z.string(),
  tripStartDate: z.string(),
  tripEndDate: z.string(),
  visaType: z.string(),
  employeeId: z.string(),
  passportNumber: z.string(),
  passportExpiryDate: z.string(),
  itineraryDetails: z.string(),
  supportingDocumentsNotes: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ visaId: string }> }) {
  const { visaId } = await params;
  console.log(`API_VISA_VISAID_GET_START (PostgreSQL): Fetching visa application ${visaId}.`);
  
  // Check if user has permission to view visa applications (either process or view, or if it's their own application)
  const canProcess = await hasPermission('process_visa_applications');
  const canView = await hasPermission('view_visa_applications');
  
  console.log(`[VISA PERMISSIONS DEBUG] visaId: ${visaId}, canProcess: ${canProcess}, canView: ${canView}`);
  
  if (!canProcess && !canView) {
    // If user doesn't have admin permissions, check if it's their own visa application
    const session = await getServerSession(authOptions);
    console.log(`[VISA OWNERSHIP DEBUG] session exists: ${!!session}, userId: ${session?.user?.id}, userName: ${session?.user?.name}, userEmail: ${session?.user?.email}, staffId: ${session?.user?.staff_id}`);
    
    if (session?.user?.id) {
      try {
        const visaCheck = await sql`
          SELECT user_id, requestor_name, staff_id 
          FROM visa_applications 
          WHERE id = ${visaId}
        `;
        
        console.log(`[VISA OWNERSHIP DEBUG] visa check result:`, visaCheck);
        
        if (visaCheck.length > 0) {
          const visa = visaCheck[0];
          // Allow access if it's the user's own visa application (by user_id, name, or staff_id)
          const isOwnVisa = visa.user_id === session.user.id || 
                           visa.requestor_name === session.user.name ||
                           visa.staff_id === session.user.staff_id;
          
          console.log(`[VISA OWNERSHIP DEBUG] isOwnVisa: ${isOwnVisa}, visa.user_id: ${visa.user_id}, visa.requestor_name: ${visa.requestor_name}, visa.staff_id: ${visa.staff_id}`);
          
          if (!isOwnVisa) {
            console.log(`[VISA OWNERSHIP DEBUG] Access denied - not own visa`);
            return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
          } else {
            console.log(`[VISA OWNERSHIP DEBUG] Access granted - own visa`);
          }
        } else {
          console.log(`[VISA OWNERSHIP DEBUG] Visa not found in database`);
          return NextResponse.json({ error: 'Visa application not found' }, { status: 404 });
        }
      } catch (error) {
        console.error('[VISA OWNERSHIP DEBUG] Error checking visa ownership:', error);
        return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
      }
    } else {
      console.log(`[VISA OWNERSHIP DEBUG] No session or user ID found`);
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    }
  }
  
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
        passport_number,
        passport_expiry_date,
        additional_comments,
        processing_details,
        processing_started_at,
        processing_completed_at,
        -- Enhanced LOI fields
        date_of_birth,
        place_of_birth,
        citizenship,
        passport_place_of_issuance,
        passport_date_of_issuance,
        contact_telephone,
        home_address,
        education_details,
        current_employer_name,
        current_employer_address,
        position,
        department,
        marital_status,
        family_information,
        request_type,
        approximately_arrival_date,
        duration_of_stay,
        visa_entry_type,
        work_visit_category,
        application_fees_borne_by,
        cost_centre_number,
        itinerary_details,
        supporting_documents_notes,
        line_focal_person,
        line_focal_dept,
        line_focal_contact,
        line_focal_date,
        sponsoring_dept_head,
        sponsoring_dept_head_dept,
        sponsoring_dept_head_contact,
        sponsoring_dept_head_date,
        ceo_approval_name,
        ceo_approval_date
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
    const completedApprovalSteps = await sql`
      SELECT 
        id,
        step_role as "stepRole",
        step_name as "stepName",
        status,
        step_date as "stepDate",
        comments
      FROM visa_approval_steps
      WHERE visa_id = ${visaId}
      ORDER BY created_at ASC
    `;
    
    // Generate the complete approval workflow including expected pending steps
    const fullApprovalHistory = generateFullVisaApprovalWorkflow(
      app.status, 
      completedApprovalSteps,
      app.requestor_name || 'Unknown'
    );
    
    // Map database fields to frontend expected format
    const visaApplication: VisaApplication = {
      id: app.id,
      userId: app.user_id || '',
      applicantName: app.requestor_name,
      requestorName: app.requestor_name,
      travelPurpose: app.travel_purpose as any, // Cast to expected enum type
      destination: app.destination,
      employeeId: app.staff_id || '',
      staffId: app.staff_id || '',
      tripStartDate: app.trip_start_date ? new Date(app.trip_start_date) : null,
      tripEndDate: app.trip_end_date ? new Date(app.trip_end_date) : null,
      itineraryDetails: app.itinerary_details || (app.additional_comments ? app.additional_comments.split('\n\nSupporting Documents:')[0] : ''),
      supportingDocumentsNotes: app.supporting_documents_notes || (app.additional_comments && app.additional_comments.includes('\n\nSupporting Documents:')
        ? app.additional_comments.split('\n\nSupporting Documents:')[1]
        : ''),
      status: app.status as any, // Cast to expected enum type
      submittedDate: app.submitted_date ? new Date(app.submitted_date) : new Date(),
      lastUpdatedDate: app.last_updated_date ? new Date(app.last_updated_date) : new Date(),

      // Enhanced LOI fields - Section A: Particulars of Applicant
      dateOfBirth: app.date_of_birth ? new Date(app.date_of_birth) : null,
      placeOfBirth: app.place_of_birth || '',
      citizenship: app.citizenship || '',
      passportNumber: app.passport_number || '',
      passportPlaceOfIssuance: app.passport_place_of_issuance || '',
      passportDateOfIssuance: app.passport_date_of_issuance ? new Date(app.passport_date_of_issuance) : null,
      passportExpiryDate: app.passport_expiry_date ? new Date(app.passport_expiry_date) : null,
      contactTelephone: app.contact_telephone || '',
      homeAddress: app.home_address || '',
      educationDetails: app.education_details || '',
      currentEmployerName: app.current_employer_name || '',
      currentEmployerAddress: app.current_employer_address || '',
      position: app.position || '',
      department: app.department || '',
      maritalStatus: app.marital_status || '',
      familyInformation: app.family_information || '',

      // Section B: Type of Request
      requestType: app.request_type as any,
      approximatelyArrivalDate: app.approximately_arrival_date ? new Date(app.approximately_arrival_date) : null,
      durationOfStay: app.duration_of_stay || '',
      visaEntryType: app.visa_entry_type as any,
      workVisitCategory: app.work_visit_category as any,
      applicationFeesBorneBy: app.application_fees_borne_by as any,
      costCentreNumber: app.cost_centre_number || '',

      // Approval workflow fields
      lineFocalPerson: app.line_focal_person || '',
      lineFocalDept: app.line_focal_dept || '',
      lineFocalContact: app.line_focal_contact || '',
      lineFocalDate: app.line_focal_date ? new Date(app.line_focal_date) : null,
      sponsoringDeptHead: app.sponsoring_dept_head || '',
      sponsoringDeptHeadDept: app.sponsoring_dept_head_dept || '',
      sponsoringDeptHeadContact: app.sponsoring_dept_head_contact || '',
      sponsoringDeptHeadDate: app.sponsoring_dept_head_date ? new Date(app.sponsoring_dept_head_date) : null,
      ceoApprovalName: app.ceo_approval_name || '',
      ceoApprovalDate: app.ceo_approval_date ? new Date(app.ceo_approval_date) : null,

      // Legacy and system fields
      visaType: app.visa_type || '',
      email: '', // Default empty since not stored separately
      passportCopy: null,
      additionalComments: app.additional_comments || '',
      approvalWorkflow: fullApprovalHistory,
      approvalHistory: fullApprovalHistory, // Keep for backward compatibility

      // Processing details
      processingDetails: app.processing_details ? JSON.parse(app.processing_details) : null,
      processingStartedAt: app.processing_started_at ? new Date(app.processing_started_at) : null,
      processingCompletedAt: app.processing_completed_at ? new Date(app.processing_completed_at) : null
    };
    
    return NextResponse.json({ visaApplication });
  } catch (error: any) {
    console.error(`API_VISA_GET_BY_ID_ERROR (PostgreSQL): ${error.message}`, error.stack);
    return NextResponse.json({ error: 'Failed to fetch visa application.', details: error.message }, { status: 500 });
  }
}

// Generate full approval workflow including pending steps
function generateFullVisaApprovalWorkflow(
  currentStatus: string,
  completedSteps: any[],
  requestorName?: string
): VisaApprovalStep[] {
  // Define the expected workflow sequence for visa applications
  const expectedSteps = [
    { role: 'Requestor', name: requestorName || 'Unknown', status: 'Submitted' },
    { role: 'Department Focal', name: 'Pending', status: 'Pending' },
    { role: 'Line Manager', name: 'Pending', status: 'Pending' },
    { role: 'HOD', name: 'Pending', status: 'Pending' },
    { role: 'Visa Admin', name: 'Pending', status: 'Pending' },
  ];

  // Map completed steps to expected steps
  const workflow: VisaApprovalStep[] = expectedSteps.map(expectedStep => {
    const completedStep = completedSteps.find(step =>
      step.stepRole === expectedStep.role || step.stepName === expectedStep.name
    );

    if (completedStep) {
      return {
        role: completedStep.stepRole,
        name: completedStep.stepName,
        status: completedStep.status as any,
        date: completedStep.stepDate,
        comments: completedStep.comments
      };
    }

    return {
      role: expectedStep.role,
      name: expectedStep.name,
      status: expectedStep.status as any,
      date: undefined,
      comments: undefined
    };
  });

  // Update status based on current application status
  if (currentStatus === 'Draft') {
    workflow[0].status = 'Not Started';
  } else if (currentStatus === 'Pending Department Focal') {
    workflow[0].status = 'Submitted';
    workflow[1].status = 'Current';
  } else if (currentStatus === 'Pending Line Manager') {
    workflow[0].status = 'Approved';
    workflow[1].status = 'Approved';
    workflow[2].status = 'Current';
  } else if (currentStatus === 'Pending HOD') {
    workflow[0].status = 'Approved';
    workflow[1].status = 'Approved';
    workflow[2].status = 'Approved';
    workflow[3].status = 'Current';
  } else if (currentStatus === 'Processing with Visa Admin') {
    workflow[0].status = 'Approved';
    workflow[1].status = 'Approved';
    workflow[2].status = 'Approved';
    workflow[3].status = 'Approved';
    workflow[4].status = 'Current';
  } else if (currentStatus === 'Processed') {
    workflow.forEach(step => {
      if (step.status === 'Pending' || step.status === 'Current') {
        step.status = 'Approved';
      }
    });
  } else if (currentStatus === 'Rejected') {
    // Find the current step and mark it as rejected
    const currentStepIndex = workflow.findIndex(step => step.status === 'Current');
    if (currentStepIndex !== -1) {
      workflow[currentStepIndex].status = 'Rejected';
    }
  } else if (currentStatus === 'Cancelled') {
    workflow.forEach(step => {
      if (step.status === 'Pending' || step.status === 'Current') {
        step.status = 'Cancelled';
      }
    });
  }

  return workflow;
}

// Placeholder for PUT (Update Visa App - e.g. Visa Clerk uploads visa copy)

export async function PUT(request: NextRequest, { params }: { params: { visaId: string } }) {
  const { visaId } = params;
  console.log(`API_VISA_VISAID_PUT_START (PostgreSQL): Updating visa application ${visaId}.`);

  // Check if user has permission to process visa applications
  if (!await hasPermission('process_visa_applications')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }

  if (!sql) {
    console.error("API_VISA_PUT_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized. Check server logs.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const validationResult = visaUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("API_VISA_PUT_VALIDATION_ERROR (PostgreSQL):", validationResult.error.flatten());
      return NextResponse.json({ error: "Validation failed for visa update", details: validationResult.error.flatten() }, { status: 400 });
    }

    const { 
      applicantName, travelPurpose, destination, tripStartDate, tripEndDate, visaType, 
      employeeId, passportNumber, passportExpiryDate, itineraryDetails, supportingDocumentsNotes 
    } = validationResult.data;

    console.log(`API_VISA_PUT (PostgreSQL): Attempting to update visa application with ID: ${visaId}`);

    const result = await sql`
      UPDATE visa_applications
      SET
        requestor_name = ${applicantName},
        travel_purpose = ${travelPurpose},
        destination = ${destination},
        trip_start_date = ${tripStartDate},
        trip_end_date = ${tripEndDate},
        visa_type = ${visaType},
        staff_id = ${employeeId},
        passport_number = ${passportNumber},
        passport_expiry_date = ${passportExpiryDate},
        additional_comments = ${itineraryDetails + (supportingDocumentsNotes ? '\n\nSupporting Documents:\n' + supportingDocumentsNotes : '')},
        last_updated_date = NOW()
      WHERE id = ${visaId}
      RETURNING id
    `;

    if (result.length === 0) {
      console.log(`API_VISA_PUT (PostgreSQL): No visa application found with ID: ${visaId}`);
      return NextResponse.json({ error: `Visa Application with ID ${visaId} not found.` }, { status: 404 });
    }

    console.log(`API_VISA_PUT (PostgreSQL): Successfully updated visa application with ID: ${visaId}`);
    return NextResponse.json({ message: `Visa application ${visaId} updated successfully.` });
  } catch (error: any) {
    console.error(`API_VISA_PUT_ERROR (PostgreSQL): ${error.message}`, error.stack);
    return NextResponse.json({ error: 'Failed to update visa application.', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { visaId: string } }) {
  const { visaId } = params;
  console.log(`API_VISA_VISAID_DELETE_START (PostgreSQL): Deleting visa application ${visaId}.`);

  // Check if user has permission to process visa applications
  if (!await hasPermission('process_visa_applications')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }

  if (!sql) {
    console.error("API_VISA_DELETE_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized. Check server logs.' }, { status: 503 });
  }

  try {
    console.log(`API_VISA_DELETE (PostgreSQL): Attempting to delete visa application with ID: ${visaId}`);

    const result = await sql`
      DELETE FROM visa_applications
      WHERE id = ${visaId}
      RETURNING id
    `;

    if (result.length === 0) {
      console.log(`API_VISA_DELETE (PostgreSQL): No visa application found with ID: ${visaId}`);
      return NextResponse.json({ error: `Visa Application with ID ${visaId} not found.` }, { status: 404 });
    }

    console.log(`API_VISA_DELETE (PostgreSQL): Successfully deleted visa application with ID: ${visaId}`);
    return NextResponse.json({ message: `Visa application ${visaId} deleted successfully.` });
  } catch (error: any) {
    console.error(`API_VISA_DELETE_ERROR (PostgreSQL): ${error.message}`, error.stack);
    return NextResponse.json({ error: 'Failed to delete visa application.', details: error.message }, { status: 500 });
  }
}

