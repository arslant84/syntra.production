// Simulate the API response logic to see if flight details are included

const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
  port: 5432,
});

async function testAPIResponse() {
  try {
    await client.connect();

    const trfId = 'TSR-20250828-1112-TUR-9ANX';

    // Execute the exact same query as the API
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
      WHERE tr.id = $1 AND tr.travel_type IN ($2, $3, $4, $5)
    `, [trfId, 'Domestic', 'Overseas', 'Home Leave Passage', 'External Parties']);

    console.log('🔍 Testing API Response Logic');
    console.log('');

    if (result.rows.length > 0) {
      const mainTrfData = result.rows[0];

      // Simulate the exact flight booking data mapping from the API
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

      console.log('1️⃣ FLIGHT BOOKING DATA CHECK:');
      console.log(`   Has flight_booking_id: ${!!mainTrfData.flight_booking_id}`);
      console.log(`   flightBookingData is: ${flightBookingData ? 'NOT NULL' : 'NULL'}`);
      console.log('');

      if (flightBookingData) {
        console.log('2️⃣ FLIGHT BOOKING DATA CONTENT:');
        console.log(JSON.stringify(flightBookingData, null, 2));
        console.log('');
      }

      // Simulate the TRF data object construction
      let trfData = {
        id: mainTrfData.id,
        requestorName: mainTrfData.requestor_name,
        status: mainTrfData.status,
        travelType: mainTrfData.travel_type,
        // Add flight details if available
        flightDetails: flightBookingData,
      };

      console.log('3️⃣ FINAL TRF DATA OBJECT:');
      console.log(`   TRF ID: ${trfData.id}`);
      console.log(`   Status: ${trfData.status}`);
      console.log(`   Travel Type: ${trfData.travelType}`);
      console.log(`   Has flightDetails: ${!!trfData.flightDetails}`);

      if (trfData.flightDetails) {
        console.log('   ✅ flightDetails is included in API response!');
        console.log(`   Flight Number: ${trfData.flightDetails.flightNumber}`);
        console.log(`   Airline: ${trfData.flightDetails.airline}`);
        console.log(`   PNR: ${trfData.flightDetails.bookingReference}`);
      } else {
        console.log('   ❌ flightDetails is NULL in API response');
      }

      console.log('');
      console.log('4️⃣ FRONTEND COMPONENT CHECK:');
      console.log(`   Component should check: trfData?.flightDetails`);
      console.log(`   Result: ${!!trfData.flightDetails}`);
      console.log(`   Should show flight section: ${!!trfData.flightDetails ? 'YES' : 'NO'}`);

    } else {
      console.log('❌ No TRF data found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

testAPIResponse().catch(console.error);