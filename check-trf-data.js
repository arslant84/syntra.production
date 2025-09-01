const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra', 
  user: 'postgres',
  password: '221202'
});

async function checkTrfs() {
  try {
    await client.connect();
    
    // Check if travel_requests table exists and has data
    const count = await client.query('SELECT COUNT(*) as total FROM travel_requests');
    console.log('Total travel requests in database:', count.rows[0].total);
    
    // Check what travel types exist
    const travelTypes = await client.query(`
      SELECT travel_type, COUNT(*) as count 
      FROM travel_requests 
      GROUP BY travel_type 
      ORDER BY count DESC
    `);
    
    console.log('\nTravel types in database:');
    travelTypes.rows.forEach(row => {
      console.log(`- ${row.travel_type || 'NULL'}: ${row.count} requests`);
    });
    
    // Check overseas/home leave passage specifically
    const flightRequiredTypes = await client.query(`
      SELECT COUNT(*) as count
      FROM travel_requests 
      WHERE travel_type IN ('Overseas', 'Home Leave Passage')
    `);
    
    console.log(`\nTSRs requiring flights: ${flightRequiredTypes.rows[0].count}`);
    
    // Sample some data
    const sample = await client.query(`
      SELECT id, travel_type, status, purpose, requestor_name
      FROM travel_requests 
      ORDER BY submitted_at DESC 
      LIMIT 5
    `);
    
    console.log('\nSample TSRs:');
    sample.rows.forEach(row => {
      console.log(`- ${row.id}: ${row.travel_type} - ${row.status} - ${row.requestor_name}`);
    });
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkTrfs();