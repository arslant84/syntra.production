/**
 * Test script to verify transport notification variables are working correctly
 */

const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Get a recent transport request to check its purpose
    console.log('\n--- Recent transport requests ---');
    
    const recentTransport = await client.query(`
      SELECT 
        id, 
        requestor_name, 
        purpose, 
        status,
        created_at
      FROM transport_requests 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

    if (recentTransport.rows.length > 0) {
      console.log('Recent transport requests:');
      console.table(recentTransport.rows.map(row => ({
        id: row.id,
        requestor: row.requestor_name,
        purpose: row.purpose || '[NULL/EMPTY]',
        status: row.status,
        created: row.created_at?.toISOString?.().split('T')[0]
      })));
    } else {
      console.log('No transport requests found');
    }

    // Check the transport_submitted_to_focal template specifically
    console.log('\n--- transport_submitted_to_focal template details ---');
    
    const template = await client.query(`
      SELECT 
        name,
        subject,
        body,
        variables_available
      FROM notification_templates 
      WHERE name = 'transport_submitted_to_focal'
    `);

    if (template.rows.length > 0) {
      const t = template.rows[0];
      console.log(`Template: ${t.name}`);
      console.log(`Subject: ${t.subject}`);
      console.log(`Variables available: ${t.variables_available}`);
      
      // Extract all template variables used in body
      const variables = t.body.match(/\{[^}]+\}/g);
      if (variables) {
        console.log(`Variables used in body: ${variables.join(', ')}`);
      }
      
      // Check if it uses {transportPurpose} or {purpose}
      if (t.body.includes('{transportPurpose}')) {
        console.log('✅ Template uses {transportPurpose}');
      } else if (t.body.includes('{purpose}')) {
        console.log('✅ Template uses {purpose}');
      } else {
        console.log('❌ Template does not use purpose variables');
      }
    } else {
      console.log('Template not found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

main().catch(console.error);