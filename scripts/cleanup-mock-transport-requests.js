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

async function cleanupMockTransportRequests() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🧹 Cleaning up mock transport requests...\n');
    
    // Step 1: List all transport requests
    console.log('1. Current transport requests:');
    const allRequests = await pool.query(`
      SELECT id, requestor_name, purpose, status, created_at
      FROM transport_requests 
      ORDER BY created_at DESC
    `);
    
    console.log(`   Found ${allRequests.rows.length} transport requests:`);
    for (const req of allRequests.rows) {
      const isMock = req.id.includes('TEST') || req.requestor_name === 'John Doe' || req.requestor_name === 'Jane Smith';
      console.log(`     ${isMock ? '🗑️ ' : '📋 '} ${req.id}: ${req.requestor_name} (${req.status}) ${isMock ? '[MOCK]' : ''}`);
    }
    
    // Step 2: Delete mock transport requests
    console.log('\n2. Deleting mock transport requests...');
    const mockRequestIds = allRequests.rows
      .filter(req => req.id.includes('TEST') || req.requestor_name === 'John Doe' || req.requestor_name === 'Jane Smith')
      .map(req => req.id);
    
    if (mockRequestIds.length > 0) {
      console.log(`   Deleting ${mockRequestIds.length} mock requests: ${mockRequestIds.join(', ')}`);
      
      // Delete transport details first (due to foreign key)
      const detailsDeleteResult = await pool.query(`
        DELETE FROM transport_details 
        WHERE transport_request_id = ANY($1)
      `, [mockRequestIds]);
      console.log(`     ✅ Deleted ${detailsDeleteResult.rowCount} transport details`);
      
      // Delete approval steps
      const stepsDeleteResult = await pool.query(`
        DELETE FROM transport_approval_steps 
        WHERE transport_request_id = ANY($1)
      `, [mockRequestIds]);
      console.log(`     ✅ Deleted ${stepsDeleteResult.rowCount} approval steps`);
      
      // Delete main transport requests
      const requestsDeleteResult = await pool.query(`
        DELETE FROM transport_requests 
        WHERE id = ANY($1)
      `, [mockRequestIds]);
      console.log(`     ✅ Deleted ${requestsDeleteResult.rowCount} transport requests`);
      
    } else {
      console.log('   ✅ No mock requests found to delete');
    }
    
    // Step 3: Show remaining transport requests
    console.log('\n3. Remaining transport requests:');
    const remainingRequests = await pool.query(`
      SELECT id, requestor_name, purpose, status, created_at, submitted_at
      FROM transport_requests 
      ORDER BY submitted_at DESC
    `);
    
    if (remainingRequests.rows.length > 0) {
      console.log(`   Found ${remainingRequests.rows.length} real transport requests:`);
      for (const req of remainingRequests.rows) {
        console.log(`     ✅ ${req.id}: ${req.requestor_name} (${req.status})`);
      }
    } else {
      console.log('   No transport requests remaining');
    }
    
    console.log('\n🎉 Mock transport request cleanup completed!');
    
  } catch (error) {
    console.error('❌ Error cleaning up mock transport requests:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the function if this file is executed directly
if (require.main === module) {
  cleanupMockTransportRequests()
    .then(() => {
      console.log('\n✅ Mock transport request cleanup completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Mock transport request cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupMockTransportRequests };