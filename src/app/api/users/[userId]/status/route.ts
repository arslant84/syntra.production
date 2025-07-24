// src/app/api/users/[userId]/status/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { formatISO } from 'date-fns';

const statusUpdateSchema = z.object({
  status: z.enum(["Active", "Inactive"]),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  console.log(`API_USERID_STATUS_PATCH_START (PostgreSQL): Updating status for user ${userId}.`);
  if (!sql) {
    console.error("API_USERID_STATUS_PATCH_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const validationResult = statusUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("API_USERID_STATUS_PATCH_VALIDATION_ERROR (PostgreSQL):", validationResult.error.flatten());
      return NextResponse.json({ error: "Validation failed", details: validationResult.error.flatten() }, { status: 400 });
    }
    const { status } = validationResult.data;
    
    const updatedUserArray = await sql`
      UPDATE users
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${userId}
      RETURNING id, name, email, role_id, role AS "roleName", department, staff_id, status, last_login_at AS "lastLogin", created_at, updated_at
    `;

    if (updatedUserArray.count === 0) {
      return NextResponse.json({ error: 'User not found or update failed' }, { status: 404 });
    }
    const updatedUser = updatedUserArray[0];
    const formattedUser = {
      ...updatedUser,
      lastLogin: updatedUser.lastLogin ? formatISO(new Date(updatedUser.lastLogin)) : null,
      created_at: updatedUser.created_at ? formatISO(new Date(updatedUser.created_at)) : null,
      updated_at: updatedUser.updated_at ? formatISO(new Date(updatedUser.updated_at)) : null,
    };

    console.log(`API_USERID_STATUS_PATCH (PostgreSQL): User ${userId} status updated:`, formattedUser);
    return NextResponse.json({ user: formattedUser });
  } catch (error: any) {
    console.error(`API_USERID_STATUS_PATCH_ERROR (PostgreSQL) for user ${userId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to update user status.', details: error.message }, { status: 500 });
  }
}
