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

    // Fetch all user subscriptions with user and event details
    const subscriptions = await sql`
      SELECT 
        nus.id,
        nus.user_id as "userId",
        u.name as "userName",
        u.email as "userEmail",
        nus.event_type_id as "eventTypeId",
        net.name as "eventName",
        nus.permission_required as "permissionRequired",
        nus.role_required as "roleRequired",
        nus.department_filter as "departmentFilter",
        nus.is_enabled as "isEnabled",
        nus.notification_method as "notificationMethod",
        nus.created_at as "createdAt"
      FROM notification_user_subscriptions nus
      INNER JOIN users u ON nus.user_id = u.id
      INNER JOIN notification_event_types net ON nus.event_type_id = net.id
      ORDER BY u.name, net.name
    `;

    return NextResponse.json({ subscriptions });
  } catch (error) {
    console.error('Error fetching notification subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification subscriptions' },
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
    const { 
      userId, 
      eventTypeId, 
      permissionRequired, 
      roleRequired, 
      departmentFilter,
      notificationMethod = 'in_app',
      isEnabled = true
    } = body;

    if (!userId || !eventTypeId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, eventTypeId' },
        { status: 400 }
      );
    }

    // Create or update subscription
    const [subscription] = await sql`
      INSERT INTO notification_user_subscriptions (
        user_id, event_type_id, permission_required, role_required,
        department_filter, notification_method, is_enabled
      ) VALUES (
        ${userId}, ${eventTypeId}, 
        ${permissionRequired || null}, ${roleRequired || null},
        ${departmentFilter || null}, ${notificationMethod}, ${isEnabled}
      )
      ON CONFLICT (user_id, event_type_id) DO UPDATE SET
        permission_required = EXCLUDED.permission_required,
        role_required = EXCLUDED.role_required,
        department_filter = EXCLUDED.department_filter,
        notification_method = EXCLUDED.notification_method,
        is_enabled = EXCLUDED.is_enabled,
        updated_at = NOW()
      RETURNING id, user_id as "userId", event_type_id as "eventTypeId"
    `;

    return NextResponse.json({ subscription }, { status: 201 });
  } catch (error) {
    console.error('Error creating notification subscription:', error);
    return NextResponse.json(
      { error: 'Failed to create notification subscription' },
      { status: 500 }
    );
  }
});