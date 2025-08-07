import { sql } from '@/lib/db';
import { type AccommodationRequestDetails, StaffHouseData, RoomData, BookingData, StaffGuest } from '@/types/accommodation';

/**
 * Fetches all accommodation requests from the database
 * @param userId Optional user ID to filter requests by user
 * @returns Array of accommodation request details
 */
export async function getAccommodationRequests(userId?: string): Promise<AccommodationRequestDetails[]> {
  try {
    // Build the query based on whether a userId is provided
    const query = userId
      ? sql`
          SELECT DISTINCT ON (tr.id)
            tr.id,
            CASE 
              WHEN tr.travel_type = 'Accommodation' THEN NULL 
              ELSE tr.id 
            END as "trfId",
            tr.requestor_name as "requestorName",
            tr.staff_id as "requestorId",
            'Male' as "requestorGender", -- Default value as it's not in the schema
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
          WHERE 
            tr.staff_id = ${userId}
          ORDER BY 
            tr.id, tr.submitted_at DESC
        `
      : sql`
          SELECT DISTINCT ON (tr.id)
            tr.id,
            CASE 
              WHEN tr.travel_type = 'Accommodation' THEN NULL 
              ELSE tr.id 
            END as "trfId",
            tr.requestor_name as "requestorName",
            tr.staff_id as "requestorId",
            'Male' as "requestorGender", -- Default value as it's not in the schema
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
            tr.id, tr.submitted_at DESC
        `;

    const accommodationRequests = await query;

    // Format dates and ensure proper typing
    return accommodationRequests.map(request => ({
      id: request.id,
      trfId: request.trfId,
      requestorName: request.requestorName,
      requestorId: request.requestorId,
      requestorGender: request.requestorGender as 'Male' | 'Female',
      department: request.department,
      location: request.location as 'Ashgabat' | 'Kiyanly' | 'Turkmenbashy',
      requestedCheckInDate: new Date(request.requestedCheckInDate),
      requestedCheckOutDate: new Date(request.requestedCheckOutDate),
      requestedRoomType: request.requestedRoomType,
      status: request.status as 'Pending Assignment' | 'Confirmed' | 'Rejected' | 'Blocked',
      assignedRoomName: request.assignedRoomName,
      assignedStaffHouseName: request.assignedStaffHouseName,
      submittedDate: new Date(request.submittedDate),
      lastUpdatedDate: request.lastUpdatedDate ? new Date(request.lastUpdatedDate) : new Date(request.submittedDate),
      specialRequests: request.specialRequests,
      flightArrivalTime: request.flightArrivalTime,
      flightDepartureTime: request.flightDepartureTime
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
export async function getAccommodationRequestById(requestId: string): Promise<AccommodationRequestDetails | null> {
  const bookingId = requestId; // Alias for parameter consistency
  try {
    const [request] = await sql`
      SELECT 
        tr.id,
        CASE 
          WHEN tr.travel_type = 'Accommodation' THEN NULL 
          ELSE tr.id 
        END as "trfId",
        tr.requestor_name as "requestorName",
        tr.staff_id as "requestorId",
        'Male' as "requestorGender", -- Default value as it's not in the schema
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
      WHERE 
        tr.id = ${bookingId}
    `;

    if (!request) {
      return null;
    }

    // Format dates and ensure proper typing
    return {
      id: request.id,
      trfId: request.trfId,
      requestorName: request.requestorName,
      requestorId: request.requestorId,
      requestorGender: request.requestorGender as 'Male' | 'Female',
      department: request.department,
      location: request.location as 'Ashgabat' | 'Kiyanly' | 'Turkmenbashy',
      requestedCheckInDate: new Date(request.requestedCheckInDate),
      requestedCheckOutDate: new Date(request.requestedCheckOutDate),
      requestedRoomType: request.requestedRoomType,
      status: request.status as 'Pending Assignment' | 'Confirmed' | 'Rejected' | 'Blocked',
      assignedRoomName: request.assignedRoomName,
      assignedStaffHouseName: request.assignedStaffHouseName,
      submittedDate: new Date(request.submittedDate),
      lastUpdatedDate: request.lastUpdatedDate ? new Date(request.lastUpdatedDate) : new Date(request.submittedDate),
      specialRequests: request.specialRequests,
      flightArrivalTime: request.flightArrivalTime,
      flightDepartureTime: request.flightDepartureTime
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
    const staffHousesWithRooms = staffHouses.map(house => {
      const houseRooms = rooms
        .filter(room => room.staffHouseId === house.id)
        .map(room => ({
          id: room.id,
          name: room.name
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
 * Fetches all staff guests from the database
 * @returns Array of staff guest data
 */
export async function getStaffGuests(): Promise<StaffGuest[]> {
  try {
    const staffGuests = await sql`
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

    return staffGuests.map(guest => ({
      id: guest.id,
      name: guest.name,
      gender: guest.gender,
      initials: guest.initials || guest.name.substring(0, 2).toUpperCase()
    }));
  } catch (error) {
    console.error('Error fetching staff guests:', error);
    // Return empty array to avoid breaking the UI
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
        sg.name as "staffName",
        sg.gender as "staffGender"
      FROM 
        accommodation_bookings ab
      LEFT JOIN
        staff_guests sg ON ab.staff_id = sg.id
      WHERE 
        EXTRACT(YEAR FROM ab.date) = ${year}
        AND EXTRACT(MONTH FROM ab.date) = ${month}
      ORDER BY
        ab.date
    `;

    return bookings.map(booking => ({
      id: booking.id,
      staffHouseId: booking.staffHouseId,
      roomId: booking.roomId,
      date: booking.date,
      staffId: booking.staffId,
      staffName: booking.staffName,
      staffGender: booking.staffGender
    }));
  } catch (error) {
    console.error(`Error fetching bookings for ${year}-${month}:`, error);
    // Return empty array to avoid breaking the UI
    return [];
  }
}
