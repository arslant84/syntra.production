// src/app/api/admin/settings/notifications/route.ts
import { NextResponse } from 'next/server';
import { 
  getAllNotificationTemplates,
  getAllNotificationEventTypes,
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate
} from '@/lib/system-settings-service';
import { hasPermission } from '@/lib/auth-service';
import { NotificationTemplateFormValues } from '@/types/notifications';

// GET handler to fetch all notification templates and event types
export async function GET(request: Request) {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_notifications')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const url = new URL(request.url);
    const type = url.searchParams.get('type');

    if (type === 'event-types') {
      const eventTypes = await getAllNotificationEventTypes();
      return NextResponse.json(eventTypes);
    } else {
      const templates = await getAllNotificationTemplates();
      return NextResponse.json(templates);
    }
  } catch (error) {
    console.error('Error fetching notification data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification data' },
      { status: 500 }
    );
  }
}

// POST handler to create a new notification template
export async function POST(request: Request) {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_notifications')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const templateData = await request.json();

    if (!templateData.name || !templateData.subject || !templateData.body || !templateData.type || !templateData.eventType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const newTemplate = await createNotificationTemplate(templateData as NotificationTemplateFormValues);
    return NextResponse.json(newTemplate);
  } catch (error) {
    console.error('Error creating notification template:', error);
    return NextResponse.json(
      { error: 'Failed to create notification template' },
      { status: 500 }
    );
  }
}

// PUT handler to update a notification template
export async function PUT(request: Request) {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_notifications')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { templateId, templateData } = body;

    if (!templateId || !templateData) {
      return NextResponse.json(
        { error: 'Missing required fields: templateId or templateData' },
        { status: 400 }
      );
    }

    const updatedTemplate = await updateNotificationTemplate(templateId, templateData as NotificationTemplateFormValues);
    return NextResponse.json(updatedTemplate);
  } catch (error) {
    console.error('Error updating notification template:', error);
    return NextResponse.json(
      { error: 'Failed to update notification template' },
      { status: 500 }
    );
  }
}

// DELETE handler to delete a notification template
export async function DELETE(request: Request) {
  try {
    // Check if user has permission
    if (!await hasPermission('manage_notifications')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const url = new URL(request.url);
    const templateId = url.searchParams.get('templateId');

    if (!templateId) {
      return NextResponse.json(
        { error: 'Missing required parameter: templateId' },
        { status: 400 }
      );
    }

    const success = await deleteNotificationTemplate(templateId);
    return NextResponse.json({ success });
  } catch (error) {
    console.error('Error deleting notification template:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification template' },
      { status: 500 }
    );
  }
}
