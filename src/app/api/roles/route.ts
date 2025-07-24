// src/app/api/roles/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { formatISO } from 'date-fns';
import { requireRole } from '@/lib/authz';

const roleCreateSchema = z.object({
  name: z.string().min(2, "Role name must be at least 2 characters."),
  description: z.string().optional().nullable(),
  permissionIds: z.array(z.string().uuid("Invalid permission ID format.")).min(0, "Permissions list can be empty.").optional().default([]), // Allow empty for creation
});

export async function GET(request: NextRequest) {
  console.log("API_ROLES_GET_START (PostgreSQL): Fetching roles.");
  
  // Debug environment variables
  console.log("API_ROLES_GET_DEBUG: Environment variables check:");
  console.log("DATABASE_HOST:", process.env.DATABASE_HOST || 'NOT SET');
  console.log("DATABASE_NAME:", process.env.DATABASE_NAME || 'NOT SET');
  console.log("DATABASE_USER:", process.env.DATABASE_USER || 'NOT SET');
  console.log("DATABASE_PASSWORD:", process.env.DATABASE_PASSWORD ? 'SET (value hidden)' : 'NOT SET');
  
  if (!sql) {
    console.error("API_ROLES_GET_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }
  try {
    const rolesData = await sql`
      SELECT 
        r.id, r.name, r.description, r.created_at, r.updated_at,
        COALESCE(json_agg(rp.permission_id) FILTER (WHERE rp.permission_id IS NOT NULL), '[]'::json) as "permissionIds"
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      GROUP BY r.id, r.name, r.description, r.created_at, r.updated_at
      ORDER BY r.name ASC
    `;
    
    const roles = rolesData.map(role => ({
        ...role,
        created_at: role.created_at ? formatISO(new Date(role.created_at)) : null,
        updated_at: role.updated_at ? formatISO(new Date(role.updated_at)) : null,
    }));

    console.log(`API_ROLES_GET (PostgreSQL): Fetched ${roles.length} roles.`);
    return NextResponse.json({ roles });
  } catch (error: any) {
    console.error("API_ROLES_GET_ERROR (PostgreSQL):", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to fetch roles.', details: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(request, ['System Administrator']);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.message === 'Forbidden' ? 403 : 401 });
  }
  console.log("API_ROLES_POST_START (PostgreSQL): Creating role.");
  if (!sql) {
    console.error("API_ROLES_POST_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const validationResult = roleCreateSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("API_ROLES_POST_VALIDATION_ERROR (PostgreSQL):", validationResult.error.flatten());
      return NextResponse.json({ error: "Validation failed", details: validationResult.error.flatten() }, { status: 400 });
    }
    const { name, description, permissionIds } = validationResult.data;

    const existingRole = await sql`SELECT id FROM roles WHERE name = ${name}`;
    if (existingRole.count > 0) {
      return NextResponse.json({ error: "Role with this name already exists." }, { status: 409 });
    }

    const newRole = await sql.begin(async tx => {
      const [role] = await tx`
        INSERT INTO roles (name, description, created_at, updated_at)
        VALUES (${name}, ${description || null}, NOW(), NOW())
        RETURNING id, name, description, created_at, updated_at
      `;

      if (permissionIds && permissionIds.length > 0) {
        const permissionsToInsert = permissionIds.map(permissionId => ({
          role_id: role.id,
          permission_id: permissionId,
        }));
        await tx`INSERT INTO role_permissions ${tx(permissionsToInsert, 'role_id', 'permission_id')}`;
      }
      return role;
    });
    
    const formattedRole = {
        ...newRole,
        permissionIds: permissionIds || [], // Return submitted permissionIds
        created_at: newRole.created_at ? formatISO(new Date(newRole.created_at)) : null,
        updated_at: newRole.updated_at ? formatISO(new Date(newRole.updated_at)) : null,
    };

    console.log("API_ROLES_POST (PostgreSQL): Role created successfully:", newRole.id);
    return NextResponse.json({ role: formattedRole }, { status: 201 });

  } catch (error: any) {
    console.error("API_ROLES_POST_ERROR (PostgreSQL):", error.message, error.stack);
     if (error.code === '23505') { // Unique constraint violation for role name
        return NextResponse.json({ error: 'Role with this name already exists.', details: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create role.', details: error.message }, { status: 500 });
  }
}
