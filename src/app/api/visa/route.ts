// src/app/api/visa/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db'; // Assuming PostgreSQL setup
import { formatISO, parseISO } from 'date-fns';
import { generateRequestId } from '@/utils/requestIdGenerator';
import { withAuth, canViewAllData, canViewDomainData, canViewApprovalData, getUserIdentifier } from '@/lib/api-protection';
import { hasPermission, hasAnyPermission } from '@/lib/session-utils';
import { NotificationService } from '@/lib/notification-service';
import { generateUniversalUserFilter, shouldBypassUserFilter } from '@/lib/universal-user-matching';
import { withCache, userCacheKey, CACHE_TTL } from '@/lib/cache';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { generateRequestFingerprint, checkAndMarkRequest, markRequestCompleted } from '@/lib/request-deduplication';

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


export const POST = withRateLimit(RATE_LIMITS.API_WRITE)(withAuth(async function(request: NextRequest) {
  console.log("API_VISA_POST_START (PostgreSQL): Creating visa application.");
  
  const session = (request as any).user;
  
  // Check if user has permission to create visa applications - using create_trf as requestors should be able to create visa applications
  if (!hasAnyPermission(session, ['create_trf', 'create_visa_applications'])) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }
  
  if (!sql) {
    console.error("API_VISA_POST_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized. Check server logs.' }, { status: 503 });
  }
  
  let requestFingerprint: string | undefined;
  
  try {
    const body = await request.json();
    const validationResult = visaApplicationCreateSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("API_VISA_POST_VALIDATION_ERROR (PostgreSQL):", validationResult.error.flatten());
      console.error("Validation Errors (raw):", validationResult.error.errors);
      return NextResponse.json({ error: "Validation failed", details: validationResult.error.errors }, { status: 400 });
    }
    const data = validationResult.data;

    // Check for duplicate submission using request deduplication
    requestFingerprint = generateRequestFingerprint(
      session.id,
      'visa_submission',
      {
        applicantName: data.applicantName,
        travelPurpose: data.travelPurpose,
        destination: data.destination,
        visaType: data.visaType,
        tripStartDate: data.tripStartDate.toISOString(),
        tripEndDate: data.tripEndDate.toISOString()
      }
    );

    const deduplicationResult = checkAndMarkRequest(requestFingerprint, 30000); // 30 seconds TTL
    if (deduplicationResult.isDuplicate) {
      console.warn(`API_VISA_POST_DUPLICATE: Duplicate visa submission detected for user ${session.id}. Time remaining: ${deduplicationResult.timeRemaining}s`);
      return NextResponse.json({ 
        error: 'Duplicate submission detected', 
        message: `Please wait ${deduplicationResult.timeRemaining} seconds before submitting again.`,
        details: 'You recently submitted a similar visa application. To prevent duplicates, please wait before trying again.'
      }, { status: 429 });
    }
    
    // Generate a unified request ID for the visa application
    // Use the destination country as context for the request ID
    let contextForVisaId = data.destination?.substring(0, 5).toUpperCase() || 'VISA';
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
          visa_id, step_role, step_name, 
          status, step_date, comments, created_at, updated_at
        )
        VALUES (
          ${newVisaApp.id}, 'Applicant', ${data.applicantName || 'Applicant'}, 
          'Submitted', NOW(), 'Initial submission.', NOW(), NOW()
        )
    `;

    // Mark deduplication request as completed (successful submission)
    markRequestCompleted(requestFingerprint);
    
    // Return response immediately, then process notifications asynchronously
    const response = NextResponse.json({ 
      message: 'Visa application submitted successfully!', 
      visaApplication: newVisaApp,
      requestId: visaRequestId
    }, { status: 201 });

    // Process notifications asynchronously (non-blocking)
    setImmediate(async () => {
      try {
        console.log(`🔔 VISA_NOTIFICATION: Starting async notification process for visa ${visaRequestId}`);
        
        // Use requestor's department from session (avoid database query)
        const requestorDepartment = session.department || 'Unknown';

        // Find Department Focals with visa approval permission in the same department
        const departmentFocals = await sql`
          SELECT u.id, u.name 
          FROM users u
          INNER JOIN role_permissions rp ON u.role_id = rp.role_id
          INNER JOIN permissions p ON rp.permission_id = p.id
          WHERE p.name = 'approve_trf_focal'
            AND u.department = ${requestorDepartment}
            AND u.status = 'Active'
        `;

        for (const focal of departmentFocals) {
          await NotificationService.createApprovalRequest({
            approverId: focal.id,
            requestorName: data.applicantName,
            entityType: 'visa',
            entityId: visaRequestId,
            entityTitle: `Visa Application to ${data.destination || 'Unknown Destination'}`
          });
        }
        
        if (departmentFocals.length > 0) {
          console.log(`✅ VISA_NOTIFICATION: Created approval notifications for visa ${visaRequestId} to ${departmentFocals.length} department focals`);
        }
      } catch (notificationError) {
        console.error(`❌ VISA_NOTIFICATION: Error sending async notifications for visa ${visaRequestId}:`, notificationError);
        // Notification failures don't affect the submitted visa application
      }
    });

    console.log("API_VISA_POST (PostgreSQL): Visa application created successfully:", newVisaApp.id);
    return response;
  } catch (error: any) {
    // Clean up deduplication on error
    if (requestFingerprint) {
      markRequestCompleted(requestFingerprint);
    }
    
    console.error("API_VISA_POST_ERROR (PostgreSQL):", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to create visa application.', details: error.message }, { status: 500 });
  }
}));

export const GET = withRateLimit(RATE_LIMITS.API_READ)(withAuth(async function(request: NextRequest) {
  console.log("API_VISA_GET_START (PostgreSQL): Fetching visa applications.");
  
  const session = (request as any).user;
  
  // Role-based access control - authenticated users can access visa applications (they'll see filtered data based on role)
  console.log(`API_VISA_GET: User ${session.role} (${session.email}) accessing visa data`);
  
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
    
    // Role-based data filtering
    let userFilter = '';
    
    // Universal user filtering system
    if (shouldBypassUserFilter(session, statusesParam)) {
      console.log(`API_VISA_GET (PostgreSQL): Admin ${session.role} viewing approval queue - no user filter`);
      // Admins viewing approval queue see all requests
    } else {
      // Use universal user filtering - works for ALL users regardless of role
      console.log(`API_VISA_GET (PostgreSQL): User ${session.role} viewing own visa applications with universal filtering`);
      userFilter = ` AND ${generateUniversalUserFilter(session, '', {
        staffIdField: 'staff_id',
        nameField: 'requestor_name',
        emailField: 'email',
        userIdField: 'user_id'
      })}`;
    }
    
    if (statusesParam) {
      // Split the comma-separated statuses and filter by them
      const statuses = statusesParam.split(',');
      console.log("API_VISA_GET (PostgreSQL): Filtering by statuses:", statuses);
      
      apps = await sql.unsafe(`
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
        WHERE status = ANY(ARRAY[${statuses.map(s => `'${s}'`).join(', ')}])${userFilter}
        ORDER BY submitted_date DESC
        LIMIT ${parseInt(limit)}
      `);
    } else {
      // No status filter, return all visa applications
      apps = await sql.unsafe(`
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
        WHERE 1=1${userFilter}
        ORDER BY submitted_date DESC
        LIMIT ${parseInt(limit)}
      `);
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
}));
