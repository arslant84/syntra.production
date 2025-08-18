import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { hasPermission } from '../../../../../lib/permissions';

// Schema for creating/updating accommodation locations
const locationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  location: z.enum(['Ashgabat', 'Kiyanly', 'Turkmenbashy'], {
    required_error: "Location must be one of: Ashgabat, Kiyanly, Turkmenbashy"
  }),
  address: z.string().optional(),
  description: z.string().optional()
});

// GET handler to fetch all accommodation locations
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission
    if (!hasPermission(session, 'manage_accommodation_locations')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
      // Check if table exists first
      try {
        await sql`SELECT 1 FROM accommodation_staff_houses LIMIT 1`;
      } catch (tableError: unknown) {
        if (tableError instanceof Error && tableError.message && 
            tableError.message.includes('relation "accommodation_staff_houses" does not exist')) {
          console.log('Accommodation staff houses table does not exist yet, returning empty results');
          return NextResponse.json({ locations: [] });
        }
      }

      // Fetch all staff houses
      const staffHouses = await sql`
        SELECT 
          id, 
          name, 
          location, 
          address,
          description
        FROM accommodation_staff_houses 
        ORDER BY 
          location, name
      `;

      // Transform the data to match the expected format
      const locations = staffHouses.map(house => ({
        id: house.id,
        name: house.name,
        location: house.location,
        address: house.address,
        description: house.description
      }));

      return NextResponse.json({ locations });
    } catch (dbError: unknown) {
      console.error('Database query error:', dbError);
      // If there's any database error, return empty results in development
      return NextResponse.json({ 
        locations: [],
        debug: process.env.NODE_ENV === 'development' ? 
          { error: dbError instanceof Error ? dbError.message : 'Unknown database error' } : undefined
      });
    }
  } catch (error: unknown) {
    console.error('Error fetching staff houses:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch staff houses', 
        message: error instanceof Error ? error.message : 'Unknown error',
        locations: [] // Always return an empty array even on error to avoid frontend crashes
      },
      { status: 500 }
    );
  }
}

// POST handler to create a new accommodation location
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission
    if (!hasPermission(session, 'manage_accommodation_bookings')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const validation = locationSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() }, 
        { status: 400 }
      );
    }

    const { name, location, address, description } = validation.data;

    // Check if a location with the same name already exists
    const existingLocation = await sql`
      SELECT id FROM accommodation_staff_houses WHERE name = ${name}
    `;

    if (existingLocation.length > 0) {
      return NextResponse.json(
        { error: 'A location with this name already exists' }, 
        { status: 409 }
      );
    }

    // Create the new location
    const result = await sql`
      INSERT INTO accommodation_staff_houses (
        name, 
        location, 
        address, 
        description
      ) VALUES (
        ${name}, 
        ${location}, 
        ${address || null}, 
        ${description || null}
      ) RETURNING id, name, location, address, description
    `;

    return NextResponse.json({ 
      message: 'Accommodation location created successfully',
      location: result[0]
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating accommodation location:', error);
    return NextResponse.json(
      { error: 'Failed to create accommodation location' }, 
      { status: 500 }
    );
  }
}

// PUT handler to update an existing accommodation location
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission
    if (!hasPermission(session, 'manage_accommodation_bookings')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const validation = locationSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() }, 
        { status: 400 }
      );
    }

    const { id, name, location, address, description } = validation.data;

    if (!id) {
      return NextResponse.json(
        { error: 'Location ID is required for updates' }, 
        { status: 400 }
      );
    }

    // Check if the location exists
    const existingLocation = await sql`
      SELECT id FROM accommodation_staff_houses WHERE id = ${id}
    `;

    if (existingLocation.length === 0) {
      return NextResponse.json(
        { error: 'Location not found' }, 
        { status: 404 }
      );
    }

    // Check if the new name conflicts with another location
    const nameConflict = await sql`
      SELECT id FROM accommodation_staff_houses 
      WHERE name = ${name} AND id != ${id}
    `;

    if (nameConflict.length > 0) {
      return NextResponse.json(
        { error: 'Another location with this name already exists' }, 
        { status: 409 }
      );
    }

    // Update the location
    const result = await sql`
      UPDATE accommodation_staff_houses SET
        name = ${name},
        location = ${location},
        address = ${address || null},
        description = ${description || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, location, address, description
    `;

    return NextResponse.json({ 
      message: 'Accommodation location updated successfully',
      location: result[0]
    });
  } catch (error) {
    console.error('Error updating accommodation location:', error);
    return NextResponse.json(
      { error: 'Failed to update accommodation location' }, 
      { status: 500 }
    );
  }
}

// DELETE handler to remove an accommodation location
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission
    if (!hasPermission(session, 'manage_accommodation_bookings')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Location ID is required' }, 
        { status: 400 }
      );
    }

    // Check if the location exists
    const existingLocation = await sql`
      SELECT id FROM accommodation_staff_houses WHERE id = ${id}
    `;

    if (existingLocation.length === 0) {
      return NextResponse.json(
        { error: 'Location not found' }, 
        { status: 404 }
      );
    }

    // Check if there are any rooms for this location
    const rooms = await sql`
      SELECT id FROM accommodation_rooms WHERE staff_house_id = ${id}
    `;

    if (rooms.length > 0) {
      // Check if there are any bookings for this location
      const bookings = await sql`
        SELECT id FROM accommodation_bookings WHERE staff_house_id = ${id} LIMIT 1
      `;

      if (bookings.length > 0) {
        return NextResponse.json(
          { 
            error: 'Cannot delete location with existing bookings', 
            message: 'This location has active bookings. Please cancel or reassign all bookings before deleting this location.',
            hasBookings: true
          }, 
          { status: 409 }
        );
      }

      // Has rooms but no bookings
      return NextResponse.json(
        { 
          error: 'Cannot delete location with existing rooms', 
          message: 'This location has rooms assigned to it. Please delete all rooms first before deleting this location.',
          hasRooms: true
        }, 
        { status: 409 }
      );
    }

    // Delete the location (this will cascade delete rooms due to foreign key constraint)
    await sql`DELETE FROM accommodation_staff_houses WHERE id = ${id}`;

    return NextResponse.json({ 
      message: 'Accommodation location deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting accommodation location:', error);
    return NextResponse.json(
      { error: 'Failed to delete accommodation location' }, 
      { status: 500 }
    );
  }
}
