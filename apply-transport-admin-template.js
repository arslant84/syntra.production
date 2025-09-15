/**
 * Script to apply transport admin notification template
 */

const path = require('path');
const fs = require('fs');

// Try to find the correct path to db module
let dbPath;
const possiblePaths = [
  '../src/lib/db',
  '../src/lib/db.js', 
  '../src/lib/db.ts'
];

for (const testPath of possiblePaths) {
  try {
    const fullPath = path.resolve(__dirname, testPath);
    if (fs.existsSync(fullPath + '.js') || fs.existsSync(fullPath + '.ts') || fs.existsSync(fullPath)) {
      dbPath = testPath;
      break;
    }
  } catch (e) {
    // Continue trying
  }
}

if (!dbPath) {
  console.log('❌ Could not find database module');
  console.log('📝 Please manually apply the SQL template:');
  console.log('');
  console.log(`-- Transport Admin Notification Template`);
  console.log(`INSERT INTO notification_templates (name, subject, body, notification_type, recipient_type, is_active)`);
  console.log(`VALUES (`);
  console.log(`  'transport_hod_approved_to_admin',`);
  console.log(`  'Transport Request Ready for Processing: {entityId}',`);
  console.log(`  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><div style="background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;"><h2 style="margin: 0;">🚗 Transport Request - Processing Required</h2><p style="margin: 5px 0 0 0; opacity: 0.9;">HOD Approved - Ready for Processing</p></div><div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;"><p>Dear Transport Admin,</p><p>A transport request has been <strong>approved by the HOD</strong> and is ready for your processing:</p><div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;"><p><strong>Request ID:</strong> {entityId}</p><p><strong>Requestor:</strong> {requestorName}</p><p><strong>Department:</strong> {department}</p><p><strong>Purpose:</strong> {transportPurpose}</p><p><strong>Status:</strong> {currentStatus}</p>{approverName && <p><strong>Approved by:</strong> {approverName}</p>}{comments && <p><strong>HOD Comments:</strong> {comments}</p>}</div><div style="text-align: center; margin: 30px 0;"><a href="{approvalUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">Process Transport Request</a></div><p style="margin-top: 30px; font-size: 14px; color: #6c757d;">Please review the transport details and process this request. You can access the full details by clicking the link above.</p></div><div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">This is an automated notification from the TMS System.<br>Please do not reply to this email.</div></div>',`);
  console.log(`  'email',`);
  console.log(`  'approver',`);
  console.log(`  true`);
  console.log(`)`);
  console.log(`ON CONFLICT (name) DO UPDATE SET`);
  console.log(`  subject = EXCLUDED.subject,`);
  console.log(`  body = EXCLUDED.body,`);
  console.log(`  is_active = EXCLUDED.is_active;`);
  console.log('');
  console.log(`-- Ensure permission exists`);
  console.log(`INSERT INTO permissions (name, description)`);
  console.log(`VALUES ('manage_transport_requests', 'Can manage and process transport requests')`);
  console.log(`ON CONFLICT (name) DO NOTHING;`);
  console.log('');
  process.exit(1);
}

async function applyTemplate() {
  try {
    console.log('📧 Creating transport admin notification template...');
    
    const { sql } = require(dbPath);
    
    // Create the template
    await sql`
      INSERT INTO notification_templates (name, subject, body, notification_type, recipient_type, is_active) 
      VALUES (
        'transport_hod_approved_to_admin',
        'Transport Request Ready for Processing: {entityId}',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h2 style="margin: 0;">🚗 Transport Request - Processing Required</h2>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">HOD Approved - Ready for Processing</p>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
                <p>Dear Transport Admin,</p>
                
                <p>A transport request has been <strong>approved by the HOD</strong> and is ready for your processing:</p>
                
                <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                    <p><strong>Request ID:</strong> {entityId}</p>
                    <p><strong>Requestor:</strong> {requestorName}</p>
                    <p><strong>Department:</strong> {department}</p>
                    <p><strong>Purpose:</strong> {transportPurpose}</p>
                    <p><strong>Status:</strong> {currentStatus}</p>
                    {approverName && <p><strong>Approved by:</strong> {approverName}</p>}
                    {comments && <p><strong>HOD Comments:</strong> {comments}</p>}
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{approvalUrl}" 
                       style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
                        Process Transport Request
                    </a>
                </div>
                
                <p style="margin-top: 30px; font-size: 14px; color: #6c757d;">
                    Please review the transport details and process this request. You can access the full details by clicking the link above.
                </p>
            </div>
            
            <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
                This is an automated notification from the TMS System.<br>
                Please do not reply to this email.
            </div>
        </div>',
        'email',
        'approver',
        true
      )
      ON CONFLICT (name) DO UPDATE SET
        subject = EXCLUDED.subject,
        body = EXCLUDED.body,
        notification_type = EXCLUDED.notification_type,
        recipient_type = EXCLUDED.recipient_type,
        is_active = EXCLUDED.is_active
    `;
    
    // Ensure permission exists
    await sql`
      INSERT INTO permissions (name, description) 
      VALUES (
        'manage_transport_requests',
        'Can manage and process transport requests'
      )
      ON CONFLICT (name) DO NOTHING
    `;
    
    // Verify template was created
    const template = await sql`
      SELECT name, subject, is_active 
      FROM notification_templates 
      WHERE name = 'transport_hod_approved_to_admin'
    `;
    
    if (template.length > 0) {
      console.log('✅ Template created successfully:');
      console.log(`   📧 Name: ${template[0].name}`);
      console.log(`   📧 Subject: ${template[0].subject}`);
      console.log(`   📧 Active: ${template[0].is_active}`);
    } else {
      console.log('❌ Template creation failed');
    }
    
  } catch (error) {
    console.error('❌ Error creating template:', error);
  } finally {
    process.exit(0);
  }
}

applyTemplate().catch(console.error);