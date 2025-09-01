const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra', 
  user: 'postgres',
  password: '221202'
});

async function checkAccommodationTables() {
  try {
    await client.connect();
    
    // Check accommodation-related tables
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%accommodation%'
      ORDER BY table_name
    `);
    
    console.log('Accommodation-related tables:');
    tables.rows.forEach(row => console.log('- ' + row.table_name));
    
    // Check if trf_accommodation_details table exists
    const accommodationDetailsExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'trf_accommodation_details'
      ) as exists
    `);
    
    console.log('\nTRF Accommodation Details table exists:', accommodationDetailsExists.rows[0].exists);
    
    // Check TSRs with accommodation type
    const accommodationTSRs = await client.query(`
      SELECT COUNT(*) as count, travel_type
      FROM travel_requests 
      WHERE travel_type = 'Accommodation'
      GROUP BY travel_type
    `);
    
    console.log('\nTSRs with Accommodation travel type:', accommodationTSRs.rows[0]?.count || 0);
    
    // Sample accommodation TSRs
    const sampleTSRs = await client.query(`
      SELECT id, requestor_name, status, travel_type, submitted_at
      FROM travel_requests 
      WHERE travel_type = 'Accommodation'
      ORDER BY submitted_at DESC
      LIMIT 5
    `);
    
    console.log('\nSample Accommodation TSRs:');
    sampleTSRs.rows.forEach(row => {
      console.log(`- ${row.id}: ${row.requestor_name} - ${row.status}`);
    });
    
    // Check if there are any TSRs with accommodation details
    if (accommodationDetailsExists.rows[0].exists) {
      const detailsCount = await client.query(`
        SELECT COUNT(*) as count FROM trf_accommodation_details
      `);
      console.log('\nAccommodation details records:', detailsCount.rows[0].count);
      
      // Check table structure
      const columns = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'trf_accommodation_details'
        ORDER BY ordinal_position
      `);
      
      console.log('\nTRF Accommodation Details table structure:');
      columns.rows.forEach(col => {
        console.log(`- ${col.column_name}: ${col.data_type}`);
      });
    }
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkAccommodationTables();