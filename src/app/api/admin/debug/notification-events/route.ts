// Debug endpoint for notification events with detailed logging
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';
import { sql } from '@/lib/db';

export const GET = withAuth(async function(request: NextRequest) {
  try {
    const session = (request as any).user;
    console.log('Debug: Session user:', session?.email);
    console.log('Debug: Session permissions:', session?.permissions);
    console.log('Debug: Session role:', session?.role);
    
    // Check permissions with detailed logging
    const hasManageNotifications = hasPermission(session, 'manage_notifications');
    const hasSystemAdmin = hasPermission(session, 'system_admin');
    
    console.log('Debug: Has manage_notifications permission:', hasManageNotifications);
    console.log('Debug: Has system_admin permission:', hasSystemAdmin);
    
    if (!hasManageNotifications && !hasSystemAdmin) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        details: 'User lacks required permissions: manage_notifications or system_admin',
        userPermissions: session?.permissions,
        userRole: session?.role
      }, { status: 403 });
    }

    // Test database connection
    console.log('Debug: Testing database connection...');
    const testQuery = await sql`SELECT 1 as test`;
    console.log('Debug: Database connection successful');

    // Check if table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notification_event_types'
      )
    `;
    console.log('Debug: Table exists:', tableExists[0].exists);

    // Get table row count
    const countResult = await sql`SELECT COUNT(*) as count FROM notification_event_types`;
    console.log('Debug: Total event types in database:', countResult[0].count);

    // Fetch all notification event types with detailed logging
    console.log('Debug: Fetching notification event types...');
    const eventTypes = await sql`
      SELECT 
        id, name, description, category, module, 
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM notification_event_types
      ORDER BY module, category, name
    `;

    console.log('Debug: Successfully fetched', eventTypes.length, 'event types');
    
    // Log first few event types for debugging
    console.log('Debug: Sample event types:', eventTypes.slice(0, 3));

    return NextResponse.json({ 
      success: true,
      eventTypes,
      debug: {
        userRole: session?.role,
        userPermissions: session?.permissions,
        tableExists: tableExists[0].exists,
        totalCount: parseInt(countResult[0].count),
        sampleEvents: eventTypes.slice(0, 3)
      }
    });
  } catch (error) {
    console.error('Debug API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch notification event types',
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
});