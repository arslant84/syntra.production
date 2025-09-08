/**
 * Fix script to properly separate TSR accommodation details into ACCOM requests
 * This will create proper ACCOM requests for the 15 TSRs identified
 */

const { Client } = require('pg');
const { format } = require('date-fns');

// Database connection
const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
});

// Generate request ID (simplified version)
function generateRequestId(type, context) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  const timestamp = `${year}${month}${day}-${hours}${minutes}${seconds}`;
  const validContext = context.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 5);
  const uniqueId = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  return `${type}-${timestamp}-${validContext}-${uniqueId}`;
}

async function createAccommodationRequest(tsrData, accommodationDetail, userId = 'system-fix') {
  try {
    // Determine location
    let location = accommodationDetail.location || 'Kiyanly';
    const locationMap = {
      'ashgabat': 'Ashgabat',
      'kiyanly': 'Kiyanly', 
      'turkmenbashy': 'Turkmenbashy',
      'new york': 'New York'
    };
    location = locationMap[location.toLowerCase()] || location;

    // Generate accommodation request ID
    const contextForAccomId = location.substring(0, 5).toUpperCase();
    const accomRequestId = generateRequestId('ACCOM', contextForAccomId);

    console.log(`Creating accommodation request ${accomRequestId} for TSR ${tsrData.id}`);

    await client.query('BEGIN');

    try {
      // Create travel request entry
      const insertTravelRequest = `
        INSERT INTO travel_requests (
          id, requestor_name, staff_id, department, travel_type, status, 
          additional_comments, submitted_at, created_at, updated_at, additional_data
        ) VALUES (
          $1, $2, $3, $4, 'Accommodation', 'Pending Department Focal',
          $5, NOW(), NOW(), NOW(), $6
        ) RETURNING *
      `;

      const travelRequestResult = await client.query(insertTravelRequest, [
        accomRequestId,
        tsrData.requestor_name,
        tsrData.staff_id || null,
        tsrData.department || null,
        `Auto-generated from TSR ${tsrData.id}: ${tsrData.purpose}`,
        JSON.stringify({ tsrReference: tsrData.id })
      ]);

      // Create accommodation details entry
      const insertAccommodationDetails = `
        INSERT INTO trf_accommodation_details (
          trf_id, check_in_date, check_out_date, accommodation_type, location, 
          place_of_stay, estimated_cost_per_night, remarks, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NOW()
        )
      `;

      await client.query(insertAccommodationDetails, [
        accomRequestId,
        accommodationDetail.check_in_date,
        accommodationDetail.check_out_date,
        accommodationDetail.accommodation_type || 'Staff House/PKC Kampung/Kiyanly camp',
        location,
        accommodationDetail.place_of_stay || '',
        accommodationDetail.estimated_cost_per_night || 0,
        accommodationDetail.remarks || 'Auto-generated from TSR'
      ]);

      // Create initial approval step
      const insertApprovalStep = `
        INSERT INTO trf_approval_steps (trf_id, step_role, step_name, status, step_date, comments)
        VALUES ($1, 'Requestor', $2, 'Approved', NOW(), 'Auto-generated accommodation request from TSR.')
      `;

      await client.query(insertApprovalStep, [
        accomRequestId,
        tsrData.requestor_name
      ]);

      await client.query('COMMIT');
      console.log(`✅ Successfully created accommodation request ${accomRequestId}`);
      return accomRequestId;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error(`❌ Failed to create accommodation request for TSR ${tsrData.id}:`, error.message);
    return null;
  }
}

async function removeAccommodationDetailsFromTSR(tsrId, accommodationDetailId) {
  try {
    console.log(`Removing accommodation details (ID: ${accommodationDetailId}) from TSR ${tsrId}`);
    
    // Delete the accommodation details from the original TSR
    await client.query('DELETE FROM trf_accommodation_details WHERE trf_id = $1 AND id = $2', [tsrId, accommodationDetailId]);
    
    // Update TSR's additional comments to indicate accommodation was moved
    await client.query(`
      UPDATE travel_requests
      SET additional_comments = COALESCE(additional_comments, '') || E'\\n\\n[System] Accommodation details moved to separate ACCOM request for proper processing.',
          updated_at = NOW()
      WHERE id = $1
    `, [tsrId]);

    console.log(`✅ Successfully removed accommodation details from TSR ${tsrId}`);
  } catch (error) {
    console.error(`❌ Failed to remove accommodation details from TSR ${tsrId}:`, error.message);
  }
}

async function main() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Get the TSRs with accommodation details that need fixing
    const tsrsWithAccommodation = await client.query(`
      SELECT DISTINCT
        tr.id,
        tr.requestor_name,
        tr.staff_id,
        tr.department,
        tr.travel_type,
        tr.purpose,
        tr.status,
        tr.submitted_at
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
      ORDER BY tr.submitted_at DESC
    `);

    console.log(`\nFound ${tsrsWithAccommodation.rows.length} TSRs to process`);

    const results = {
      processed: [],
      errors: []
    };

    // Process each TSR
    for (const tsr of tsrsWithAccommodation.rows) {
      try {
        console.log(`\n--- Processing TSR ${tsr.id} ---`);

        // Get accommodation details for this TSR
        const accommodationDetails = await client.query(`
          SELECT * FROM trf_accommodation_details 
          WHERE trf_id = $1
        `, [tsr.id]);

        for (const detail of accommodationDetails.rows) {
          // Create ACCOM request
          const accomRequestId = await createAccommodationRequest(tsr, detail);
          
          if (accomRequestId) {
            // Remove accommodation details from original TSR
            await removeAccommodationDetailsFromTSR(tsr.id, detail.id);
            results.processed.push({
              tsrId: tsr.id,
              accomRequestId: accomRequestId
            });
          } else {
            results.errors.push({
              tsrId: tsr.id,
              error: 'Failed to create accommodation request'
            });
          }
        }

      } catch (error) {
        console.error(`Error processing TSR ${tsr.id}:`, error.message);
        results.errors.push({
          tsrId: tsr.id,
          error: error.message
        });
      }
    }

    console.log('\n=== RESULTS SUMMARY ===');
    console.log(`✅ Successfully processed: ${results.processed.length}`);
    console.log(`❌ Errors: ${results.errors.length}`);

    if (results.processed.length > 0) {
      console.log('\n✅ Successfully created ACCOM requests:');
      results.processed.forEach(result => {
        console.log(`  • ${result.tsrId} → ${result.accomRequestId}`);
      });
    }

    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.forEach(error => {
        console.log(`  • ${error.tsrId}: ${error.error}`);
      });
    }

    // Verify the fix
    console.log('\n=== VERIFICATION ===');
    const verificationQuery = await client.query(`
      SELECT COUNT(*) as count FROM travel_requests
      WHERE travel_type = 'Accommodation'
    `);
    
    console.log(`Total accommodation requests in queue now: ${verificationQuery.rows[0].count}`);

  } catch (error) {
    console.error('Error during fix process:', error);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

main().catch(console.error);