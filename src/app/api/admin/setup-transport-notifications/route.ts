// src/app/api/admin/setup-transport-notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 SETUP: Setting up transport notification templates');

    // Insert transport submission template for approvers
    const result = await sql`
      INSERT INTO notification_templates (name, subject, body, notification_type, recipient_type) 
      VALUES (
          'transport_submitted_approver',
          'New Transport Request Requires Your Approval: {entityId}',
          '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #20c997; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h2 style="margin: 0;">🚗 New Transport Request</h2>
                  <p style="margin: 5px 0 0 0; opacity: 0.9;">Approval Required</p>
              </div>
              
              <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
                  <p>Dear Department Focal,</p>
                  
                  <p><strong>{requestorName}</strong> has submitted a new transport request that requires your approval:</p>
                  
                  <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #20c997;">
                      <p><strong>Request ID:</strong> {entityId}</p>
                      <p><strong>Requestor:</strong> {requestorName}</p>
                      <p><strong>Department:</strong> {department}</p>
                      <p><strong>Status:</strong> {currentStatus}</p>
                  </div>
                  
                  <div style="text-align: center; margin: 30px 0;">
                      <a href="{approvalUrl}" 
                         style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
                          Review & Approve Request
                      </a>
                  </div>
                  
                  <p style="margin-top: 30px; font-size: 14px; color: #6c757d;">
                      Please review this request and take appropriate action. You can access the full details by clicking the link above.
                  </p>
              </div>
              
              <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
                  This is an automated notification from the VMS System.<br>
                  Please do not reply to this email.
              </div>
          </div>',
          'email',
          'approver'
      )
      ON CONFLICT (name) DO UPDATE SET
          subject = EXCLUDED.subject,
          body = EXCLUDED.body,
          notification_type = EXCLUDED.notification_type,
          recipient_type = EXCLUDED.recipient_type
    `;

    // Ensure the approve_transport_requests permission exists
    await sql`
      INSERT INTO permissions (name, description) 
      VALUES (
          'approve_transport_requests',
          'Can approve transport requests'
      )
      ON CONFLICT (name) DO NOTHING
    `;

    // Check notification event types
    const eventTypes = await sql`
      SELECT id, name FROM notification_event_types 
      WHERE name IN ('Transport Submitted', 'transport_submitted')
    `;

    console.log('🔧 SETUP: Event types found:', eventTypes);

    // Insert event type if missing
    if (eventTypes.length === 0) {
      await sql`
        INSERT INTO notification_event_types (name, description)
        VALUES ('transport_submitted', 'Transport request submitted for approval')
        ON CONFLICT (name) DO NOTHING
      `;
    }

    // Verify templates were created
    const templates = await sql`
      SELECT name, subject FROM notification_templates 
      WHERE name = 'transport_submitted_approver'
    `;

    console.log('✅ SETUP: Transport notification setup complete');

    return NextResponse.json({
      success: true,
      message: 'Transport notification templates setup successfully',
      templates: templates,
      eventTypes: eventTypes
    });

  } catch (error) {
    console.error('❌ SETUP: Error setting up transport notifications:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to setup transport notifications',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}