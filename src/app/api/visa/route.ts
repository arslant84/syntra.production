// src/app/api/visa/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db'; // Assuming PostgreSQL setup
import { formatISO, parseISO } from 'date-fns';
import { generateRequestId } from '@/utils/requestIdGenerator';

const visaApplicationCreateSchema = z.object({
  applicantName: z.string().min(1, "Applicant name is required"),
  travelPurpose: z.string().min(1, "Travel purpose is required"),
  destination: z.string().optional().nullable(),
  employeeId: z.string().optional().nullable(),
  visaType: z.string().min(1, "Visa type is required"),
  tripStartDate: z.coerce.date({ required_error: "Trip start date is required" }),
  tripEndDate: z.coerce.date({ required_error: "Trip end date is required" }),
  passportNumber: z.string().optional().nullable(),
  passportExpiryDate: z.coerce.date().optional().nullable(),
  itineraryDetails: z.string().optional().nullable(),
  supportingDocumentsNotes: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.travelPurpose === "Business Trip" && (!data.destination || data.destination.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Destination is required for business trips.",
      path: ["destination"],
    });
  }
});


export async function POST(request: NextRequest) {
  console.log("API_VISA_POST_START (PostgreSQL): Creating visa application.");
  if (!sql) {
    console.error("API_VISA_POST_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized. Check server logs.' }, { status: 503 });
  }
  
  try {
    const body = await request.json();
    const validationResult = visaApplicationCreateSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("API_VISA_POST_VALIDATION_ERROR (PostgreSQL):", validationResult.error.flatten());
      console.error("Validation Errors (raw):", validationResult.error.errors);
      return NextResponse.json({ error: "Validation failed", details: validationResult.error.errors }, { status: 400 });
    }
    const data = validationResult.data;
    
    // Generate a unified request ID for the visa application
    // Use the destination country as context for the request ID
    let contextForVisaId = data.destination.substring(0, 5).toUpperCase();
    const visaRequestId = generateRequestId('VIS', contextForVisaId);
    console.log("API_VISA_POST (PostgreSQL): Generated Visa ID:", visaRequestId);

    const [newVisaApp] = await sql`
      INSERT INTO visa_applications (
        id, requestor_name, travel_purpose, destination, staff_id,
        visa_type, trip_start_date, trip_end_date, 
        passport_number, passport_expiry_date, status, additional_comments,
        submitted_date, last_updated_date, created_at, updated_at
      ) VALUES (
        ${visaRequestId}, ${data.applicantName}, ${data.travelPurpose}, ${data.destination}, 
        ${data.employeeId || null},
        ${data.visaType}, ${formatISO(data.tripStartDate, { representation: 'date' })}, 
        ${formatISO(data.tripEndDate, { representation: 'date' })},
        ${data.passportNumber || null}, 
        ${data.passportExpiryDate ? formatISO(data.passportExpiryDate, { representation: 'date' }) : null},
        'Pending Department Focal', ${(data.itineraryDetails || '') + (data.supportingDocumentsNotes ? '\n\nSupporting Documents:\n' + data.supportingDocumentsNotes : '')},
        NOW(), NOW(), NOW(), NOW()
      ) RETURNING *
    `;
    
    // Add initial approval step
    await sql`
        INSERT INTO visa_approval_steps (
          visa_application_id, step_number, step_role, step_name, 
          status, step_date, comments, created_at, updated_at
        )
        VALUES (
          ${newVisaApp.id}, 1, 'Applicant', ${data.applicantName || 'Applicant'}, 
          'Submitted', NOW(), 'Initial submission.', NOW(), NOW()
        )
    `;

    console.log("API_VISA_POST (PostgreSQL): Visa application created successfully:", newVisaApp.id);
    return NextResponse.json({ 
      message: 'Visa application submitted successfully!', 
      visaApplication: newVisaApp,
      requestId: visaRequestId
    }, { status: 201 });
  } catch (error: any) {
    console.error("API_VISA_POST_ERROR (PostgreSQL):", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to create visa application.', details: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  console.log("API_VISA_GET_START (PostgreSQL): Fetching visa applications.");
  if (!sql) {
    console.error("API_VISA_GET_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized. Check server logs.' }, { status: 503 });
  }
  
  // Debug environment variables
  console.log("API_VISA_GET_DEBUG: Environment variables check:");
  console.log("DATABASE_HOST:", process.env.DATABASE_HOST || 'NOT SET');
  console.log("DATABASE_NAME:", process.env.DATABASE_NAME || 'NOT SET');
  console.log("DATABASE_USER:", process.env.DATABASE_USER || 'NOT SET');
  console.log("DATABASE_PASSWORD:", process.env.DATABASE_PASSWORD ? 'SET (value hidden)' : 'NOT SET');
  
  // Get query parameters for filtering
  const statusesParam = request.nextUrl.searchParams.get('statuses');
  const limit = request.nextUrl.searchParams.get('limit') || '50';
  
  try {
    console.log("API_VISA_GET (PostgreSQL): Attempting to query visa applications.");
    console.log("API_VISA_GET (PostgreSQL): Status filter:", statusesParam || 'None');
    
    let apps;
    
    if (statusesParam) {
      // Split the comma-separated statuses and filter by them
      const statuses = statusesParam.split(',');
      console.log("API_VISA_GET (PostgreSQL): Filtering by statuses:", statuses);
      
      apps = await sql`
        SELECT 
          id, 
          user_id as "userId",
          requestor_name as "applicantName", 
          travel_purpose as "travelPurpose", 
          destination, 
          status, 
          submitted_date as "submittedDate", 
          trip_start_date as "tripStartDate", 
          trip_end_date as "tripEndDate",
          visa_type as "visaType",
          last_updated_date as "lastUpdatedDate",
          staff_id as "employeeId",
          passport_number as "passportNumber",
          passport_expiry_date as "passportExpiryDate",
          additional_comments as "itineraryDetails"
        FROM visa_applications 
        WHERE status = ANY(${statuses})
        ORDER BY submitted_date DESC
        LIMIT ${parseInt(limit)}
      `;
    } else {
      // No status filter, return all visa applications
      apps = await sql`
        SELECT 
          id, 
          user_id as "userId",
          requestor_name as "applicantName", 
          travel_purpose as "travelPurpose", 
          destination, 
          status, 
          submitted_date as "submittedDate", 
          trip_start_date as "tripStartDate", 
          trip_end_date as "tripEndDate",
          visa_type as "visaType",
          last_updated_date as "lastUpdatedDate",
          staff_id as "employeeId",
          passport_number as "passportNumber",
          passport_expiry_date as "passportExpiryDate",
          additional_comments as "itineraryDetails"
        FROM visa_applications 
        ORDER BY submitted_date DESC
        LIMIT ${parseInt(limit)}
      `;
    }
    
    console.log(`API_VISA_GET (PostgreSQL): Found ${apps.length} visa applications.`);
    
    // Map database field names to frontend field names
    const formattedApps = apps.map(app => ({
        id: app.id,
        userId: app.userId || '',
        applicantName: app.applicantName,
        travelPurpose: app.travelPurpose,
        destination: app.destination,
        employeeId: app.employeeId || '',
        nationality: '', // Default empty string since column doesn't exist
        tripStartDate: app.tripStartDate ? new Date(app.tripStartDate) : null,
        tripEndDate: app.tripEndDate ? new Date(app.tripEndDate) : null,
        itineraryDetails: app.itineraryDetails ? app.itineraryDetails.split('\n\nSupporting Documents:')[0] : '',
        supportingDocumentsNotes: app.itineraryDetails && app.itineraryDetails.includes('\n\nSupporting Documents:') 
          ? app.itineraryDetails.split('\n\nSupporting Documents:')[1] 
          : '',
        status: app.status,
        submittedDate: app.submittedDate ? new Date(app.submittedDate) : new Date(),
        lastUpdatedDate: app.lastUpdatedDate ? new Date(app.lastUpdatedDate) : new Date(),
        // Passport information
        passportNumber: app.passportNumber || '',
        passportExpiryDate: app.passportExpiryDate ? new Date(app.passportExpiryDate) : null,
    }));
    
    console.log("API_VISA_GET (PostgreSQL): Successfully mapped visa applications to frontend format.");
    return NextResponse.json({ visaApplications: formattedApps });
  } catch (error: any) {
    console.error("API_VISA_GET_ERROR (PostgreSQL):", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to fetch visa applications.', details: error.message }, { status: 500 });
  }
}
