const postgres = require('postgres');
require('dotenv').config();

const sql = postgres({
  host: process.env.DATABASE_HOST || 'localhost',
  database: process.env.DATABASE_NAME,
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: false
});

async function checkClaimsTemplateBody() {
  try {
    console.log('🔍 CHECKING CLAIMS TEMPLATE BODY CONTENT');
    console.log('========================================\n');
    
    // 1. Check the template content
    console.log('1️⃣ CLAIMS_SUBMITTED_TO_FOCAL TEMPLATE');
    console.log('=====================================');
    
    const template = await sql`
      SELECT name, recipient_type, subject, body, is_active
      FROM notification_templates 
      WHERE name = 'claims_submitted_to_focal'
    `;
    
    if (template.length === 0) {
      console.log('❌ Template not found!');
      await sql.end();
      return;
    }
    
    const t = template[0];
    console.log(`Name: ${t.name}`);
    console.log(`Recipient: ${t.recipient_type}`);
    console.log(`Active: ${t.is_active}`);
    console.log(`Subject: ${t.subject}`);
    console.log(`\nBody content (first 500 chars):`);
    console.log('─'.repeat(50));
    console.log(t.body ? t.body.substring(0, 500) + '...' : 'EMPTY OR NULL');
    console.log('─'.repeat(50));
    
    if (!t.body || t.body.trim() === '') {
      console.log('❌ ISSUE FOUND: Template body is empty!');
    } else {
      console.log('✅ Template has body content');
    }
    
    // 2. Compare with transport template (working example)
    console.log('\n2️⃣ COMPARISON WITH TRANSPORT TEMPLATE');
    console.log('====================================');
    
    const transportTemplate = await sql`
      SELECT name, body
      FROM notification_templates 
      WHERE name = 'transport_submitted_to_focal'
        AND is_active = true
    `;
    
    if (transportTemplate.length > 0) {
      console.log('Transport template body (first 500 chars):');
      console.log('─'.repeat(50));
      console.log(transportTemplate[0].body.substring(0, 500) + '...');
      console.log('─'.repeat(50));
    }
    
    // 3. Check template variables used
    console.log('\n3️⃣ CHECKING TEMPLATE VARIABLES');
    console.log('==============================');
    
    if (t.body) {
      const variables = t.body.match(/\{[^}]+\}/g);
      if (variables) {
        console.log('Variables found in template:');
        [...new Set(variables)].forEach(variable => {
          console.log(`   • ${variable}`);
        });
      } else {
        console.log('No template variables found');
      }
    }
    
    // 4. Test variable replacement
    console.log('\n4️⃣ TESTING VARIABLE REPLACEMENT');
    console.log('===============================');
    
    if (t.body && t.body.includes('{')) {
      const testVariables = {
        entityId: 'CLM-TEST-123',
        requestorName: 'Test User',
        department: 'Test Department',
        purpose: 'Test Purpose',
        amount: '100.00'
      };
      
      let processedBody = t.body;
      Object.entries(testVariables).forEach(([key, value]) => {
        processedBody = processedBody.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      });
      
      console.log('After variable replacement (first 300 chars):');
      console.log('─'.repeat(50));
      console.log(processedBody.substring(0, 300) + '...');
      console.log('─'.repeat(50));
    }
    
    // 5. Check if template needs to be recreated
    console.log('\n5️⃣ DIAGNOSIS AND SOLUTION');
    console.log('=========================');
    
    if (!t.body || t.body.trim() === '') {
      console.log('❌ PROBLEM: Template body is empty');
      console.log('✅ SOLUTION: Need to update template with proper HTML content');
    } else if (!t.body.includes('{')) {
      console.log('❌ PROBLEM: Template has no variables');
      console.log('✅ SOLUTION: Need to add template variables like {entityId}, {requestorName}');
    } else {
      console.log('✅ Template appears to have content and variables');
      console.log('❌ PROBLEM: May be an issue with variable processing in the notification service');
    }
    
    await sql.end();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkClaimsTemplateBody();