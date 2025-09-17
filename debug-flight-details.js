const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
  port: 5432,
});

async function comprehensiveFlightAnalysis() {
  try {
    await client.connect();
    console.log('🔍 COMPREHENSIVE FLIGHT DETAILS ANALYSIS');
    console.log('=' .repeat(60));

    // First, let's check the structure of travel_requests table
    console.log('\n🔍 0. CHECKING TRAVEL_REQUESTS TABLE STRUCTURE');
    console.log('-'.repeat(50));

    const tableStructureQuery = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'travel_requests'
      ORDER BY ordinal_position;
    `);

    console.log('travel_requests table columns:');
    tableStructureQuery.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(NULLABLE)'}`);
    });

    // 1. Check Travel Requests with TRF Processed status
    console.log('\n📋 1. TRAVEL REQUESTS WITH TRF PROCESSED STATUS');
    console.log('-'.repeat(50));

    const trfProcessedQuery = await client.query(`
      SELECT id, requestor_name, travel_type, status,
             purpose, created_at, updated_at
      FROM travel_requests
      WHERE status = 'TRF Processed'
      ORDER BY updated_at DESC
    `);

    console.log(`Total TSRs with 'TRF Processed' status: ${trfProcessedQuery.rows.length}`);

    if (trfProcessedQuery.rows.length > 0) {
      console.log('\nTSR IDs with TRF Processed status:');
      trfProcessedQuery.rows.forEach((row, index) => {
        console.log(`${index + 1}. ID: ${row.id} | Requestor: ${row.requestor_name} | Type: ${row.travel_type} | Purpose: ${row.purpose}`);
      });
    } else {
      console.log('❌ No TSRs found with TRF Processed status');
    }

    // 2. Check if trf_flight_bookings table exists and its structure
    console.log('\n✈️ 2. TRF_FLIGHT_BOOKINGS TABLE ANALYSIS');
    console.log('-'.repeat(50));

    try {
      // Check if table exists
      const tableExistsQuery = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'trf_flight_bookings'
        );
      `);

      const tableExists = tableExistsQuery.rows[0].exists;
      console.log(`Table 'trf_flight_bookings' exists: ${tableExists ? '✅ YES' : '❌ NO'}`);

      if (tableExists) {
        // Get table structure
        const columnsQuery = await client.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = 'trf_flight_bookings'
          ORDER BY ordinal_position;
        `);

        console.log('\nTable structure:');
        columnsQuery.rows.forEach(col => {
          console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(NULLABLE)'}`);
        });

        // Count total records
        const countQuery = await client.query('SELECT COUNT(*) as count FROM trf_flight_bookings');
        console.log(`\nTotal records in trf_flight_bookings: ${countQuery.rows[0].count}`);

        // Check TSR IDs with flight bookings
        const trfIdsWithFlights = await client.query(`
          SELECT DISTINCT trf_id, COUNT(*) as flight_count
          FROM trf_flight_bookings
          GROUP BY trf_id
          ORDER BY trf_id
        `);

        console.log(`\nTSR IDs with flight booking entries: ${trfIdsWithFlights.rows.length}`);
        if (trfIdsWithFlights.rows.length > 0) {
          console.log('TSR IDs with flight bookings:');
          trfIdsWithFlights.rows.forEach((row, index) => {
            console.log(`${index + 1}. TSR ID: ${row.trf_id} (${row.flight_count} flight record${row.flight_count > 1 ? 's' : ''})`);
          });
        }

      } else {
        console.log('❌ Table trf_flight_bookings does not exist!');
        console.log('This could be the root cause of the issue.');
      }

    } catch (tableError) {
      console.error('❌ Error checking table existence:', tableError.message);
    }

    // 3. Data Relationship Analysis
    console.log('\n🔗 3. DATA RELATIONSHIP ANALYSIS');
    console.log('-'.repeat(50));

    if (trfProcessedQuery.rows.length > 0) {
      const trfProcessedIds = trfProcessedQuery.rows.map(row => row.id);

      try {
        // Check which TRF Processed TSRs have flight booking records
        const relationshipQuery = await client.query(`
          SELECT
            tr.id as tsr_id,
            tr.requestor_name,
            tr.travel_type,
            tr.status,
            CASE WHEN tfb.trf_id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_flight_booking,
            tfb.id as flight_booking_id,
            tfb.flight_number,
            tfb.airline
          FROM travel_requests tr
          LEFT JOIN trf_flight_bookings tfb ON tr.id = tfb.trf_id
          WHERE tr.status = 'TRF Processed'
          ORDER BY tr.id
        `);

        const withFlights = relationshipQuery.rows.filter(row => row.has_flight_booking === 'YES');
        const withoutFlights = relationshipQuery.rows.filter(row => row.has_flight_booking === 'NO');

        console.log(`TRF Processed TSRs WITH flight bookings: ${withFlights.length}`);
        if (withFlights.length > 0) {
          withFlights.forEach((row, index) => {
            console.log(`  ${index + 1}. TSR ${row.tsr_id}: ${row.requestor_name} - Flight ${row.flight_number || 'N/A'} (${row.airline || 'N/A'})`);
          });
        }

        console.log(`\nTRF Processed TSRs WITHOUT flight bookings: ${withoutFlights.length}`);
        if (withoutFlights.length > 0) {
          console.log('❌ Missing flight bookings for:');
          withoutFlights.forEach((row, index) => {
            console.log(`  ${index + 1}. TSR ${row.tsr_id}: ${row.requestor_name} (${row.travel_type})`);
          });
        }

      } catch (relationshipError) {
        console.error('❌ Error in relationship analysis:', relationshipError.message);
      }
    }

    // 4. Sample Data Analysis
    console.log('\n📊 4. SAMPLE DATA ANALYSIS');
    console.log('-'.repeat(50));

    try {
      // Get sample flight booking records with all fields
      const sampleFlightQuery = await client.query(`
        SELECT * FROM trf_flight_bookings
        ORDER BY created_at DESC
        LIMIT 3
      `);

      if (sampleFlightQuery.rows.length > 0) {
        console.log('Sample flight booking records:');
        sampleFlightQuery.rows.forEach((row, index) => {
          console.log(`\n--- Sample Flight Booking ${index + 1} ---`);
          Object.entries(row).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        });
      } else {
        console.log('❌ No sample flight booking records found');
      }

      // Show sample TSR records
      const sampleTsrQuery = await client.query(`
        SELECT id, requestor_name, travel_type, status, purpose,
               departure_date, return_date, created_at, updated_at
        FROM travel_requests
        WHERE travel_type IN ('Domestic', 'Overseas', 'Home Leave Passage', 'External Parties')
        ORDER BY updated_at DESC
        LIMIT 3
      `);

      console.log('\n--- Sample TSR Records ---');
      sampleTsrQuery.rows.forEach((row, index) => {
        console.log(`\nSample TSR ${index + 1}:`);
        Object.entries(row).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      });

    } catch (sampleError) {
      console.error('❌ Error getting sample data:', sampleError.message);
    }

    // 5. API Query Test (exactly what the API uses)
    console.log('\n🔧 5. API QUERY SIMULATION');
    console.log('-'.repeat(50));

    if (trfProcessedQuery.rows.length > 0) {
      const testTrfId = trfProcessedQuery.rows[0].id;
      console.log(`Testing API query for TSR ID: ${testTrfId}`);

      try {
        const apiSimulationQuery = await client.query(`
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
        `, [testTrfId]);

        if (apiSimulationQuery.rows.length > 0) {
          const result = apiSimulationQuery.rows[0];
          console.log('API query result:');
          console.log(`  TSR ID: ${result.id}`);
          console.log(`  Status: ${result.status}`);
          console.log(`  Flight Booking ID: ${result.flight_booking_id || 'NULL'}`);
          console.log(`  Flight Number: ${result.flight_flight_number || 'NULL'}`);
          console.log(`  Airline: ${result.flight_airline || 'NULL'}`);
          console.log(`  Departure: ${result.flight_departure_location || 'NULL'} at ${result.flight_departure_date || 'NULL'} ${result.flight_departure_time || 'NULL'}`);
          console.log(`  Arrival: ${result.flight_arrival_location || 'NULL'} at ${result.flight_arrival_date || 'NULL'} ${result.flight_arrival_time || 'NULL'}`);

          if (result.flight_booking_id) {
            console.log('✅ Flight details found in API simulation');
          } else {
            console.log('❌ No flight details found in API simulation');
          }
        } else {
          console.log('❌ No results from API simulation query');
        }

      } catch (apiError) {
        console.error('❌ Error in API simulation:', apiError.message);
      }
    }

    // 6. Status Distribution Analysis
    console.log('\n📈 6. STATUS DISTRIBUTION ANALYSIS');
    console.log('-'.repeat(50));

    try {
      const statusDistribution = await client.query(`
        SELECT status, COUNT(*) as count
        FROM travel_requests
        WHERE travel_type IN ('Domestic', 'Overseas', 'Home Leave Passage', 'External Parties')
        GROUP BY status
        ORDER BY count DESC
      `);

      console.log('TSR Status Distribution:');
      statusDistribution.rows.forEach(row => {
        console.log(`  ${row.status}: ${row.count} TSRs`);
      });

    } catch (statusError) {
      console.error('❌ Error getting status distribution:', statusError.message);
    }

    // 7. Possible Issues Summary
    console.log('\n🚨 7. POSSIBLE ISSUES SUMMARY');
    console.log('-'.repeat(50));

    console.log('Based on the analysis above, potential issues could be:');
    console.log('1. trf_flight_bookings table does not exist');
    console.log('2. TSRs have status "TRF Processed" but no corresponding flight booking records');
    console.log('3. Column name mismatches between API expectations and database schema');
    console.log('4. Data not being inserted properly during flight booking process');
    console.log('5. Database connection or permission issues');

    console.log('\n✅ Analysis complete!');

  } catch (error) {
    console.error('❌ Critical error during analysis:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await client.end();
  }
}

comprehensiveFlightAnalysis().catch(console.error);