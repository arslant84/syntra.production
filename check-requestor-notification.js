#!/usr/bin/env node

require('dotenv').config();
const postgres = require('postgres');

async function checkRequestorNotificationTemplate() {
  const sql = postgres({
    host: process.env.DATABASE_HOST || 'localhost',
    database: process.env.DATABASE_NAME || 'syntra',
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.NODE_ENV === 'production'
  });

  try {
    console.log('🔍 Checking claims requestor notification templates...\n');
    
    // Check templates for requestor notifications when claims are approved
    const templates = await sql`
      SELECT name, subject, recipient_type, description
      FROM notification_templates 
      WHERE name LIKE '%claims%' 
      AND (name LIKE '%requestor%' OR recipient_type = 'requestor' OR name LIKE '%approved%')
      ORDER BY name
    `;
    
    console.log('📧 Claims requestor notification templates:');
    if (templates.length === 0) {
      console.log('   ❌ No specific requestor notification templates found for claims');
    } else {
      templates.forEach(t => console.log(`   📋 ${t.name} (${t.recipient_type}): ${t.subject}`));
    }
    
    // Check the specific template that should notify requestor when HOD approves
    const hodTemplate = await sql`
      SELECT name, subject, recipient_type, body, description
      FROM notification_templates 
      WHERE name = 'claims_hod_approved_to_admin'
    `;
    
    if (hodTemplate.length > 0) {
      console.log('\n🔍 HOD approved template details:');
      console.log(`   Name: ${hodTemplate[0].name}`);
      console.log(`   Subject: ${hodTemplate[0].subject}`);
      console.log(`   Recipient Type: ${hodTemplate[0].recipient_type}`);
      console.log(`   Description: ${hodTemplate[0].description}`);
      
      // Check if this template is designed to CC requestor
      if (hodTemplate[0].recipient_type === 'approver') {
        console.log('   ✅ This template sends to Admin with Requestor as CC');
      } else if (hodTemplate[0].recipient_type === 'requestor') {
        console.log('   ✅ This template sends directly to Requestor');
      } else {
        console.log('   ⚠️ This template may not properly notify requestor');
      }
    }
    
    // Check if there should be a separate requestor template for final approval
    console.log('\n🎯 ISSUE ANALYSIS:');
    console.log('   The issue is that requestor should get a SEPARATE notification');
    console.log('   when their claim is FULLY APPROVED (not just sent to Claims Admin)');
    console.log('   We need a template like "claims_fully_approved_to_requestor"');
    
    // Check if we have admin completion templates
    const completionTemplates = await sql`
      SELECT name, subject, recipient_type
      FROM notification_templates 
      WHERE name LIKE '%claims%admin%completed%requestor%'
      ORDER BY name
    `;
    
    console.log('\n📋 Admin completion templates (when Claims Admin finishes):');
    if (completionTemplates.length > 0) {
      completionTemplates.forEach(t => console.log(`   ✅ ${t.name} (${t.recipient_type}): ${t.subject}`));
    } else {
      console.log('   ❌ No admin completion templates found');
    }
    
    console.log('\n📝 RECOMMENDATION:');
    console.log('   Create a separate notification for requestor when HOD approves');
    console.log('   This should be different from the Claims Admin notification');
    
    await sql.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkRequestorNotificationTemplate();