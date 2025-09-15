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

async function testReactKeys() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🧪 Testing React key issues comprehensively...');
    
    // Test all accommodation API endpoints that could be causing duplicate keys
    
    console.log('\n1. Testing /api/accommodation/requests (main endpoint)...');
    
    const mainQuery = await pool.query(`
      SELECT DISTINCT ON (tr.id)
        tr.id,
        CASE 
          WHEN tr.travel_type = 'Accommodation' THEN NULL 
          ELSE tr.id 
        END as "trfId",
        tr.requestor_name as "requestorName",
        tr.travel_type,
        tr.status,
        tad.location
      FROM 
        trf_accommodation_details tad
      LEFT JOIN 
        travel_requests tr ON tad.trf_id = tr.id
      ORDER BY 
        tr.id, tr.submitted_at DESC
      LIMIT 50
    `);
    
    console.log(`Main endpoint would return ${mainQuery.rows.length} records:`);
    const mainIds = mainQuery.rows.map(r => r.id);
    const mainDupes = mainIds.filter((id, index) => mainIds.indexOf(id) !== index);
    
    if (mainDupes.length > 0) {
      console.log(`❌ DUPLICATES in main endpoint: ${[...new Set(mainDupes)].join(', ')}`);
    } else {
      console.log('✅ No duplicates in main endpoint');
    }
    
    // Show sample data
    console.log('Sample records:');
    for (let i = 0; i < Math.min(3, mainQuery.rows.length); i++) {
      const r = mainQuery.rows[i];
      console.log(`  ${i + 1}. ${r.id} (${r.travel_type}) - TSR Ref: ${r.trfId || 'NULL'}`);
    }
    
    console.log('\n2. Testing /api/trf/pending-accommodation...');
    
    const pendingQuery = await pool.query(`
      SELECT 
        tad.id as "accommodationId",
        tad.trf_id as "trfId", 
        tr.id,
        tr.requestor_name as "requestorName",
        tr.status
      FROM 
        trf_accommodation_details tad
      JOIN 
        travel_requests tr ON tad.trf_id = tr.id
      LEFT JOIN 
        accommodation_bookings ab ON ab.trf_id = tr.id
      WHERE 
        tr.status IN ('Approved', 'Pending')
        AND ab.id IS NULL
      ORDER BY 
        tad.created_at DESC
    `);
    
    console.log(`Pending accommodation endpoint would return ${pendingQuery.rows.length} records:`);
    const pendingIds = pendingQuery.rows.map(r => r.id);
    const pendingDupes = pendingIds.filter((id, index) => pendingIds.indexOf(id) !== index);
    
    if (pendingDupes.length > 0) {
      console.log(`❌ DUPLICATES in pending endpoint: ${[...new Set(pendingDupes)].join(', ')}`);
    } else {
      console.log('✅ No duplicates in pending endpoint');
    }
    
    console.log('\n3. Checking for records that appear in multiple queries...');
    
    const mainIdSet = new Set(mainIds);
    const pendingIdSet = new Set(pendingIds);
    const overlap = mainIds.filter(id => pendingIdSet.has(id));
    
    if (overlap.length > 0) {
      console.log(`ℹ️  Records appearing in both endpoints: ${[...new Set(overlap)].join(', ')}`);
      console.log('   This could cause issues if frontend combines the arrays');
    } else {
      console.log('✅ No overlap between main and pending endpoints');
    }
    
    console.log('\n4. Simulating frontend array combination (like admin pages might do)...');
    
    // Simulate what might happen if frontend combines arrays
    const combinedArray = [...mainQuery.rows, ...pendingQuery.rows];
    const combinedIds = combinedArray.map(r => r.id);
    const combinedDupes = combinedIds.filter((id, index) => combinedIds.indexOf(id) !== index);
    
    if (combinedDupes.length > 0) {
      console.log(`❌ DUPLICATES when combining arrays: ${[...new Set(combinedDupes)].join(', ')}`);
      console.log('   This would cause React key errors!');
    } else {
      console.log('✅ No duplicates when combining arrays');
    }
    
    console.log('\n5. Checking specific problematic IDs...');
    
    const problematicIds = [
      'ACCOM-20250807-0919-ASHGA-ZMQ5',
      'TSR-20250724-1002-ASH-42MC', 
      'TSR-20250724-1002-ASH-RQQG',
      'TSR-20250630-1154-NEW-2GR9'
    ];
    
    for (const id of problematicIds) {
      const count = await pool.query(`
        SELECT COUNT(*) as count
        FROM trf_accommodation_details tad
        LEFT JOIN travel_requests tr ON tad.trf_id = tr.id
        WHERE tr.id = $1
      `, [id]);
      
      const accomCount = parseInt(count.rows[0].count);
      
      if (accomCount > 1) {
        console.log(`⚠️  ${id}: ${accomCount} accommodation detail records (potential for duplicates)`);
      } else if (accomCount === 1) {
        console.log(`✅ ${id}: ${accomCount} accommodation detail record`);
      } else {
        console.log(`❓ ${id}: Not found in accommodation data`);
      }
    }
    
    console.log('\n6. Final recommendation...');
    
    if (mainDupes.length === 0 && pendingDupes.length === 0 && combinedDupes.length === 0) {
      console.log('🎉 No database-level duplicates found.');
      console.log('The React key errors might be caused by:');
      console.log('   - Multiple useEffect calls');
      console.log('   - State not being cleared properly');
      console.log('   - Component re-mounting');
      console.log('   - Hot reloading during development');
    } else {
      console.log('❌ Database-level duplicates found - these need to be fixed.');
    }
    
  } catch (error) {
    console.error('❌ Error testing React keys:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testReactKeys()
    .then(() => {
      console.log('\n✅ React key test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 React key test failed:', error);
      process.exit(1);
    });
}

module.exports = { testReactKeys };