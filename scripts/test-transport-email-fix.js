/**
 * Test script to verify transport request email CC fix
 * This script simulates a transport approval to test email notifications
 */

const { sql } = require('../src/lib/db');

async function testTransportEmailFix() {
  console.log('🧪 Testing Transport Request Email CC Fix...\n');

  try {
    // 1. Get a sample transport request
    const transportRequests = await sql`
      SELECT 
        tr.id,
        tr.requestor_name,
        tr.staff_id,
        tr.email as direct_email,
        tr.department,
        tr.status,
        u.email as created_by_email,
        u.name as created_by_name
      FROM transport_requests tr
      LEFT JOIN users u ON tr.created_by = u.id
      WHERE tr.status LIKE 'Pending%'
      LIMIT 5
    `;

    if (transportRequests.length === 0) {
      console.log('❌ No pending transport requests found for testing');
      return;
    }

    console.log(`📋 Found ${transportRequests.length} pending transport requests:\n`);

    transportRequests.forEach((req, index) => {
      console.log(`${index + 1}. Transport ID: ${req.id}`);
      console.log(`   👤 Requestor: ${req.requestor_name}`);
      console.log(`   🆔 Staff ID: ${req.staff_id}`);
      console.log(`   📧 Direct Email: ${req.direct_email || '[NONE]'}`);
      console.log(`   📧 Created-by Email: ${req.created_by_email || '[NONE]'}`);
      console.log(`   🏢 Department: ${req.department}`);
      console.log(`   📊 Status: ${req.status}`);
      console.log('');
    });

    // 2. Test the enhanced query
    console.log('🔍 Testing enhanced requestor email resolution...\n');

    for (const transport of transportRequests.slice(0, 2)) {
      console.log(`Testing Transport: ${transport.id}`);
      
      const enhancedResult = await sql`
        SELECT 
          tr.created_by, 
          tr.requestor_name, 
          tr.department, 
          tr.purpose,
          tr.staff_id,
          tr.email as direct_email,
          u.email as created_by_email,
          u2.email as staff_match_email,
          u3.email as name_match_email,
          COALESCE(tr.email, u.email, u2.email, u3.email) as email,
          COALESCE(tr.created_by, u.id, u2.id, u3.id) as user_id
        FROM transport_requests tr
        LEFT JOIN users u ON tr.created_by = u.id
        LEFT JOIN users u2 ON tr.staff_id IS NOT NULL AND tr.staff_id = u2.staff_id
        LEFT JOIN users u3 ON tr.requestor_name IS NOT NULL AND LOWER(tr.requestor_name) = LOWER(u3.name)
        WHERE tr.id = ${transport.id}
      `;

      if (enhancedResult.length > 0) {
        const result = enhancedResult[0];
        console.log(`   📧 Direct email: ${result.direct_email || '[NONE]'}`);
        console.log(`   📧 Created-by email: ${result.created_by_email || '[NONE]'}`);
        console.log(`   📧 Staff match email: ${result.staff_match_email || '[NONE]'}`);
        console.log(`   📧 Name match email: ${result.name_match_email || '[NONE]'}`);
        console.log(`   📧 Final resolved email: ${result.email || '[NONE]'}`);
        
        if (result.email) {
          console.log(`   ✅ Email resolution SUCCESS: ${result.email}`);
        } else {
          console.log(`   ❌ Email resolution FAILED: No email found`);
        }
      }
      console.log('');
    }

    // 3. Check notification templates
    console.log('📋 Checking transport notification templates...\n');

    const templates = await sql`
      SELECT name, recipient_type, notification_type, is_active
      FROM notification_templates 
      WHERE name LIKE '%transport%'
      ORDER BY name
    `;

    if (templates.length > 0) {
      templates.forEach(template => {
        console.log(`   📧 ${template.name}`);
        console.log(`      Recipients: ${template.recipient_type}`);
        console.log(`      Type: ${template.notification_type}`);
        console.log(`      Active: ${template.is_active}`);
        console.log('');
      });
    } else {
      console.log('   ❌ No transport notification templates found!');
    }

    // 4. Test summary
    console.log('📋 TEST SUMMARY:');
    console.log('1. Enhanced query now checks multiple email sources');
    console.log('2. COALESCE prioritizes: direct email > created_by email > staff match > name match');
    console.log('3. Added debugging logs to track email resolution and CC logic');
    console.log('4. Next: Test actual workflow notification by approving a transport request');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testTransportEmailFix().catch(console.error);