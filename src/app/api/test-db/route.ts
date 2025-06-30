// src/app/api/test-db/route.ts
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: Request) {
  console.log("API_TEST_DB_POSTGRES: Handler entered.");
  try {
    if (!sql) {
      console.error("API_TEST_DB_POSTGRES_ERROR: SQL client from @/lib/db is not initialized.");
      return NextResponse.json({ error: 'Database client not initialized. Check server logs.' }, { status: 503 });
    }

    console.log("API_TEST_DB_POSTGRES: SQL client seems available. Attempting to query current time.");
    const result = await sql`SELECT NOW();`;
    const currentTime = result[0]?.now;

    if (currentTime) {
      console.log("API_TEST_DB_POSTGRES_SUCCESS: Successfully connected to PostgreSQL. Current time:", currentTime);
      return NextResponse.json({
        message: 'Successfully connected to PostgreSQL using postgres.js!',
        timestamp: currentTime,
      });
    } else {
      console.error("API_TEST_DB_POSTGRES_ERROR: Query executed but no time returned.");
      return NextResponse.json({ error: 'Query executed but no time returned from PostgreSQL.' }, { status: 500 });
    }
  } catch (error: any) {
    console.error("API_TEST_DB_POSTGRES_ERROR: Error connecting to PostgreSQL or executing query:", error.message, error.stack);
    return NextResponse.json({ error: 'Failed to connect to PostgreSQL or execute query.', details: error.message }, { status: 500 });
  }
}
