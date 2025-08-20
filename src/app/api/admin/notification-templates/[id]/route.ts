import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Missing template ID' }, { status: 400 });
    }

    const [template] = await sql`
      SELECT id, name, description, subject, body, 
             notification_type as "type", event_type_id as "eventType", 
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM notification_templates 
      WHERE id = ${id}
    `;

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('Error fetching notification template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification template' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, description, subject, body, type, eventType } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Missing template ID' }, { status: 400 });
    }

    if (!name || !subject || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: name, subject, body' },
        { status: 400 }
      );
    }

    const [updatedTemplate] = await sql`
      UPDATE notification_templates 
      SET name = ${name}, 
          description = ${description || null}, 
          subject = ${subject}, 
          body = ${body}, 
          notification_type = ${type || 'email'}, 
          event_type_id = ${eventType || null},
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, description, subject, body, 
                notification_type as "type", event_type_id as "eventType", 
                created_at AS "createdAt", updated_at AS "updatedAt"
    `;

    if (!updatedTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json(updatedTemplate);
  } catch (error) {
    console.error('Error updating notification template:', error);
    return NextResponse.json(
      { error: 'Failed to update notification template' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Missing template ID' }, { status: 400 });
    }

    await sql`
      DELETE FROM notification_templates WHERE id = ${id}
    `;

    return NextResponse.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification template:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification template' },
      { status: 500 }
    );
  }
}
