// Flight Details Sample
// Show detailed flight information for better understanding
const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
  port: 5432,
});

async function showFlightDetailsSample() {
  try {
    await client.connect();
    console.log('📋 FLIGHT DETAILS SAMPLE');
    console.log('========================');
    console.log('');

    // Show sample TSRs with actual flight bookings
    console.log('1️⃣ SAMPLE TSRs WITH ACTUAL FLIGHT BOOKINGS:');
    console.log('-------------------------------------------');

    const flightBookingsQuery = await client.query(`
      SELECT
        tr.id,
        tr.status,
        tr.travel_type,
        tr.requestor_name,
        tfb.id as booking_id,
        tfb.flight_number,
        tfb.airline,
        tfb.departure_location,
        tfb.arrival_location,
        tfb.departure_date,
        tfb.departure_time,
        tfb.booking_reference,
        tfb.status as flight_status
      FROM travel_requests tr
      INNER JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
      WHERE tr.travel_type IN ('Domestic', 'Overseas', 'Home Leave Passage', 'External Parties')
      ORDER BY tr.submitted_at DESC
      LIMIT 5
    `);

    flightBookingsQuery.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. TSR: ${row.id} (${row.status})`);
      console.log(`      Requestor: ${row.requestor_name}`);
      console.log(`      Travel Type: ${row.travel_type}`);
      console.log(`      Flight Booking ID: ${row.booking_id}`);
      console.log(`      Flight Number: ${row.flight_number || 'N/A'}`);
      console.log(`      Airline: ${row.airline || 'N/A'}`);
      console.log(`      Route: ${row.departure_location || 'N/A'} → ${row.arrival_location || 'N/A'}`);
      console.log(`      Date: ${row.departure_date || 'N/A'} at ${row.departure_time || 'N/A'}`);
      console.log(`      PNR: ${row.booking_reference || 'N/A'}`);
      console.log(`      Flight Status: ${row.flight_status || 'N/A'}`);
      console.log('');
    });

    // Show sample TSRs with itinerary flights only
    console.log('2️⃣ SAMPLE TSRs WITH ITINERARY FLIGHTS ONLY:');
    console.log('------------------------------------------');

    const itineraryOnlyQuery = await client.query(`
      SELECT
        tr.id,
        tr.status,
        tr.travel_type,
        tr.requestor_name,
        tis.id as segment_id,
        tis.flight_number,
        tis.from_location as departure_location,
        tis.to_location as arrival_location,
        tis.segment_date,
        tis.departure_time,
        tis.arrival_time,
        tis.flight_class,
        tis.remarks
      FROM travel_requests tr
      INNER JOIN trf_itinerary_segments tis ON tr.id = tis.trf_id
      LEFT JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
      WHERE tr.travel_type IN ('Domestic', 'Overseas', 'Home Leave Passage', 'External Parties')
        AND tis.flight_number IS NOT NULL
        AND tis.flight_number <> ''
        AND tfb.id IS NULL  -- Only those WITHOUT flight bookings
      ORDER BY tr.submitted_at DESC
      LIMIT 5
    `);

    if (itineraryOnlyQuery.rows.length > 0) {
      itineraryOnlyQuery.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. TSR: ${row.id} (${row.status})`);
        console.log(`      Requestor: ${row.requestor_name}`);
        console.log(`      Travel Type: ${row.travel_type}`);
        console.log(`      Itinerary Segment ID: ${row.segment_id}`);
        console.log(`      Flight Number: ${row.flight_number}`);
        console.log(`      Route: ${row.departure_location || 'N/A'} → ${row.arrival_location || 'N/A'}`);
        console.log(`      Date: ${row.segment_date || 'N/A'}`);
        console.log(`      Times: ${row.departure_time || 'N/A'} → ${row.arrival_time || 'N/A'}`);
        console.log(`      Class: ${row.flight_class || 'N/A'}`);
        console.log(`      Remarks: ${row.remarks || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('   ℹ️  All TSRs with itinerary flights also have flight bookings');
    }

    // Show TSRs with both for comparison
    console.log('3️⃣ SAMPLE TSRs WITH BOTH BOOKINGS AND ITINERARY:');
    console.log('-----------------------------------------------');

    const bothQuery = await client.query(`
      SELECT
        tr.id,
        tr.status,
        tr.travel_type,
        tr.requestor_name,
        tr.submitted_at,
        tfb.flight_number as booked_flight,
        tfb.airline,
        tfb.booking_reference,
        COUNT(tis.id) as itinerary_segments
      FROM travel_requests tr
      INNER JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
      INNER JOIN trf_itinerary_segments tis ON tr.id = tis.trf_id
      WHERE tr.travel_type IN ('Domestic', 'Overseas', 'Home Leave Passage', 'External Parties')
        AND tis.flight_number IS NOT NULL
        AND tis.flight_number <> ''
      GROUP BY tr.id, tr.status, tr.travel_type, tr.requestor_name, tr.submitted_at, tfb.flight_number, tfb.airline, tfb.booking_reference
      ORDER BY tr.submitted_at DESC
      LIMIT 5
    `);

    bothQuery.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. TSR: ${row.id} (${row.status})`);
      console.log(`      Requestor: ${row.requestor_name}`);
      console.log(`      Travel Type: ${row.travel_type}`);
      console.log(`      Booked Flight: ${row.booked_flight || 'N/A'} (${row.airline || 'N/A'})`);
      console.log(`      PNR: ${row.booking_reference || 'N/A'}`);
      console.log(`      Itinerary Segments: ${row.itinerary_segments}`);
      console.log('');
    });

    // Summary table counts
    console.log('4️⃣ DATABASE TABLE RECORD COUNTS:');
    console.log('--------------------------------');

    const tableCountsQuery = await client.query(`
      SELECT
        'travel_requests' as table_name,
        COUNT(*) as total_records,
        COUNT(CASE WHEN travel_type IN ('Domestic', 'Overseas', 'Home Leave Passage', 'External Parties') THEN 1 END) as relevant_records
      FROM travel_requests
      UNION ALL
      SELECT
        'trf_flight_bookings' as table_name,
        COUNT(*) as total_records,
        COUNT(*) as relevant_records
      FROM trf_flight_bookings
      UNION ALL
      SELECT
        'trf_itinerary_segments' as table_name,
        COUNT(*) as total_records,
        COUNT(CASE WHEN flight_number IS NOT NULL AND flight_number <> '' THEN 1 END) as with_flight_number
      FROM trf_itinerary_segments
    `);

    tableCountsQuery.rows.forEach(row => {
      console.log(`   ${row.table_name}: ${row.total_records} total records (${row.relevant_records || row.with_flight_number} relevant)`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

// Run the analysis
showFlightDetailsSample().catch(console.error);