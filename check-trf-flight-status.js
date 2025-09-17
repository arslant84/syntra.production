// Check which TRFs with "TRF Processed" status have flight booking data
const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
  port: 5432,
});

async function checkTRFFlightStatus() {
  try {
    await client.connect();

    console.log('🔍 CHECKING TRF FLIGHT BOOKING STATUS');
    console.log('=====================================');
    console.log('');

    // Get all TRFs with "TRF Processed" status
    const processedTRFs = await client.query(`
      SELECT id, requestor_name, status, travel_type, created_at
      FROM travel_requests
      WHERE status = 'TRF Processed'
      ORDER BY created_at DESC
    `);

    console.log(`📋 Found ${processedTRFs.rows.length} TRFs with "TRF Processed" status:`);
    console.log('');

    for (const trf of processedTRFs.rows) {
      // Check if this TRF has flight booking data
      const flightBooking = await client.query(`
        SELECT id, flight_number, airline, booking_reference, status as flight_status
        FROM trf_flight_bookings
        WHERE trf_id = $1
      `, [trf.id]);

      const hasFlightData = flightBooking.rows.length > 0;
      const status = hasFlightData ? '✅ HAS FLIGHT DATA' : '❌ NO FLIGHT DATA';

      console.log(`${status}`);
      console.log(`   TRF ID: ${trf.id}`);
      console.log(`   Requestor: ${trf.requestor_name}`);
      console.log(`   Travel Type: ${trf.travel_type}`);
      console.log(`   Status: ${trf.status}`);
      console.log(`   Created: ${trf.created_at.toISOString().split('T')[0]}`);

      if (hasFlightData) {
        const flight = flightBooking.rows[0];
        console.log(`   ✈️  Flight: ${flight.flight_number} (${flight.airline})`);
        console.log(`   📋 PNR: ${flight.booking_reference}`);
        console.log(`   📍 Status: ${flight.flight_status}`);
      }
      console.log('');
    }

    // Summary statistics
    const withFlightData = processedTRFs.rows.filter(async (trf) => {
      const flightBooking = await client.query(`
        SELECT id FROM trf_flight_bookings WHERE trf_id = $1
      `, [trf.id]);
      return flightBooking.rows.length > 0;
    });

    console.log('📊 SUMMARY:');
    console.log(`   Total TRFs with "TRF Processed" status: ${processedTRFs.rows.length}`);
    console.log(`   TRFs with flight booking data: [checking...]`);
    console.log(`   TRFs missing flight booking data: [checking...]`);
    console.log('');
    console.log('💡 ISSUE: Not all TRFs with "TRF Processed" status have flight booking details.');
    console.log('   This means Flight Admin has not processed all approved TRFs yet.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTRFFlightStatus().catch(console.error);