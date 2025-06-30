import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { z } from 'zod';
import { hasPermission } from '../../../../../lib/permissions';
import { BookingStatus } from '../../../../../types/accommodation';

// Schema for validating query parameters
const queryParamsSchema = z.object({
  year: z.union([
    z.string(),
    z.number()
  ]).optional(),
  month: z.union([
    z.string(),
    z.number()
  ]).optional(),
  staffHouseId: z.union([
    z.string(),
    z.null()
  ]).optional(),
  roomId: z.union([
    z.string(),
    z.null()
  ]).optional(),
  staffId: z.union([
    z.string(),
    z.null()
  ]).optional()
});

// Schema for creating/updating bookings
const bookingSchema = z.object({
  id: z.string().optional(),
  staffHouseId: z.string(),
  roomId: z.string(),
  staffId: z.string().optional(),
  date: z.string(), // Keep as string, will be converted to date in SQL
  status: z.enum(['Confirmed', 'Checked-in', 'Checked-out', 'Cancelled', 'Blocked']),
  notes: z.string().optional(),
  trfId: z.string().optional(),
});

// GET handler to fetch bookings with optional filters
export async function GET(request: Request) {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_accommodation_bookings')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
    const validation = queryParamsSchema.safeParse({
      year: searchParams.get('year'),
      month: searchParams.get('month'),
      staffHouseId: searchParams.get('staffHouseId'),
      roomId: searchParams.get('roomId'),
      staffId: searchParams.get('staffId')
    });
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.format() }, 
        { status: 400 }
      );
    }

    // Extract validated parameters
    const { year, month, staffHouseId, roomId, staffId } = validation.data;
    
    // Default to current year/month if not provided
    const currentDate = new Date();
    let yearValue = year ? parseInt(year.toString(), 10) : currentDate.getFullYear();
    let monthValue = month ? parseInt(month.toString(), 10) : currentDate.getMonth() + 1; // JS months are 0-indexed
    
    // Validate year and month values
    if (isNaN(yearValue) || yearValue < 2000 || yearValue > 2100) {
      yearValue = currentDate.getFullYear();
    }
    
    if (isNaN(monthValue) || monthValue < 1 || monthValue > 12) {
      monthValue = currentDate.getMonth() + 1;
    }
    
    try {
      // Check if tables exist first
      try {
        await sql`SELECT 1 FROM accommodation_bookings LIMIT 1`;
      } catch (tableError: unknown) {
        if (tableError instanceof Error && tableError.message && 
            tableError.message.includes('relation "accommodation_bookings" does not exist')) {
          console.log('Accommodation bookings table does not exist yet, returning empty results');
          return NextResponse.json({ bookings: [] });
        }
      }
      
      // Build dynamic SQL query using tagged template literals
      let bookingsQuery;
      
      // Base query with year and month filters
      const yearInt = yearValue;
      const monthInt = monthValue;
      
      // Start with a base query and add filters conditionally
      if (staffHouseId && roomId && staffId) {
        // All three filters
        const staffHouseIdInt = parseInt(staffHouseId, 10);
        const roomIdInt = parseInt(roomId, 10);
        bookingsQuery = await sql`
          SELECT 
            b.id,
            b.staff_house_id as "staffHouseId",
            b.room_id as "roomId",
            b.staff_id as "guestId",
            b.date as "bookingDate",
            b.status,
            b.notes,
            r.name as "roomName",
            sh.name as "staffHouseName",
            u.name as "guestName"
          FROM 
            accommodation_bookings b
          LEFT JOIN 
            accommodation_rooms r ON b.room_id = r.id
          LEFT JOIN 
            accommodation_staff_houses sh ON b.staff_house_id = sh.id
          LEFT JOIN 
            users u ON b.staff_id = u.id
          WHERE 
            EXTRACT(YEAR FROM b.date) = ${yearInt} AND
            EXTRACT(MONTH FROM b.date) = ${monthInt} AND
            b.staff_house_id = ${staffHouseIdInt} AND
            b.room_id = ${roomIdInt} AND
            b.staff_id = ${staffId}
          ORDER BY b.date
        `;
      } else if (staffHouseId && roomId) {
        // StaffHouse and Room filters
        const staffHouseIdInt = parseInt(staffHouseId, 10);
        const roomIdInt = parseInt(roomId, 10);
        bookingsQuery = await sql`
          SELECT 
            b.id,
            b.staff_house_id as "staffHouseId",
            b.room_id as "roomId",
            b.staff_id as "guestId",
            b.date as "bookingDate",
            b.status,
            b.notes,
            r.name as "roomName",
            sh.name as "staffHouseName",
            u.name as "guestName"
          FROM 
            accommodation_bookings b
          LEFT JOIN 
            accommodation_rooms r ON b.room_id = r.id
          LEFT JOIN 
            accommodation_staff_houses sh ON b.staff_house_id = sh.id
          LEFT JOIN 
            users u ON b.staff_id = u.id
          WHERE 
            EXTRACT(YEAR FROM b.date) = ${yearInt} AND
            EXTRACT(MONTH FROM b.date) = ${monthInt} AND
            b.staff_house_id = ${staffHouseIdInt} AND
            b.room_id = ${roomIdInt}
          ORDER BY b.date
        `;
      } else if (staffHouseId && staffId) {
        // StaffHouse and Staff filters
        const staffHouseIdInt = parseInt(staffHouseId, 10);
        bookingsQuery = await sql`
          SELECT 
            b.id,
            b.staff_house_id as "staffHouseId",
            b.room_id as "roomId",
            b.staff_id as "guestId",
            b.date as "bookingDate",
            b.status,
            b.notes,
            r.name as "roomName",
            sh.name as "staffHouseName",
            u.name as "guestName"
          FROM 
            accommodation_bookings b
          LEFT JOIN 
            accommodation_rooms r ON b.room_id = r.id
          LEFT JOIN 
            accommodation_staff_houses sh ON b.staff_house_id = sh.id
          LEFT JOIN 
            users u ON b.staff_id = u.id
          WHERE 
            EXTRACT(YEAR FROM b.date) = ${yearInt} AND
            EXTRACT(MONTH FROM b.date) = ${monthInt} AND
            b.staff_house_id = ${staffHouseIdInt} AND
            b.staff_id = ${staffId}
          ORDER BY b.date
        `;
      } else if (roomId && staffId) {
        // Room and Staff filters
        const roomIdInt = parseInt(roomId, 10);
        bookingsQuery = await sql`
          SELECT 
            b.id,
            b.staff_house_id as "staffHouseId",
            b.room_id as "roomId",
            b.staff_id as "guestId",
            b.date as "bookingDate",
            b.status,
            b.notes,
            r.name as "roomName",
            sh.name as "staffHouseName",
            u.name as "guestName"
          FROM 
            accommodation_bookings b
          LEFT JOIN 
            accommodation_rooms r ON b.room_id = r.id
          LEFT JOIN 
            accommodation_staff_houses sh ON b.staff_house_id = sh.id
          LEFT JOIN 
            users u ON b.staff_id = u.id
          WHERE 
            EXTRACT(YEAR FROM b.date) = ${yearInt} AND
            EXTRACT(MONTH FROM b.date) = ${monthInt} AND
            b.room_id = ${roomIdInt} AND
            b.staff_id = ${staffId}
          ORDER BY b.date
        `;
      } else if (staffHouseId) {
        // Only StaffHouse filter
        const staffHouseIdInt = parseInt(staffHouseId, 10);
        bookingsQuery = await sql`
          SELECT 
            b.id,
            b.staff_house_id as "staffHouseId",
            b.room_id as "roomId",
            b.staff_id as "guestId",
            b.date as "bookingDate",
            b.status,
            b.notes,
            r.name as "roomName",
            sh.name as "staffHouseName",
            u.name as "guestName"
          FROM 
            accommodation_bookings b
          LEFT JOIN 
            accommodation_rooms r ON b.room_id = r.id
          LEFT JOIN 
            accommodation_staff_houses sh ON b.staff_house_id = sh.id
          LEFT JOIN 
            users u ON b.staff_id = u.id
          WHERE 
            EXTRACT(YEAR FROM b.date) = ${yearInt} AND
            EXTRACT(MONTH FROM b.date) = ${monthInt} AND
            b.staff_house_id = ${staffHouseIdInt}
          ORDER BY b.date
        `;
      } else if (roomId) {
        // Only Room filter
        const roomIdInt = parseInt(roomId, 10);
        bookingsQuery = await sql`
          SELECT 
            b.id,
            b.staff_house_id as "staffHouseId",
            b.room_id as "roomId",
            b.staff_id as "guestId",
            b.date as "bookingDate",
            b.status,
            b.notes,
            r.name as "roomName",
            sh.name as "staffHouseName",
            u.name as "guestName"
          FROM 
            accommodation_bookings b
          LEFT JOIN 
            accommodation_rooms r ON b.room_id = r.id
          LEFT JOIN 
            accommodation_staff_houses sh ON b.staff_house_id = sh.id
          LEFT JOIN 
            users u ON b.staff_id = u.id
          WHERE 
            EXTRACT(YEAR FROM b.date) = ${yearInt} AND
            EXTRACT(MONTH FROM b.date) = ${monthInt} AND
            b.room_id = ${roomIdInt}
          ORDER BY b.date
        `;
      } else if (staffId) {
        // Only Staff filter
        bookingsQuery = await sql`
          SELECT 
            b.id,
            b.staff_house_id as "staffHouseId",
            b.room_id as "roomId",
            b.staff_id as "guestId",
            b.date as "bookingDate",
            b.status,
            b.notes,
            r.name as "roomName",
            sh.name as "staffHouseName",
            u.name as "guestName"
          FROM 
            accommodation_bookings b
          LEFT JOIN 
            accommodation_rooms r ON b.room_id = r.id
          LEFT JOIN 
            accommodation_staff_houses sh ON b.staff_house_id = sh.id
          LEFT JOIN 
            users u ON b.staff_id = u.id
          WHERE 
            EXTRACT(YEAR FROM b.date) = ${yearInt} AND
            EXTRACT(MONTH FROM b.date) = ${monthInt} AND
            b.staff_id = ${staffId}
          ORDER BY b.date
        `;
      } else {
        // No additional filters, just year and month
        bookingsQuery = await sql`
          SELECT 
            b.id,
            b.staff_house_id as "staffHouseId",
            b.room_id as "roomId",
            b.staff_id as "guestId",
            b.date as "bookingDate",
            b.status,
            b.notes,
            r.name as "roomName",
            sh.name as "staffHouseName",
            u.name as "guestName"
          FROM 
            accommodation_bookings b
          LEFT JOIN 
            accommodation_rooms r ON b.room_id = r.id
          LEFT JOIN 
            accommodation_staff_houses sh ON b.staff_house_id = sh.id
          LEFT JOIN 
            users u ON b.staff_id = u.id
          WHERE 
            EXTRACT(YEAR FROM b.date) = ${yearInt} AND
            EXTRACT(MONTH FROM b.date) = ${monthInt}
          ORDER BY b.date
        `;
      }
      
      // Use the query results
      const bookings = bookingsQuery;

      // Transform the data to match the expected format
      const transformedBookings = bookings.map(booking => ({
        id: booking.id,
        staffHouseId: booking.staffHouseId,
        roomId: booking.roomId,
        staffId: booking.guestId, // Map guestId to staffId for backward compatibility
        bookingDate: booking.bookingDate,
        status: booking.status as BookingStatus,
        notes: booking.notes,
        roomName: booking.roomName,
        staffHouseName: booking.staffHouseName,
        guestName: booking.guestName
      }));

      return NextResponse.json({ bookings: transformedBookings });
    } catch (dbError: unknown) {
      console.error('Database query error:', dbError);
      // If there's any database error, return empty results in development
      return NextResponse.json({ 
        bookings: [],
        debug: process.env.NODE_ENV === 'development' ? 
          { error: dbError instanceof Error ? dbError.message : 'Unknown database error' } : undefined
      });
    }
  } catch (error: unknown) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch bookings', 
        message: error instanceof Error ? error.message : 'Unknown error',
        bookings: [] // Always return an empty array even on error to avoid frontend crashes
      },
      { status: 500 }
    );
  }
}

// POST handler to create a new booking
export async function POST(request: Request) {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_accommodation_bookings')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const validation = bookingSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { staffHouseId, roomId, staffId, date, status, notes, trfId } = validation.data;

    // Validate that staffId exists in staff_guests table if provided
    if (staffId) {
      const staffExists = await sql`
        SELECT id FROM staff_guests WHERE id = ${staffId}
      `;
      
      if (staffExists.length === 0) {
        return NextResponse.json(
          { error: `Staff ID ${staffId} does not exist in the staff_guests table` },
          { status: 400 }
        );
      }
    }

    // Check for existing booking on the same date
    const existingBookings = await sql`
      SELECT id FROM accommodation_bookings
      WHERE room_id = ${roomId}
      AND date = ${date}::date
      AND status != 'Available'
    `;

    if (existingBookings.length > 0) {
      return NextResponse.json(
        { error: 'There is already a booking for this room on the selected date' }, 
        { status: 409 }
      );
    }

    // Create the booking
    const result = await sql`
      INSERT INTO accommodation_bookings (
        staff_house_id,
        room_id,
        staff_id,
        date,
        status,
        notes,
        trf_id
      ) VALUES (
        ${staffHouseId},
        ${roomId},
        ${staffId || null},
        ${date}::date,
        ${status},
        ${notes || null},
        ${trfId || null}
      ) RETURNING id
    `;

    return NextResponse.json({
      message: 'Booking created successfully',
      bookingId: result[0].id
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}

// PUT handler to update a booking
export async function PUT(request: Request) {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_accommodation_bookings')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const validation = bookingSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { id, staffHouseId, roomId, staffId, date, status, notes, trfId } = validation.data;

    if (!id) {
      return NextResponse.json(
        { error: 'Booking ID is required for updates' },
        { status: 400 }
      );
    }

    // Check if the booking exists
    const existingBooking = await sql`
      SELECT id FROM accommodation_bookings WHERE id = ${id}
    `;

    if (existingBooking.length === 0) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Check for existing booking on the same date (excluding this booking)
    const existingBookings = await sql`
      SELECT id FROM accommodation_bookings
      WHERE room_id = ${roomId}
      AND id != ${id}
      AND date = ${date}::date
      AND status != 'Available'
    `;

    if (existingBookings.length > 0) {
      return NextResponse.json(
        { error: 'There is already another booking for this room on the selected date' },
        { status: 409 }
      );
    }

    // Update the booking
    await sql`
      UPDATE accommodation_bookings SET
        staff_house_id = ${staffHouseId},
        room_id = ${roomId},
        staff_id = ${staffId || null},
        date = ${date}::date,
        status = ${status},
        notes = ${notes || null},
        trf_id = ${trfId || null},
        updated_at = NOW()
      WHERE id = ${id}
    `;

    return NextResponse.json({
      message: 'Booking updated successfully'
    });
  } catch (error) {
    console.error('Error updating booking:', error);
    return NextResponse.json(
      { error: 'Failed to update booking' },
      { status: 500 }
    );
  }
}

// DELETE handler to remove a booking
export async function DELETE(request: Request) {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_accommodation_bookings')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    // Check if the booking exists
    const existingBooking = await sql`
      SELECT id FROM accommodation_bookings WHERE id = ${id}
    `;

    if (existingBooking.length === 0) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Delete the booking
    await sql`DELETE FROM accommodation_bookings WHERE id = ${id}`;

    return NextResponse.json({
      message: 'Booking deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting booking:', error);
    return NextResponse.json(
      { error: 'Failed to delete booking' },
      { status: 500 }
    );
  }
}
