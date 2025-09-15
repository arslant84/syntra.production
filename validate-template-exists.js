/**
 * Script to validate if transport admin notification template exists
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
  console.log('📝 Please run this PostgreSQL query to check if template exists:');
  console.log('');
  console.log(`-- Check if transport admin template exists`);
  console.log(`SELECT name, subject, is_active, created_at`);
  console.log(`FROM notification_templates`); 
  console.log(`WHERE name = 'transport_hod_approved_to_admin';`);
  console.log('');
  console.log(`-- Check all transport-related templates`);
  console.log(`SELECT name, recipient_type, is_active`);
  console.log(`FROM notification_templates`);
  console.log(`WHERE name LIKE '%transport%'`);
  console.log(`ORDER BY name;`);
  console.log('');
  process.exit(1);
}

async function validateTemplate() {
  try {
    console.log('🔍 Checking if transport admin notification template exists...\n');
    
    const { sql } = require(dbPath);
    
    // Check if specific template exists
    const specificTemplate = await sql`
      SELECT name, subject, is_active, created_at
      FROM notification_templates 
      WHERE name = 'transport_hod_approved_to_admin'
    `;
    
    console.log('📋 SPECIFIC TEMPLATE CHECK:');
    if (specificTemplate.length > 0) {
      const template = specificTemplate[0];
      console.log('✅ Template EXISTS:');
      console.log(`   📧 Name: ${template.name}`);
      console.log(`   📧 Subject: ${template.subject}`);
      console.log(`   📧 Active: ${template.is_active}`);
      console.log(`   📅 Created: ${template.created_at}`);
      console.log('');
      console.log('🎯 RESULT: Template already exists - no need to create');
    } else {
      console.log('❌ Template DOES NOT EXIST');
      console.log('   📧 Name: transport_hod_approved_to_admin');
      console.log('');
      console.log('🎯 RESULT: Template needs to be created');
    }
    console.log('');
    
    // Check all transport templates
    const allTransportTemplates = await sql`
      SELECT name, recipient_type, is_active
      FROM notification_templates
      WHERE name LIKE '%transport%'
      ORDER BY name
    `;
    
    console.log('📋 ALL TRANSPORT TEMPLATES:');
    if (allTransportTemplates.length > 0) {
      allTransportTemplates.forEach((template, index) => {
        const status = template.is_active ? '✅' : '❌';
        console.log(`   ${index + 1}. ${status} ${template.name}`);
        console.log(`      Recipient: ${template.recipient_type}`);
        console.log('');
      });
    } else {
      console.log('   ❌ No transport templates found');
    }
    
    // Check permission
    const permission = await sql`
      SELECT name, description
      FROM permissions
      WHERE name = 'manage_transport_requests'
    `;
    
    console.log('🔐 PERMISSION CHECK:');
    if (permission.length > 0) {
      console.log('✅ Permission EXISTS:');
      console.log(`   🔑 Name: ${permission[0].name}`);
      console.log(`   📝 Description: ${permission[0].description}`);
    } else {
      console.log('❌ Permission DOES NOT EXIST:');
      console.log('   🔑 Name: manage_transport_requests');
    }
    
  } catch (error) {
    console.error('❌ Error validating template:', error);
  } finally {
    process.exit(0);
  }
}

validateTemplate().catch(console.error);