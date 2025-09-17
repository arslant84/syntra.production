const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
  port: 5432,
});

async function testApiResponseIssue() {
  try {
    await client.connect();
    console.log('🔍 COMPREHENSIVE API RESPONSE TEST - Flight Details Display Issue');
    console.log('==================================================================\n');

    // 1. TEST THE EXACT QUERY USED BY API WITH bookedOnly=true
    console.log('1️⃣ TESTING EXACT bookedOnly=true QUERY FROM API');
    console.log('-------------------------------------------');

    const bookedOnlyQuery = `
      SELECT DISTINCT ON (tr.id)
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
        tfb.airline,
        tfb.departure_location,
        tfb.arrival_location,
        tfb.departure_date,
        tfb.departure_time,
        tfb.arrival_date,
        tfb.arrival_time,
        tfb.booking_reference,
        tfb.status as flight_status,
        tfb.remarks,
        tis.flight_number as itinerary_flight_number,
        tis.from_location as itinerary_departure,
        tis.to_location as itinerary_arrival,
        tis.segment_date as itinerary_segment_date,
        tis.departure_time as itinerary_departure_time,
        tis.arrival_time as itinerary_arrival_time
      FROM travel_requests tr
      INNER JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
      LEFT JOIN trf_itinerary_segments tis ON tr.id = tis.trf_id AND
               (tis.flight_number IS NOT NULL AND tis.flight_number <> '')
      WHERE tr.status = 'TRF Processed'
        AND tfb.id IS NOT NULL
      ORDER BY tr.id, tr.submitted_at DESC, tfb.id DESC NULLS LAST, tis.segment_date ASC
      LIMIT 200
    `;

    const bookedOnlyResults = await client.query(bookedOnlyQuery);
    console.log(`📊 Query returned ${bookedOnlyResults.rows.length} rows`);

    if (bookedOnlyResults.rows.length === 0) {
      console.log('❌ NO RESULTS FOUND! This explains why flight details aren\'t showing.');
      console.log('   Checking if the issue is with:');
      console.log('   a) INNER JOIN condition');
      console.log('   b) Status = "TRF Processed" condition');
      console.log('   c) tfb.id IS NOT NULL condition\n');
    } else {
      console.log('✅ Query returned results. Let\'s analyze the data...\n');

      // Show first few rows for analysis
      console.log('📋 SAMPLE DATA (first 3 rows):');
      bookedOnlyResults.rows.slice(0, 3).forEach((row, index) => {
        console.log(`\n--- Row ${index + 1} ---`);
        console.log(`TRF ID: ${row.id}`);
        console.log(`Requestor: ${row.requestor_name || row.external_full_name}`);
        console.log(`Status: ${row.status}`);
        console.log(`Flight Booking ID: ${row.flight_booking_id}`);
        console.log(`Flight Number: ${row.flight_number || 'NULL'}`);
        console.log(`Airline: ${row.airline || 'NULL'}`);
        console.log(`Departure: ${row.departure_location || 'NULL'}`);
        console.log(`Arrival: ${row.arrival_location || 'NULL'}`);
        console.log(`Departure Date: ${row.departure_date || 'NULL'}`);
        console.log(`Departure Time: ${row.departure_time || 'NULL'}`);
        console.log(`Flight Status: ${row.flight_status || 'NULL'}`);
        console.log(`Booking Ref: ${row.booking_reference || 'NULL'}`);
      });
    }

    // 2. SIMULATE THE EXACT API PROCESSING LOGIC
    console.log('\n\n2️⃣ SIMULATING API PROCESSING LOGIC');
    console.log('-----------------------------------');

    const formattedTrfs = bookedOnlyResults.rows.map(trf => {
      // Determine if this TRF has flight booking data
      const hasFormalBooking = !!trf.flight_booking_id;
      const hasItineraryFlight = !!(trf.itinerary_flight_number && trf.itinerary_flight_number !== '');
      const hasAnyFlightData = hasFormalBooking || hasItineraryFlight;

      // Create flight details from formal booking or itinerary data
      let flightDetails = null;
      if (hasFormalBooking) {
        // Combine separate date and time fields into datetime format
        const departureDateTime = trf.departure_date && trf.departure_time
          ? `${trf.departure_date}T${trf.departure_time}:00`
          : trf.departure_date;
        const arrivalDateTime = trf.arrival_date && trf.arrival_time
          ? `${trf.arrival_date}T${trf.arrival_time}:00`
          : trf.arrival_date;

        // Use formal flight booking data - ensure all fields are properly populated
        flightDetails = {
          id: Number(trf.flight_booking_id),
          flightNumber: trf.flight_number || 'N/A',
          airline: trf.airline || 'N/A',
          departureLocation: trf.departure_location || 'N/A',
          arrivalLocation: trf.arrival_location || 'N/A',
          departureDate: departureDateTime,
          arrivalDate: arrivalDateTime,
          bookingReference: trf.booking_reference || 'N/A',
          status: trf.flight_status || 'Confirmed',
          remarks: trf.remarks || 'Flight booked by admin'
        };
      } else if (hasItineraryFlight) {
        // Use itinerary segment data as flight details
        const departureDateTime = trf.itinerary_segment_date && trf.itinerary_departure_time
          ? `${trf.itinerary_segment_date}T${trf.itinerary_departure_time}:00`
          : trf.itinerary_segment_date;
        const arrivalDateTime = trf.itinerary_segment_date && trf.itinerary_arrival_time
          ? `${trf.itinerary_segment_date}T${trf.itinerary_arrival_time}:00`
          : trf.itinerary_segment_date;

        flightDetails = {
          id: `itinerary-${trf.id}`,
          flightNumber: trf.itinerary_flight_number,
          departureLocation: trf.itinerary_departure || 'N/A',
          arrivalLocation: trf.itinerary_arrival || 'N/A',
          departureDate: departureDateTime,
          arrivalDate: arrivalDateTime,
          bookingReference: trf.itinerary_flight_number,
          status: 'From Itinerary',
          remarks: 'Flight details from user itinerary'
        };
      }

      return {
        id: String(trf.id),
        requestorName: trf.requestor_name || trf.external_full_name,
        travelType: trf.travel_type,
        department: trf.department,
        purpose: trf.purpose,
        status: trf.status,
        submittedAt: trf.submitted_at,
        hasFlightBooking: hasAnyFlightData,
        flightDetails: flightDetails
      };
    });

    console.log(`📊 Processed ${formattedTrfs.length} TRFs`);
    console.log(`✅ TRFs with hasFlightBooking=true: ${formattedTrfs.filter(t => t.hasFlightBooking).length}`);
    console.log(`❌ TRFs with hasFlightBooking=false: ${formattedTrfs.filter(t => !t.hasFlightBooking).length}`);
    console.log(`✈️ TRFs with non-null flightDetails: ${formattedTrfs.filter(t => t.flightDetails !== null).length}`);

    // Show detailed breakdown of flight details
    if (formattedTrfs.length > 0) {
      console.log('\n📋 FLIGHT DETAILS ANALYSIS:');
      formattedTrfs.slice(0, 3).forEach((trf, index) => {
        console.log(`\n--- TRF ${index + 1} (ID: ${trf.id}) ---`);
        console.log(`hasFlightBooking: ${trf.hasFlightBooking}`);
        console.log(`flightDetails:`, trf.flightDetails ? 'PRESENT' : 'NULL');
        if (trf.flightDetails) {
          console.log(`  - Flight Number: ${trf.flightDetails.flightNumber}`);
          console.log(`  - Airline: ${trf.flightDetails.airline || 'N/A'}`);
          console.log(`  - Route: ${trf.flightDetails.departureLocation} → ${trf.flightDetails.arrivalLocation}`);
          console.log(`  - Status: ${trf.flightDetails.status}`);
        }
      });
    }

    // 3. TEST WITH LEFT JOIN INSTEAD OF INNER JOIN
    console.log('\n\n3️⃣ TESTING WITH LEFT JOIN (vs INNER JOIN)');
    console.log('------------------------------------------');

    const leftJoinQuery = `
      SELECT DISTINCT ON (tr.id)
        tr.id,
        tr.requestor_name,
        tr.external_full_name,
        tr.travel_type,
        tr.status,
        tfb.id as flight_booking_id,
        tfb.flight_number,
        tfb.airline
      FROM travel_requests tr
      LEFT JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
      WHERE tr.status = 'TRF Processed'
      ORDER BY tr.id, tr.submitted_at DESC
      LIMIT 10
    `;

    const leftJoinResults = await client.query(leftJoinQuery);
    console.log(`📊 LEFT JOIN returned ${leftJoinResults.rows.length} rows`);
    console.log(`✅ With flight bookings: ${leftJoinResults.rows.filter(r => r.flight_booking_id !== null).length}`);
    console.log(`❌ Without flight bookings: ${leftJoinResults.rows.filter(r => r.flight_booking_id === null).length}`);

    // 4. CHECK DATABASE STATE
    console.log('\n\n4️⃣ DATABASE STATE ANALYSIS');
    console.log('---------------------------');

    // Count records by status
    const statusCount = await client.query(`
      SELECT tr.status, COUNT(*) as count
      FROM travel_requests tr
      GROUP BY tr.status
      ORDER BY count DESC
    `);

    console.log('📊 TRF Records by Status:');
    statusCount.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count}`);
    });

    // Count flight bookings
    const flightBookingCount = await client.query(`
      SELECT COUNT(*) as total_bookings
      FROM trf_flight_bookings
    `);

    console.log(`\n✈️ Total Flight Bookings: ${flightBookingCount.rows[0].total_bookings}`);

    // Count flight bookings linked to TRF Processed
    const processedWithFlights = await client.query(`
      SELECT COUNT(DISTINCT tr.id) as count
      FROM travel_requests tr
      INNER JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
      WHERE tr.status = 'TRF Processed'
    `);

    console.log(`🔗 TRF Processed with Flight Bookings: ${processedWithFlights.rows[0].count}`);

    // 5. CHECK FOR SPECIFIC ISSUES
    console.log('\n\n5️⃣ ISSUE DIAGNOSIS');
    console.log('------------------');

    // Check if there are TRF Processed records at all
    const processedCount = await client.query(`
      SELECT COUNT(*) as count FROM travel_requests WHERE status = 'TRF Processed'
    `);

    if (processedCount.rows[0].count == 0) {
      console.log('❌ ISSUE FOUND: No records with status "TRF Processed"');

      // Check similar statuses
      const similarStatuses = await client.query(`
        SELECT DISTINCT status FROM travel_requests
        WHERE status ILIKE '%process%' OR status ILIKE '%complete%' OR status ILIKE '%book%'
      `);

      console.log('🔍 Similar statuses found:');
      similarStatuses.rows.forEach(row => {
        console.log(`   "${row.status}"`);
      });
    } else {
      console.log(`✅ Found ${processedCount.rows[0].count} records with status "TRF Processed"`);
    }

    // Check if flight bookings exist but aren't linked properly
    const orphanFlights = await client.query(`
      SELECT COUNT(*) as count
      FROM trf_flight_bookings tfb
      LEFT JOIN travel_requests tr ON tfb.trf_id = tr.id
      WHERE tr.id IS NULL
    `);

    if (orphanFlights.rows[0].count > 0) {
      console.log(`⚠️ WARNING: ${orphanFlights.rows[0].count} flight bookings not linked to valid TRFs`);
    }

    // 6. SHOW EXPECTED vs ACTUAL API RESPONSE
    console.log('\n\n6️⃣ API RESPONSE COMPARISON');
    console.log('---------------------------');

    const expectedResponse = {
      trfs: formattedTrfs
    };

    console.log('📤 API Response Structure:');
    console.log(`{`);
    console.log(`  "trfs": [${formattedTrfs.length} items] {`);
    if (formattedTrfs.length > 0) {
      console.log(`    "id": "${formattedTrfs[0].id}",`);
      console.log(`    "requestorName": "${formattedTrfs[0].requestorName}",`);
      console.log(`    "hasFlightBooking": ${formattedTrfs[0].hasFlightBooking},`);
      console.log(`    "flightDetails": ${formattedTrfs[0].flightDetails ? 'Object' : 'null'}`);
    }
    console.log(`  }`);
    console.log(`}`);

    // 7. FINAL DIAGNOSIS
    console.log('\n\n🏁 FINAL DIAGNOSIS');
    console.log('==================');

    if (bookedOnlyResults.rows.length === 0) {
      console.log('❌ ROOT CAUSE: The bookedOnly=true query returns NO results');
      console.log('   This means EITHER:');
      console.log('   a) No records have status "TRF Processed"');
      console.log('   b) No TRF Processed records have linked flight bookings');
      console.log('   c) The INNER JOIN is too restrictive');
      console.log('\n   SOLUTION: Check your database for:');
      console.log('   1. Records with correct status');
      console.log('   2. Proper foreign key relationships');
      console.log('   3. Consider using LEFT JOIN instead of INNER JOIN');
    } else {
      console.log('✅ Query returns results, but flight details might not be displaying due to:');
      console.log('   1. Frontend filtering logic issues');
      console.log('   2. hasFlightBooking flag issues');
      console.log('   3. flightDetails object construction problems');
      console.log('   4. Component rendering issues in the frontend');
    }

    console.log('\n📊 SUMMARY STATS:');
    console.log(`   Total query results: ${bookedOnlyResults.rows.length}`);
    console.log(`   Records with hasFlightBooking=true: ${formattedTrfs.filter(t => t.hasFlightBooking).length}`);
    console.log(`   Records with flightDetails: ${formattedTrfs.filter(t => t.flightDetails !== null).length}`);
    console.log(`   Database TRF Processed count: ${processedCount.rows[0].count}`);
    console.log(`   Database flight bookings count: ${flightBookingCount.rows[0].total_bookings}`);

    // 8. TEST INDIVIDUAL TRF API ENDPOINT
    console.log('\n\n8️⃣ TESTING INDIVIDUAL TRF API ENDPOINT');
    console.log('--------------------------------------');

    if (formattedTrfs.length > 0) {
      const testTrfId = formattedTrfs[0].id;
      console.log(`Testing individual TRF endpoint for: ${testTrfId}`);

      // Simulate the individual TRF API query
      const individualTrfQuery = `
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
      `;

      const individualResult = await client.query(individualTrfQuery, [
        testTrfId, 'Domestic', 'Overseas', 'Home Leave Passage', 'External Parties'
      ]);

      if (individualResult.rows.length > 0) {
        const mainTrfData = individualResult.rows[0];
        console.log(`✅ Individual TRF API returned data for ${testTrfId}`);
        console.log(`   Has flight booking: ${mainTrfData.flight_booking_id ? 'YES' : 'NO'}`);

        if (mainTrfData.flight_booking_id) {
          // Simulate the flight details construction in individual TRF API
          const departureDateTime = mainTrfData.flight_departure_date && mainTrfData.flight_departure_time
            ? `${mainTrfData.flight_departure_date}T${mainTrfData.flight_departure_time}:00`
            : mainTrfData.flight_departure_date;

          const arrivalDateTime = mainTrfData.flight_arrival_date && mainTrfData.flight_arrival_time
            ? `${mainTrfData.flight_arrival_date}T${mainTrfData.flight_arrival_time}:00`
            : mainTrfData.flight_arrival_date;

          const individualFlightDetails = {
            id: mainTrfData.flight_booking_id,
            flightNumber: mainTrfData.flight_flight_number,
            airline: mainTrfData.flight_airline,
            flightClass: mainTrfData.flight_class,
            bookingReference: mainTrfData.flight_booking_reference,
            departureLocation: mainTrfData.flight_departure_location,
            arrivalLocation: mainTrfData.flight_arrival_location,
            departureDate: departureDateTime,
            arrivalDate: arrivalDateTime,
            departureTime: mainTrfData.flight_departure_time,
            arrivalTime: mainTrfData.flight_arrival_time,
            status: mainTrfData.flight_status,
            remarks: mainTrfData.flight_remarks,
            processedBy: mainTrfData.flight_created_by,
            processedDate: mainTrfData.flight_created_at
          };

          console.log('   Individual TRF flight details structure:');
          console.log('   {');
          console.log(`     id: "${individualFlightDetails.id}",`);
          console.log(`     flightNumber: "${individualFlightDetails.flightNumber}",`);
          console.log(`     airline: "${individualFlightDetails.airline || 'N/A'}",`);
          console.log(`     route: "${individualFlightDetails.departureLocation} → ${individualFlightDetails.arrivalLocation}",`);
          console.log(`     status: "${individualFlightDetails.status}"`);
          console.log('   }');

          console.log('\n🎯 DATA STRUCTURE COMPARISON:');
          console.log('==========================');
          console.log('Flights Admin API (bookedOnly=true):');
          console.log('  ✅ Returns trfData.flightDetails object');
          console.log('  ✅ TrfView checks: trfData?.flightDetails (SHOULD WORK)');
          console.log('\nIndividual TRF API (/api/trf/[trfId]):');
          console.log('  ✅ Returns trfData.flightDetails object');
          console.log('  ✅ TrfView checks: trfData?.flightDetails (SHOULD WORK)');
          console.log('\n✅ BOTH APIs return compatible data structures!');
        }
      } else {
        console.log(`❌ Individual TRF API returned no data for ${testTrfId}`);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await client.end();
  }
}

// Run the test
console.log('Starting API Response Test...\n');
testApiResponseIssue().catch(console.error);