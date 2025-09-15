const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra', 
  user: 'postgres',
  password: '221202'
});

async function debugTransportUsers() {
  try {
    await client.connect();
    
    console.log('Checking transport requests and their creators...');
    
    // Check all transport requests and their created_by values
    const requests = await client.query(`
      SELECT 
        tr.id,
        tr.requestor_name,
        tr.created_by,
        tr.staff_id,
        tr.status,
        tr.created_at
      FROM transport_requests tr
      ORDER BY tr.created_at DESC
      LIMIT 10
    `);
    
    console.log('\nTransport requests:');
    requests.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.id}`);
      console.log(`   Requestor Name: ${row.requestor_name}`);
      console.log(`   Staff ID: ${row.staff_id}`);
      console.log(`   Created By: ${row.created_by}`);
      console.log(`   Status: ${row.status}`);
      console.log('');
    });
    
    // Check what user Arslan Tekayev has as identifiers
    console.log('Checking user identifiers for Arslan Tekayev...');
    const user = await client.query(`
      SELECT id, email, staff_id, name 
      FROM users 
      WHERE name ILIKE '%arslan%' OR email ILIKE '%tekayev%'
    `);
    
    console.log('\nArslan Tekayev user record:');
    user.rows.forEach(row => {
      console.log(`- ID: ${row.id}`);
      console.log(`- Email: ${row.email}`);
      console.log(`- Staff ID: ${row.staff_id}`);
      console.log(`- Name: ${row.name}`);
    });
    
    // Check which transport requests should match Arslan
    console.log('\nChecking transport requests that should match Arslan...');
    const arslanRequests = await client.query(`
      SELECT 
        tr.id,
        tr.requestor_name,
        tr.created_by,
        tr.staff_id
      FROM transport_requests tr
      WHERE tr.requestor_name ILIKE '%arslan%' 
         OR tr.created_by = '38dc9f14-f6f2-4cdb-bf04-7ae25d44e6ea'
         OR tr.created_by = 'tekayev@outlook.com'
         OR tr.staff_id = '1049681'
    `);
    
    console.log('Arslan transport requests:');
    arslanRequests.rows.forEach(row => {
      console.log(`- ${row.id}: ${row.requestor_name} (created_by: ${row.created_by}, staff_id: ${row.staff_id})`);
    });
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

debugTransportUsers();