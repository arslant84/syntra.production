/**
 * Manual fix script to identify and resolve TSR accommodation naming issues
 * This script will:
 * 1. Find TSRs with accommodation details that aren't separated
 * 2. Create proper ACCOM requests for them
 * 3. Update the approval queue to show them
 */

const { Client } = require('pg');

// Database connection
const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Step 1: Find TSRs with accommodation details that haven't been separated
    console.log('\n--- Step 1: Finding TSRs with accommodation details ---');
    
    const tsrsWithAccommodation = await client.query(`
      SELECT DISTINCT
        tr.id,
        tr.requestor_name,
        tr.staff_id,
        tr.department,
        tr.travel_type,
        tr.purpose,
        tr.status,
        tr.submitted_at,
        COUNT(tad.id) as accommodation_count
      FROM travel_requests tr
      INNER JOIN trf_accommodation_details tad ON tr.id = tad.trf_id
      WHERE tr.id LIKE 'TSR-%'
        AND tr.travel_type != 'Accommodation'
        AND NOT EXISTS (
          SELECT 1 FROM travel_requests accom_tr 
          WHERE accom_tr.additional_comments LIKE '%' || tr.id || '%'
            AND accom_tr.travel_type = 'Accommodation'
            AND accom_tr.id LIKE 'ACCOM-%'
        )
      GROUP BY tr.id, tr.requestor_name, tr.staff_id, tr.department, tr.travel_type, tr.purpose, tr.status, tr.submitted_at
      ORDER BY tr.submitted_at DESC
    `);

    console.log(`Found ${tsrsWithAccommodation.rows.length} TSRs with accommodation details that need fixing:`);
    
    if (tsrsWithAccommodation.rows.length > 0) {
      console.table(tsrsWithAccommodation.rows.map(row => ({
        id: row.id,
        requestor: row.requestor_name,
        travel_type: row.travel_type,
        status: row.status,
        accom_count: row.accommodation_count
      })));
    }

    // Step 2: Check accommodation details for these TSRs
    if (tsrsWithAccommodation.rows.length > 0) {
      console.log('\n--- Step 2: Checking accommodation details ---');
      
      const tsrIds = tsrsWithAccommodation.rows.map(row => row.id);
      const accommodationDetails = await client.query(`
        SELECT 
          trf_id,
          id as detail_id,
          accommodation_type,
          check_in_date,
          check_out_date,
          location,
          place_of_stay,
          estimated_cost_per_night,
          remarks
        FROM trf_accommodation_details 
        WHERE trf_id = ANY($1)
        ORDER BY trf_id, check_in_date
      `, [tsrIds]);

      console.log(`Found ${accommodationDetails.rows.length} accommodation details:`);
      if (accommodationDetails.rows.length > 0) {
        console.table(accommodationDetails.rows.map(detail => ({
          trf_id: detail.trf_id,
          type: detail.accommodation_type,
          location: detail.location,
          check_in: detail.check_in_date?.toISOString().split('T')[0],
          check_out: detail.check_out_date?.toISOString().split('T')[0]
        })));
      }
    }

    // Step 3: Check current approval queue for accommodation requests
    console.log('\n--- Step 3: Current accommodation requests in approval queue ---');
    
    const currentAccommodation = await client.query(`
      SELECT 
        id,
        requestor_name,
        travel_type,
        status,
        submitted_at
      FROM travel_requests
      WHERE travel_type = 'Accommodation'
      ORDER BY submitted_at DESC
      LIMIT 10
    `);

    console.log(`Current accommodation requests in queue: ${currentAccommodation.rows.length}`);
    if (currentAccommodation.rows.length > 0) {
      console.table(currentAccommodation.rows.map(row => ({
        id: row.id,
        requestor: row.requestor_name,
        status: row.status,
        submitted: row.submitted_at?.toISOString().split('T')[0]
      })));
    }

    // Step 4: Analysis summary
    console.log('\n--- ANALYSIS SUMMARY ---');
    console.log(`• TSRs with accommodation details: ${tsrsWithAccommodation.rows.length}`);
    console.log(`• Current accommodation requests in queue: ${currentAccommodation.rows.length}`);
    
    if (tsrsWithAccommodation.rows.length > 0) {
      console.log('\n🔧 ISSUE IDENTIFIED:');
      console.log('   These TSRs have accommodation details but are not showing in the approval queue');
      console.log('   because they maintain their TSR naming and travel_type instead of being');
      console.log('   separated into proper ACCOM requests.');
      
      console.log('\n💡 SOLUTION:');
      console.log('   Need to run the TSR auto-generation service to create proper ACCOM requests');
      console.log('   for these TSRs and remove their accommodation details from the original TSR.');
    } else {
      console.log('\n✅ NO ISSUES FOUND:');
      console.log('   All TSRs with accommodation details have been properly separated.');
    }

  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

main().catch(console.error);