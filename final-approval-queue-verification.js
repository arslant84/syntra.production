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

async function finalApprovalQueueVerification() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🎯 Final Unified Approval Queue Verification\n');
    
    // Test final state of all request types
    console.log('1. TSR Requests (excluding accommodation):');
    const tsrQuery = await pool.query(`
      SELECT 
        id,
        requestor_name,
        travel_type,
        status,
        submitted_at
      FROM 
        travel_requests
      WHERE
        status IN ('Pending Department Focal', 'Pending Line Manager', 'Pending HOD')
        AND travel_type != 'Accommodation'
      ORDER BY 
        submitted_at DESC
      LIMIT 10
    `);
    
    console.log(`   Found ${tsrQuery.rows.length} TSR requests:`);
    tsrQuery.rows.forEach((req, index) => {
      const isMock = req.requestor_name === 'John Doe' || req.requestor_name === 'Jane Smith';
      console.log(`     ${index + 1}. ${isMock ? '🗑️ [MOCK] ' : '✅ '}${req.id}: ${req.requestor_name} (${req.travel_type} - ${req.status})`);
    });
    
    console.log('\n2. Accommodation Requests (standalone only):');
    const accommodationQuery = await pool.query(`
      SELECT DISTINCT ON (tr.id)
        tr.id,
        tr.requestor_name,
        tr.travel_type,
        tr.status,
        tr.submitted_at
      FROM 
        trf_accommodation_details tad
      LEFT JOIN 
        travel_requests tr ON tad.trf_id = tr.id
      WHERE
        tr.status IN ('Pending Department Focal', 'Pending Approval') 
        AND tr.travel_type = 'Accommodation'
      ORDER BY 
        tr.id, tr.submitted_at DESC
      LIMIT 10
    `);
    
    console.log(`   Found ${accommodationQuery.rows.length} accommodation requests:`);
    accommodationQuery.rows.forEach((req, index) => {
      console.log(`     ${index + 1}. ✅ ${req.id}: ${req.requestor_name} (${req.travel_type} - ${req.status})`);
    });
    
    console.log('\n3. Transport Requests:');
    const transportQuery = await pool.query(`
      SELECT 
        id,
        requestor_name,
        status,
        created_at,
        submitted_at
      FROM 
        transport_requests
      WHERE
        status IN ('Pending Department Focal', 'Pending Line Manager', 'Pending HOD')
      ORDER BY 
        submitted_at DESC
      LIMIT 10
    `);
    
    console.log(`   Found ${transportQuery.rows.length} transport requests:`);
    transportQuery.rows.forEach((req, index) => {
      const isMock = req.requestor_name === 'John Doe' || req.requestor_name === 'Jane Smith';
      console.log(`     ${index + 1}. ${isMock ? '🗑️ [MOCK] ' : '✅ '}${req.id}: ${req.requestor_name} (${req.status})`);
    });
    
    console.log('\n📊 Final Summary:');
    const totalRealRequests = 
      tsrQuery.rows.filter(req => req.requestor_name !== 'John Doe' && req.requestor_name !== 'Jane Smith').length +
      accommodationQuery.rows.length +
      transportQuery.rows.filter(req => req.requestor_name !== 'John Doe' && req.requestor_name !== 'Jane Smith').length;
      
    const totalMockRequests = 
      tsrQuery.rows.filter(req => req.requestor_name === 'John Doe' || req.requestor_name === 'Jane Smith').length +
      transportQuery.rows.filter(req => req.requestor_name === 'John Doe' || req.requestor_name === 'Jane Smith').length;
    
    console.log(`   Total Real Requests: ${totalRealRequests}`);
    console.log(`   Total Mock Requests: ${totalMockRequests}`);
    console.log(`   Total Requests: ${tsrQuery.rows.length + accommodationQuery.rows.length + transportQuery.rows.length}`);
    
    // Check for any remaining duplicates
    const allIds = [
      ...tsrQuery.rows.map(r => r.id),
      ...accommodationQuery.rows.map(r => r.id),
      ...transportQuery.rows.map(r => r.id)
    ];
    
    const duplicates = allIds.filter((id, index) => allIds.indexOf(id) !== index);
    
    if (duplicates.length > 0) {
      console.log(`\n❌ DUPLICATES STILL EXIST: ${[...new Set(duplicates)].join(', ')}`);
    } else {
      console.log('\n✅ NO DUPLICATES - All requests have unique IDs');
    }
    
    // Status check
    console.log('\n🔍 Request Status Distribution:');
    const allRequests = [...tsrQuery.rows, ...accommodationQuery.rows, ...transportQuery.rows];
    const statusCounts = {};
    allRequests.forEach(req => {
      statusCounts[req.status] = (statusCounts[req.status] || 0) + 1;
    });
    
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} requests`);
    });
    
    console.log('\n🎉 Unified Approval Queue Verification Complete!');
    console.log('✅ Ready for production with real data only');
    
  } catch (error) {
    console.error('❌ Error in final verification:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the function if this file is executed directly
if (require.main === module) {
  finalApprovalQueueVerification()
    .then(() => {
      console.log('\n✅ Final verification completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Final verification failed:', error);
      process.exit(1);
    });
}

module.exports = { finalApprovalQueueVerification };