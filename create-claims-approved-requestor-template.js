#!/usr/bin/env node

require('dotenv').config();
const postgres = require('postgres');

async function createClaimsApprovedRequestorTemplate() {
  const sql = postgres({
    host: process.env.DATABASE_HOST || 'localhost',
    database: process.env.DATABASE_NAME || 'syntra',
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.NODE_ENV === 'production'
  });

  try {
    console.log('📧 Creating claims fully approved requestor notification template...\n');
    
    // Create the missing template for requestor when claim is fully approved
    const templateResult = await sql`
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
        'claims_hod_approved_to_requestor',
        '✅ Expense Claim Approved - Processing Initiated: {entityId}',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">✅ EXPENSE CLAIM APPROVED!</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Your claim has been approved and is now being processed</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
            <p>Dear <strong>{requestorName}</strong>,</p>
            
            <p>Great news! Your expense claim has been <strong>approved by the HOD</strong> and is now being processed by the Claims Admin:</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
              <p><strong>Claim ID:</strong> {entityId}</p>
              <p><strong>Purpose:</strong> {claimPurpose}</p>
              <p><strong>Amount:</strong> {entityAmount}</p>
              <p><strong>Department:</strong> {department}</p>
              <p><strong>Current Status:</strong> {currentStatus}</p>
              {approverName && <p><strong>Approved by:</strong> {approverName}</p>}
              {comments && <p><strong>HOD Comments:</strong> {comments}</p>}
            </div>
            
            <div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; border-left: 4px solid #bee5eb;">
              <p style="margin: 0;"><strong>What happens next?</strong></p>
              <p style="margin: 10px 0 0 0;">Your claim is now with the Claims Admin for final processing. You will receive another notification once the payment has been processed and is ready for disbursement.</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="{approvalUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                View Claim Details
              </a>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #6c757d;">
              If you have any questions about your claim, please contact the Claims Admin or your department''s focal person.
            </p>
          </div>
          
          <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
            This is an automated notification from the TMS System.<br>
            Please do not reply to this email.
          </div>
        </div>',
        'Notification sent to requestor when their expense claim is approved by HOD and sent to Claims Admin',
        'email',
        'requestor',
        true,
        ARRAY['entityId', 'requestorName', 'claimPurpose', 'entityAmount', 'department', 'currentStatus', 'approverName', 'comments', 'approvalUrl']
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
    
    console.log('✅ Created/Updated claims_hod_approved_to_requestor template');
    
    // Verify the template was created
    const verification = await sql`
      SELECT name, subject, recipient_type, is_active
      FROM notification_templates 
      WHERE name = 'claims_hod_approved_to_requestor'
    `;
    
    if (verification.length > 0) {
      const template = verification[0];
      console.log(`✅ Verification: ${template.name} - ${template.recipient_type} - Active: ${template.is_active}`);
      console.log(`   Subject: ${template.subject}`);
    }
    
    console.log('\n📝 NEXT STEPS:');
    console.log('1. Update claims action route to send this notification to requestor');
    console.log('2. Test the notification flow when HOD approves a claim');
    console.log('3. Ensure requestor gets both the approval notification AND CC on Claims Admin notification');
    
    await sql.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

createClaimsApprovedRequestorTemplate();