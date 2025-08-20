// API endpoints for user notifications
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NotificationService } from '@/lib/notification-service';
import { hasPermission } from '@/lib/permissions';

// GET - Fetch user's notifications
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to view notifications
    // Temporarily disabled to debug HOD notification issue
    // if (!await hasPermission('view_sidebar_counts')) {
    //   return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    // }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const category = searchParams.get('category');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    const notifications = await NotificationService.getUserNotifications(session.user.id, {
      unreadOnly,
      category: category || undefined,
      limit,
      offset
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// POST - Create a new notification (for testing/admin use)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only system admins can create notifications manually
    if (!await hasPermission('send_notifications')) {
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { targetUserId, title, message, type, category, priority, relatedEntityType, relatedEntityId, actionRequired, actionUrl } = body;

    if (!targetUserId || !title || !message || !type || !category) {
      return NextResponse.json({ 
        error: 'Missing required fields: targetUserId, title, message, type, category' 
      }, { status: 400 });
    }

    const notificationId = await NotificationService.createNotification({
      userId: targetUserId,
      title,
      message,
      type,
      category,
      priority: priority || 'normal',
      relatedEntityType,
      relatedEntityId,
      actionRequired: actionRequired || false,
      actionUrl
    });

    return NextResponse.json({ 
      success: true, 
      notificationId,
      message: 'Notification created successfully' 
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}