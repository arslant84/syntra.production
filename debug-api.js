const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
  port: 5432,
});

async function debugAPI() {
  try {
    await client.connect();

    // Test the exact query that the API is using
    const trfId = 'TSR-20250828-1112-TUR-9ANX';

    console.log(`🔍 Debugging API response for TRF: ${trfId}`);
    console.log('');

    // First, check if the TRF has flight bookings
    const flightCheck = await client.query(`
      SELECT tr.id, tr.requestor_name, tr.status,
             tfb.id as flight_id, tfb.airline, tfb.flight_number, tfb.booking_reference
      FROM travel_requests tr
      LEFT JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
      WHERE tr.id = $1
    `, [trfId]);

    console.log('1️⃣ FLIGHT BOOKING CHECK:');
    if (flightCheck.rows.length > 0) {
      const row = flightCheck.rows[0];
      console.log(`   TRF ID: ${row.id}`);
      console.log(`   Requestor: ${row.requestor_name}`);
      console.log(`   Status: ${row.status}`);
      console.log(`   Flight ID: ${row.flight_id || 'NO FLIGHT BOOKING'}`);
      console.log(`   Flight Number: ${row.flight_number || 'N/A'}`);
      console.log(`   Airline: ${row.airline || 'N/A'}`);
      console.log(`   PNR: ${row.booking_reference || 'N/A'}`);
    }
    console.log('');

    // Now test the exact API query structure
    console.log('2️⃣ TESTING API QUERY:');
    const apiQuery = await client.query(`
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
    `, [trfId, 'Domestic', 'Overseas', 'Home Leave Passage', 'External Parties']);

    if (apiQuery.rows.length > 0) {
      const result = apiQuery.rows[0];
      console.log('   ✅ API Query successful');
      console.log(`   Main TRF ID: ${result.id}`);
      console.log(`   Travel Type: ${result.travel_type}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Flight Booking ID: ${result.flight_booking_id || 'NULL'}`);
      console.log(`   Flight Airline: ${result.flight_airline || 'NULL'}`);
      console.log(`   Flight Number: ${result.flight_flight_number || 'NULL'}`);
      console.log(`   Booking Reference: ${result.flight_booking_reference || 'NULL'}`);

      // Check if flight details would be mapped
      if (result.flight_booking_id) {
        console.log('');
        console.log('3️⃣ FLIGHT DETAILS MAPPING:');
        const flightData = {
          id: result.flight_booking_id,
          flightNumber: result.flight_flight_number,
          airline: result.flight_airline,
          bookingReference: result.flight_booking_reference,
          departureLocation: result.flight_departure_location,
          arrivalLocation: result.flight_arrival_location,
          departureDate: result.flight_departure_date,
          arrivalDate: result.flight_arrival_date,
          departureTime: result.flight_departure_time,
          arrivalTime: result.flight_arrival_time,
          status: result.flight_status,
          remarks: result.flight_remarks,
          processedBy: result.flight_created_by,
          processedDate: result.flight_created_at
        };
        console.log('   Flight Details Object:', JSON.stringify(flightData, null, 2));
      } else {
        console.log('');
        console.log('❌ NO FLIGHT BOOKING ID - Flight details would be NULL');
      }
    } else {
      console.log('   ❌ API Query returned no results');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

debugAPI().catch(console.error);