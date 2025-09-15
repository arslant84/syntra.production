#!/usr/bin/env node

require('dotenv').config();
const postgres = require('postgres');

async function createMissingVisaTemplates() {
  const sql = postgres({
    host: process.env.DATABASE_HOST || 'localhost',
    database: process.env.DATABASE_NAME || 'syntra',
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.NODE_ENV === 'production'
  });

  try {
    console.log('📧 Creating missing visa notification templates...\n');
    
    // 1. Create visa_hod_approved_to_requestor template (MOST IMPORTANT)
    console.log('1. Creating visa_hod_approved_to_requestor template...');
    await sql`
      INSERT INTO notification_templates (
        name, 
        subject, 
        body, 
        description, 
        notification_type, 
        recipient_type, 
        is_active,
        variables_available
      ) VALUES (
        'visa_hod_approved_to_requestor',
        '✅ Visa Application Approved - Processing Initiated: {entityId}',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">✅ VISA APPLICATION APPROVED!</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Your application has been approved and is now being processed</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
            <p>Dear <strong>{requestorName}</strong>,</p>
            
            <p>Great news! Your visa application has been <strong>approved by the HOD</strong> and is now being processed by the Visa Admin:</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
              <p><strong>Application ID:</strong> {entityId}</p>
              <p><strong>Purpose:</strong> {visaPurpose}</p>
              <p><strong>Destination:</strong> {destination}</p>
              <p><strong>Visa Type:</strong> {visaType}</p>
              <p><strong>Department:</strong> {department}</p>
              <p><strong>Current Status:</strong> {currentStatus}</p>
              {approverName && <p><strong>Approved by:</strong> {approverName}</p>}
              {comments && <p><strong>HOD Comments:</strong> {comments}</p>}
            </div>
            
            <div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; border-left: 4px solid #bee5eb;">
              <p style="margin: 0;"><strong>What happens next?</strong></p>
              <p style="margin: 10px 0 0 0;">Your visa application is now with the Visa Admin for processing and submission to the relevant embassy/consulate. You will receive another notification once the visa processing is completed.</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{approvalUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                View Application Details
              </a>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #6c757d;">
              If you have any questions about your visa application, please contact the Visa Admin or your department''s focal person.
            </p>
          </div>
          
          <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
            This is an automated notification from the TMS System.<br>
            Please do not reply to this email.
          </div>
        </div>',
        'Notification sent to requestor when their visa application is approved by HOD and sent to Visa Admin',
        'email',
        'requestor',
        true,
        ARRAY['entityId', 'requestorName', 'visaPurpose', 'destination', 'visaType', 'department', 'currentStatus', 'approverName', 'comments', 'approvalUrl']
      )
      ON CONFLICT (name) DO UPDATE SET
        subject = EXCLUDED.subject,
        body = EXCLUDED.body,
        description = EXCLUDED.description,
        notification_type = EXCLUDED.notification_type,
        recipient_type = EXCLUDED.recipient_type,
        is_active = EXCLUDED.is_active,
        variables_available = EXCLUDED.variables_available,
        updated_at = NOW()
    `;
    console.log('   ✅ Created visa_hod_approved_to_requestor');

    // 2. Create visa_submission_to_focal template
    console.log('2. Creating visa_submission_to_focal template...');
    await sql`
      INSERT INTO notification_templates (
        name, 
        subject, 
        body, 
        description, 
        notification_type, 
        recipient_type, 
        is_active,
        variables_available
      ) VALUES (
        'visa_submission_to_focal',
        'New Visa Application Requires Your Approval: {entityId}',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #17a2b8; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">🛂 New Visa Application</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Department Focal Approval Required</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
            <p>Dear Department Focal,</p>
            
            <p><strong>{requestorName}</strong> has submitted a new visa application that requires your approval:</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #17a2b8;">
              <p><strong>Application ID:</strong> {entityId}</p>
              <p><strong>Requestor:</strong> {requestorName}</p>
              <p><strong>Department:</strong> {department}</p>
              <p><strong>Purpose:</strong> {visaPurpose}</p>
              <p><strong>Destination:</strong> {destination}</p>
              <p><strong>Visa Type:</strong> {visaType}</p>
              <p><strong>Status:</strong> {currentStatus}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{approvalUrl}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
                Approve Application
              </a>
              <a href="{approvalUrl}" style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Reject Application
              </a>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #6c757d;">
              Please review the visa application details and take appropriate action. This application is awaiting your approval to proceed to the Line Manager.
            </p>
          </div>
          
          <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
            This is an automated notification from the TMS System.<br>
            Please do not reply to this email.
          </div>
        </div>',
        'Notification sent to Department Focal when a new visa application is submitted',
        'email',
        'approver',
        true,
        ARRAY['entityId', 'requestorName', 'department', 'visaPurpose', 'destination', 'visaType', 'currentStatus', 'approvalUrl']
      )
      ON CONFLICT (name) DO UPDATE SET
        subject = EXCLUDED.subject,
        body = EXCLUDED.body,
        description = EXCLUDED.description,
        notification_type = EXCLUDED.notification_type,
        recipient_type = EXCLUDED.recipient_type,
        is_active = EXCLUDED.is_active,
        variables_available = EXCLUDED.variables_available,
        updated_at = NOW()
    `;
    console.log('   ✅ Created visa_submission_to_focal');

    // 3. Create visa_rejected template
    console.log('3. Creating visa_rejected template...');
    await sql`
      INSERT INTO notification_templates (
        name, 
        subject, 
        body, 
        description, 
        notification_type, 
        recipient_type, 
        is_active,
        variables_available
      ) VALUES (
        'visa_rejected',
        '❌ Visa Application Rejected: {entityId}',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">❌ VISA APPLICATION REJECTED</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Your application has been declined</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
            <p>Dear <strong>{requestorName}</strong>,</p>
            
            <p>We regret to inform you that your visa application has been <strong>rejected</strong> during the approval process:</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
              <p><strong>Application ID:</strong> {entityId}</p>
              <p><strong>Purpose:</strong> {visaPurpose}</p>
              <p><strong>Destination:</strong> {destination}</p>
              <p><strong>Visa Type:</strong> {visaType}</p>
              <p><strong>Department:</strong> {department}</p>
              {approverName && <p><strong>Rejected by:</strong> {approverName}</p>}
              {rejectionReason && <p><strong>Reason for Rejection:</strong> {rejectionReason}</p>}
            </div>
            
            <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; border-left: 4px solid #f5c6cb;">
              <p style="margin: 0;"><strong>What to do next:</strong></p>
              <p style="margin: 10px 0 0 0;">Please review the rejection reason above and contact your department focal or the rejecting approver for clarification. You may submit a new application once the issues have been resolved.</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{approvalUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                View Application Details
              </a>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #6c757d;">
              If you have any questions about this rejection, please contact your department focal person or the approver mentioned above.
            </p>
          </div>
          
          <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
            This is an automated notification from the TMS System.<br>
            Please do not reply to this email.
          </div>
        </div>',
        'Notification sent to requestor when their visa application is rejected',
        'email',
        'requestor',
        true,
        ARRAY['entityId', 'requestorName', 'visaPurpose', 'destination', 'visaType', 'department', 'approverName', 'rejectionReason', 'approvalUrl']
      )
      ON CONFLICT (name) DO UPDATE SET
        subject = EXCLUDED.subject,
        body = EXCLUDED.body,
        description = EXCLUDED.description,
        notification_type = EXCLUDED.notification_type,
        recipient_type = EXCLUDED.recipient_type,
        is_active = EXCLUDED.is_active,
        variables_available = EXCLUDED.variables_available,
        updated_at = NOW()
    `;
    console.log('   ✅ Created visa_rejected');

    // 4. Verify all templates were created
    console.log('\n🔍 Verifying created templates...');
    const createdTemplates = await sql`
      SELECT name, subject, recipient_type
      FROM notification_templates 
      WHERE name IN ('visa_hod_approved_to_requestor', 'visa_submission_to_focal', 'visa_rejected')
      ORDER BY name
    `;
    
    console.log('═'.repeat(70));
    createdTemplates.forEach(template => {
      console.log(`✅ ${template.name} (${template.recipient_type}): ${template.subject}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('📝 TEMPLATE CREATION SUMMARY:');
    console.log('='.repeat(80));
    console.log('✅ visa_hod_approved_to_requestor - CRITICAL: Requestor notification when HOD approves');
    console.log('✅ visa_submission_to_focal - Focal notification when visa submitted');
    console.log('✅ visa_rejected - Requestor notification when visa rejected');
    console.log('\n📧 All missing visa templates have been created successfully!');
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Update visa workflow action route to use these templates');
    console.log('2. Migrate problematic visa statuses in database');
    console.log('3. Update unified notification service for visa workflow');
    
    await sql.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

createMissingVisaTemplates();