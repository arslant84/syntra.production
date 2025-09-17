// Final test to understand why flight details are not showing in TRF view
// This script simulates what the frontend should receive from the API

const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
  port: 5432,
});

async function testFinalAPI() {
  try {
    await client.connect();

    const trfId = 'TSR-20250828-1112-TUR-9ANX';

    console.log('🔧 FINAL TEST: Checking complete API flow...');
    console.log('');

    // Simulate exact API query
    const result = await client.query(`
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
      WHERE tr.id = $1 AND tr.travel_type IN ('Domestic', 'Overseas', 'Home Leave Passage', 'External Parties')
    `, [trfId]);

    console.log('1️⃣ DATABASE QUERY RESULT:');
    console.log(`   Query returned ${result.rows.length} rows`);

    if (result.rows.length > 0) {
      const mainTrfData = result.rows[0];

      console.log('');
      console.log('2️⃣ MAIN TRF DATA CHECK:');
      console.log(`   TRF ID: ${mainTrfData.id}`);
      console.log(`   Status: ${mainTrfData.status}`);
      console.log(`   Travel Type: ${mainTrfData.travel_type}`);
      console.log('');

      console.log('3️⃣ FLIGHT BOOKING ID CHECK:');
      console.log(`   flight_booking_id exists: ${!!mainTrfData.flight_booking_id}`);
      console.log(`   flight_booking_id value: ${mainTrfData.flight_booking_id || 'NULL'}`);
      console.log('');

      // Simulate API logic
      let flightBookingData = null;
      if (mainTrfData && mainTrfData.flight_booking_id) {
        flightBookingData = {
          id: mainTrfData.flight_booking_id,
          flightNumber: mainTrfData.flight_flight_number,
          airline: mainTrfData.flight_airline,
          bookingReference: mainTrfData.flight_booking_reference,
          departureLocation: mainTrfData.flight_departure_location,
          arrivalLocation: mainTrfData.flight_arrival_location,
          departureDate: mainTrfData.flight_departure_date,
          arrivalDate: mainTrfData.flight_arrival_date,
          departureTime: mainTrfData.flight_departure_time,
          arrivalTime: mainTrfData.flight_arrival_time,
          status: mainTrfData.flight_status,
          remarks: mainTrfData.flight_remarks,
          processedBy: mainTrfData.flight_created_by,
          processedDate: mainTrfData.flight_created_at
        };
      }

      console.log('4️⃣ FLIGHT BOOKING DATA MAPPING:');
      console.log(`   flightBookingData is NULL: ${flightBookingData === null}`);
      console.log(`   flightBookingData is NOT NULL: ${flightBookingData !== null}`);
      console.log('');

      if (flightBookingData) {
        console.log('5️⃣ FLIGHT BOOKING DATA CONTENT:');
        console.log('   Flight Number:', flightBookingData.flightNumber);
        console.log('   Airline:', flightBookingData.airline);
        console.log('   Booking Reference:', flightBookingData.bookingReference);
        console.log('   Status:', flightBookingData.status);
        console.log('');
      }

      // Simulate final TRF data object
      const trfData = {
        id: mainTrfData.id,
        requestorName: mainTrfData.requestor_name,
        status: mainTrfData.status,
        travelType: mainTrfData.travel_type,
        flightDetails: flightBookingData,
      };

      console.log('6️⃣ FINAL TRF DATA OBJECT:');
      console.log(`   TRF ID: ${trfData.id}`);
      console.log(`   Status: ${trfData.status}`);
      console.log(`   Travel Type: ${trfData.travelType}`);
      console.log(`   Has flightDetails: ${!!trfData.flightDetails}`);
      console.log(`   flightDetails value: ${trfData.flightDetails ? 'NOT NULL' : 'NULL'}`);
      console.log('');

      console.log('7️⃣ FRONTEND COMPONENT CHECK:');
      console.log(`   Component checks: trfData?.flightDetails`);
      console.log(`   Result: ${!!trfData.flightDetails}`);
      console.log(`   Should show flight section: ${!!trfData.flightDetails ? 'YES ✅' : 'NO ❌'}`);
      console.log('');

      if (trfData.flightDetails) {
        console.log('8️⃣ SUCCESS - FLIGHT DETAILS SHOULD DISPLAY!');
        console.log('   Flight section should be visible in the TRF view.');
        console.log('   The problem must be elsewhere (server not updated, frontend issue, etc.)');
      } else {
        console.log('8️⃣ PROBLEM - FLIGHT DETAILS ARE NULL!');
        console.log('   This explains why the flight section is not showing.');
        console.log('   Need to investigate why flight_booking_id is NULL in the query result.');
      }

    } else {
      console.log('❌ No TRF data found with the given ID and travel type constraints');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

testFinalAPI().catch(console.error);