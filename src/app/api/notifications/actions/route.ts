// API endpoint for notification actions (mark read, dismiss, etc.)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NotificationService } from '@/lib/notification-service';
import { hasPermission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to manage their notifications
    if (!await hasPermission('view_sidebar_counts')) {
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { action, notificationIds, notificationId } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    switch (action) {
      case 'mark_read':
        if (notificationId) {
          await NotificationService.markAsRead(notificationId, session.user.id);
        } else if (notificationIds && Array.isArray(notificationIds)) {
          await NotificationService.markMultipleAsRead(notificationIds, session.user.id);
        } else {
          return NextResponse.json({ error: 'notificationId or notificationIds required for mark_read' }, { status: 400 });
        }
        break;

      case 'mark_all_read':
        await NotificationService.markAllAsRead(session.user.id);
        break;

      case 'dismiss':
        if (!notificationId) {
          return NextResponse.json({ error: 'notificationId required for dismiss' }, { status: 400 });
        }
        await NotificationService.dismissNotification(notificationId, session.user.id);
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `Action ${action} completed successfully` });
  } catch (error) {
    console.error('Error performing notification action:', error);
    return NextResponse.json({ error: 'Failed to perform notification action' }, { status: 500 });
  }
}