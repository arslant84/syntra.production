import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';
import { sql } from '@/lib/db';

export const GET = withAuth(async function(request: NextRequest) {
  try {
    const session = (request as any).user;
    
    // Check if user has permission to manage notifications
    if (!hasPermission(session, 'manage_notifications') && !hasPermission(session, 'system_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

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

    return NextResponse.json({ eventTypes });
  } catch (error) {
    console.error('Error fetching notification event types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification event types' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async function(request: NextRequest) {
  try {
    const session = (request as any).user;
    
    // Check if user has permission to manage notifications
    if (!hasPermission(session, 'manage_notifications') && !hasPermission(session, 'system_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, category, module } = body;

    if (!name || !category || !module) {
      return NextResponse.json(
        { error: 'Missing required fields: name, category, module' },
        { status: 400 }
      );
    }

    // Create new event type
    const [newEventType] = await sql`
      INSERT INTO notification_event_types (name, description, category, module)
      VALUES (${name}, ${description || null}, ${category}, ${module})
      RETURNING id, name, description, category, module, is_active as "isActive"
    `;

    return NextResponse.json({ eventType: newEventType }, { status: 201 });
  } catch (error) {
    console.error('Error creating notification event type:', error);
    return NextResponse.json(
      { error: 'Failed to create notification event type' },
      { status: 500 }
    );
  }
});