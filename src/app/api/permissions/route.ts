// src/app/api/permissions/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { formatISO } from 'date-fns';

export async function GET(request: NextRequest) {
  console.log("API_PERMISSIONS_GET_START (PostgreSQL): Fetching permissions.");
   if (!sql) {
    console.error("API_PERMISSIONS_GET_CRITICAL_ERROR (PostgreSQL): SQL client is not initialized.");
    return NextResponse.json({ error: 'Database client not initialized.' }, { status: 503 });
  }
  try {
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
    console.error("API_PERMISSIONS_GET_ERROR (PostgreSQL):", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to fetch permissions.', details: error.message }, { status: 500 });
  }
}
