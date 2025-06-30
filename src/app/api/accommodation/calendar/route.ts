// src/app/api/accommodation/calendar/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { format } from 'date-fns';

// This API will return simplified mock data for the calendar display,
// as a full room inventory and booking system is complex.
// It will query a simplified `accommodation_bookings_mock` table.

export async function GET(request: NextRequest) {
  console.log("API_ACCOM_CALENDAR_GET_START (PostgreSQL): Fetching calendar data.");
  if (!sql) {
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }
  
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // YYYY-MM format e.g. 2024-05
  const location = searchParams.get('location'); // e.g. Ashgabat

  // Mock staff houses for now, a real system would query these
  const mockStaffHouses = [
    { id: 'sh1', name: 'Staff house 41', location: 'Ashgabat', rooms: [{ id: 'sh1r1', name: 'Room #1' }, { id: 'sh1r2', name: 'Room #2' }] },
    { id: 'sh2', name: 'Staff house 42', location: 'Ashgabat', rooms: [{ id: 'sh2r1', name: 'Room #1' }] },
    { id: 'camp1', name: 'Kiyanly Camp A', location: 'Kiyanly', rooms: [{ id: 'c1r1', name: 'Tent 101' }] }
  ];
  
  // Mock staff guests, a real system would link to users or a guest table
  const mockStaffGuests = [
    { id: 'sg1', initials: 'EK', name: 'E.K - Eziz Kemalov', gender: 'Male' },
    { id: 'sg2', initials: 'AV', name: 'A.V - Arun', gender: 'Male' },
    { id: 'sg5', initials: 'OP', name: 'O.P - Oksana Petrovskaya', gender: 'Female' },
  ];

  try {
    // Filter staff houses by location client-side for this mock
    const filteredHouses = mockStaffHouses.filter(h => !location || h.location === location);
    
    // Fetch "bookings" from the mock table
    // In a real system, you'd filter by month and location in the SQL query
    const bookingsData = await sql`
      SELECT staff_house_id, room_id, booking_date, staff_id, guest_name, guest_gender 
      FROM accommodation_bookings_mock
    `; 
    
    const bookings = bookingsData.map(b => ({
        id: `${b.staff_house_id}-${b.room_id}-${format(new Date(b.booking_date), 'yyyy-MM-dd')}`, // Create a unique-ish ID
        staffHouseId: b.staff_house_id,
        roomId: b.room_id,
        date: format(new Date(b.booking_date), 'yyyy-MM-dd'),
        staffId: b.staff_id,
        // In a real system, guest details would be joined or fetched separately
        guest: {
            id: b.staff_id,
            initials: b.guest_name ? b.guest_name.split(' ').map(n=>n[0]).join('') : 'XX',
            name: b.guest_name || 'Unknown Guest',
            gender: b.guest_gender || 'Male'
        }
    }));

    return NextResponse.json({
      staffHouses: filteredHouses, // Send filtered based on query param
      bookings: bookings,         // Send all mock bookings for now
      staffGuests: mockStaffGuests // Send all mock guests
    });
  } catch (error: any) {
    console.error("API_ACCOM_CALENDAR_GET_ERROR (PostgreSQL):", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to fetch calendar data.', details: error.message }, { status: 500 });
  }
}
