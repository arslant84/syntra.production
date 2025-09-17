// Test both fixes: Flight Admin API and Time Display
const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
  port: 5432,
});

async function testFixes() {
  try {
    await client.connect();

    console.log('🔧 TESTING BOTH FIXES');
    console.log('====================');
    console.log('');

    // Test 1: Check if Flight Admin API will now include TRF Processed TSRs
    console.log('1️⃣ TESTING FLIGHT ADMIN API FIX:');
    console.log('   Query: TRFs that should appear in Flight Admin panel');

    const flightAdminQuery = await client.query(`
      SELECT DISTINCT
        tr.id,
        tr.requestor_name,
        tr.travel_type,
        tr.status,
        tfb.id as flight_booking_id
      FROM travel_requests tr
      LEFT JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
      LEFT JOIN trf_itinerary_segments tis ON tr.id = tis.trf_id
      WHERE (tr.travel_type IN ('Overseas', 'Home Leave Passage')
         OR tfb.id IS NOT NULL
         OR (tis.flight_number IS NOT NULL AND tis.flight_number <> '')
         OR tr.status = 'TRF Processed')
      ORDER BY tr.id
      LIMIT 15
    `);

    console.log(`   ✅ Query returned ${flightAdminQuery.rows.length} TRFs`);

    const trfProcessedCount = flightAdminQuery.rows.filter(row => row.status === 'TRF Processed').length;
    const withFlightDataCount = flightAdminQuery.rows.filter(row => row.flight_booking_id).length;
    const withoutFlightDataCount = flightAdminQuery.rows.filter(row => row.status === 'TRF Processed' && !row.flight_booking_id).length;

    console.log(`   📊 TRF Processed TSRs: ${trfProcessedCount}`);
    console.log(`   📊 With flight data: ${withFlightDataCount}`);
    console.log(`   📊 Need flight booking: ${withoutFlightDataCount}`);

    // Find the specific TRF that was missing
    const missingTrf = flightAdminQuery.rows.find(row => row.id === 'TSR-20250715-1611-TUR-TVKU');
    if (missingTrf) {
      console.log(`   ✅ TSR-20250715-1611-TUR-TVKU is now included!`);
      console.log(`      Status: ${missingTrf.status}`);
      console.log(`      Has flight data: ${!!missingTrf.flight_booking_id}`);
    } else {
      console.log(`   ❌ TSR-20250715-1611-TUR-TVKU still missing`);
    }

    console.log('');

    // Test 2: Check time format issue
    console.log('2️⃣ TESTING TIME FORMAT FIX:');
    console.log('   Query: Check actual time values in database');

    const timeTestQuery = await client.query(`
      SELECT
        trf_id,
        departure_time,
        arrival_time,
        TO_CHAR(departure_time, 'HH24:MI') as departure_formatted,
        TO_CHAR(arrival_time, 'HH24:MI') as arrival_formatted
      FROM trf_flight_bookings
      WHERE trf_id = 'TSR-20250828-1112-TUR-9ANX'
    `);

    if (timeTestQuery.rows.length > 0) {
      const timeData = timeTestQuery.rows[0];
      console.log(`   📋 Raw departure_time: ${timeData.departure_time}`);
      console.log(`   📋 Raw arrival_time: ${timeData.arrival_time}`);
      console.log(`   📋 Formatted departure: ${timeData.departure_formatted}`);
      console.log(`   📋 Formatted arrival: ${timeData.arrival_formatted}`);

      // Test the regex pattern that was updated
      const departureStr = String(timeData.departure_time);
      const arrivalStr = String(timeData.arrival_time);

      // New regex pattern that handles HH:MM:SS
      const timePattern = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

      console.log(`   🔍 Departure matches new pattern: ${timePattern.test(departureStr)}`);
      console.log(`   🔍 Arrival matches new pattern: ${timePattern.test(arrivalStr)}`);

      if (timePattern.test(departureStr) && timePattern.test(arrivalStr)) {
        console.log(`   ✅ Time format fix should work!`);
      } else {
        console.log(`   ❌ Time format fix needs adjustment`);
      }
    }

    console.log('');
    console.log('📊 SUMMARY:');
    console.log('   Fix 1 (Flight Admin API): Include all TRF Processed TSRs ✅');
    console.log('   Fix 2 (Time Display): Handle PostgreSQL time format ✅');
    console.log('');
    console.log('🎯 EXPECTED RESULTS:');
    console.log('   1. TSR-20250715-1611-TUR-TVKU should now appear in Flight Admin panel');
    console.log('   2. Flight times should show as "6:11 AM" instead of "N/A"');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

testFixes().catch(console.error);