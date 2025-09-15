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

async function testAdminApprovalsAPICalls() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🔍 Testing admin approvals API calls exactly as the frontend does...\n');
    
    // Test 1: TSR requests (excluding Accommodation travel_type)
    console.log('1. Testing TSR requests API call (excluding Accommodation)...');
    const trfStatuses = ["Pending Department Focal", "Pending Line Manager", "Pending HOD"];
    console.log(`   Fetching TSRs with statuses: ${trfStatuses.join(', ')}`);
    
    const tsrQuery = await pool.query(`
      SELECT 
        id,
        requestor_name as "requestorName",
        purpose,
        status,
        submitted_at as "submittedAt",
        travel_type as "travelType"
      FROM 
        travel_requests
      WHERE
        status = ANY($1)
        AND travel_type != 'Accommodation'
      ORDER BY 
        submitted_at DESC
      LIMIT 50
    `, [trfStatuses]);
    
    console.log(`   ✅ Found ${tsrQuery.rows.length} TSR requests`);
    
    // Test 2: Accommodation requests (as the API does it)
    console.log('\n2. Testing Accommodation requests API call...');
    const accommodationStatuses = ["Pending Department Focal", "Pending Approval"];
    console.log(`   Fetching Accommodation with statuses: ${accommodationStatuses.join(', ')}`);
    
    // This mimics the accommodation API with status filter
    const accommodationQuery = await pool.query(`
      SELECT DISTINCT ON (tr.id)
        tr.id,
        NULL as "trfId",
        tr.requestor_name as "requestorName",
        tr.staff_id as "requestorId",
        'Male' as "requestorGender", 
        tr.department,
        tad.location,
        tad.check_in_date as "requestedCheckInDate",
        tad.check_out_date as "requestedCheckOutDate",
        tad.accommodation_type as "requestedRoomType",
        tr.status,
        NULL as "assignedRoomName",
        NULL as "assignedStaffHouseName",
        tr.submitted_at as "submittedDate",
        tr.updated_at as "lastUpdatedDate",
        tr.additional_comments as "specialRequests"
      FROM 
        trf_accommodation_details tad
      LEFT JOIN 
        travel_requests tr ON tad.trf_id = tr.id
      WHERE
        (tr.status = ANY($1)) AND tr.travel_type = 'Accommodation'
      ORDER BY 
        tr.id, tr.submitted_at DESC
      LIMIT 50
    `, [accommodationStatuses]);
    
    console.log(`   ✅ Found ${accommodationQuery.rows.length} accommodation requests`);
    for (const req of accommodationQuery.rows) {
      console.log(`     - ${req.id}: ${req.requestorName} (${req.status}) - ${req.travel_type || 'N/A'}`);
    }
    
    // Test 3: Transport requests
    console.log('\n3. Testing Transport requests API call...');
    const transportStatuses = ["Pending Department Focal", "Pending Line Manager", "Pending HOD"];
    console.log(`   Fetching Transport with statuses: ${transportStatuses.join(', ')}`);
    
    const transportQuery = await pool.query(`
      SELECT 
        id,
        requestor_name as "requestorName",
        department,
        purpose,
        status,
        created_at as "submittedAt",
        tsr_reference as "tsrReference"
      FROM transport_requests
      WHERE status = ANY($1)
      ORDER BY created_at DESC
      LIMIT 50
    `, [transportStatuses]);
    
    console.log(`   ✅ Found ${transportQuery.rows.length} transport requests`);
    for (const req of transportQuery.rows) {
      console.log(`     - ${req.id}: ${req.requestorName} (${req.status})`);
    }
    
    // Test 4: Check for duplicate IDs across different request types
    console.log('\n4. Checking for duplicate IDs across request types...');
    const allIds = [
      ...tsrQuery.rows.map(r => r.id),
      ...accommodationQuery.rows.map(r => r.id), 
      ...transportQuery.rows.map(r => r.id)
    ];
    
    const duplicateIds = allIds.filter((id, index) => allIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      console.log(`   ❌ Found duplicate IDs: ${[...new Set(duplicateIds)].join(', ')}`);
      console.log('   This would cause duplicates in the approval queue!');
    } else {
      console.log('   ✅ No duplicate IDs found across request types');
    }
    
    console.log('\n📊 Summary:');
    console.log(`   TSR requests: ${tsrQuery.rows.length}`);
    console.log(`   Accommodation requests: ${accommodationQuery.rows.length}`);
    console.log(`   Transport requests: ${transportQuery.rows.length}`);
    console.log(`   Total items for approval queue: ${tsrQuery.rows.length + accommodationQuery.rows.length + transportQuery.rows.length}`);
    
  } catch (error) {
    console.error('❌ Error testing admin approvals API calls:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the function if this file is executed directly
if (require.main === module) {
  testAdminApprovalsAPICalls()
    .then(() => {
      console.log('\n✅ Admin approvals API calls test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Admin approvals API calls test failed:', error);
      process.exit(1);
    });
}

module.exports = { testAdminApprovalsAPICalls };