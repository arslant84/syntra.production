// src/app/api/accommodation/requests/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { formatISO } from 'date-fns';
import { generateRequestId } from '@/utils/requestIdGenerator';
import { requireAuth, createAuthError } from '@/lib/auth-utils';
import { withAuth, canViewAllData, canViewDomainData, canViewApprovalData, getUserIdentifier } from '@/lib/api-protection';
import { NotificationService } from '@/lib/notification-service';
import { generateUniversalUserFilter, shouldBypassUserFilter } from '@/lib/universal-user-matching';

const accommodationRequestSchema = z.object({
  trfId: z.string().optional().nullable(), // Can be optional if not directly tied to a TRF
  requestorName: z.string().min(1, "Requestor name is required"),
  requestorId: z.string().optional().nullable(),
  requestorGender: z.enum(["Male", "Female"], { required_error: "Gender is required" }),
  department: z.string().optional().nullable(),
  location: z.enum(["Ashgabat", "Kiyanly", "Turkmenbashy"], { required_error: "Location is required" }),
  requestedCheckInDate: z.coerce.date({ required_error: "Check-in date is required" }),
  requestedCheckOutDate: z.coerce.date({ required_error: "Check-out date is required" }),
  requestedRoomType: z.string().optional().nullable(),
  specialRequests: z.string().optional().nullable(),
  flightArrivalTime: z.string().optional().nullable(), // Will be stored in check_in_time
  flightDepartureTime: z.string().optional().nullable(), // Will be stored in check_out_time
}).refine(data => data.requestedCheckOutDate >= data.requestedCheckInDate, {
  message: "Check-out date must be after or same as check-in date.",
  path: ["requestedCheckOutDate"],
});

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const user = await requireAuth();
    console.log(`API_ACCOM_REQ_POST_START: User ${user.email} creating accommodation request.`);

    if (!sql) {
      return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
    }
    const body = await request.json();
    const validationResult = accommodationRequestSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("API_ACCOM_REQ_POST_VALIDATION_ERROR (PostgreSQL):", validationResult.error.flatten());
      return NextResponse.json({ error: "Validation failed", details: validationResult.error.flatten() }, { status: 400 });
    }
    const data = validationResult.data;
    
    // Generate a unified request ID for the accommodation request
    // Use the location as context for the request ID
    const contextForAccomId = data.location.substring(0, 5).toUpperCase();
    const accomRequestId = generateRequestId('ACCOM', contextForAccomId);
    console.log("API_ACCOM_REQ_POST (PostgreSQL): Generated Accommodation Request ID:", accomRequestId);

    // First, create a travel request entry to get an accommodation request ID
    const [newTravelRequest] = await sql`
      INSERT INTO travel_requests (
        id, requestor_name, staff_id, department, travel_type, status, additional_comments, submitted_at
      ) VALUES (
        ${accomRequestId}, ${data.requestorName}, ${data.requestorId || null}, ${data.department || null}, 
        'Accommodation', 'Pending Department Focal', ${data.specialRequests || null}, NOW()
      ) RETURNING *
    `;
    
    // Then create the accommodation details entry linked to the travel request
    const [newAccommodationDetails] = await sql`
      INSERT INTO trf_accommodation_details (
        trf_id, check_in_date, check_out_date, accommodation_type, location, 
        check_in_time, check_out_time, created_at
      ) VALUES (
        ${newTravelRequest.id}, 
        ${formatISO(data.requestedCheckInDate, { representation: 'date' })},
        ${formatISO(data.requestedCheckOutDate, { representation: 'date' })}, 
        ${data.requestedRoomType || null}, 
        ${data.location},
        ${data.flightArrivalTime || null}, 
        ${data.flightDepartureTime || null},
        NOW()
      ) RETURNING *
    `;
    
    // Create initial approval step (like TSR does)
    console.log("API_ACCOM_REQ_POST (PostgreSQL): Creating initial approval step for accommodation request:", accomRequestId);
    await sql`
      INSERT INTO trf_approval_steps (trf_id, step_role, step_name, status, step_date, comments)
      VALUES (${newTravelRequest.id}, 'Requestor', ${data.requestorName}, 'Approved', NOW(), 'Submitted accommodation request.')
    `;
    
    // Combine the data for the response
    // For standalone accommodation requests, the main ID should be the ACCOM ID
    // and trfId should only be populated if this was created from a TSR
    const newRequest = {
      id: newTravelRequest.id, // This is the ACCOM ID 
      trfId: data.trfId || null, // Only populate if created from a TSR
      requestorName: newTravelRequest.requestor_name,
      requestorId: newTravelRequest.staff_id,
      department: newTravelRequest.department,
      location: newAccommodationDetails.location,
      requestedCheckInDate: newAccommodationDetails.check_in_date,
      requestedCheckOutDate: newAccommodationDetails.check_out_date,
      requestedRoomType: newAccommodationDetails.accommodation_type,
      status: newTravelRequest.status,
      specialRequests: newTravelRequest.additional_comments,
      flightArrivalTime: newAccommodationDetails.check_in_time,
      flightDepartureTime: newAccommodationDetails.check_out_time,
      submittedDate: newTravelRequest.submitted_at
    };
    console.log("API_ACCOM_REQ_POST (PostgreSQL): Accommodation request created:", newRequest.id);
    
    // Send notification to Department Focals in the requestor's department
    try {
      // First get the requestor's department from their user record
      let requestorDepartment = 'Unknown';
      if (data.requestorId) {
        const requestorInfo = await sql`
          SELECT department FROM users WHERE staff_id = ${data.requestorId} OR email = ${data.requestorId} LIMIT 1
        `;
        if (requestorInfo.length > 0) {
          requestorDepartment = requestorInfo[0].department || 'Unknown';
        }
      }

      // Find Department Focals with accommodation approval permission in the same department
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
          requestorName: data.requestorName,
          entityType: 'accommodation',
          entityId: accomRequestId,
          entityTitle: `Accommodation Request at ${data.location}`
        });
      }
      
      if (departmentFocals.length > 0) {
        console.log(`Created approval notifications for accommodation ${accomRequestId} to ${departmentFocals.length} department focals`);
      }
    } catch (notificationError) {
      console.error('Error sending notifications for new accommodation request:', notificationError);
      // Don't fail the main operation due to notification errors
    }
    
    return NextResponse.json({ 
      message: 'Accommodation request submitted successfully!', 
      accommodationRequest: newRequest,
      requestId: accomRequestId
    }, { status: 201 });
  } catch (error: any) {
    // Handle authentication errors
    if (error.message === 'UNAUTHORIZED') {
      const authError = createAuthError('UNAUTHORIZED');
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    
    console.error("API_ACCOM_REQ_POST_ERROR (PostgreSQL):", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to create accommodation request.' }, { status: 500 });
  }
}

export const GET = withAuth(async function(request: NextRequest) {
  try {
    const session = (request as any).user;
    console.log(`API_ACCOM_REQ_GET_START: User ${session.role} (${session.email}) fetching accommodation requests.`);

    if (!sql) {
      return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
    }
  
    // Parse query parameters
    const url = new URL(request.url);
    const statusesParam = url.searchParams.get('statuses');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    
    console.log(`API_ACCOM_REQ_GET (PostgreSQL): Filtering by statuses: ${statusesParam || 'None'}, limit: ${limit}`);
    
    // Universal user filtering system
    let userFilterCondition = '';
    
    if (shouldBypassUserFilter(session, statusesParam)) {
      console.log(`API_ACCOM_REQ_GET (PostgreSQL): Admin ${session.role} viewing approval queue - no user filter`);
      // Admins viewing approval queue see all requests
      userFilterCondition = '';
    } else {
      // Use simplified, safe user filtering for accommodation
      const userIdentifier = getUserIdentifier(session);
      console.log(`API_ACCOM_REQ_GET (PostgreSQL): User ${session.role} viewing own accommodation requests`);
      console.log(`API_ACCOM_REQ_GET (PostgreSQL): User data - staffId: ${userIdentifier.staffId}, name: ${session.name}`);
      
      // Build safe user filter conditions
      const userConditions = [];
      if (userIdentifier.staffId) {
        userConditions.push(`tr.staff_id = '${userIdentifier.staffId}'`);
      }
      if (userIdentifier.userId && userIdentifier.userId.includes('-')) {
        userConditions.push(`tr.staff_id IN (SELECT staff_id FROM users WHERE id = '${userIdentifier.userId}')`);
      } else if (userIdentifier.userId) {
        userConditions.push(`tr.staff_id = '${userIdentifier.userId}'`);
      }
      if (session.name) {
        userConditions.push(`tr.requestor_name = '${session.name.replace(/'/g, "''")}'`); // Escape single quotes
      }
      if (userIdentifier.email) {
        userConditions.push(`tr.requestor_name ILIKE '%${userIdentifier.email.replace(/'/g, "''")}%'`);
      }
      
      if (userConditions.length > 0) {
        userFilterCondition = ` AND (${userConditions.join(' OR ')})`;
      } else {
        userFilterCondition = ` AND tr.staff_id = 'NO_MATCH'`; // Fallback
      }
    }
    
    try {
      // Parse status filter if provided
      const statuses = statusesParam ? statusesParam.split(',').map(s => s.trim()) : [];
      
      // Execute the query with conditional WHERE clause
      let requests;
    
      // Build dynamic queries with user filtering
      if (statuses.length > 0) {
        console.log(`API_ACCOM_REQ_GET (PostgreSQL): Using statuses filter with values: ${JSON.stringify(statuses)}`);
        
        // Use sql.unsafe for dynamic WHERE clause construction
        requests = await sql.unsafe(`
          SELECT DISTINCT ON (tr.id)
            tr.id,
            CASE 
              WHEN tr.travel_type = 'Accommodation' THEN NULL 
              ELSE tr.id 
            END as "trfId",
            tr.requestor_name as "requestorName",
            tr.staff_id as "requestorId",
            COALESCE(u.gender, 'Male') as "requestorGender", 
            tr.department,
            tad.location,
            tad.check_in_date as "requestedCheckInDate",
            tad.check_out_date as "requestedCheckOutDate",
            tad.accommodation_type as "requestedRoomType",
            COALESCE(
              (SELECT CASE 
                WHEN COUNT(CASE WHEN tas.status = 'Rejected' THEN 1 END) > 0 THEN 'Rejected'
                WHEN COUNT(CASE WHEN tas.status = 'Cancelled' THEN 1 END) > 0 THEN 'Cancelled'
                WHEN tr.status IN ('Approved', 'Processing', 'Completed', 'Processing Accommodation', 'TRF Processed', 'Awaiting Visa') THEN tr.status
                ELSE tr.status
              END
              FROM trf_approval_steps tas 
              WHERE tas.trf_id = tr.id),
              tr.status
            ) as status,
            NULL as "assignedRoomName",
            NULL as "assignedStaffHouseName",
            tr.submitted_at as "submittedDate",
            tr.updated_at as "lastUpdatedDate",
            tr.additional_comments as "specialRequests",
            tad.check_in_time as "flightArrivalTime",
            tad.check_out_time as "flightDepartureTime"
          FROM 
            travel_requests tr
          INNER JOIN 
            trf_accommodation_details tad ON tad.trf_id = tr.id
          LEFT JOIN 
            users u ON tr.staff_id = u.id
          WHERE tr.status IN (${statuses.map(s => `'${s}'`).join(', ')})
            AND tr.id IS NOT NULL
            ${userFilterCondition}
          ORDER BY 
            tr.id, tr.submitted_at DESC
          LIMIT ${limit}
        `);
        console.log(`API_ACCOM_REQ_GET (PostgreSQL): Found ${requests.length} requests with status filtering`);
      } else {
        // When not filtering by status - get travel requests that have accommodation details
        requests = await sql.unsafe(`
          SELECT DISTINCT ON (tr.id)
            tr.id,
            CASE 
              WHEN tr.travel_type = 'Accommodation' THEN NULL 
              ELSE tr.id 
            END as "trfId",
            tr.requestor_name as "requestorName",
            tr.staff_id as "requestorId",
            COALESCE(u.gender, 'Male') as "requestorGender", 
            tr.department,
            tad.location,
            tad.check_in_date as "requestedCheckInDate",
            tad.check_out_date as "requestedCheckOutDate",
            tad.accommodation_type as "requestedRoomType",
            COALESCE(
              (SELECT CASE 
                WHEN COUNT(CASE WHEN tas.status = 'Rejected' THEN 1 END) > 0 THEN 'Rejected'
                WHEN COUNT(CASE WHEN tas.status = 'Cancelled' THEN 1 END) > 0 THEN 'Cancelled'
                WHEN tr.status IN ('Approved', 'Processing', 'Completed', 'Processing Accommodation', 'TRF Processed', 'Awaiting Visa') THEN tr.status
                ELSE tr.status
              END
              FROM trf_approval_steps tas 
              WHERE tas.trf_id = tr.id),
              tr.status
            ) as status,
            NULL as "assignedRoomName",
            NULL as "assignedStaffHouseName",
            tr.submitted_at as "submittedDate",
            tr.updated_at as "lastUpdatedDate",
            tr.additional_comments as "specialRequests",
            tad.check_in_time as "flightArrivalTime",
            tad.check_out_time as "flightDepartureTime"
          FROM 
            travel_requests tr
          INNER JOIN 
            trf_accommodation_details tad ON tad.trf_id = tr.id
          LEFT JOIN 
            users u ON tr.staff_id = u.id
          WHERE 
            tr.id IS NOT NULL
            ${userFilterCondition}
          ORDER BY 
            tr.id, tr.submitted_at DESC
          LIMIT ${limit}
        `);
        console.log(`API_ACCOM_REQ_GET (PostgreSQL): Found ${requests.length} travel requests with accommodation details`);
      }
    
    console.log(`API_ACCOM_REQ_GET (PostgreSQL): Total unique requests found: ${requests.length}`);
    
    const formattedRequests = requests.map(req => ({
        ...req,
        requestedCheckInDate: req.requestedCheckInDate ? formatISO(new Date(req.requestedCheckInDate)) : null,
        requestedCheckOutDate: req.requestedCheckOutDate ? formatISO(new Date(req.requestedCheckOutDate)) : null,
        submittedDate: req.submittedDate ? formatISO(new Date(req.submittedDate)) : null,
        lastUpdatedDate: req.lastUpdatedDate ? formatISO(new Date(req.lastUpdatedDate)) : null,
    }));
      return NextResponse.json({ accommodationRequests: formattedRequests });
    } catch (error: any) {
      console.error("API_ACCOM_REQ_GET_ERROR (PostgreSQL):", error.message, error.stack);
      return NextResponse.json({ error: 'Failed to fetch accommodation requests.' }, { status: 500 });
    }
  } catch (error: any) {
    console.error("API_ACCOM_REQ_GET_ERROR (PostgreSQL):", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to fetch accommodation requests.' }, { status: 500 });
  }
});
