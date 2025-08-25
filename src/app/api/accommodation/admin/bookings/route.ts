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
  staffHouseId: z.string().optional(), // Make optional for blocking rooms
  roomId: z.string(),
  staffId: z.string().optional(),
  date: z.string().optional(), // Keep as string, will be converted to date in SQL
  checkInDate: z.string().optional(), // Support date range for blocking
  checkOutDate: z.string().optional(), // Support date range for blocking
  status: z.enum(['Confirmed', 'Checked-in', 'Checked-out', 'Cancelled', 'Blocked']),
  notes: z.string().optional(),
  blockReason: z.string().optional(), // Support blockReason from frontend
  trfId: z.string().optional(),
  forceBlock: z.boolean().optional(), // Allow overriding existing bookings when blocking
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
            b.trf_id,
            r.name as "roomName",
            sh.name as "staffHouseName",
            u.name as "guestName",
            COALESCE(sg.gender, u.gender) as gender
          FROM 
            accommodation_bookings b
          LEFT JOIN 
            accommodation_rooms r ON b.room_id = r.id
          LEFT JOIN 
            accommodation_staff_houses sh ON b.staff_house_id = sh.id
          LEFT JOIN 
            users u ON b.staff_id = u.id
          LEFT JOIN 
            staff_guests sg ON b.staff_id = sg.id
          LEFT JOIN 
            trf_accommodation_details tad ON b.trf_id = tad.trf_id
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
            b.trf_id,
            r.name as "roomName",
            sh.name as "staffHouseName",
            u.name as "guestName",
            COALESCE(sg.gender, u.gender) as gender
          FROM 
            accommodation_bookings b
          LEFT JOIN 
            accommodation_rooms r ON b.room_id = r.id
          LEFT JOIN 
            accommodation_staff_houses sh ON b.staff_house_id = sh.id
          LEFT JOIN 
            users u ON b.staff_id = u.id
          LEFT JOIN 
            staff_guests sg ON b.staff_id = sg.id
          LEFT JOIN 
            trf_accommodation_details tad ON b.trf_id = tad.trf_id
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
            b.trf_id,
            r.name as "roomName",
            sh.name as "staffHouseName",
            u.name as "guestName",
            COALESCE(sg.gender, u.gender) as gender
          FROM 
            accommodation_bookings b
          LEFT JOIN 
            accommodation_rooms r ON b.room_id = r.id
          LEFT JOIN 
            accommodation_staff_houses sh ON b.staff_house_id = sh.id
          LEFT JOIN 
            users u ON b.staff_id = u.id
          LEFT JOIN 
            staff_guests sg ON b.staff_id = sg.id
          LEFT JOIN 
            trf_accommodation_details tad ON b.trf_id = tad.trf_id
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
            b.trf_id,
            r.name as "roomName",
            sh.name as "staffHouseName",
            u.name as "guestName",
            COALESCE(sg.gender, u.gender) as gender
          FROM 
            accommodation_bookings b
          LEFT JOIN 
            accommodation_rooms r ON b.room_id = r.id
          LEFT JOIN 
            accommodation_staff_houses sh ON b.staff_house_id = sh.id
          LEFT JOIN 
            users u ON b.staff_id = u.id
          LEFT JOIN 
            staff_guests sg ON b.staff_id = sg.id
          LEFT JOIN 
            trf_accommodation_details tad ON b.trf_id = tad.trf_id
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
            b.trf_id,
            r.name as "roomName",
            sh.name as "staffHouseName",
            u.name as "guestName",
            COALESCE(sg.gender, u.gender) as gender
          FROM 
            accommodation_bookings b
          LEFT JOIN 
            accommodation_rooms r ON b.room_id = r.id
          LEFT JOIN 
            accommodation_staff_houses sh ON b.staff_house_id = sh.id
          LEFT JOIN 
            users u ON b.staff_id = u.id
          LEFT JOIN 
            staff_guests sg ON b.staff_id = sg.id
          LEFT JOIN 
            trf_accommodation_details tad ON b.trf_id = tad.trf_id
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
            b.trf_id,
            r.name as "roomName",
            sh.name as "staffHouseName",
            u.name as "guestName",
            COALESCE(sg.gender, u.gender) as gender
          FROM 
            accommodation_bookings b
          LEFT JOIN 
            accommodation_rooms r ON b.room_id = r.id
          LEFT JOIN 
            accommodation_staff_houses sh ON b.staff_house_id = sh.id
          LEFT JOIN 
            users u ON b.staff_id = u.id
          LEFT JOIN 
            staff_guests sg ON b.staff_id = sg.id
          LEFT JOIN 
            trf_accommodation_details tad ON b.trf_id = tad.trf_id
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
            b.trf_id,
            r.name as "roomName",
            sh.name as "staffHouseName",
            u.name as "guestName",
            COALESCE(sg.gender, u.gender) as gender
          FROM 
            accommodation_bookings b
          LEFT JOIN 
            accommodation_rooms r ON b.room_id = r.id
          LEFT JOIN 
            accommodation_staff_houses sh ON b.staff_house_id = sh.id
          LEFT JOIN 
            users u ON b.staff_id = u.id
          LEFT JOIN 
            staff_guests sg ON b.staff_id = sg.id
          LEFT JOIN 
            trf_accommodation_details tad ON b.trf_id = tad.trf_id
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
            b.trf_id,
            r.name as "roomName",
            sh.name as "staffHouseName",
            u.name as "guestName",
            COALESCE(sg.gender, u.gender) as gender
          FROM 
            accommodation_bookings b
          LEFT JOIN 
            accommodation_rooms r ON b.room_id = r.id
          LEFT JOIN 
            accommodation_staff_houses sh ON b.staff_house_id = sh.id
          LEFT JOIN 
            users u ON b.staff_id = u.id
          LEFT JOIN 
            staff_guests sg ON b.staff_id = sg.id
          LEFT JOIN 
            trf_accommodation_details tad ON b.trf_id = tad.trf_id
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
        trfId: booking.trf_id,
        roomName: booking.roomName,
        staffHouseName: booking.staffHouseName,
        guestName: booking.guestName,
        gender: booking.gender
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
    console.log('POST booking - API endpoint hit');
    console.log('POST booking - checking permissions...');
    // Check if user has permission
    if (!await hasPermission('manage_accommodation_bookings')) {
      console.log('POST booking - permission denied');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.log('POST booking - permission granted');

    const body = await request.json();
    console.log('POST booking request body:', JSON.stringify(body, null, 2));
    const validation = bookingSchema.safeParse(body);
    
    if (!validation.success) {
      console.error('POST booking validation failed:', validation.error.format());
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { staffHouseId, roomId, staffId, date, checkInDate, checkOutDate, status, notes, blockReason, trfId, forceBlock } = validation.data;

    console.log('POST booking - extracted data:', { staffHouseId, roomId, staffId, date, checkInDate, checkOutDate, status, notes, blockReason, trfId, forceBlock });

    // For TRF bookings, validate staff_id exists and resolve to proper user ID
    // For regular bookings, validate against staff_guests table
    let validatedStaffId = staffId;
    let guestGender = null;
    
    if (trfId) {
      // For TRF bookings, get the staff_id from the TRF and resolve to user UUID
      const trfData = await sql`
        SELECT tr.staff_id as trf_staff_id, tr.requestor_name, u.id as user_id, u.gender
        FROM travel_requests tr
        LEFT JOIN users u ON tr.staff_id = u.staff_id
        WHERE tr.id = ${trfId}
        LIMIT 1
      `;
      
      if (trfData.length > 0 && trfData[0].user_id) {
        validatedStaffId = trfData[0].user_id;
        guestGender = trfData[0].gender;
        console.log(`TRF booking: resolved staff_id ${trfData[0].trf_staff_id} to user_id ${validatedStaffId}`);
      } else {
        console.log(`TRF ${trfId} staff not found in users table, using staff_id from TRF if available`);
        if (trfData.length > 0) {
          validatedStaffId = trfData[0].trf_staff_id; // Fall back to staff_id number
        }
      }
    } else if (staffId) {
      // For regular bookings, check staff_guests table first, then users table
      let staffExists = await sql`SELECT id, gender FROM staff_guests WHERE id = ${staffId}`;
        
      if (staffExists.length === 0) {
        // Try users table as fallback
        const userExists = await sql`SELECT id, gender FROM users WHERE id = ${staffId} OR staff_id = ${staffId}`;
        if (userExists.length === 0) {
          return NextResponse.json(
            { error: `Staff ID ${staffId} does not exist in staff_guests or users table` },
            { status: 400 }
          );
        } else {
          validatedStaffId = userExists[0].id; // Use user UUID
          guestGender = userExists[0].gender;
        }
      } else {
        guestGender = staffExists[0].gender;
      }
    }

    // Determine the dates to book
    let datesToBook: string[] = [];
    
    if (checkInDate && checkOutDate) {
      // Handle date range (for blocking rooms)
      const startDate = new Date(checkInDate);
      const endDate = new Date(checkOutDate);
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        datesToBook.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (date) {
      // Handle single date
      datesToBook = [date];
    } else {
      return NextResponse.json(
        { error: 'Either date or checkInDate/checkOutDate must be provided' },
        { status: 400 }
      );
    }

    // Get staffHouseId from room if not provided (for blocking)
    let finalStaffHouseId = staffHouseId;
    if (!finalStaffHouseId) {
      const roomInfo = await sql`
        SELECT staff_house_id FROM accommodation_rooms WHERE id = ${roomId}
      `;
      
      if (roomInfo.length === 0) {
        return NextResponse.json(
          { error: `Room with ID ${roomId} not found` },
          { status: 400 }
        );
      }
      
      finalStaffHouseId = roomInfo[0].staff_house_id.toString();
    }

    // Check for gender conflicts if guest gender is available
    if (guestGender && validatedStaffId) {
      for (const bookingDate of datesToBook) {
        const genderConflictBookings = await sql`
          SELECT ab.id, ab.status, COALESCE(sg.gender, u.gender) as existing_gender
          FROM accommodation_bookings ab
          LEFT JOIN staff_guests sg ON ab.staff_id = sg.id
          LEFT JOIN users u ON ab.staff_id = u.id
          WHERE ab.room_id = ${roomId}
          AND ab.date = ${bookingDate}::date
          AND ab.status IN ('Confirmed', 'Checked-in', 'Checked-out')
          AND (sg.gender IS NOT NULL OR u.gender IS NOT NULL)
        `;
        
        const hasGenderConflict = genderConflictBookings.some(booking => {
          const existingGender = booking.existing_gender;
          return existingGender && existingGender !== guestGender;
        });
        
        if (hasGenderConflict) {
          return NextResponse.json(
            { error: `Gender conflict detected: Cannot book ${guestGender} guest in room with ${genderConflictBookings[0].existing_gender} occupants on ${bookingDate}` },
            { status: 409 }
          );
        }
      }
    }

    // Check for existing active bookings on the dates (excluding cancelled ones)
    console.log('POST booking - checking for conflicts for dates:', datesToBook);
    const conflictingBookings: any[] = [];
    for (const bookingDate of datesToBook) {
      const existingBookings = await sql`
        SELECT id, status FROM accommodation_bookings
        WHERE room_id = ${roomId}
        AND date = ${bookingDate}::date
      `;
      
      console.log(`POST booking - existing bookings for ${bookingDate}:`, existingBookings);

      if (existingBookings.length > 0) {
        const existingBooking = existingBookings[0];
        
        if (existingBooking.status === 'Cancelled') {
          // If existing booking is cancelled, we can delete it and create a new one
          console.log(`POST booking - deleting cancelled booking ${existingBooking.id} for ${bookingDate}`);
          await sql`DELETE FROM accommodation_bookings WHERE id = ${existingBooking.id}`;
        } else if (forceBlock && status === 'Blocked') {
          // If force blocking, cancel the existing booking
          console.log(`POST booking - force cancelling booking ${existingBooking.id} for ${bookingDate}`);
          await sql`
            UPDATE accommodation_bookings 
            SET status = 'Cancelled', 
                notes = COALESCE(notes || ' ', '') || '[CANCELLED BY ADMIN FOR ROOM BLOCKING]',
                updated_at = NOW()
            WHERE id = ${existingBooking.id}
          `;
        } else {
          // Normal conflict handling for active bookings
          if (existingBooking.status === 'Blocked') {
            return NextResponse.json(
              { error: `Room is already blocked on ${bookingDate}` }, 
              { status: 409 }
            );
          } else {
            conflictingBookings.push({ date: bookingDate, status: existingBooking.status });
          }
        }
      }
    }

    // If there are conflicts and not force blocking, return error
    if (conflictingBookings.length > 0 && !forceBlock) {
      const conflictDates = conflictingBookings.map(b => `${b.date} (${b.status})`).join(', ');
      return NextResponse.json(
        { 
          error: `There are already active bookings on: ${conflictDates}`,
          canForceBlock: status === 'Blocked',
          conflictingDates: conflictingBookings.map(b => b.date)
        }, 
        { status: 409 }
      );
    }

    // Create bookings for all dates
    const createdBookingIds: string[] = [];
    const finalNotes = notes || blockReason || null;
    
    for (const bookingDate of datesToBook) {
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
          ${finalStaffHouseId},
          ${roomId},
          ${validatedStaffId || null},
          ${bookingDate}::date,
          ${status},
          ${finalNotes},
          ${trfId || null}
        ) RETURNING id
      `;
      
      createdBookingIds.push(result[0].id);
    }

    return NextResponse.json({
      message: `Booking${datesToBook.length > 1 ? 's' : ''} created successfully`,
      bookingIds: createdBookingIds,
      datesBooked: datesToBook.length
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create booking',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : '') : undefined
      },
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
    console.log('PUT booking request body:', body);
    const validation = bookingSchema.safeParse(body);
    
    if (!validation.success) {
      console.error('PUT booking validation failed:', validation.error.format());
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { id, staffHouseId, roomId, staffId, date, checkInDate, checkOutDate, status, notes, blockReason, trfId, forceBlock } = validation.data;
    
    // Use the appropriate date field
    const bookingDate = date || checkInDate;
    const finalNotes = notes || blockReason;

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

    if (!bookingDate) {
      return NextResponse.json(
        { error: 'Date is required for booking updates' },
        { status: 400 }
      );
    }

    // Check for existing active booking on the same date (excluding this booking)
    const existingBookings = await sql`
      SELECT id, status FROM accommodation_bookings
      WHERE room_id = ${roomId}
      AND id != ${id}
      AND date = ${bookingDate}::date
      AND status IN ('Confirmed', 'Checked-in', 'Checked-out', 'Blocked')
    `;

    if (existingBookings.length > 0) {
      const existingBooking = existingBookings[0];
      return NextResponse.json(
        { error: `There is already another active booking (${existingBooking.status}) for this room on the selected date` },
        { status: 409 }
      );
    }

    // Update the booking
    await sql`
      UPDATE accommodation_bookings SET
        staff_house_id = ${staffHouseId},
        room_id = ${roomId},
        staff_id = ${staffId || null},
        date = ${bookingDate}::date,
        status = ${status},
        notes = ${finalNotes || null},
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
