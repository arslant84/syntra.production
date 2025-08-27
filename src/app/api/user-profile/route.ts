import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { sql } from '@/lib/db';
import { z } from 'zod';
import { withCache, userCacheKey, CACHE_TTL } from '@/lib/cache';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';

const profileUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  gender: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  profile_photo: z.string().nullable().optional(), // Base64 encoded image or URL
});

// GET - Get current user's profile
export const GET = withRateLimit(RATE_LIMITS.API_READ)(async function(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const users = await sql`
      SELECT 
        id, name, email, role, department, staff_id, gender, phone, profile_photo, status, created_at, updated_at
      FROM users 
      WHERE email = ${session.user.email}
      LIMIT 1
    `;

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[0];
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
});

// PATCH - Update current user's profile
export const PATCH = withRateLimit(RATE_LIMITS.API_WRITE)(async function(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = profileUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: validationResult.error.flatten() 
      }, { status: 400 });
    }

    const updateData = validationResult.data;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update provided' }, { status: 400 });
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (updateData.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(updateData.name);
    }

    if (updateData.hasOwnProperty('gender')) {
      updateFields.push(`gender = $${paramIndex++}`);
      updateValues.push(updateData.gender);
    }

    if (updateData.hasOwnProperty('phone')) {
      updateFields.push(`phone = $${paramIndex++}`);
      updateValues.push(updateData.phone);
    }

    if (updateData.hasOwnProperty('profile_photo')) {
      updateFields.push(`profile_photo = $${paramIndex++}`);
      updateValues.push(updateData.profile_photo);
    }

    // Always update the updated_at timestamp
    updateFields.push(`updated_at = $${paramIndex++}`);
    updateValues.push(new Date());

    // Add email as the WHERE condition
    updateValues.push(session.user.email);

    const query = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE email = $${paramIndex}
      RETURNING 
        id, name, email, role, department, staff_id, gender, phone, profile_photo, status, created_at, updated_at
    `;

    const result = await sql.unsafe(query, updateValues);

    if (result.length === 0) {
      return NextResponse.json({ error: 'User not found or update failed' }, { status: 404 });
    }

    const updatedUser = result[0];
    return NextResponse.json({ 
      user: updatedUser,
      message: 'Profile updated successfully' 
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
});