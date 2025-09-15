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

async function testApprovalQueueAPIs() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🧪 Testing approval queue API data sources...\n');
    
    // Test 1: Check accommodation requests with pending statuses
    console.log('1. Testing accommodation requests for approval queue...');
    const accommodationStatuses = ["Pending Department Focal", "Pending Approval"];
    
    const accommodationQuery = await pool.query(`
      SELECT DISTINCT ON (tr.id)
        tr.id,
        tr.requestor_name as "requestorName",
        tr.status,
        tr.travel_type,
        tr.submitted_at as "submittedDate",
        tad.location,
        tr.additional_comments as "specialRequests"
      FROM 
        trf_accommodation_details tad
      LEFT JOIN 
        travel_requests tr ON tad.trf_id = tr.id
      WHERE
        tr.status = ANY($1)
      ORDER BY 
        tr.id, tr.submitted_at DESC
      LIMIT 10
    `, [accommodationStatuses]);
    
    console.log(`   Found ${accommodationQuery.rows.length} accommodation requests:`);
    for (const row of accommodationQuery.rows) {
      console.log(`     - ${row.id}: ${row.requestorName} (${row.status})`);
    }
    
    // Test 2: Check transport requests with pending statuses
    console.log('\n2. Testing transport requests for approval queue...');
    const transportStatuses = ["Pending Department Focal", "Pending Line Manager", "Pending HOD"];
    
    const transportQuery = await pool.query(`
      SELECT 
        id,
        requestor_name as "requestorName",
        department,
        purpose,
        status,
        created_at as "submittedAt"
      FROM 
        transport_requests
      WHERE
        status = ANY($1)
      ORDER BY 
        created_at DESC
      LIMIT 10
    `, [transportStatuses]);
    
    console.log(`   Found ${transportQuery.rows.length} transport requests:`);
    for (const row of transportQuery.rows) {
      console.log(`     - ${row.id}: ${row.requestorName} (${row.status})`);
    }
    
    // Test 3: Check TSR requests with pending statuses
    console.log('\n3. Testing TSR requests for approval queue...');
    const tsrStatuses = ["Pending Department Focal", "Pending Line Manager", "Pending HOD"];
    
    const tsrQuery = await pool.query(`
      SELECT 
        id,
        requestor_name as "requestorName",
        purpose,
        status,
        submitted_at as "submittedAt",
        travel_type
      FROM 
        travel_requests
      WHERE
        status = ANY($1)
        AND travel_type != 'Accommodation'
      ORDER BY 
        submitted_at DESC
      LIMIT 10
    `, [tsrStatuses]);
    
    console.log(`   Found ${tsrQuery.rows.length} TSR requests:`);
    for (const row of tsrQuery.rows) {
      console.log(`     - ${row.id}: ${row.requestorName} (${row.status}) - ${row.travel_type}`);
    }
    
    // Test 4: Summary
    console.log('\n4. Summary:');
    console.log(`   - Accommodation requests with pending status: ${accommodationQuery.rows.length}`);
    console.log(`   - Transport requests with pending status: ${transportQuery.rows.length}`);
    console.log(`   - TSR requests with pending status: ${tsrQuery.rows.length}`);
    
    if (accommodationQuery.rows.length === 0) {
      console.log('   ❌ No accommodation requests found - this explains why they don\'t appear in approval queue');
    }
    
    if (transportQuery.rows.length === 0) {
      console.log('   ❌ No transport requests found - this explains why they don\'t appear in approval queue');
    }
    
  } catch (error) {
    console.error('❌ Error testing approval queue APIs:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testApprovalQueueAPIs()
    .then(() => {
      console.log('\n✅ Approval queue API test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Approval queue API test failed:', error);
      process.exit(1);
    });
}

module.exports = { testApprovalQueueAPIs };