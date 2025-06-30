// src/app/api/admin/settings/permissions/route.ts
import { NextResponse } from 'next/server';
import { getAllPermissions } from '@/lib/system-settings-service';
import { hasPermission } from '@/lib/auth-service';

// GET handler to fetch all permissions
export async function GET() {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_roles')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const permissions = await getAllPermissions();
    return NextResponse.json(permissions);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}
