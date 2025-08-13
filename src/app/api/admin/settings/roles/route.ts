// src/app/api/admin/settings/roles/route.ts
import { NextResponse } from 'next/server';
import { 
  getAllRolesWithPermissions, 
  createRole, 
  updateRole, 
  deleteRole 
} from '@/lib/system-settings-service';
import { hasPermission } from '@/lib/permissions';
import { z } from 'zod';

// Schema for role validation
const roleSchema = z.object({
  name: z.string().min(1, 'Role name is required'),
  description: z.string().nullable().optional(),
  permissionIds: z.array(z.string()).optional().default([])
});

// GET handler to fetch all roles with permissions
export async function GET() {
  try {
    // Check if user has permission to view system settings
    if (!await hasPermission('view_system_settings')) {
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    }

    const roles = await getAllRolesWithPermissions();
    return NextResponse.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    );
  }
}

// POST handler to create a new role
export async function POST(request: Request) {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_roles')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const validation = roleSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      );
    }

    const newRole = await createRole(validation.data);
    
    return NextResponse.json(newRole, { status: 201 });
  } catch (error) {
    console.error('Error creating role:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create role';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// PUT handler to update an existing role
export async function PUT(request: Request) {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_roles')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    
    // Extract roleId from the request body
    const { id: roleId, ...roleData } = body;
    
    if (!roleId) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }
    
    const validation = roleSchema.safeParse(roleData);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      );
    }

    const updatedRole = await updateRole(roleId, validation.data);
    
    return NextResponse.json(updatedRole);
  } catch (error) {
    console.error('Error updating role:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update role';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE handler to delete a role
export async function DELETE(request: Request) {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_roles')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Extract roleId from the URL search params
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('id');
    
    if (!roleId) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }

    await deleteRole(roleId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting role:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete role';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
