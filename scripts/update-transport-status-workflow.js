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

async function updateTransportStatusWorkflow() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🚗 Updating transport request status workflow...\n');
    
    // Step 1: Check if submitted_at column exists
    console.log('1. Checking transport_requests table schema...');
    const columnCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'transport_requests' 
      AND column_name = 'submitted_at'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('   Adding submitted_at column to transport_requests table...');
      await pool.query(`
        ALTER TABLE transport_requests 
        ADD COLUMN submitted_at TIMESTAMPTZ DEFAULT NOW()
      `);
      console.log('   ✅ submitted_at column added successfully');
    } else {
      console.log('   ✅ submitted_at column already exists');
    }
    
    // Step 2: Check existing transport requests
    console.log('\n2. Checking existing transport requests...');
    const existingRequests = await pool.query(`
      SELECT id, requestor_name, status, created_at, submitted_at 
      FROM transport_requests 
      ORDER BY created_at DESC
    `);
    
    console.log(`   Found ${existingRequests.rows.length} transport requests:`);
    for (const req of existingRequests.rows) {
      console.log(`     - ${req.id}: ${req.requestor_name} (${req.status})`);
    }
    
    // Step 3: Update Draft status to Pending Department Focal
    console.log('\n3. Updating transport request statuses...');
    const draftRequests = existingRequests.rows.filter(req => req.status === 'Draft');
    
    if (draftRequests.length > 0) {
      console.log(`   Found ${draftRequests.length} requests with Draft status, updating to 'Pending Department Focal'...`);
      
      for (const req of draftRequests) {
        await pool.query(`
          UPDATE transport_requests 
          SET 
            status = 'Pending Department Focal',
            submitted_at = COALESCE(submitted_at, created_at),
            updated_at = NOW()
          WHERE id = $1
        `, [req.id]);
        
        console.log(`     ✅ Updated ${req.id}: ${req.requestor_name} -> Pending Department Focal`);
      }
    } else {
      console.log('   ✅ No Draft requests found - all requests already have proper status');
    }
    
    // Step 4: Ensure submitted_at is set for all requests
    console.log('\n4. Ensuring all requests have submitted_at timestamp...');
    const updateResult = await pool.query(`
      UPDATE transport_requests 
      SET submitted_at = created_at 
      WHERE submitted_at IS NULL
    `);
    
    if (updateResult.rowCount > 0) {
      console.log(`   ✅ Updated submitted_at for ${updateResult.rowCount} requests`);
    } else {
      console.log('   ✅ All requests already have submitted_at timestamp');
    }
    
    // Step 5: Show final status
    console.log('\n5. Final transport request status:');
    const finalStatus = await pool.query(`
      SELECT 
        id, 
        requestor_name, 
        status, 
        created_at,
        submitted_at
      FROM transport_requests 
      ORDER BY submitted_at DESC
    `);
    
    console.log(`   Total: ${finalStatus.rows.length} transport requests`);
    const statusCounts = {};
    for (const req of finalStatus.rows) {
      statusCounts[req.status] = (statusCounts[req.status] || 0) + 1;
      console.log(`     - ${req.id}: ${req.requestor_name} (${req.status}) - Submitted: ${req.submitted_at?.toISOString?.() || req.submitted_at}`);
    }
    
    console.log('\n   Status Summary:');
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`     ${status}: ${count} requests`);
    }
    
    console.log('\n🎉 Transport status workflow update completed!');
    console.log('Now all transport requests should appear in the approval queue.');
    
  } catch (error) {
    console.error('❌ Error updating transport status workflow:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the function if this file is executed directly
if (require.main === module) {
  updateTransportStatusWorkflow()
    .then(() => {
      console.log('\n✅ Transport status workflow update completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Transport status workflow update failed:', error);
      process.exit(1);
    });
}

module.exports = { updateTransportStatusWorkflow };