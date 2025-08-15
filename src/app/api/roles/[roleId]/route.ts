// src/app/api/roles/[roleId]/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { formatISO } from 'date-fns';
import { withAuth, canViewAllData } from '@/lib/api-protection';

const roleUpdateSchema = z.object({
  name: z.string().min(2, "Role name must be at least 2 characters."),
  description: z.string().optional().nullable(),
  permissionIds: z.array(z.string().uuid("Invalid permission ID format.")).min(0, "Permissions list can be empty.").optional().default([]),
});

export const GET = withAuth(async function(request: NextRequest, { params }: { params: Promise<{ roleId: string }> }) {
  const session = (request as any).user;
  const { roleId } = await params;
  
  console.log(`API_ROLEID_GET_START (PostgreSQL): User ${session.role} fetching role ${roleId}.`);
  
  // Check if user has admin permissions to view roles
  if (!canViewAllData(session)) {
    console.log(`API_ROLEID_GET_UNAUTHORIZED: User ${session.role} cannot view roles`);
    return NextResponse.json({ error: 'Insufficient permissions to view roles' }, { status: 403 });
  }
  
  if (!sql) {
    console.error("API_ROLEID_GET_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }

  try {
    const rolesData = await sql`
      SELECT 
        r.id, r.name, r.description, r.created_at, r.updated_at,
        COALESCE(json_agg(rp.permission_id) FILTER (WHERE rp.permission_id IS NOT NULL), '[]'::json) as "permissionIds"
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      WHERE r.id = ${roleId}
      GROUP BY r.id, r.name, r.description, r.created_at, r.updated_at
    `;

    if (rolesData.count === 0) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }
    const role = rolesData[0];
    const formattedRole = {
      ...role,
      created_at: role.created_at ? formatISO(new Date(role.created_at)) : null,
      updated_at: role.updated_at ? formatISO(new Date(role.updated_at)) : null,
    };
    console.log(`API_ROLEID_GET (PostgreSQL): Role ${roleId} found.`);
    return NextResponse.json({ role: formattedRole });
  } catch (error: any) {
    console.error(`API_ROLEID_GET_ERROR (PostgreSQL) for role ${roleId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to fetch role.', details: error.message }, { status: 500 });
  }
});

export const PUT = withAuth(async function(request: NextRequest, { params }: { params: Promise<{ roleId: string }> }) {
  const session = (request as any).user;
  const { roleId } = await params;
  
  console.log(`API_ROLEID_PUT_START (PostgreSQL): User ${session.role} updating role ${roleId}.`);
  
  // Check if user has admin permissions to modify roles
  if (!canViewAllData(session)) {
    console.log(`API_ROLEID_PUT_UNAUTHORIZED: User ${session.role} cannot modify roles`);
    return NextResponse.json({ error: 'Insufficient permissions to modify roles' }, { status: 403 });
  }
   
  if (!sql) {
    console.error("API_ROLEID_PUT_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }
  try {
    const body = await request.json();
    const validationResult = roleUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("API_ROLEID_PUT_VALIDATION_ERROR (PostgreSQL):", validationResult.error.flatten());
      return NextResponse.json({ error: "Validation failed", details: validationResult.error.flatten() }, { status: 400 });
    }
    const { name, description, permissionIds } = validationResult.data;

    const existingRole = await sql`SELECT id FROM roles WHERE name = ${name} AND id != ${roleId}`;
    if (existingRole.count > 0) {
      return NextResponse.json({ error: "Another role with this name already exists." }, { status: 409 });
    }

    const updatedRole = await sql.begin(async tx => {
      const [role] = await tx`
        UPDATE roles
        SET name = ${name}, description = ${description || null}, updated_at = NOW()
        WHERE id = ${roleId}
        RETURNING id, name, description, created_at, updated_at
      `;

      if (!role) {
        // This case should ideally not happen if the roleId is valid, but as a safeguard.
        throw new Error("Role not found for update.");
      }

      await tx`DELETE FROM role_permissions WHERE role_id = ${roleId}`;
      if (permissionIds && permissionIds.length > 0) {
        const permissionsToInsert = permissionIds.map(permissionId => ({
          role_id: roleId,
          permission_id: permissionId,
        }));
        await tx`INSERT INTO role_permissions ${tx(permissionsToInsert, 'role_id', 'permission_id')}`;
      }
      return role;
    });

    if (!updatedRole) { // Should be caught by the error in transaction if role not found
        return NextResponse.json({ error: 'Role not found or update failed' }, { status: 404 });
    }
    
    const formattedRole = {
      ...updatedRole,
      permissionIds: permissionIds || [], // Return submitted permissionIds
      created_at: updatedRole.created_at ? formatISO(new Date(updatedRole.created_at)) : null,
      updated_at: updatedRole.updated_at ? formatISO(new Date(updatedRole.updated_at)) : null,
    };

    console.log(`API_ROLEID_PUT (PostgreSQL): Role ${roleId} updated successfully.`);
    return NextResponse.json({ role: formattedRole });

  } catch (error: any) {
    console.error(`API_ROLEID_PUT_ERROR (PostgreSQL) for role ${roleId}:`, error.message, error.stack);
    if (error.message === "Role not found for update.") {
        return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }
    if (error.code === '23505') { // Unique constraint violation for role name
        return NextResponse.json({ error: 'Another role with this name already exists.', details: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update role.', details: error.message }, { status: 500 });
  }
});

export const DELETE = withAuth(async function(request: NextRequest, { params }: { params: Promise<{ roleId: string }> }) {
  const session = (request as any).user;
  const { roleId } = await params;
  
  console.log(`API_ROLEID_DELETE_START (PostgreSQL): User ${session.role} deleting role ${roleId}.`);
  
  // Check if user has admin permissions to delete roles
  if (!canViewAllData(session)) {
    console.log(`API_ROLEID_DELETE_UNAUTHORIZED: User ${session.role} cannot delete roles`);
    return NextResponse.json({ error: 'Insufficient permissions to delete roles' }, { status: 403 });
  }
  
  if (!sql) {
    console.error("API_ROLEID_DELETE_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }
  // Note: In a real system, check if users are assigned this role before deleting.
  // For now, we rely on ON DELETE SET NULL for users.role_id if that's configured.
  try {
    const result = await sql.begin(async tx => {
      await tx`DELETE FROM role_permissions WHERE role_id = ${roleId}`;
      const [deletedRole] = await tx`DELETE FROM roles WHERE id = ${roleId} RETURNING id`;
      return deletedRole;
    });

    if (!result || !result.id) {
      return NextResponse.json({ error: 'Role not found or delete failed' }, { status: 404 });
    }
    console.log(`API_ROLEID_DELETE (PostgreSQL): Role ${roleId} deleted.`);
    return NextResponse.json({ message: 'Role deleted successfully' });
  } catch (error: any) {
    console.error(`API_ROLEID_DELETE_ERROR (PostgreSQL) for role ${roleId}:`, error.message, error.stack);
    return NextResponse.json({ error: 'Failed to delete role.', details: error.message }, { status: 500 });
  }
});
