// Test script to validate the exact API response for booked flights
const { Pool } = require('pg');

async function testFlightAPI() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/syntra'
  });

  try {
    console.log('=== TESTING EXACT API QUERY ===');

    // This is the exact query used by bookedOnly=true
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

    const result = await pool.query(bookedOnlyQuery);
    console.log(`📊 Query returned ${result.rows.length} rows`);

    if (result.rows.length === 0) {
      console.log('❌ NO ROWS RETURNED - This is the problem!');

      // Let's debug why no rows are returned
      console.log('\n=== DEBUGGING: WHY NO ROWS? ===');

      // Check TRF Processed TSRs
      const trfProcessed = await pool.query(`
        SELECT id, status, requestor_name
        FROM travel_requests
        WHERE status = 'TRF Processed'
      `);
      console.log(`TRF Processed TSRs: ${trfProcessed.rows.length}`);
      trfProcessed.rows.forEach(row => {
        console.log(`  - ${row.id}: ${row.requestor_name}`);
      });

      // Check flight bookings
      const flightBookings = await pool.query(`
        SELECT trf_id, flight_number, departure_location, arrival_location
        FROM trf_flight_bookings
      `);
      console.log(`\nFlight bookings: ${flightBookings.rows.length}`);
      flightBookings.rows.forEach(row => {
        console.log(`  - ${row.trf_id}: ${row.flight_number} (${row.departure_location} → ${row.arrival_location})`);
      });

      // Check if INNER JOIN is the problem
      console.log('\n=== TESTING LEFT JOIN INSTEAD ===');
      const leftJoinQuery = `
        SELECT tr.id, tr.status, tfb.id as flight_booking_id, tfb.flight_number
        FROM travel_requests tr
        LEFT JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
        WHERE tr.status = 'TRF Processed'
      `;
      const leftJoinResult = await pool.query(leftJoinQuery);
      console.log(`Left join result: ${leftJoinResult.rows.length} rows`);
      leftJoinResult.rows.forEach(row => {
        console.log(`  - ${row.id}: booking_id=${row.flight_booking_id}, flight=${row.flight_number}`);
      });

    } else {
      console.log('\n=== PROCESSING API RESPONSE ===');

      // Simulate the exact API processing logic
      const formattedTrfs = result.rows.map(trf => {
        const hasFormalBooking = !!trf.flight_booking_id;
        const hasItineraryFlight = !!(trf.itinerary_flight_number && trf.itinerary_flight_number !== '');
        const hasAnyFlightData = hasFormalBooking || hasItineraryFlight;

        let flightDetails = null;
        if (hasFormalBooking) {
          const departureDateTime = trf.departure_date && trf.departure_time
            ? `${trf.departure_date}T${trf.departure_time}:00`
            : trf.departure_date;
          const arrivalDateTime = trf.arrival_date && trf.arrival_time
            ? `${trf.arrival_date}T${trf.arrival_time}:00`
            : trf.arrival_date;

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

      console.log(`✅ Formatted ${formattedTrfs.length} TSRs`);

      // Show detailed results
      formattedTrfs.forEach((trf, index) => {
        console.log(`\n📄 TSR ${index + 1}: ${trf.id}`);
        console.log(`   Requestor: ${trf.requestorName}`);
        console.log(`   Status: ${trf.status}`);
        console.log(`   Has Flight Booking: ${trf.hasFlightBooking}`);

        if (trf.flightDetails) {
          console.log(`   ✈️ Flight Details:`);
          console.log(`      Flight: ${trf.flightDetails.flightNumber}`);
          console.log(`      Route: ${trf.flightDetails.departureLocation} → ${trf.flightDetails.arrivalLocation}`);
          console.log(`      Departure: ${trf.flightDetails.departureDate}`);
          console.log(`      PNR: ${trf.flightDetails.bookingReference}`);
          console.log(`      Status: ${trf.flightDetails.status}`);
        } else {
          console.log(`   ❌ No flight details`);
        }
      });

      // Simulate frontend filtering
      const filteredForFrontend = formattedTrfs.filter(trf => trf.hasFlightBooking && trf.flightDetails);
      console.log(`\n🎯 After frontend filtering: ${filteredForFrontend.length} TSRs would display`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

testFlightAPI();