'use server';

import { sql } from '@/lib/db';
import { 
  type AccommodationRequestDetails, 
  StaffHouseData, 
  RoomData, 
  BookingData, 
  StaffGuest 
} from '@/types/accommodation';

/**
 * Server-side database functions for accommodation
 * These functions will only run on the server and not be bundled for the client
 */

/**
 * Fetches all staff houses from the database
 * @returns Array of staff house data
 */
export async function getServerStaffHouses(): Promise<StaffHouseData[]> {
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
export async function getServerStaffGuests(): Promise<StaffGuest[]> {
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
export async function getServerAccommodationBookings(year: number, month: number): Promise<BookingData[]> {
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
