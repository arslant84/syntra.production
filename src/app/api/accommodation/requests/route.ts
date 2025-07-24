// src/app/api/accommodation/requests/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { formatISO } from 'date-fns';
import { generateRequestId } from '@/utils/requestIdGenerator';

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
  console.log("API_ACCOM_REQ_POST_START (PostgreSQL): Creating accommodation request.");
  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }
  try {
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

    // First, create a travel request entry to get a TRF ID
    const [newTravelRequest] = await sql`
      INSERT INTO travel_requests (
        id, requestor_name, staff_id, department, travel_type, status, additional_comments, submitted_at
      ) VALUES (
        ${accomRequestId}, ${data.requestorName}, ${data.requestorId || null}, ${data.department || null}, 
        'Domestic', 'Pending Department Focal', ${data.specialRequests || null}, NOW()
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
    
    // Combine the data for the response
    const newRequest = {
      id: newAccommodationDetails.id,
      trfId: newTravelRequest.id,
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
    // TODO: Notification
    return NextResponse.json({ 
      message: 'Accommodation request submitted successfully!', 
      accommodationRequest: newRequest,
      requestId: accomRequestId
    }, { status: 201 });
  } catch (error: any) {
    console.error("API_ACCOM_REQ_POST_ERROR (PostgreSQL):", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to create accommodation request.', details: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  console.log("API_ACCOM_REQ_GET_START (PostgreSQL): Fetching accommodation requests.");
  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }
  
  // Parse query parameters
  const url = new URL(request.url);
  const statusesParam = url.searchParams.get('statuses');
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  
  console.log(`API_ACCOM_REQ_GET (PostgreSQL): Filtering by statuses: ${statusesParam || 'None'}, limit: ${limit}`);
  
  try {
    // Parse status filter if provided
    const statuses = statusesParam ? statusesParam.split(',').map(s => s.trim()) : [];
    
    // Execute the query with conditional WHERE clause
    let requests;
    
    // For simplicity, we'll create separate queries for with/without status filters
    if (statuses.length > 0) {
      console.log(`API_ACCOM_REQ_GET (PostgreSQL): Using statuses filter with values: ${JSON.stringify(statuses)}`);
      
      // Create a dynamic query based on the number of statuses
      // For each status, we'll create a separate condition with OR
      let whereClause = '';
      for (let i = 0; i < statuses.length; i++) {
        whereClause += i === 0 ? 'WHERE (' : ' OR ';
        whereClause += `tr.status = '${statuses[i].replace(/'/g, "''")}'`; // Escape single quotes
      }
      // Close the parentheses if we have any conditions
      if (statuses.length > 0) {
        whereClause += ')';
      }
      
      // Use raw SQL query with manual escaping for simplicity
      const query = `
        SELECT 
          tad.id,
          tad.trf_id as "trfId",
          tr.requestor_name as "requestorName",
          tr.staff_id as "requestorId",
          'Male' as "requestorGender", 
          tr.department,
          tad.location,
          tad.check_in_date as "requestedCheckInDate",
          tad.check_out_date as "requestedCheckOutDate",
          tad.accommodation_type as "requestedRoomType",
          tr.status,
          NULL as "assignedRoomName",
          NULL as "assignedStaffHouseName",
          tr.submitted_at as "submittedDate",
          tr.updated_at as "lastUpdatedDate",
          tr.additional_comments as "specialRequests",
          tad.check_in_time as "flightArrivalTime",
          tad.check_out_time as "flightDepartureTime"
        FROM 
          trf_accommodation_details tad
        LEFT JOIN 
          travel_requests tr ON tad.trf_id = tr.id
        ${whereClause}
        ORDER BY 
          tr.submitted_at DESC
        LIMIT ${limit}
      `;
      
      console.log(`API_ACCOM_REQ_GET (PostgreSQL): Executing query: ${query}`);
      requests = await (sql as any).unsafe(query);
    } else {
      // When not filtering by status
      requests = await sql`
        SELECT 
          tad.id,
          tad.trf_id as "trfId",
          tr.requestor_name as "requestorName",
          tr.staff_id as "requestorId",
          'Male' as "requestorGender", 
          tr.department,
          tad.location,
          tad.check_in_date as "requestedCheckInDate",
          tad.check_out_date as "requestedCheckOutDate",
          tad.accommodation_type as "requestedRoomType",
          tr.status,
          NULL as "assignedRoomName",
          NULL as "assignedStaffHouseName",
          tr.submitted_at as "submittedDate",
          tr.updated_at as "lastUpdatedDate",
          tr.additional_comments as "specialRequests",
          tad.check_in_time as "flightArrivalTime",
          tad.check_out_time as "flightDepartureTime"
        FROM 
          trf_accommodation_details tad
        LEFT JOIN 
          travel_requests tr ON tad.trf_id = tr.id
        ORDER BY 
          tr.submitted_at DESC
        LIMIT ${limit}
      `;
    }
    
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
    return NextResponse.json({ error: 'Failed to fetch accommodation requests.', details: error.message }, { status: 500 });
  }
}
