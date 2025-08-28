import { sql } from '@/lib/db';
import { BookingData, StaffGuest, StaffHouseData, BookingStatus } from '@/types/accommodation';

export interface AccommodationRequestDetails {
  id: string;
  trfId?: string;
  requestorName: string;
  requestorId: string;
  requestorGender: string;
  department: string;
  location: string;
  requestedCheckInDate: string;
  requestedCheckOutDate: string;
  requestedRoomType: string;
  status: string;
  assignedRoomName?: string;
  assignedStaffHouseName?: string;
  submittedDate: string;
  lastUpdatedDate: string;
  specialRequests?: string;
  flightArrivalTime?: string;
  flightDepartureTime?: string;
}

interface AccommodationApprovalStep {
  role: string; // e.g., 'Requestor', 'Department Focal', 'Line Manager', 'HOD'
  name: string;
  status: 'Current' | 'Pending' | 'Approved' | 'Rejected' | 'Not Started' | 'Cancelled' | 'Submitted';
  date?: Date | string;
  comments?: string;
}

/**
 * Fetches all accommodation requests from the database
 * @param userId Optional user ID to filter requests by user
 * @returns Array of accommodation request details
 */
export async function getAccommodationRequests(userId?: string, statuses?: string[]): Promise<AccommodationRequestDetails[]> {
  try {
    let whereConditions = [sql`tad.trf_id IS NOT NULL`];
    
    if (userId) {
      const isUUID = userId.includes('-');
      if (isUUID) {
        whereConditions.push(sql`tr.staff_id IN (SELECT staff_id FROM users WHERE id = ${userId})`);
      } else {
        whereConditions.push(sql`tr.staff_id = ${userId}`);
      }
    }
    
    if (statuses && statuses.length > 0) {
      whereConditions.push(sql`tr.status IN ${sql(statuses)}`);
    }
    
    // Construct WHERE clause
    let whereClause = sql``;
    if (whereConditions.length > 0) {
      whereClause = sql`WHERE ${ whereConditions[0] }`;
      for (let i = 1; i < whereConditions.length; i++) {
        whereClause = sql`${whereClause} AND ${whereConditions[i]}`;
      }
    }
    
    // Optimized query without complex subquery
    const query = sql`
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
        CASE 
          WHEN tr.travel_type != 'Accommodation' THEN
            -- For TSRs, determine status based on approval workflow completion
            CASE 
              WHEN tr.status = 'Processing Accommodation' THEN 
                -- Check if core approvals are complete for TSR accommodation
                CASE 
                  WHEN (
                    SELECT COUNT(*)
                    FROM trf_approval_steps tas 
                    WHERE tas.trf_id = tr.id 
                    AND tas.step_role IN ('Department Focal', 'Line Manager', 'HOD')
                    AND tas.status = 'Approved'
                  ) >= 3 THEN 'Approved'  -- TSR accommodation should inherit approval status
                  ELSE tr.status
                END
              ELSE tr.status
            END
          ELSE tr.status  -- Pure accommodation requests keep their original status
        END as status,
        NULL as "assignedRoomName",
        NULL as "assignedStaffHouseName",
        tr.submitted_at as "submittedDate",
        tr.updated_at as "lastUpdatedDate",
        tr.additional_comments as "specialRequests",
        tad.check_in_time as "flightArrivalTime",
        tad.check_out_time as "flightDepartureTime"
      FROM 
        trf_accommodation_details tad
      INNER JOIN 
        travel_requests tr ON tr.id = tad.trf_id
      LEFT JOIN 
        users u ON u.staff_id = tr.staff_id
      ${whereClause}
      ORDER BY 
        tr.id, tr.submitted_at DESC
    `;

    const results = await query;
    
    if (!results || results.length === 0) {
      console.log('No accommodation requests found');
      return [];
    }

    console.log(`Found ${results.length} travel requests with accommodation details`);
    
    return results.map((row: any) => ({
      id: row.id,
      trfId: row.trfId,
      requestorName: row.requestorName,
      requestorId: row.requestorId,
      requestorGender: row.requestorGender,
      department: row.department,
      location: row.location,
      requestedCheckInDate: row.requestedCheckInDate,
      requestedCheckOutDate: row.requestedCheckOutDate,
      requestedRoomType: row.requestedRoomType,
      status: row.status,
      assignedRoomName: row.assignedRoomName,
      assignedStaffHouseName: row.assignedStaffHouseName,
      submittedDate: row.submittedDate,
      lastUpdatedDate: row.lastUpdatedDate,
      specialRequests: row.specialRequests,
      flightArrivalTime: row.flightArrivalTime,
      flightDepartureTime: row.flightDepartureTime,
    }));
  } catch (error) {
    console.error('Error fetching accommodation requests:', error);
    throw new Error('Failed to fetch accommodation requests');
  }
}

/**
 * Fetches a single accommodation request by ID
 * @param bookingId The ID of the accommodation request
 * @returns The accommodation request details or null if not found
 */
export async function getAccommodationRequestById(requestId: string): Promise<(AccommodationRequestDetails & { approvalWorkflow?: AccommodationApprovalStep[]; bookingDetails?: any[] }) | null> {
  const bookingId = requestId; // Alias for parameter consistency
  console.log(`[ACCOMMODATION SERVICE] Looking for accommodation request with ID: ${bookingId}`);
  
  try {
    // First, let's check what records exist in both tables for debugging
    const trfCheck = await sql`SELECT id, travel_type, status FROM travel_requests WHERE id = ${bookingId}`;
    const tadCheck = await sql`SELECT trf_id FROM trf_accommodation_details WHERE trf_id = ${bookingId}`;
    
    console.log(`[ACCOMMODATION SERVICE] TRF check result: ${JSON.stringify(trfCheck)}`);
    console.log(`[ACCOMMODATION SERVICE] TAD check result: ${JSON.stringify(tadCheck)}`);
    
    const [request] = await sql`
      SELECT 
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
        CASE 
          WHEN tr.travel_type != 'Accommodation' THEN
            -- For TSRs, check approval workflow and override status if needed
            CASE 
              WHEN tr.status = 'Processing Accommodation' THEN 
                -- Check if core approvals are complete for TSR accommodation
                CASE 
                  WHEN (
                    SELECT COUNT(*)
                    FROM trf_approval_steps tas 
                    WHERE tas.trf_id = tr.id 
                    AND tas.step_role IN ('Department Focal', 'Line Manager', 'HOD')
                    AND tas.status = 'Approved'
                  ) >= 3 THEN 'Approved'  -- TSR accommodation should inherit approval status
                  ELSE tr.status
                END
              ELSE tr.status
            END
          ELSE 
            -- For pure accommodation requests, use original complex logic
            COALESCE(
              (SELECT CASE 
                WHEN COUNT(CASE WHEN tas.status = 'Rejected' THEN 1 END) > 0 THEN 'Rejected'
                WHEN COUNT(CASE WHEN tas.status = 'Cancelled' THEN 1 END) > 0 THEN 'Cancelled'
                ELSE tr.status
              END
              FROM trf_approval_steps tas 
              WHERE tas.trf_id = tr.id),
              tr.status
            )
        END as status,
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
      LEFT JOIN 
        users u ON tr.staff_id = u.id
      WHERE 
        tr.id = ${bookingId}
    `;

    console.log(`[ACCOMMODATION SERVICE] Query result: ${JSON.stringify(request)}`);

    if (!request) {
      console.log(`[ACCOMMODATION SERVICE] No accommodation request found with ID: ${bookingId}`);
      return null;
    }

    // Fetch actual booking details from accommodation_bookings table
    let bookingDetails: any[] = [];
    try {
      bookingDetails = await sql`
        SELECT 
          ab.id,
          ab.staff_id as "staffId",
          ab.date as "bookingDate",
          ab.status as "bookingStatus",
          ab.notes as "bookingNotes",
          ar.name as "roomName",
          ash.name as "staffHouseName",
          ash.location,
          ar.room_type as "roomType",
          ar.capacity,
          u.name as "guestName",
          COALESCE(sg.gender, u.gender) as gender
        FROM 
          accommodation_bookings ab
        LEFT JOIN 
          accommodation_rooms ar ON ab.room_id = ar.id
        LEFT JOIN 
          accommodation_staff_houses ash ON ab.staff_house_id = ash.id
        LEFT JOIN 
          users u ON ab.staff_id = u.id
        LEFT JOIN 
          staff_guests sg ON ab.staff_id = sg.id
        WHERE 
          ab.trf_id = ${bookingId}
        ORDER BY ab.date
      `;
    } catch (bookingError) {
      console.warn('Could not fetch booking details:', bookingError);
      // Continue without booking details if the table doesn't exist or query fails
    }

    // Fetch approval workflow steps
    const approvalResult = await sql`
      SELECT * FROM trf_approval_steps WHERE trf_id = ${bookingId} ORDER BY step_date
    `;

    // Generate the complete approval workflow including expected pending steps
    const fullApprovalWorkflow = generateFullApprovalWorkflow(
      request.status, 
      approvalResult,
      request.requestorName
    );

    // Get assigned room and staff house from booking details if available
    const firstBooking = bookingDetails.length > 0 ? bookingDetails[0] : null;
    const assignedRoomName = firstBooking?.roomName || request.assignedRoomName;
    const assignedStaffHouseName = firstBooking?.staffHouseName || request.assignedStaffHouseName;

    // Format dates and ensure proper typing
    return {
      id: request.id,
      trfId: request.trfId,
      requestorName: request.requestorName,
      requestorId: request.requestorId,
      requestorGender: request.requestorGender as 'Male' | 'Female',
      department: request.department,
      location: request.location as 'Ashgabat' | 'Kiyanly' | 'Turkmenbashy',
      requestedCheckInDate: new Date(request.requestedCheckInDate).toISOString(),
      requestedCheckOutDate: new Date(request.requestedCheckOutDate).toISOString(),
      requestedRoomType: request.requestedRoomType,
      status: request.status as BookingStatus,
      assignedRoomName,
      assignedStaffHouseName,
      submittedDate: new Date(request.submittedDate).toISOString(),
      lastUpdatedDate: request.lastUpdatedDate ? new Date(request.lastUpdatedDate).toISOString() : new Date(request.submittedDate).toISOString(),
      specialRequests: request.specialRequests,
      flightArrivalTime: request.flightArrivalTime,
      flightDepartureTime: request.flightDepartureTime,
      approvalWorkflow: fullApprovalWorkflow,
      bookingDetails
    };
  } catch (error) {
    console.error(`Error fetching accommodation request with ID ${bookingId}:`, error);
    throw new Error('Failed to fetch accommodation request');
  }
}

/**
 * Fetches all staff houses from the database
 * @returns Array of staff house data
 */
export async function getStaffHouses(): Promise<StaffHouseData[]> {
  try {
    // First, fetch all staff houses
    const staffHouses = await sql`
      SELECT 
        id, 
        name, 
        location
      FROM 
        accommodation_staff_houses
      ORDER BY 
        location, name
    `;

    // Then fetch all rooms for all staff houses
    const rooms = await sql`
      SELECT 
        id, 
        staff_house_id as "staffHouseId", 
        name
      FROM 
        accommodation_rooms
      ORDER BY 
        staff_house_id, name
    `;

    // Map rooms to their respective staff houses
    const staffHousesWithRooms = staffHouses.map((house: { id: string; name: string; location: string }) => {
      const houseRooms = rooms
        .filter((room: any) => room.staffHouseId === house.id)
        .map((room: any) => ({
          id: room.id,
          name: room.name,
          staff_house_id: room.staffHouseId
        }));

      return {
        id: house.id,
        name: house.name,
        location: house.location,
        rooms: houseRooms
      };
    });

    return staffHousesWithRooms;
  } catch (error) {
    console.error('Error fetching staff houses:', error);
    throw new Error('Failed to fetch staff houses');
  }
}

/**
 * Fetches all staff guests from the database (includes both staff_guests and users tables)
 * @returns Array of staff guest data
 */
export async function getStaffGuests(): Promise<StaffGuest[]> {
  try {
    // Try to get from staff_guests table first, then fall back to users table
    let staffGuests: any[] = [];
    
    try {
      staffGuests = await sql`
        SELECT 
          id, 
          name, 
          gender,
          SUBSTRING(name, 1, 2) as "initials"
        FROM 
          staff_guests
        ORDER BY 
          name
      `;
    } catch (staffGuestsError) {
      console.log('staff_guests table not available, using users table');
    }
    
    // If staff_guests table is empty or doesn't exist, get from users table
    if (staffGuests.length === 0) {
      staffGuests = await sql`
        SELECT 
          staff_id as id, 
          name, 
          COALESCE(gender, 'Male') as gender,
          SUBSTRING(name, 1, 2) as "initials"
        FROM 
          users
        WHERE staff_id IS NOT NULL
        ORDER BY 
          name
      `;
    }

    return staffGuests.map((guest: any) => ({
      id: guest.id,
      name: guest.name,
      gender: guest.gender,
      initials: guest.initials || guest.name?.substring(0, 2).toUpperCase() || 'UN'
    }));
  } catch (error) {
    console.error('Error fetching staff guests:', error);
    return [];
  }
}

/**
 * Fetches all accommodation bookings for a specific month
 * @param year The year
 * @param month The month (1-12)
 * @returns Array of booking data
 */
export async function getAccommodationBookings(year: number, month: number): Promise<BookingData[]> {
  try {
    const bookings = await sql`
      SELECT 
        ab.id,
        ab.staff_house_id as "staffHouseId",
        ab.room_id as "roomId",
        ab.date,
        ab.staff_id as "staffId",
        ab.status,
        COALESCE(sg.name, u.name, 'Unknown Guest') as "staffName",
        COALESCE(sg.gender, u.gender, 'Male') as "staffGender"
      FROM 
        accommodation_bookings ab
      LEFT JOIN staff_guests sg ON ab.staff_id = sg.id
      LEFT JOIN users u ON ab.staff_id = u.staff_id
      WHERE 
        EXTRACT(YEAR FROM ab.date) = ${year}
        AND EXTRACT(MONTH FROM ab.date) = ${month}
        AND ab.status NOT IN ('Cancelled')
      ORDER BY
        ab.date, ab.staff_house_id, ab.room_id
    `;

    return bookings.map((booking: any) => ({
      id: booking.id,
      staffHouseId: booking.staffHouseId,
      roomId: booking.roomId,
      date: booking.date instanceof Date ? booking.date.toISOString().split('T')[0] : booking.date,
      staffId: booking.staffId,
      staffName: booking.staffName,
      staffGender: booking.staffGender
    }));
  } catch (error) {
    console.error(`Error fetching bookings for ${year}-${month}:`, error);
    return [];
  }
}

/**
 * Generate full approval workflow including pending steps
 * @param currentStatus Current status of the request
 * @param completedSteps Array of completed approval steps
 * @param requestorName Name of the requestor
 * @returns Array of approval workflow steps
 */
function generateFullApprovalWorkflow(
  currentStatus: string, 
  completedSteps: any[],
  requestorName?: string
): AccommodationApprovalStep[] {
  // Check if this is a TSR (has Ticketing Admin step) vs pure accommodation request
  const isTransportRequest = completedSteps.some(step => 
    ['Ticketing Admin', 'Transport Admin'].includes(step.step_role)
  );
  
  // Define the expected workflow sequence based on request type
  let expectedWorkflow;
  
  if (isTransportRequest) {
    // TSR workflow with transport/accommodation components
    expectedWorkflow = [
      { role: 'Requestor', name: requestorName || 'System', status: 'Submitted' as const },
      { role: 'Department Focal', name: 'TBD', status: 'Pending' as const },
      { role: 'Line Manager', name: 'TBD', status: 'Pending' as const },
      { role: 'HOD', name: 'TBD', status: 'Pending' as const },
      { role: 'Ticketing Admin', name: 'TBD', status: 'Pending' as const },
      { role: 'Accommodation Admin', name: 'TBD', status: 'Pending' as const }
    ];
  } else {
    // Pure accommodation request workflow
    expectedWorkflow = [
      { role: 'Requestor', name: requestorName || 'System', status: 'Submitted' as const },
      { role: 'Department Focal', name: 'TBD', status: 'Pending' as const },
      { role: 'Line Manager', name: 'TBD', status: 'Pending' as const },
      { role: 'HOD', name: 'TBD', status: 'Pending' as const },
      { role: 'Accommodation Admin', name: 'TBD', status: 'Pending' as const }
    ];
  }

  // Map completed steps by role for easy lookup
  const completedByRole = completedSteps.reduce((acc: any, step: any) => {
    acc[step.step_role] = step;
    return acc;
  }, {});

  // Generate the full workflow
  const fullWorkflow: AccommodationApprovalStep[] = [];

  for (const expectedStep of expectedWorkflow) {
    const completedStep = completedByRole[expectedStep.role];
    
    if (completedStep) {
      // Use the completed step data
      fullWorkflow.push({
        role: completedStep.step_role || expectedStep.role,
        name: completedStep.step_name || expectedStep.name,
        status: completedStep.status as "Current" | "Pending" | "Approved" | "Rejected" | "Not Started" | "Cancelled" | "Submitted",
        date: completedStep.step_date ? new Date(completedStep.step_date) : undefined,
        comments: completedStep.comments || undefined
      });
    } else {
      // Determine status based on current request status and role
      let stepStatus: AccommodationApprovalStep['status'] = 'Pending';
      
      // Handle the initial requestor step
      if (expectedStep.role === 'Requestor') {
        stepStatus = 'Submitted';
      } else if (currentStatus === `Pending ${expectedStep.role}`) {
        stepStatus = 'Current'; // Current pending step
      } else if (currentStatus === 'Processing Accommodation' && expectedStep.role === 'Accommodation Admin') {
        stepStatus = 'Current'; // TSR is waiting for accommodation admin
      } else {
        // Determine status based on request completion state
        const isCompleted = ['TRF Processed', 'Accommodation Assigned', 'Completed'].includes(currentStatus);
        const isInProgress = ['Approved', 'Processing Accommodation', 'Finance Approved'].includes(currentStatus);
        const isRejected = ['Rejected', 'Cancelled'].includes(currentStatus);
        
        if (isRejected) {
          stepStatus = 'Not Started';
        } else if (isCompleted || isInProgress) {
          // For completed/in-progress requests, mark prior approvers as approved
          if (['Department Focal', 'Line Manager', 'HOD', 'Ticketing Admin'].includes(expectedStep.role)) {
            stepStatus = 'Approved';
          } else if (expectedStep.role === 'Accommodation Admin') {
            // Accommodation admin status based on actual completion
            if (isCompleted) {
              stepStatus = 'Approved';
            } else {
              stepStatus = 'Current';
            }
          } else {
            stepStatus = 'Pending';
          }
        } else {
          stepStatus = 'Pending';
        }
      }

      fullWorkflow.push({
        role: expectedStep.role,
        name: expectedStep.name !== 'TBD' ? expectedStep.name : 'To be assigned',
        status: stepStatus,
        date: undefined,
        comments: undefined
      });
    }
  }

  return fullWorkflow;
}

/**
 * Get all bookings for a specific staff member
 * @param staffId The staff member ID
 * @returns Array of booking data
 */
export async function getBookingsForStaff(staffId: string): Promise<BookingData[]> {
  try {
    const bookings = await sql`
      SELECT 
        ab.id,
        ab.staff_house_id as "staffHouseId",
        ab.room_id as "roomId", 
        ab.date,
        ab.staff_id as "staffId"
      FROM accommodation_bookings ab
      WHERE ab.staff_id = ${staffId}
      AND ab.status != 'Cancelled'
      ORDER BY ab.date
    `;

    return bookings.map((booking: any) => ({
      id: booking.id,
      roomId: booking.roomId,
      staffHouseId: booking.staffHouseId,
      date: booking.date instanceof Date ? booking.date.toISOString().split('T')[0] : booking.date,
      staffId: booking.staffId
    }));
  } catch (error) {
    console.error('Error fetching bookings for staff:', error);
    throw new Error('Failed to fetch bookings for staff');
  }
}

/**
 * Get all bookings for a specific TRF
 * @param trfId The TRF ID
 * @returns Array of booking data
 */
export async function getBookingsForTrf(trfId: string): Promise<BookingData[]> {
  try {
    const bookings = await sql`
      SELECT 
        ab.id,
        ab.staff_house_id as "staffHouseId",
        ab.room_id as "roomId", 
        ab.date,
        ab.staff_id as "staffId"
      FROM accommodation_bookings ab
      WHERE ab.trf_id = ${trfId}
      AND ab.status != 'Cancelled'
      ORDER BY ab.date
    `;

    return bookings.map((booking: any) => ({
      id: booking.id,
      roomId: booking.roomId,
      staffHouseId: booking.staffHouseId,
      date: booking.date instanceof Date ? booking.date.toISOString().split('T')[0] : booking.date,
      staffId: booking.staffId
    }));
  } catch (error) {
    console.error('Error fetching bookings for TRF:', error);
    throw new Error('Failed to fetch bookings for TRF');
  }
}
