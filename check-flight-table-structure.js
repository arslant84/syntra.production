const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra', 
  user: 'postgres',
  password: '221202'
});

async function checkFlightTableStructure() {
  try {
    await client.connect();
    
    // Check if trf_flight_bookings table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'trf_flight_bookings'
      ) as exists
    `);
    
    console.log('TRF Flight Bookings table exists:', tableExists.rows[0].exists);
    
    if (tableExists.rows[0].exists) {
      // Get table structure
      const columns = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'trf_flight_bookings'
        ORDER BY ordinal_position
      `);
      
      console.log('\nTRF Flight Bookings table structure:');
      columns.rows.forEach(col => {
        console.log(`- ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
      
      // Check if there's any data
      const dataCount = await client.query(`
        SELECT COUNT(*) as count FROM trf_flight_bookings
      `);
      console.log('\nFlight bookings records count:', dataCount.rows[0].count);
      
      // Sample data if exists
      if (parseInt(dataCount.rows[0].count) > 0) {
        const sampleData = await client.query(`
          SELECT * FROM trf_flight_bookings LIMIT 3
        `);
        console.log('\nSample flight booking records:');
        sampleData.rows.forEach((row, index) => {
          console.log(`${index + 1}:`, row);
        });
      }
    } else {
      // Check for any flight-related tables
      const flightTables = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE '%flight%'
        ORDER BY table_name
      `);
      
      console.log('\nFlight-related tables:');
      if (flightTables.rows.length === 0) {
        console.log('No flight-related tables found');
      } else {
        flightTables.rows.forEach(row => console.log('- ' + row.table_name));
      }
    }
    
    // Check sample overseas TSRs
    console.log('\nSample Overseas TSRs:');
    const overseasTSRs = await client.query(`
      SELECT id, requestor_name, status, travel_type, submitted_at
      FROM travel_requests 
      WHERE travel_type IN ('Overseas', 'Home Leave Passage')
      ORDER BY submitted_at DESC
      LIMIT 5
    `);
    
    overseasTSRs.rows.forEach(row => {
      console.log(`- ${row.id}: ${row.requestor_name} - ${row.status} - ${row.travel_type}`);
    });
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkFlightTableStructure();