// src/app/api/visa/[visaId]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { z } from 'zod';
import { z } from 'zod';
import { z } from 'zod';
import { z } from 'zod';
import { z } from 'zod';
import { z } from 'zod';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { formatISO, parseISO } from 'date-fns';
import type { VisaApplication, VisaApprovalStep } from '@/types/visa';

const visaUpdateSchema = z.object({
  applicantName: z.string(),
  travelPurpose: z.string(),
  destination: z.string(),
  tripStartDate: z.string(),
  tripEndDate: z.string(),
  visaType: z.string(),
  employeeId: z.string(),
  nationality: z.string(),
  position: z.string(),
  email: z.string(),
  passportNumber: z.string(),
  passportExpiryDate: z.string(),
  itineraryDetails: z.string(),
});

const visaUpdateSchema = z.object({
  applicantName: z.string(),
  travelPurpose: z.string(),
  destination: z.string(),
  tripStartDate: z.string(),
  tripEndDate: z.string(),
  visaType: z.string(),
  employeeId: z.string(),
  nationality: z.string(),
  position: z.string(),
  email: z.string(),
  passportNumber: z.string(),
  passportExpiryDate: z.string(),
  itineraryDetails: z.string(),
});

const visaUpdateSchema = z.object({
  applicantName: z.string(),
  travelPurpose: z.string(),
  destination: z.string(),
  tripStartDate: z.string(),
  tripEndDate: z.string(),
  visaType: z.string(),
  employeeId: z.string(),
  nationality: z.string(),
  position: z.string(),
  email: z.string(),
  passportNumber: z.string(),
  passportExpiryDate: z.string(),
  itineraryDetails: z.string(),
});

const visaUpdateSchema = z.object({
  applicantName: z.string(),
  travelPurpose: z.string(),
  destination: z.string(),
  tripStartDate: z.string(),
  tripEndDate: z.string(),
  visaType: z.string(),
  employeeId: z.string(),
  nationality: z.string(),
  position: z.string(),
  email: z.string(),
  passportNumber: z.string(),
  passportExpiryDate: z.string(),
  itineraryDetails: z.string(),
});

const visaUpdateSchema = z.object({
  applicantName: z.string(),
  travelPurpose: z.string(),
  destination: z.string(),
  tripStartDate: z.string(),
  tripEndDate: z.string(),
  visaType: z.string(),
  employeeId: z.string(),
  nationality: z.string(),
  position: z.string(),
  email: z.string(),
  passportNumber: z.string(),
  passportExpiryDate: z.string(),
  itineraryDetails: z.string(),
});

const visaUpdateSchema = z.object({
  applicantName: z.string(),
  travelPurpose: z.string(),
  destination: z.string(),
  tripStartDate: z.string(),
  tripEndDate: z.string(),
  visaType: z.string(),
  employeeId: z.string(),
  nationality: z.string(),
  position: z.string(),
  email: z.string(),
  passportNumber: z.string(),
  passportExpiryDate: z.string(),
  itineraryDetails: z.string(),
});

const visaUpdateSchema = z.object({
  applicantName: z.string(),
  travelPurpose: z.string(),
  destination: z.string(),
  tripStartDate: z.string(),
  tripEndDate: z.string(),
  visaType: z.string(),
  employeeId: z.string(),
  nationality: z.string(),
  position: z.string(),
  email: z.string(),
  passportNumber: z.string(),
  passportExpiryDate: z.string(),
  itineraryDetails: z.string(),
});

const visaUpdateSchema = z.object({
  applicantName: z.string(),
  travelPurpose: z.string(),
  destination: z.string(),
  tripStartDate: z.string(),
  tripEndDate: z.string(),
  visaType: z.string(),
  employeeId: z.string(),
  nationality: z.string(),
  position: z.string(),
  email: z.string(),
  passportNumber: z.string(),
  passportExpiryDate: z.string(),
  itineraryDetails: z.string(),
});

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
import { z } from 'zod';

const visaUpdateSchema = z.object({
  applicantName: z.string(),
  travelPurpose: z.string(),
  destination: z.string(),
  tripStartDate: z.string(),
  tripEndDate: z.string(),
  visaType: z.string(),
  employeeId: z.string(),
  nationality: z.string(),
  position: z.string(),
  email: z.string(),
  passportNumber: z.string(),
  passportExpiryDate: z.string(),
  itineraryDetails: z.string(),
});

export async function PUT(request: NextRequest, { params }: { params: { visaId: string } }) {
  const { visaId } = params;
  console.log(`API_VISA_VISAID_PUT_START (PostgreSQL): Updating visa application ${visaId}.`);

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
      employeeId, nationality, position, email, passportNumber, passportExpiryDate, itineraryDetails 
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
        department = ${nationality},
        position = ${position},
        email = ${email},
        passport_number = ${passportNumber},
        passport_expiry_date = ${passportExpiryDate},
        additional_comments = ${itineraryDetails},
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
} validationResult.error.flatten());
      return NextResponse.json({ error: "Validation failed for visa update", details: validationResult.error.flatten() }, { status: 400 });
    }

    const { 
      applicantName, travelPurpose, destination, tripStartDate, tripEndDate, visaType, 
      employeeId, nationality, position, email, passportNumber, passportExpiryDate, itineraryDetails 
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
        department = ${nationality},
        position = ${position},
        email = ${email},
        passport_number = ${passportNumber},
        passport_expiry_date = ${passportExpiryDate},
        additional_comments = ${itineraryDetails},
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
