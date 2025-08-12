import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const templates = await sql`
      SELECT id, name, subject, created_at AS "createdAt" FROM notification_templates
    `;
    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching notification templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, subject, body } = await request.json();

    if (!name || !subject || !body) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const newTemplate = await sql`
      INSERT INTO notification_templates (name, subject, body)
      VALUES (${name}, ${subject}, ${body})
      RETURNING id, name, subject, created_at AS "createdAt"
    `;

    return NextResponse.json(newTemplate[0], { status: 201 });
  } catch (error) {
    console.error('Error creating notification template:', error);
    return NextResponse.json(
      { error: 'Failed to create notification template' },
      { status: 500 }
    );
  }
}
