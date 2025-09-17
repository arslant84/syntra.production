// Accurate Flight Statistics Analysis
// Fixed version that properly handles JOIN duplicates
const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
  port: 5432,
});

async function accurateFlightStatistics() {
  try {
    await client.connect();
    console.log('✅ ACCURATE FLIGHT STATISTICS ANALYSIS');
    console.log('======================================');
    console.log('');

    // 1. TSR COUNT BY STATUS
    console.log('1️⃣ TOTAL TSR COUNT BY STATUS:');
    console.log('-----------------------------');
    const statusQuery = await client.query(`
      SELECT
        status,
        COUNT(*) as count
      FROM travel_requests
      WHERE travel_type IN ('Domestic', 'Overseas', 'Home Leave Passage', 'External Parties')
      GROUP BY status
      ORDER BY count DESC
    `);

    console.log('   📊 Travel Request Status Distribution:');
    statusQuery.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count}`);
    });

    const totalTSRs = statusQuery.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
    console.log(`   📊 TOTAL TSRs: ${totalTSRs}`);
    console.log('');

    // 2. TSRs WITH FLIGHT BOOKINGS (UNIQUE COUNT)
    console.log('2️⃣ TSRs WITH FLIGHT BOOKINGS:');
    console.log('-----------------------------');

    // Count unique TSRs with flight bookings
    const uniqueFlightBookingQuery = await client.query(`
      SELECT COUNT(DISTINCT tr.id) as unique_tsr_count
      FROM travel_requests tr
      INNER JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
      WHERE tr.travel_type IN ('Domestic', 'Overseas', 'Home Leave Passage', 'External Parties')
    `);

    const uniqueTSRsWithFlightBookings = parseInt(uniqueFlightBookingQuery.rows[0].unique_tsr_count);

    // Count by status
    const flightBookingsByStatus = await client.query(`
      SELECT
        tr.status,
        COUNT(DISTINCT tr.id) as unique_tsr_count,
        COUNT(tfb.id) as total_flight_bookings
      FROM travel_requests tr
      INNER JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
      WHERE tr.travel_type IN ('Domestic', 'Overseas', 'Home Leave Passage', 'External Parties')
      GROUP BY tr.status
      ORDER BY unique_tsr_count DESC
    `);

    console.log('   📊 TSRs with Flight Bookings by Status:');
    flightBookingsByStatus.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.unique_tsr_count} unique TSRs (${row.total_flight_bookings} total flight bookings)`);
    });
    console.log(`   📊 TOTAL UNIQUE TSRs with Flight Bookings: ${uniqueTSRsWithFlightBookings}`);
    console.log('');

    // 3. TSRs WITH ITINERARY FLIGHTS (UNIQUE COUNT)
    console.log('3️⃣ TSRs WITH ITINERARY FLIGHTS:');
    console.log('-------------------------------');

    // Count unique TSRs with itinerary flights
    const uniqueItineraryQuery = await client.query(`
      SELECT COUNT(DISTINCT tr.id) as unique_tsr_count
      FROM travel_requests tr
      INNER JOIN trf_itinerary_segments tis ON tr.id = tis.trf_id
      WHERE tr.travel_type IN ('Domestic', 'Overseas', 'Home Leave Passage', 'External Parties')
        AND tis.flight_number IS NOT NULL
        AND tis.flight_number <> ''
    `);

    const uniqueTSRsWithItinerary = parseInt(uniqueItineraryQuery.rows[0].unique_tsr_count);

    // Count by status
    const itineraryByStatus = await client.query(`
      SELECT
        tr.status,
        COUNT(DISTINCT tr.id) as unique_tsr_count,
        COUNT(tis.id) as total_itinerary_flights
      FROM travel_requests tr
      INNER JOIN trf_itinerary_segments tis ON tr.id = tis.trf_id
      WHERE tr.travel_type IN ('Domestic', 'Overseas', 'Home Leave Passage', 'External Parties')
        AND tis.flight_number IS NOT NULL
        AND tis.flight_number <> ''
      GROUP BY tr.status
      ORDER BY unique_tsr_count DESC
    `);

    console.log('   📊 TSRs with Itinerary Flights by Status:');
    itineraryByStatus.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.unique_tsr_count} unique TSRs (${row.total_itinerary_flights} total itinerary segments)`);
    });
    console.log(`   📊 TOTAL UNIQUE TSRs with Itinerary Flights: ${uniqueTSRsWithItinerary}`);
    console.log('');

    // 4. FLIGHT DATA CATEGORIZATION (PROPERLY COUNTED)
    console.log('4️⃣ FLIGHT DATA CATEGORIZATION:');
    console.log('------------------------------');

    const categorizationQuery = await client.query(`
      SELECT
        tr.id,
        tr.status,
        tr.travel_type,
        tr.requestor_name,
        (CASE WHEN flight_bookings.booking_count > 0 THEN true ELSE false END) as has_flight_booking,
        (CASE WHEN itinerary_flights.flight_count > 0 THEN true ELSE false END) as has_itinerary_flight,
        COALESCE(flight_bookings.booking_count, 0) as booking_count,
        COALESCE(itinerary_flights.flight_count, 0) as itinerary_count
      FROM travel_requests tr
      LEFT JOIN (
        SELECT trf_id, COUNT(*) as booking_count
        FROM trf_flight_bookings
        GROUP BY trf_id
      ) flight_bookings ON tr.id = flight_bookings.trf_id
      LEFT JOIN (
        SELECT trf_id, COUNT(*) as flight_count
        FROM trf_itinerary_segments
        WHERE flight_number IS NOT NULL AND flight_number <> ''
        GROUP BY trf_id
      ) itinerary_flights ON tr.id = itinerary_flights.trf_id
      WHERE tr.travel_type IN ('Domestic', 'Overseas', 'Home Leave Passage', 'External Parties')
      ORDER BY tr.submitted_at DESC
    `);

    let categoryCounts = {
      both: 0,
      bookingOnly: 0,
      itineraryOnly: 0,
      neither: 0
    };

    console.log('   📊 Flight Data Categories (first 15 TSRs):');
    categorization = categorizationQuery.rows.slice(0, 15).forEach((row, index) => {
      const hasBooking = row.has_flight_booking;
      const hasItinerary = row.has_itinerary_flight;

      let category = '';
      if (hasBooking && hasItinerary) {
        category = 'BOTH';
      } else if (hasBooking) {
        category = 'BOOKING ONLY';
      } else if (hasItinerary) {
        category = 'ITINERARY ONLY';
      } else {
        category = 'NO FLIGHTS';
      }

      console.log(`   ${index + 1}. ${row.id} (${row.status})`);
      console.log(`      Travel Type: ${row.travel_type}`);
      console.log(`      Requestor: ${row.requestor_name || 'N/A'}`);
      console.log(`      Flight Data: ${category} (${row.booking_count} bookings, ${row.itinerary_count} itinerary)`);
      console.log('');
    });

    // Count all categories
    categorization = categorizationQuery.rows.forEach(row => {
      const hasBooking = row.has_flight_booking;
      const hasItinerary = row.has_itinerary_flight;

      if (hasBooking && hasItinerary) {
        categoryCounts.both++;
      } else if (hasBooking) {
        categoryCounts.bookingOnly++;
      } else if (hasItinerary) {
        categoryCounts.itineraryOnly++;
      } else {
        categoryCounts.neither++;
      }
    });

    console.log('   📊 Complete Flight Data Categorization:');
    console.log(`   TSRs with BOTH booking & itinerary: ${categoryCounts.both}`);
    console.log(`   TSRs with BOOKING ONLY: ${categoryCounts.bookingOnly}`);
    console.log(`   TSRs with ITINERARY ONLY: ${categoryCounts.itineraryOnly}`);
    console.log(`   TSRs with NO FLIGHTS: ${categoryCounts.neither}`);
    console.log('');

    // 5. TRAVEL TYPE BREAKDOWN
    console.log('5️⃣ FLIGHT DATA BY TRAVEL TYPE:');
    console.log('------------------------------');
    const travelTypeBreakdown = await client.query(`
      SELECT
        tr.travel_type,
        COUNT(tr.id) as total_tsrs,
        COUNT(CASE WHEN flight_bookings.booking_count > 0 THEN 1 END) as with_flight_bookings,
        COUNT(CASE WHEN itinerary_flights.flight_count > 0 THEN 1 END) as with_itinerary_flights,
        COUNT(CASE WHEN flight_bookings.booking_count > 0 AND itinerary_flights.flight_count > 0 THEN 1 END) as with_both,
        COUNT(CASE WHEN flight_bookings.booking_count IS NULL AND itinerary_flights.flight_count IS NULL THEN 1 END) as with_neither
      FROM travel_requests tr
      LEFT JOIN (
        SELECT trf_id, COUNT(*) as booking_count
        FROM trf_flight_bookings
        GROUP BY trf_id
      ) flight_bookings ON tr.id = flight_bookings.trf_id
      LEFT JOIN (
        SELECT trf_id, COUNT(*) as flight_count
        FROM trf_itinerary_segments
        WHERE flight_number IS NOT NULL AND flight_number <> ''
        GROUP BY trf_id
      ) itinerary_flights ON tr.id = itinerary_flights.trf_id
      WHERE tr.travel_type IN ('Domestic', 'Overseas', 'Home Leave Passage', 'External Parties')
      GROUP BY tr.travel_type
      ORDER BY total_tsrs DESC
    `);

    console.log('   📊 Flight Data by Travel Type:');
    travelTypeBreakdown.rows.forEach(row => {
      console.log(`   ${row.travel_type}:`);
      console.log(`     Total TSRs: ${row.total_tsrs}`);
      console.log(`     With Flight Bookings: ${row.with_flight_bookings}`);
      console.log(`     With Itinerary Flights: ${row.with_itinerary_flights}`);
      console.log(`     With Both: ${row.with_both}`);
      console.log(`     With Neither: ${row.with_neither}`);
      console.log('');
    });

    // 6. FINAL SUMMARY
    console.log('6️⃣ FINAL SUMMARY:');
    console.log('-----------------');
    console.log(`📊 Total TSRs: ${totalTSRs}`);
    console.log(`📊 TSRs with Flight Bookings: ${uniqueTSRsWithFlightBookings}`);
    console.log(`📊 TSRs with Itinerary Flights: ${uniqueTSRsWithItinerary}`);

    const withAnyFlight = categoryCounts.both + categoryCounts.bookingOnly + categoryCounts.itineraryOnly;

    console.log(`📊 TSRs with ANY flight data: ${withAnyFlight}`);
    console.log(`📊 TSRs with NO flight data: ${categoryCounts.neither}`);
    console.log('');

    console.log('📈 CORRECT FLIGHT STATISTICS:');
    console.log(`   📋 Both bookings & itinerary: ${categoryCounts.both}`);
    console.log(`   📋 Booking only: ${categoryCounts.bookingOnly}`);
    console.log(`   📋 Itinerary only: ${categoryCounts.itineraryOnly}`);
    console.log(`   📋 No flight data: ${categoryCounts.neither}`);
    console.log('');

    // Verification
    const verificationSum = categoryCounts.both + categoryCounts.bookingOnly + categoryCounts.itineraryOnly + categoryCounts.neither;
    console.log(`✅ Verification: ${verificationSum} = ${totalTSRs} ${verificationSum === totalTSRs ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
  }
}

// Run the analysis
accurateFlightStatistics().catch(console.error);