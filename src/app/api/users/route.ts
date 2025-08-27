// src/app/api/users/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { formatISO, parseISO } from 'date-fns';
import { requireRole } from '@/lib/authz';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hashPassword } from '@/lib/password-utils';
import { hasPermission } from '@/lib/permissions';
import { withCache, userCacheKey, CACHE_TTL } from '@/lib/cache';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';

const userCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(15, "Password must be at least 15 characters."),
  role_id: z.string().uuid().nullable().optional(),
  department: z.string().nullable().optional(),
  staff_id: z.string().nullable().optional(),
  gender: z.enum(['Male', 'Female']).nullable().optional(),
  status: z.enum(['Active', 'Inactive']).default('Active'),
});

export const GET = withRateLimit(RATE_LIMITS.API_READ)(async function(request: NextRequest) {
  console.log("API_USERS_GET_START (PostgreSQL): Handler entered.");
  
  // Check if user has permission to view users
  if (!await hasPermission('view_users') && !await hasPermission('manage_users')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
  }
  
  // Debug environment variables
  console.log("API_USERS_GET_DEBUG: Environment variables check:");
  console.log("DATABASE_HOST:", process.env.DATABASE_HOST || 'NOT SET');
  console.log("DATABASE_NAME:", process.env.DATABASE_NAME || 'NOT SET');
  console.log("DATABASE_USER:", process.env.DATABASE_USER || 'NOT SET');
  console.log("DATABASE_PASSWORD:", process.env.DATABASE_PASSWORD ? 'SET (value hidden)' : 'NOT SET');
  
  if (!sql) {
    console.error("API_USERS_GET_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized. Check server logs.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const searchTerm = searchParams.get('search')?.trim();
  const roleFilter = searchParams.get('role')?.trim(); // Expects role name for filtering
  const statusFilter = searchParams.get('status')?.trim();
  const sortBy = searchParams.get('sortBy') || 'name';
  const sortOrder = searchParams.get('sortOrder') || 'asc';

  const offset = (page - 1) * limit;

  const whereClauses: any[] = [];
  if (searchTerm) {
    whereClauses.push(sql`(LOWER(users.name) LIKE LOWER(${'%' + searchTerm + '%'}) OR LOWER(users.email) LIKE LOWER(${'%' + searchTerm + '%'}) OR LOWER(users.staff_id) LIKE LOWER(${'%' + searchTerm + '%'}))`);
  }
  if (statusFilter) {
    whereClauses.push(sql`users.status = ${statusFilter}`);
  }
  if (roleFilter) {
     // Assuming roleFilter is the role name. Join with roles table to filter by name.
    whereClauses.push(sql`roles.name = ${roleFilter}`);
  }

  // Construct WHERE clause by combining all conditions with AND
  let whereClause = sql``;
  if (whereClauses.length > 0) {
    whereClause = sql`WHERE ${ whereClauses[0] }`;
    for (let i = 1; i < whereClauses.length; i++) {
      whereClause = sql`${whereClause} AND ${ whereClauses[i] }`;
    }
  }

  const allowedSortColumns: Record<string, string> = {
    id: 'users.id', name: 'users.name', email: 'users.email', 
    roleName: 'roles.name', // Sort by role name from joined table
    department: 'users.department', staff_id: 'users.staff_id', status: 'users.status',
    lastLogin: 'users.last_login_at', created_at: 'users.created_at',
  };
  const dbSortColumn = allowedSortColumns[sortBy] || 'users.name';
  const dbSortOrder = sortOrder.toLowerCase() === 'desc' ? sql`DESC` : sql`ASC`;

  try {
    console.log("API_USERS_GET (PostgreSQL): Attempting to query users.");
    const usersQuery = sql`
      SELECT 
        users.id, users.name, users.email, users.department, users.staff_id, users.gender, users.status, 
        users.last_login_at AS "lastLogin", users.created_at, users.updated_at,
        users.role_id, roles.name AS "roleName"
      FROM users
      LEFT JOIN roles ON users.role_id = roles.id
      ${whereClause}
      ORDER BY ${sql(dbSortColumn)} ${dbSortOrder} NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `;
    const usersFromDb = await usersQuery;

    const countQuery = sql`
      SELECT COUNT(*) AS count
      FROM users
      ${ roleFilter ? sql`LEFT JOIN roles ON users.role_id = roles.id` : sql`` } 
      ${whereClause}
    `;
    const totalCountResult = await countQuery;
    const totalCount = Number(totalCountResult[0]?.count || 0);

    console.log(`API_USERS_GET (PostgreSQL): Fetched ${usersFromDb.length} users. Total matched: ${totalCount}`);
    
    const users = usersFromDb.map(user => {
      const userObj = {
        id: user.id,
        name: user.name,
        email: user.email,
        role_id: user.role_id, // ensure this is present
        roleName: user.roleName,
        department: user.department,
        staff_id: user.staff_id,
        gender: user.gender,
        status: user.status,
        lastLogin: user.lastLogin ? formatISO(new Date(user.lastLogin)) : null,
        created_at: user.created_at ? formatISO(new Date(user.created_at)) : null,
        updated_at: user.updated_at ? formatISO(new Date(user.updated_at)) : null,
      };
      console.log("API_USERS_GET: User object:", userObj);
      return userObj;
    });

    return NextResponse.json({
      users,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    });
  } catch (error: any) {
    console.error("API_USERS_GET_ERROR (PostgreSQL):", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to fetch users from database.', details: error.message }, { status: 500 });
  }
}));

export const POST = withRateLimit(RATE_LIMITS.API_WRITE)(async function(request: NextRequest) {
  // Require admin role - accept both "System Administrator" and "admin" for backwards compatibility
  try {
    const session = await getServerSession(authOptions);
    console.log("SESSION DEBUG (POST):", session);
    const allowedAdminRoles = ["System Administrator", "admin"];
    if (!session?.user?.role || !allowedAdminRoles.includes(session.user.role)) {
      console.log("POST AUTH FAILED - User role:", session?.user?.role, "- Allowed roles:", allowedAdminRoles);
      return NextResponse.json({ error: "Not authenticated or not an admin" }, { status: 401 });
    }
  } catch (authError) {
    console.error("POST AUTH ERROR:", authError);
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }
  console.log("API_USERS_POST_START (PostgreSQL): Handler entered.");
  if (!sql) {
    console.error("API_USERS_POST_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }
  try {
    const body = await request.json();
    console.log("API_USERS_POST (PostgreSQL): Received body:", body);
    const validationResult = userCreateSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("API_USERS_POST_VALIDATION_ERROR (PostgreSQL):", validationResult.error.flatten());
      return NextResponse.json({ error: "Validation failed", details: validationResult.error.flatten() }, { status: 400 });
    }
    const { name, email, password, role_id, department, staff_id, gender, status } = validationResult.data;

    if (password.length < 15) {
      return NextResponse.json({ error: "Password must be at least 15 characters." }, { status: 400 });
    }

    // Hash the password before storing
    const hashedPassword = await hashPassword(password);

    // Check for duplicate email
    const existingByEmail = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existingByEmail.count > 0) {
      return NextResponse.json({ error: "User with this email already exists." }, { status: 409 });
    }
    // Check for duplicate staff_id if provided
    if (staff_id) {
      const existingByStaffId = await sql`SELECT id FROM users WHERE staff_id = ${staff_id}`;
      if (existingByStaffId.count > 0) {
        return NextResponse.json({ error: "User with this Staff ID already exists." }, { status: 409 });
      }
    }

    let roleName: string | null = null;
    if (role_id) {
      const roleResult = await sql`SELECT name FROM roles WHERE id = ${role_id}`;
      if (roleResult.count > 0) {
        roleName = roleResult[0].name as string;
      } else {
        console.warn(`API_USERS_POST (PostgreSQL): Role ID ${role_id} not found in roles table. User will be created without a role name.`);
      }
    }
    
    const newUserArray = await sql`
      INSERT INTO users (name, email, password, role_id, role, department, staff_id, gender, status, created_at, updated_at)
      VALUES (${name}, ${email}, ${hashedPassword}, ${role_id || null}, ${roleName || null}, ${department || null}, ${staff_id || null}, ${gender || null}, ${status}, NOW(), NOW())
      RETURNING id, name, email, role_id, role AS "roleName", department, staff_id, gender, status, last_login_at AS "lastLogin", created_at, updated_at
    `;
    const newUser = newUserArray[0];
    
    const formattedUser = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role_id: newUser.role_id,
      roleName: newUser.roleName,
      department: newUser.department,
      staff_id: newUser.staff_id,
      gender: newUser.gender,
      status: newUser.status,
      lastLogin: newUser.lastLogin ? formatISO(new Date(newUser.lastLogin)) : null,
      created_at: newUser.created_at ? formatISO(new Date(newUser.created_at)) : null,
      updated_at: newUser.updated_at ? formatISO(new Date(newUser.updated_at)) : null,
    };

    console.log("API_USERS_POST (PostgreSQL): User created successfully:", formattedUser.id);
    return NextResponse.json({ user: formattedUser }, { status: 201 });

  } catch (error: any) {
    console.error("API_USERS_POST_ERROR (PostgreSQL):", error.message, error.stack);
    if (error.code === '23505') { // Unique constraint violation
        if (error.constraint_name?.includes('email')) {
             return NextResponse.json({ error: 'User with this email already exists.', details: error.message }, { status: 409 });
        }
        if (error.constraint_name?.includes('staff_id')) {
             return NextResponse.json({ error: 'User with this Staff ID already exists.', details: error.message }, { status: 409 });
        }
    }
    return NextResponse.json({ error: 'Failed to create user.', details: error.message }, { status: 500 });
  }
});
