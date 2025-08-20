import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';
import { sql } from '@/lib/db';

export const PATCH = withAuth(async function(request: NextRequest, { params }: { params: { eventId: string } }) {
  try {
    const session = (request as any).user;
    
    // Check if user has permission to manage notifications
    if (!hasPermission(session, 'manage_notifications') && !hasPermission(session, 'system_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { eventId } = params;
    const body = await request.json();

    // Update event type
    const [updatedEventType] = await sql`
      UPDATE notification_event_types 
      SET 
        name = COALESCE(${body.name}, name),
        description = COALESCE(${body.description}, description),
        category = COALESCE(${body.category}, category),
        module = COALESCE(${body.module}, module),
        is_active = COALESCE(${body.isActive}, is_active),
        updated_at = NOW()
      WHERE id = ${eventId}
      RETURNING id, name, description, category, module, is_active as "isActive"
    `;

    if (!updatedEventType) {
      return NextResponse.json({ error: 'Event type not found' }, { status: 404 });
    }

    return NextResponse.json({ eventType: updatedEventType });
  } catch (error) {
    console.error('Error updating notification event type:', error);
    return NextResponse.json(
      { error: 'Failed to update notification event type' },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async function(request: NextRequest, { params }: { params: { eventId: string } }) {
  try {
    const session = (request as any).user;
    
    // Check if user has permission to manage notifications
    if (!hasPermission(session, 'manage_notifications') && !hasPermission(session, 'system_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { eventId } = params;

    // Check if event type is being used by templates or subscriptions
    const usageCheck = await sql`
      SELECT 
        (SELECT COUNT(*) FROM notification_templates WHERE event_type_id = ${eventId}) as template_count,
        (SELECT COUNT(*) FROM notification_user_subscriptions WHERE event_type_id = ${eventId}) as subscription_count
    `;

    const { template_count, subscription_count } = usageCheck[0];
    
    if (parseInt(template_count) > 0 || parseInt(subscription_count) > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete event type that is being used by templates or subscriptions' 
      }, { status: 400 });
    }

    // Delete event type
    const result = await sql`
      DELETE FROM notification_event_types WHERE id = ${eventId}
    `;

    if (result.count === 0) {
      return NextResponse.json({ error: 'Event type not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification event type:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification event type' },
      { status: 500 }
    );
  }
});