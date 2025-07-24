// src/app/api/users/[userId]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { formatISO } from 'date-fns';
import { requireRole } from '@/lib/authz';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const userUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Invalid email format").optional(),
  role_id: z.string().uuid("Invalid Role ID format").nullable().optional(),
  department: z.string().nullable().optional(),
  staff_id: z.string().nullable().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
  password: z.string().min(15, "Password must be at least 15 characters.").optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  console.log(`API_USERID_GET_START (PostgreSQL): Fetching user ${userId}.`);
  if (!sql) {
    console.error("API_USERID_GET_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const users = await sql`
      SELECT 
        users.id, users.name, users.email, users.department, users.staff_id, users.status, 
        users.last_login_at AS "lastLogin", users.created_at, users.updated_at,
        users.role_id, roles.name AS "roleName"
      FROM users
      LEFT JOIN roles ON users.role_id = roles.id
      WHERE users.id = ${userId}
    `;

    if (users.count === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const user = users[0];
    const formattedUser = {
      ...user,
      lastLogin: user.lastLogin ? formatISO(new Date(user.lastLogin)) : null,
      created_at: user.created_at ? formatISO(new Date(user.created_at)) : null,
      updated_at: user.updated_at ? formatISO(new Date(user.updated_at)) : null,
    };
    console.log(`API_USERID_GET (PostgreSQL): User ${userId} found.`);
    return NextResponse.json({ user: formattedUser });
  } catch (error: any) {
    console.error(`API_USERID_GET_ERROR (PostgreSQL) for user ${userId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to fetch user.', details: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  console.log("SESSION DEBUG (PATCH):", session);
  if (!session?.user?.role || session.user.role !== "System Administrator") {
    return NextResponse.json({ error: "Not authenticated or not an admin" }, { status: 401 });
  }
  const { userId } = await params;
  console.log(`API_USERID_PATCH_START (PostgreSQL): Updating user ${userId}.`);
  if (!sql) {
    console.error("API_USERID_PATCH_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const validationResult = userUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("API_USERID_PATCH_VALIDATION_ERROR (PostgreSQL):", validationResult.error.flatten());
      return NextResponse.json({ error: "Validation failed", details: validationResult.error.flatten() }, { status: 400 });
    }
    const updateData = validationResult.data;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update provided." }, { status: 400 });
    }
    
    // Check for duplicate email if email is being updated
    if (updateData.email) {
      const existingByEmail = await sql`SELECT id FROM users WHERE email = ${updateData.email} AND id != ${userId}`;
      if (existingByEmail.count > 0) {
        return NextResponse.json({ error: "This email is already in use by another user." }, { status: 409 });
      }
    }
    // Check for duplicate staff_id if staff_id is being updated
    if (updateData.staff_id) {
      const existingByStaffId = await sql`SELECT id FROM users WHERE staff_id = ${updateData.staff_id} AND id != ${userId}`;
      if (existingByStaffId.count > 0) {
        return NextResponse.json({ error: "This Staff ID is already in use by another user." }, { status: 409 });
      }
    }
    
    // Build update fields and values
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    if (updateData.name !== undefined) {
      updateFields.push('name');
      updateValues.push(updateData.name);
    }
    if (updateData.email !== undefined) {
      updateFields.push('email');
      updateValues.push(updateData.email);
    }
    if (updateData.department !== undefined) {
      updateFields.push('department');
      updateValues.push(updateData.department);
    }
    if (updateData.staff_id !== undefined) {
      updateFields.push('staff_id');
      updateValues.push(updateData.staff_id);
    }
    if (updateData.status !== undefined) {
      updateFields.push('status');
      updateValues.push(updateData.status);
    }
    if (updateData.password !== undefined && updateData.password.length >= 15) {
      updateFields.push('password');
      updateValues.push(updateData.password);
    }
    
    let roleNameForDenormalization: string | null = null;
    if (updateData.hasOwnProperty('role_id')) {
      updateFields.push('role_id');
      updateValues.push(updateData.role_id);
      
      if (updateData.role_id) {
        const roleResult = await sql`SELECT name FROM roles WHERE id = ${updateData.role_id}`;
        if (roleResult.count > 0) {
          roleNameForDenormalization = roleResult[0].name as string;
        }
      }
      updateFields.push('role');
      updateValues.push(roleNameForDenormalization);
    }

    if (updateFields.length === 0) {
        // If only role_id was sent but it didn't change the denormalized role name (e.g. role_id was null and stayed null)
        // Fetch current user to return.
        const currentUsers = await sql`SELECT users.*, roles.name as "roleName" FROM users LEFT JOIN roles ON users.role_id = roles.id WHERE users.id = ${userId}`;
        if (currentUsers.count === 0) return NextResponse.json({ error: "User not found after attempted update."}, { status: 404});
        const userToReturn = currentUsers[0];
         return NextResponse.json({ user: {
            ...userToReturn,
            lastLogin: userToReturn.last_login_at ? formatISO(new Date(userToReturn.last_login_at)) : null,
            created_at: formatISO(new Date(userToReturn.created_at)),
            updated_at: formatISO(new Date(userToReturn.updated_at)),
        } });
    }
    
    updateFields.push('updated_at');
    updateValues.push(new Date());

    // Build the SET clause
    const setClause = updateFields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    
    // Add userId as the last parameter
    updateValues.push(userId);
    
    const query = `
      UPDATE users
      SET ${setClause}
      WHERE id = $${updateValues.length}
      RETURNING id, name, email, role_id, role AS "roleName", department, staff_id, status, last_login_at AS "lastLogin", created_at, updated_at
    `;

    // Log query and values for debugging
    console.error('USER PATCH DEBUG: Query:', query);
    console.error('USER PATCH DEBUG: Values:', updateValues);

    const updatedUserArray = await (sql as any).unsafe(query, updateValues);

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

    console.log(`API_USERID_PATCH (PostgreSQL): User ${userId} updated:`, formattedUser);
    return NextResponse.json({ user: formattedUser });

  } catch (error: any) {
    // Log the full error object for debugging
    console.error(`API_USERID_PATCH_ERROR (PostgreSQL) for user ${userId}:`, error);
    if (error.code === '23505') { // Unique constraint violation
      if (error.constraint_name?.includes('email')) {
        return NextResponse.json({ error: 'User with this email already exists.', details: error.message }, { status: 409 });
      }
      if (error.constraint_name?.includes('staff_id')) {
        return NextResponse.json({ error: 'User with this Staff ID already exists.', details: error.message }, { status: 409 });
      }
    }
    return NextResponse.json({ error: 'Failed to update user.', details: error.message, fullError: error }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getServerSession(authOptions);
  console.log("SESSION DEBUG (DELETE):", session);
  if (!session?.user?.role || session.user.role !== "System Administrator") {
    return NextResponse.json({ error: "Not authenticated or not an admin" }, { status: 401 });
  }
  const { userId } = await params;
  console.log(`API_USERID_DELETE_START (PostgreSQL): Deleting user ${userId}.`);
  if (!sql) {
    console.error("API_USERID_DELETE_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const result = await sql`
      DELETE FROM users
      WHERE id = ${userId}
      RETURNING id
    `;

    if (result.count === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    console.log(`API_USERID_DELETE (PostgreSQL): User ${userId} deleted.`);
    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error(`API_USERID_DELETE_ERROR (PostgreSQL) for user ${userId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to delete user.', details: error.message }, { status: 500 });
  }
}
