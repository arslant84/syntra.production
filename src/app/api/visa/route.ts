// src/app/api/visa/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db'; // Assuming PostgreSQL setup
import { formatISO, parseISO } from 'date-fns';

const visaApplicationCreateSchema = z.object({
  requestorName: z.string().min(1, "Requestor name is required"),
  travelPurpose: z.string().min(1, "Travel purpose is required"),
  destination: z.string().min(1, "Destination is required"),
  staffId: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  email: z.string().optional().nullable(), // Made email optional to match frontend data
  visaType: z.string().min(1, "Visa type is required"),
  tripStartDate: z.coerce.date({ required_error: "Trip start date is required" }),
  tripEndDate: z.coerce.date({ required_error: "Trip end date is required" }),
  passportNumber: z.string().optional().nullable(),
  passportExpiryDate: z.coerce.date().optional().nullable(),
  additionalComments: z.string().optional().nullable(),
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
      return NextResponse.json({ error: "Validation failed", details: validationResult.error.flatten() }, { status: 400 });
    }
    const data = validationResult.data;

    const [newVisaApp] = await sql`
      INSERT INTO visa_applications (
        requestor_name, travel_purpose, destination, staff_id, department,
        position, email, visa_type, trip_start_date, trip_end_date, 
        passport_number, passport_expiry_date, status, additional_comments,
        submitted_date, last_updated_date, created_at, updated_at
      ) VALUES (
        ${data.requestorName}, ${data.travelPurpose}, ${data.destination}, 
        ${data.staffId || null}, ${data.department || null},
        ${data.position || null}, ${data.email || null}, ${data.visaType},
        ${formatISO(data.tripStartDate, { representation: 'date' })}, 
        ${formatISO(data.tripEndDate, { representation: 'date' })},
        ${data.passportNumber || null}, 
        ${data.passportExpiryDate ? formatISO(data.passportExpiryDate, { representation: 'date' }) : null},
        'Pending Department Focal', ${data.additionalComments || null},
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
          ${newVisaApp.id}, 1, 'Applicant', ${data.requestorName || 'Applicant'}, 
          'Submitted', NOW(), 'Initial submission.', NOW(), NOW()
        )
    `;

    console.log("API_VISA_POST (PostgreSQL): Visa application created successfully:", newVisaApp.id);
    return NextResponse.json({ 
      message: 'Visa application submitted successfully!', 
      visaApplication: newVisaApp 
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
        ORDER BY submitted_date DESC
        LIMIT ${parseInt(limit)}
      `;
    }
    
    console.log(`API_VISA_GET (PostgreSQL): Found ${apps.length} visa applications.`);
    
    // Map database field names to frontend field names
    const formattedApps = apps.map(app => ({
        id: app.id,
        userId: app.userId || '',
        applicantName: app.requestorName, // Map requestorName to applicantName for frontend
        travelPurpose: app.travelPurpose,
        destination: app.destination,
        employeeId: app.staffId || '', // Map staffId to employeeId for frontend
        nationality: app.department || '', // Use department as nationality for now
        tripStartDate: app.tripStartDate ? new Date(app.tripStartDate) : null,
        tripEndDate: app.tripEndDate ? new Date(app.tripEndDate) : null,
        itineraryDetails: app.additionalComments || '', // Use additionalComments as itineraryDetails
        status: app.status,
        submittedDate: app.submittedDate ? new Date(app.submittedDate) : new Date(),
        lastUpdatedDate: app.lastUpdatedDate ? new Date(app.lastUpdatedDate) : new Date(),
    }));
    
    console.log("API_VISA_GET (PostgreSQL): Successfully mapped visa applications to frontend format.");
    return NextResponse.json({ visaApplications: formattedApps });
  } catch (error: any) {
    console.error("API_VISA_GET_ERROR (PostgreSQL):", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to fetch visa applications.', details: error.message }, { status: 500 });
  }
}
