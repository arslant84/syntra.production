// Debug the remaining issues with flight processing
const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
  port: 5432,
});

async function debugIssues() {
  try {
    await client.connect();

    console.log('🔍 DEBUGGING REMAINING ISSUES');
    console.log('=============================');
    console.log('');

    // Issue 1: Check what exactly the API returns for time values
    console.log('1️⃣ CHECKING TIME VALUES IN API RESPONSE:');

    const timeDebugQuery = await client.query(`
      SELECT
        tr.id,
        tr.status,
        tfb.departure_time,
        tfb.arrival_time,
        tfb.departure_time::text as departure_text,
        tfb.arrival_time::text as arrival_text
      FROM travel_requests tr
      LEFT JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
      WHERE tr.id = 'TSR-20250828-1112-TUR-9ANX'
    `);

    if (timeDebugQuery.rows.length > 0) {
      const data = timeDebugQuery.rows[0];
      console.log('   📋 TRF:', data.id);
      console.log('   📋 Status:', data.status);
      console.log('   📋 departure_time (raw):', data.departure_time);
      console.log('   📋 arrival_time (raw):', data.arrival_time);
      console.log('   📋 departure_time (text):', data.departure_text);
      console.log('   📋 arrival_time (text):', data.arrival_text);

      // Test the regex patterns
      console.log('');
      console.log('   🔍 REGEX TESTING:');
      const oldPattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
      const newPattern = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

      console.log('   Old pattern matches departure:', oldPattern.test(data.departure_text));
      console.log('   New pattern matches departure:', newPattern.test(data.departure_text));
      console.log('   Old pattern matches arrival:', oldPattern.test(data.arrival_text));
      console.log('   New pattern matches arrival:', newPattern.test(data.arrival_text));
    }

    console.log('');

    // Issue 2: Check what TRFs should appear in Flight Processing Dashboard
    console.log('2️⃣ CHECKING FLIGHT PROCESSING DASHBOARD:');
    console.log('   All TRFs with TRF Processed status:');

    const processedTRFs = await client.query(`
      SELECT
        tr.id,
        tr.requestor_name,
        tr.travel_type,
        tr.status,
        tr.submitted_at,
        tfb.id as has_flight_booking,
        tfb.flight_number,
        tfb.booking_reference
      FROM travel_requests tr
      LEFT JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
      WHERE tr.status = 'TRF Processed'
      ORDER BY tr.submitted_at DESC
    `);

    console.log(`   📊 Found ${processedTRFs.rows.length} TRFs with 'TRF Processed' status:`);
    console.log('');

    processedTRFs.rows.forEach((trf, index) => {
      const hasFlightData = !!trf.has_flight_booking;
      const status = hasFlightData ? '✅ HAS FLIGHT' : '❌ NEEDS FLIGHT';
      console.log(`   ${index + 1}. ${status}`);
      console.log(`      ID: ${trf.id}`);
      console.log(`      Requestor: ${trf.requestor_name}`);
      console.log(`      Travel Type: ${trf.travel_type}`);
      console.log(`      Status: ${trf.status}`);
      if (hasFlightData) {
        console.log(`      Flight: ${trf.flight_number} (${trf.booking_reference})`);
      }
      console.log('');
    });

    // Issue 3: Test the exact API query used by Flight Admin
    console.log('3️⃣ TESTING FLIGHT ADMIN API QUERY:');
    console.log('   Query that should include ALL TRF Processed:');

    const flightAdminQuery = await client.query(`
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
      WHERE (tr.travel_type IN ('Overseas', 'Home Leave Passage')
         OR tfb.id IS NOT NULL
         OR (tis.flight_number IS NOT NULL AND tis.flight_number <> '')
         OR tr.status = 'TRF Processed')
      ORDER BY tr.submitted_at DESC
      LIMIT 20
    `);

    console.log(`   📊 Flight Admin API should return ${flightAdminQuery.rows.length} TRFs`);

    const trfProcessedInQuery = flightAdminQuery.rows.filter(row => row.status === 'TRF Processed');
    console.log(`   📊 TRF Processed count in result: ${trfProcessedInQuery.length}`);

    console.log('');
    console.log('   📋 First 5 TRFs in Flight Admin result:');
    flightAdminQuery.rows.slice(0, 5).forEach((trf, index) => {
      console.log(`   ${index + 1}. ${trf.id} - ${trf.status} (${trf.travel_type})`);
    });

    console.log('');
    console.log('📊 SUMMARY:');
    console.log(`   Total TRFs with TRF Processed: ${processedTRFs.rows.length}`);
    console.log(`   Flight Admin API should show: ${flightAdminQuery.rows.length}`);
    console.log(`   TRFs needing flight booking: ${processedTRFs.rows.filter(t => !t.has_flight_booking).length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

debugIssues().catch(console.error);