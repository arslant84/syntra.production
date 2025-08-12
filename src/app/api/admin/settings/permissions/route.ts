// src/app/api/admin/settings/permissions/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getAllPermissions } from '@/lib/system-settings-service';
import { requireAuth, createAuthError } from '@/lib/auth-utils';

// GET handler to fetch all permissions
export async function GET(request: NextRequest) {
  try {
    // TEMPORARILY DISABLED: Authentication completely removed for testing
    console.log('Admin Settings Permissions: Authentication bypassed for testing');

    const permissions = await getAllPermissions();
    return NextResponse.json(permissions);
  } catch (error: any) {
    // Temporarily bypass authentication errors
    if (error.message === 'UNAUTHORIZED') {
      console.log('Auth error bypassed for testing - admin settings');
    }

    console.error('Error fetching permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}
