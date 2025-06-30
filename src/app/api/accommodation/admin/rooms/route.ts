import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { z } from 'zod';
import { hasPermission } from '../../../../../lib/permissions';

// Schema for creating/updating rooms
const roomSchema = z.object({
  id: z.string().optional(),
  staffHouseId: z.string({
    required_error: "Staff house ID is required"
  }),
  name: z.string().min(1, "Room name is required"),
  roomType: z.enum(['Single', 'Double', 'Suite', 'Tent'], {
    required_error: "Room type must be one of: Single, Double, Suite, Tent"
  }),
  capacity: z.number().int().min(1).default(1),
  status: z.enum(['Available', 'Maintenance', 'Reserved']).default('Available'),
  genderRestriction: z.enum(['Male', 'Female']).optional()
});

// GET handler to fetch rooms, optionally filtered by staff house ID
export async function GET(request: Request) {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_accommodation_bookings')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const staffHouseId = searchParams.get('staffHouseId');
    
    try {
      // Check if tables exist first
      try {
        await sql`SELECT 1 FROM accommodation_rooms LIMIT 1`;
        await sql`SELECT 1 FROM accommodation_staff_houses LIMIT 1`;
      } catch (tableError: unknown) {
        if (tableError instanceof Error && tableError.message && 
            (tableError.message.includes('relation "accommodation_rooms" does not exist') ||
             tableError.message.includes('relation "accommodation_staff_houses" does not exist'))) {
          console.log('Accommodation tables do not exist yet, returning empty results');
          return NextResponse.json({ rooms: [] });
        }
      }

      let roomsQuery;
      if (staffHouseId) {
        roomsQuery = await sql`
          SELECT 
            r.id, 
            r.staff_house_id as "staffHouseId",
            r.name, 
            r.room_type as "roomType",
            r.capacity,
            r.status,
            sh.name as "staffHouseName",
            sh.location,
            r.created_at as "createdAt",
            r.updated_at as "updatedAt"
          FROM 
            accommodation_rooms r
          JOIN
            accommodation_staff_houses sh ON r.staff_house_id = sh.id
          WHERE 
            r.staff_house_id = ${staffHouseId}
          ORDER BY 
            r.name
        `;
      } else {
        roomsQuery = await sql`
          SELECT 
            r.id, 
            r.staff_house_id as "staffHouseId",
            r.name, 
            r.room_type as "roomType",
            r.capacity,
            r.status,
            sh.name as "staffHouseName",
            sh.location,
            r.created_at as "createdAt",
            r.updated_at as "updatedAt"
          FROM 
            accommodation_rooms r
          JOIN
            accommodation_staff_houses sh ON r.staff_house_id = sh.id
          ORDER BY 
            sh.location, sh.name, r.name
        `;
      }

      // Transform the data to match the expected format
      const rooms = roomsQuery.map(room => ({
        id: room.id,
        staffHouseId: room.staffHouseId,
        name: room.name,
        roomType: room.roomType,
        capacity: room.capacity,
        status: room.status,
        staffHouseName: room.staffHouseName,
        location: room.location,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt
      }));

      return NextResponse.json({ rooms });
    } catch (dbError: unknown) {
      console.error('Database query error:', dbError);
      // If there's any database error, return empty results in development
      return NextResponse.json({ 
        rooms: [],
        debug: process.env.NODE_ENV === 'development' ? 
          { error: dbError instanceof Error ? dbError.message : 'Unknown database error' } : undefined
      });
    }
  } catch (error: unknown) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch rooms', 
        message: error instanceof Error ? error.message : 'Unknown error',
        rooms: [] // Always return an empty array even on error to avoid frontend crashes
      }, 
      { status: 500 }
    );
  }
}

// POST handler to create a new room
export async function POST(request: Request) {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_accommodation_bookings')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const validation = roomSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() }, 
        { status: 400 }
      );
    }

    const { staffHouseId, name, roomType, capacity, status, genderRestriction } = validation.data;

    // Check if the staff house exists
    const staffHouse = await sql`
      SELECT id FROM accommodation_staff_houses WHERE id = ${staffHouseId}
    `;

    if (staffHouse.length === 0) {
      return NextResponse.json(
        { error: 'Staff house not found' }, 
        { status: 404 }
      );
    }

    // Check if a room with the same name already exists in this staff house
    const existingRoom = await sql`
      SELECT id FROM accommodation_rooms 
      WHERE staff_house_id = ${staffHouseId} AND name = ${name}
    `;

    if (existingRoom.length > 0) {
      return NextResponse.json(
        { error: 'A room with this name already exists in this staff house' }, 
        { status: 409 }
      );
    }

    // Create the new room
    const result = await sql`
      INSERT INTO accommodation_rooms (
        staff_house_id,
        name,
        room_type,
        capacity,
        status
      ) VALUES (
        ${staffHouseId},
        ${name},
        ${roomType},
        ${capacity},
        ${status}
      ) RETURNING id, staff_house_id as "staffHouseId", name, room_type as "roomType", capacity, status
    `;

    return NextResponse.json({ 
      message: 'Room created successfully',
      room: result[0]
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json(
      { error: 'Failed to create room' }, 
      { status: 500 }
    );
  }
}

// PUT handler to update an existing room
export async function PUT(request: Request) {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_accommodation_bookings')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const validation = roomSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() }, 
        { status: 400 }
      );
    }

    const { id, staffHouseId, name, roomType, capacity, status } = validation.data;

    if (!id) {
      return NextResponse.json(
        { error: 'Room ID is required for updates' }, 
        { status: 400 }
      );
    }

    // Check if the room exists
    const existingRoom = await sql`
      SELECT id FROM accommodation_rooms WHERE id = ${id}
    `;

    if (existingRoom.length === 0) {
      return NextResponse.json(
        { error: 'Room not found' }, 
        { status: 404 }
      );
    }

    // Check if the staff house exists
    const staffHouse = await sql`
      SELECT id FROM accommodation_staff_houses WHERE id = ${staffHouseId}
    `;

    if (staffHouse.length === 0) {
      return NextResponse.json(
        { error: 'Staff house not found' }, 
        { status: 404 }
      );
    }

    // Check if the new name conflicts with another room in the same staff house
    const nameConflict = await sql`
      SELECT id FROM accommodation_rooms 
      WHERE staff_house_id = ${staffHouseId} AND name = ${name} AND id != ${id}
    `;

    if (nameConflict.length > 0) {
      return NextResponse.json(
        { error: 'Another room with this name already exists in this staff house' }, 
        { status: 409 }
      );
    }

    // Update the room
    const result = await sql`
      UPDATE accommodation_rooms SET
        staff_house_id = ${staffHouseId},
        name = ${name},
        room_type = ${roomType},
        capacity = ${capacity},
        status = ${status},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, staff_house_id as "staffHouseId", name, room_type as "roomType", capacity, status
    `;

    return NextResponse.json({ 
      message: 'Room updated successfully',
      room: result[0]
    });
  } catch (error) {
    console.error('Error updating room:', error);
    return NextResponse.json(
      { error: 'Failed to update room' }, 
      { status: 500 }
    );
  }
}

// DELETE handler to remove a room
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
        { error: 'Room ID is required' }, 
        { status: 400 }
      );
    }

    // Check if the room exists
    const existingRoom = await sql`
      SELECT id FROM accommodation_rooms WHERE id = ${id}
    `;

    if (existingRoom.length === 0) {
      return NextResponse.json(
        { error: 'Room not found' }, 
        { status: 404 }
      );
    }

    // Check if there are any bookings for this room
    const bookings = await sql`
      SELECT id FROM accommodation_bookings WHERE room_id = ${id} LIMIT 1
    `;

    if (bookings.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete room with existing bookings' }, 
        { status: 409 }
      );
    }

    // Delete the room
    await sql`DELETE FROM accommodation_rooms WHERE id = ${id}`;

    return NextResponse.json({ 
      message: 'Room deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting room:', error);
    return NextResponse.json(
      { error: 'Failed to delete room' }, 
      { status: 500 }
    );
  }
}
