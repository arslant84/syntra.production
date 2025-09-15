/**
 * Script to check transport request TRN-20250828-1112-LOCAL-2WXL
 * and investigate missing transport admin notification
 */

const { sql } = require('../src/lib/db');

async function checkTransportRequest() {
  try {
    console.log('🔍 Checking transport request TRN-20250828-1112-LOCAL-2WXL...\n');
    
    const transport = await sql`
      SELECT 
        tr.id,
        tr.requestor_name,
        tr.department,
        tr.purpose,
        tr.status,
        tr.created_at,
        tr.updated_at,
        tr.created_by,
        u.email as created_by_email,
        u.name as created_by_name
      FROM transport_requests tr
      LEFT JOIN users u ON tr.created_by = u.id
      WHERE tr.id = 'TRN-20250828-1112-LOCAL-2WXL'
    `;
    
    if (transport.length === 0) {
      console.log('❌ Transport request not found');
      return;
    }
    
    const req = transport[0];
    console.log('📋 TRANSPORT REQUEST DETAILS:');
    console.log(`   🆔 ID: ${req.id}`);
    console.log(`   👤 Requestor: ${req.requestor_name}`);
    console.log(`   🏢 Department: ${req.department}`);
    console.log(`   📝 Purpose: ${req.purpose}`);
    console.log(`   📊 Status: ${req.status}`);
    console.log(`   📅 Created: ${req.created_at}`);
    console.log(`   📅 Updated: ${req.updated_at}`);
    console.log(`   👤 Created by: ${req.created_by_name} (${req.created_by_email})`);
    console.log('');
    
    // Check approval steps
    const approvalSteps = await sql`
      SELECT 
        role,
        name,
        status,
        date,
        comments,
        created_at
      FROM transport_approval_steps
      WHERE transport_request_id = 'TRN-20250828-1112-LOCAL-2WXL'
      ORDER BY created_at
    `;
    
    console.log('📋 APPROVAL WORKFLOW HISTORY:');
    if (approvalSteps.length > 0) {
      approvalSteps.forEach((step, index) => {
        console.log(`   ${index + 1}. ${step.role} (${step.name})`);
        console.log(`      Status: ${step.status}`);
        console.log(`      Date: ${step.date || step.created_at}`);
        console.log(`      Comments: ${step.comments || 'None'}`);
        console.log('');
      });
    } else {
      console.log('   ❌ No approval steps found');
    }
    
    // Check what should happen after HOD approval
    console.log('🔍 EXPECTED WORKFLOW AFTER HOD APPROVAL:');
    if (req.status === 'Approved') {
      console.log('   📊 Current Status: Approved');
      console.log('   ❓ Expected: Should be "Processing with Transport Admin" or similar');
      console.log('   🎯 Issue: Transport Admin should be notified when HOD approves');
    } else {
      console.log(`   📊 Current Status: ${req.status}`);
    }
    console.log('');
    
    // Check transport admin users
    console.log('👥 TRANSPORT ADMIN USERS:');
    const transportAdmins = await sql`
      SELECT DISTINCT 
        u.id, u.name, u.email, u.role, u.department
      FROM users u
      INNER JOIN role_permissions rp ON u.role_id = rp.role_id  
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE p.name = 'manage_transport_requests'
        AND u.status = 'Active'
    `;
    
    if (transportAdmins.length > 0) {
      transportAdmins.forEach((admin, index) => {
        console.log(`   ${index + 1}. ${admin.name} (${admin.role})`);
        console.log(`      Email: ${admin.email}`);
        console.log(`      Department: ${admin.department}`);
        console.log('');
      });
    } else {
      console.log('   ❌ No transport admins found with manage_transport_requests permission');
    }
    
    // Check notification templates for transport
    console.log('📧 TRANSPORT NOTIFICATION TEMPLATES:');
    const templates = await sql`
      SELECT name, recipient_type, notification_type, is_active
      FROM notification_templates 
      WHERE name LIKE '%transport%'
      ORDER BY name
    `;
    
    if (templates.length > 0) {
      templates.forEach((template, index) => {
        console.log(`   ${index + 1}. ${template.name}`);
        console.log(`      Recipient Type: ${template.recipient_type}`);
        console.log(`      Notification Type: ${template.notification_type}`);
        console.log(`      Active: ${template.is_active}`);
        console.log('');
      });
    } else {
      console.log('   ❌ No transport notification templates found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkTransportRequest().catch(console.error);