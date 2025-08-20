// Test endpoint to verify template body retrieval
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing template body retrieval...');

    // Get all templates with body content
    const templates = await sql`
      SELECT id, name, subject, 
             CASE WHEN LENGTH(body) > 100 THEN LEFT(body, 100) || '...' ELSE body END as body_preview,
             LENGTH(body) as body_length,
             notification_type as "type", 
             event_type_id as "eventType"
      FROM notification_templates
      ORDER BY name
    `;

    console.log(`Found ${templates.length} templates`);

    // Test individual template retrieval
    if (templates.length > 0) {
      const firstTemplate = templates[0];
      const [fullTemplate] = await sql`
        SELECT id, name, description, subject, body,
               notification_type as "type", event_type_id as "eventType", 
               created_at AS "createdAt", updated_at AS "updatedAt"
        FROM notification_templates 
        WHERE id = ${firstTemplate.id}
      `;

      return NextResponse.json({
        success: true,
        summary: {
          totalTemplates: templates.length,
          templatesWithBody: templates.filter(t => t.body_length > 0).length,
          averageBodyLength: Math.round(templates.reduce((acc, t) => acc + t.body_length, 0) / templates.length)
        },
        allTemplates: templates,
        sampleFullTemplate: fullTemplate,
        testEndpoints: {
          getAllTemplates: '/api/admin/notification-templates',
          getTemplate: `/api/admin/notification-templates/${firstTemplate.id}`,
          updateTemplate: `PUT /api/admin/notification-templates/${firstTemplate.id}`
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'No templates found',
      totalTemplates: 0
    });

  } catch (error) {
    console.error('Error testing template body:', error);
    return NextResponse.json(
      { 
        error: 'Failed to test template body retrieval',
        details: error.message
      },
      { status: 500 }
    );
  }
}