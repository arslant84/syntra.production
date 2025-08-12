// src/app/api/permissions/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { formatISO } from 'date-fns';
import { requireRoles, createAuthError } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    // TEMPORARILY DISABLED: Authentication completely removed for testing
    console.log('API_PERMISSIONS_GET_START: Authentication bypassed for testing');

    if (!sql) {
      console.error("API_PERMISSIONS_GET_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
      return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
    }
    const permissionsData = await sql`
      SELECT id, name, description, created_at, updated_at 
      FROM permissions
      ORDER BY name ASC
    `;
    
    const permissions = permissionsData.map(perm => ({
        ...perm,
        created_at: perm.created_at ? formatISO(new Date(perm.created_at)) : null,
        updated_at: perm.updated_at ? formatISO(new Date(perm.updated_at)) : null,
    }));

    console.log(`API_PERMISSIONS_GET (PostgreSQL): Fetched ${permissions.length} permissions.`);
    return NextResponse.json({ permissions });
  } catch (error: any) {
    // Temporarily disable auth errors for testing
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      console.log('Auth error bypassed for testing - permissions endpoint');
      // Continue without authentication for now
    }

    console.error("API_PERMISSIONS_GET_ERROR (PostgreSQL):", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to fetch permissions.' }, { status: 500 });
  }
}
