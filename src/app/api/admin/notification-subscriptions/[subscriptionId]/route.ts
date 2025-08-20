import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';
import { sql } from '@/lib/db';

export const PATCH = withAuth(async function(request: NextRequest, { params }: { params: { subscriptionId: string } }) {
  try {
    const session = (request as any).user;
    
    // Check if user has permission to manage notifications
    if (!hasPermission(session, 'manage_notifications') && !hasPermission(session, 'system_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { subscriptionId } = params;
    const body = await request.json();

    // Update subscription
    const [updatedSubscription] = await sql`
      UPDATE notification_user_subscriptions 
      SET 
        permission_required = COALESCE(${body.permissionRequired}, permission_required),
        role_required = COALESCE(${body.roleRequired}, role_required),
        department_filter = COALESCE(${body.departmentFilter}, department_filter),
        notification_method = COALESCE(${body.notificationMethod}, notification_method),
        is_enabled = COALESCE(${body.isEnabled}, is_enabled),
        updated_at = NOW()
      WHERE id = ${subscriptionId}
      RETURNING id, user_id as "userId", event_type_id as "eventTypeId", is_enabled as "isEnabled"
    `;

    if (!updatedSubscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json({ subscription: updatedSubscription });
  } catch (error) {
    console.error('Error updating notification subscription:', error);
    return NextResponse.json(
      { error: 'Failed to update notification subscription' },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async function(request: NextRequest, { params }: { params: { subscriptionId: string } }) {
  try {
    const session = (request as any).user;
    
    // Check if user has permission to manage notifications
    if (!hasPermission(session, 'manage_notifications') && !hasPermission(session, 'system_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { subscriptionId } = params;

    // Delete subscription
    const result = await sql`
      DELETE FROM notification_user_subscriptions WHERE id = ${subscriptionId}
    `;

    if (result.count === 0) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification subscription:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification subscription' },
      { status: 500 }
    );
  }
});