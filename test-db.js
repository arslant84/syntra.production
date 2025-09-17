const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
  port: 5432,
});

async function checkTravelRequests() {
  try {
    await client.connect();

    // Check travel_requests table
    const trfCount = await client.query('SELECT COUNT(*) as count FROM travel_requests WHERE travel_type IN ($1, $2, $3, $4)',
      ['Domestic', 'Overseas', 'Home Leave Passage', 'External Parties']);
    console.log('Total TRF records:', trfCount.rows[0].count);

    // Check for TRFs with flight bookings
    const trfWithFlights = await client.query(`
      SELECT tr.id, tr.requestor_name, tr.travel_type, tr.status,
             tfb.id as flight_id, tfb.airline, tfb.flight_number
      FROM travel_requests tr
      LEFT JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
      WHERE tr.travel_type IN ($1, $2, $3, $4)
      AND tfb.id IS NOT NULL
      LIMIT 5
    `, ['Domestic', 'Overseas', 'Home Leave Passage', 'External Parties']);

    console.log('\n--- TRFs with flight bookings ---');
    trfWithFlights.rows.forEach(row => {
      console.log(`TRF: ${row.id}, Requestor: ${row.requestor_name}, Flight: ${row.flight_number || 'N/A'}, Airline: ${row.airline || 'N/A'}`);
    });

    console.log(`\nTotal TRFs with flight bookings: ${trfWithFlights.rows.length}`);

    // Test a specific TRF
    if (trfWithFlights.rows.length > 0) {
      const testTrfId = trfWithFlights.rows[0].id;
      console.log(`\n--- Testing TRF API mapping for ID: ${testTrfId} ---`);

      const testQuery = await client.query(`
        SELECT
          tr.*,
          tfb.id as flight_booking_id,
          tfb.flight_number as flight_flight_number,
          tfb.airline as flight_airline,
          tfb.flight_class as flight_class,
          tfb.departure_location as flight_departure_location,
          tfb.arrival_location as flight_arrival_location,
          tfb.departure_date as flight_departure_date,
          tfb.arrival_date as flight_arrival_date,
          tfb.departure_time as flight_departure_time,
          tfb.arrival_time as flight_arrival_time,
          tfb.booking_reference as flight_booking_reference,
          tfb.status as flight_status,
          tfb.remarks as flight_remarks,
          tfb.created_by as flight_created_by,
          tfb.created_at as flight_created_at
        FROM travel_requests tr
        LEFT JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
        WHERE tr.id = $1 AND tr.travel_type IN ($2, $3, $4, $5)
      `, [testTrfId, 'Domestic', 'Overseas', 'Home Leave Passage', 'External Parties']);

      if (testQuery.rows.length > 0) {
        const result = testQuery.rows[0];
        console.log('✅ API mapping test successful:');
        console.log('- TRF ID:', result.id);
        console.log('- Flight ID:', result.flight_booking_id);
        console.log('- Airline:', result.flight_airline);
        console.log('- Flight Number:', result.flight_flight_number);
        console.log('- Status:', result.flight_status);
      }
    }

  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkTravelRequests().catch(console.error);