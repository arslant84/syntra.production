const { Pool } = require('pg');
const path = require('path');

// Set up environment for database
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Database configuration
const dbConfig = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME || 'syntra',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || '221202',
};

async function debugDuplicateAccommodationId() {
  const pool = new Pool(dbConfig);
  
  try {
    const duplicateId = 'ACCOM-20250807-0919-ASHGA-ZMQ5';
    console.log(`🔍 Debugging duplicate accommodation ID: ${duplicateId}\n`);
    
    // Check in travel_requests table
    console.log('1. Checking travel_requests table...');
    const travelRequestResult = await pool.query(`
      SELECT 
        id,
        requestor_name,
        travel_type,
        status,
        created_at,
        submitted_at
      FROM 
        travel_requests
      WHERE id = $1
    `, [duplicateId]);
    
    if (travelRequestResult.rows.length > 0) {
      const record = travelRequestResult.rows[0];
      console.log(`   ✅ Found in travel_requests:`);
      console.log(`     - ID: ${record.id}`);
      console.log(`     - Requestor: ${record.requestor_name}`);
      console.log(`     - Travel Type: ${record.travel_type}`);
      console.log(`     - Status: ${record.status}`);
      console.log(`     - Created: ${record.created_at}`);
      console.log(`     - Submitted: ${record.submitted_at}`);
    } else {
      console.log('   ❌ Not found in travel_requests');
    }
    
    // Check accommodation details
    console.log('\n2. Checking trf_accommodation_details table...');
    const accommodationDetailResult = await pool.query(`
      SELECT 
        id,
        trf_id,
        location,
        check_in_date,
        check_out_date,
        created_at
      FROM 
        trf_accommodation_details
      WHERE trf_id = $1
    `, [duplicateId]);
    
    if (accommodationDetailResult.rows.length > 0) {
      console.log(`   ✅ Found ${accommodationDetailResult.rows.length} accommodation details:`);
      accommodationDetailResult.rows.forEach((detail, index) => {
        console.log(`     Detail ${index + 1}:`);
        console.log(`       - Detail ID: ${detail.id}`);
        console.log(`       - TRF ID: ${detail.trf_id}`);
        console.log(`       - Location: ${detail.location}`);
        console.log(`       - Check-in: ${detail.check_in_date}`);
        console.log(`       - Check-out: ${detail.check_out_date}`);
      });
    } else {
      console.log('   ❌ Not found in trf_accommodation_details');
    }
    
    // Test TSR query (what gets this ID in TSR results?)
    console.log('\n3. Testing why this appears in TSR query...');
    const tsrQuery = await pool.query(`
      SELECT 
        id,
        requestor_name,
        travel_type,
        status
      FROM 
        travel_requests
      WHERE
        status = ANY($1)
        AND id = $2
    `, [["Pending Department Focal", "Pending Line Manager", "Pending HOD"], duplicateId]);
    
    if (tsrQuery.rows.length > 0) {
      console.log(`   ❌ This ID appears in TSR query because:`);
      const record = tsrQuery.rows[0];
      console.log(`     - Travel Type: ${record.travel_type}`);
      console.log(`     - Status: ${record.status}`);
      console.log(`     - It has pending status but travel_type is NOT filtered in TSR query`);
    } else {
      console.log('   ✅ This ID does NOT appear in TSR query');
    }
    
    // Test Accommodation query (fixed version)
    console.log('\n4. Testing accommodation query (with travel_type filter)...');
    const accommodationQuery = await pool.query(`
      SELECT DISTINCT ON (tr.id)
        tr.id,
        tr.travel_type,
        tr.status
      FROM 
        trf_accommodation_details tad
      LEFT JOIN 
        travel_requests tr ON tad.trf_id = tr.id
      WHERE
        tr.status = ANY($1) AND tr.travel_type = 'Accommodation'
        AND tr.id = $2
      ORDER BY 
        tr.id, tr.submitted_at DESC
    `, [["Pending Department Focal", "Pending Approval"], duplicateId]);
    
    if (accommodationQuery.rows.length > 0) {
      console.log(`   ✅ This ID appears in accommodation query because:`);
      const record = accommodationQuery.rows[0];
      console.log(`     - Travel Type: ${record.travel_type}`);
      console.log(`     - Status: ${record.status}`);
      console.log(`     - This is correct - it should appear in accommodation only`);
    } else {
      console.log('   ❌ This ID does NOT appear in accommodation query');
    }
    
    console.log('\n🎯 Conclusion:');
    if (travelRequestResult.rows.length > 0) {
      const travelType = travelRequestResult.rows[0].travel_type;
      if (travelType === 'Accommodation') {
        console.log('✅ This is a standalone accommodation request');
        console.log('❌ Problem: It appears in TSR query because TSR query doesn\'t filter by travel_type');
        console.log('💡 Solution: TSR query should exclude travel_type = \'Accommodation\'');
      } else {
        console.log('❌ This is a TSR request with accommodation details');
        console.log('❌ Problem: It appears in accommodation query due to accommodation details');
      }
    }
    
  } catch (error) {
    console.error('❌ Error debugging duplicate accommodation ID:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the function if this file is executed directly
if (require.main === module) {
  debugDuplicateAccommodationId()
    .then(() => {
      console.log('\n✅ Debug completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Debug failed:', error);
      process.exit(1);
    });
}

module.exports = { debugDuplicateAccommodationId };