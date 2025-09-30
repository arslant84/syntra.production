// src/app/api/visa/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db'; // Assuming PostgreSQL setup
import { formatISO, parseISO } from 'date-fns';
import { generateRequestId } from '@/utils/requestIdGenerator';
import { withAuth, canViewAllData, canViewDomainData, canViewApprovalData, getUserIdentifier } from '@/lib/api-protection';
import { hasPermission, hasAnyPermission } from '@/lib/session-utils';
import { UnifiedNotificationService } from '@/lib/unified-notification-service';
import { generateUniversalUserFilter, shouldBypassUserFilter } from '@/lib/universal-user-matching';
import { withCache, userCacheKey, CACHE_TTL } from '@/lib/cache';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { generateRequestFingerprint, checkAndMarkRequest, markRequestCompleted } from '@/lib/request-deduplication';

// Enhanced schema to match LOI Request Form
const visaApplicationCreateSchema = z.object({
  // Section A: Particulars of Applicant
  applicantName: z.string().min(1, "Full name is required"),
  dateOfBirth: z.coerce.date().optional().nullable(),
  placeOfBirth: z.string().optional().nullable(),
  citizenship: z.string().optional().nullable(),
  passportNumber: z.string().optional().nullable(),
  passportPlaceOfIssuance: z.string().optional().nullable(),
  passportDateOfIssuance: z.coerce.date().optional().nullable(),
  passportExpiryDate: z.coerce.date().optional().nullable(),
  contactTelephone: z.string().optional().nullable(),
  homeAddress: z.string().optional().nullable(),
  educationDetails: z.string().optional().nullable(),
  currentEmployerName: z.string().optional().nullable(),
  currentEmployerAddress: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  maritalStatus: z.string().optional().nullable(),
  familyInformation: z.string().optional().nullable(),

  // Section B: Type of Request
  requestType: z.enum(["LOI", "VISA", "WORK_PERMIT"]).optional().nullable(),
  approximatelyArrivalDate: z.coerce.date().optional().nullable(),
  durationOfStay: z.string().optional().nullable(),
  visaEntryType: z.enum(["Multiple", "Single", "Double"]).optional().nullable(),
  workVisitCategory: z.enum([
    "CEO", "TLS", "TSE", "TKA",
    "TKA-ME", "TKA-PE", "TKA-TE", "TKA-OE",
    "TPD", "TSS", "TWD", "TFA",
    "TPM", "TBE", "TBE-IT", "TRA",
    "TSM", "THR", "THR-CM", "Company Guest"
  ]).optional().nullable(),
  applicationFeesBorneBy: z.enum(["PC(T)SB Dept", "OPU", "Myself"]).optional().nullable(),
  costCentreNumber: z.string().optional().nullable(),

  // Legacy fields for backward compatibility
  travelPurpose: z.string().min(1, "Travel purpose is required"),
  destination: z.string().optional().nullable(),
  employeeId: z.string().optional().nullable(),
  visaType: z.string().optional().nullable(),
  tripStartDate: z.coerce.date({ required_error: "Trip start date is required" }),
  tripEndDate: z.coerce.date({ required_error: "Trip end date is required" }),
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
        id, user_id, requestor_name, travel_purpose, destination, staff_id,
        visa_type, trip_start_date, trip_end_date,
        passport_number, passport_expiry_date, status, additional_comments,
        submitted_date, last_updated_date, created_at, updated_at,
        -- New LOI Form fields
        date_of_birth, place_of_birth, citizenship,
        passport_place_of_issuance, passport_date_of_issuance,
        contact_telephone, home_address, education_details,
        current_employer_name, current_employer_address,
        position, department, marital_status, family_information,
        request_type, approximately_arrival_date, duration_of_stay,
        visa_entry_type, work_visit_category, application_fees_borne_by, cost_centre_number
      ) VALUES (
        ${visaRequestId}, ${session.id}, ${data.applicantName}, ${data.travelPurpose}, ${data.destination},
        ${data.employeeId || null},
        ${data.visaType || data.requestType || 'VISA'},
        ${formatISO(data.tripStartDate, { representation: 'date' })},
        ${formatISO(data.tripEndDate, { representation: 'date' })},
        ${data.passportNumber || null},
        ${data.passportExpiryDate ? formatISO(data.passportExpiryDate, { representation: 'date' }) : null},
        'Pending Department Focal',
        ${(data.itineraryDetails || '') + (data.supportingDocumentsNotes ? '\n\nSupporting Documents:\n' + data.supportingDocumentsNotes : '')},
        NOW(), NOW(), NOW(), NOW(),
        -- New LOI Form field values
        ${data.dateOfBirth ? formatISO(data.dateOfBirth, { representation: 'date' }) : null},
        ${data.placeOfBirth || null}, ${data.citizenship || null},
        ${data.passportPlaceOfIssuance || null},
        ${data.passportDateOfIssuance ? formatISO(data.passportDateOfIssuance, { representation: 'date' }) : null},
        ${data.contactTelephone || null}, ${data.homeAddress || null}, ${data.educationDetails || null},
        ${data.currentEmployerName || null}, ${data.currentEmployerAddress || null},
        ${data.position || null}, ${data.department || null}, ${data.maritalStatus || null}, ${data.familyInformation || null},
        ${data.requestType || 'VISA'},
        ${data.approximatelyArrivalDate ? formatISO(data.approximatelyArrivalDate, { representation: 'date' }) : null},
        ${data.durationOfStay || null}, ${data.visaEntryType || null}, ${data.workVisitCategory || null},
        ${data.applicationFeesBorneBy || null}, ${data.costCentreNumber || null}
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
        
        // Send workflow notification using unified notification system
        await UnifiedNotificationService.sendWorkflowNotification({
          eventType: 'visa_submitted',
          entityType: 'visa',
          entityId: visaRequestId,
          requestorName: data.applicantName,
          requestorEmail: session.email,
          requestorId: session.id,
          department: session.department || 'Unknown',
          currentStatus: 'Pending Department Focal',
          entityTitle: `Visa Application to ${data.destination || 'Unknown Destination'}`
        });
        
        console.log(`✅ VISA_NOTIFICATION: Sent workflow notification for visa ${visaRequestId}`);
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
  const summary = request.nextUrl.searchParams.get('summary');
  const year = request.nextUrl.searchParams.get('year') || new Date().getFullYear().toString();
  const fromDate = request.nextUrl.searchParams.get('fromDate');
  const toDate = request.nextUrl.searchParams.get('toDate');
  
  try {
    console.log("API_VISA_GET (PostgreSQL): Attempting to query visa applications.");
    console.log("API_VISA_GET (PostgreSQL): Status filter:", statusesParam || 'None');

    // Handle summary requests for reports page
    if (summary === 'true') {
      console.log("API_VISA_GET (PostgreSQL): Generating summary data for reports");

      // Generate user filter for summary
      let userFilter = '';
      if (!shouldBypassUserFilter(session, statusesParam)) {
        userFilter = ` AND ${generateUniversalUserFilter(session, '', {
          staffIdField: 'staff_id',
          nameField: 'requestor_name',
          emailField: 'email',
          userIdField: 'user_id'
        })}`;
      }

      // Build date filter
      let dateFilter = '';
      if (fromDate && toDate) {
        dateFilter = ` AND submitted_date BETWEEN '${fromDate}' AND '${toDate}'`;
      } else {
        // Default to current year if no date range specified
        dateFilter = ` AND EXTRACT(YEAR FROM submitted_date) = ${parseInt(year)}`;
      }

      // Query to get status counts by month
      const summaryQuery = `
        SELECT
          TO_CHAR(submitted_date, 'YYYY-MM') as month,
          COUNT(*) FILTER (WHERE status LIKE '%Pending%' OR status = 'Draft' OR status IS NULL) as pending,
          COUNT(*) FILTER (WHERE status LIKE '%Approved%' OR status = 'Completed') as approved,
          COUNT(*) FILTER (WHERE status LIKE '%Rejected%' OR status LIKE '%Denied%') as rejected
        FROM visa_applications
        WHERE 1=1${userFilter}${dateFilter}
        GROUP BY TO_CHAR(submitted_date, 'YYYY-MM')
        ORDER BY month
      `;

      const summaryData = await sql.unsafe(summaryQuery);

      // Format data for frontend
      const statusByMonth = summaryData.map(row => ({
        month: row.month,
        pending: parseInt(row.pending) || 0,
        approved: parseInt(row.approved) || 0,
        rejected: parseInt(row.rejected) || 0
      }));

      console.log("API_VISA_GET (PostgreSQL): Generated summary data:", statusByMonth);
      return NextResponse.json({ statusByMonth });
    }
    
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
