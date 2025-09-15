const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra', 
  user: 'postgres',
  password: '221202'
});

async function testFlightQuery() {
  try {
    await client.connect();
    
    console.log('Testing flight query...');
    
    // Check TSRs with travel types that require flights
    const flightTypes = await client.query(`
      SELECT travel_type, COUNT(*) as count
      FROM travel_requests 
      WHERE travel_type IN ('Overseas', 'Home Leave Passage')
      GROUP BY travel_type
    `);
    
    console.log('Travel types requiring flights:');
    flightTypes.rows.forEach(row => {
      console.log(`- ${row.travel_type}: ${row.count} requests`);
    });
    
    // Test the updated query that the API now uses
    const result = await client.query(`
      SELECT DISTINCT
        tr.id,
        tr.requestor_name,
        tr.external_full_name,
        tr.travel_type,
        tr.department,
        tr.purpose,
        tr.status,
        tr.submitted_at,
        tfb.id as flight_booking_id,
        tfb.flight_number,
        tfb.departure_location,
        tfb.arrival_location,
        tfb.departure_datetime as departure_date,
        tfb.arrival_datetime as arrival_date,
        tfb.booking_reference,
        tfb.status as flight_status,
        tfb.remarks
      FROM travel_requests tr
      LEFT JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
      LEFT JOIN trf_itinerary_segments tis ON tr.id = tis.trf_id
      WHERE tr.travel_type IN ('Overseas', 'Home Leave Passage') 
         OR tfb.id IS NOT NULL
         OR (tis.flight_number IS NOT NULL AND tis.flight_number <> '')
      ORDER BY tr.submitted_at DESC
      LIMIT 10
    `);
    
    console.log(`\nQuery returned ${result.rows.length} flight requests:`);
    result.rows.forEach(row => {
      console.log(`- ${row.id}: ${row.requestor_name || row.external_full_name} - ${row.status} - ${row.travel_type} - ${row.flight_booking_id ? 'Has flight booking' : 'No flight booking'}`);
    });
    
    // Check all travel types to see what's available
    console.log('\nAll travel types in database:');
    const allTypes = await client.query(`
      SELECT travel_type, COUNT(*) as count
      FROM travel_requests 
      GROUP BY travel_type
      ORDER BY count DESC
    `);
    
    allTypes.rows.forEach(row => {
      console.log(`- ${row.travel_type}: ${row.count} requests`);
    });
    
    // Check if trf_flight_bookings table exists
    const flightBookingsExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'trf_flight_bookings'
      ) as exists
    `);
    
    console.log('\nTRF Flight Bookings table exists:', flightBookingsExists.rows[0].exists);
    
  } catch (error) {
    console.error('Query error:', error.message);
  } finally {
    await client.end();
  }
}

testFlightQuery();