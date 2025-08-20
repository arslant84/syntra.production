// Test endpoint for notification events without auth
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing notification events API...');

    // Test database connection
    const testConnection = await sql`SELECT 1 as test`;
    console.log('Database connection successful');

    // Fetch all notification event types
    const eventTypes = await sql`
      SELECT 
        id, name, description, category, module, 
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM notification_event_types
      ORDER BY module, category, name
    `;

    console.log(`Found ${eventTypes.length} event types`);

    // Also check the table structure
    const tableInfo = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'notification_event_types'
      ORDER BY ordinal_position
    `;

    return NextResponse.json({ 
      success: true,
      eventTypesCount: eventTypes.length,
      eventTypes: eventTypes.slice(0, 5), // First 5 for preview
      tableStructure: tableInfo,
      sampleQuery: 'SELECT * FROM notification_event_types LIMIT 5'
    });
  } catch (error) {
    console.error('Error in test notification events API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch notification event types',
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
}