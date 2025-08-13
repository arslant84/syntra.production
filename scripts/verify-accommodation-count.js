/**
 * Verify Accommodation Count Script
 * This script checks the actual accommodation requests count and identifies duplicates
 */

const { Pool } = require('pg');
const config = require('./config');

// Database configuration
const pool = new Pool(config.database);

async function verifyAccommodationCount() {
  console.log('🔍 Verifying accommodation count...');
  
  try {
    // Check total accommodation requests
    const totalQuery = await pool.query(`
      SELECT COUNT(*) as total_count
      FROM travel_requests 
      WHERE travel_type = 'Accommodation'
    `);
    
    const totalCount = parseInt(totalQuery.rows[0]?.total_count || '0');
    console.log(`📊 Total accommodation requests: ${totalCount}`);
    
    // Check for unique accommodation requests
    const uniqueQuery = await pool.query(`
      SELECT COUNT(DISTINCT tr.id) as unique_count
      FROM travel_requests tr
      LEFT JOIN trf_accommodation_details tad ON tad.trf_id = tr.id
      WHERE tr.travel_type = 'Accommodation'
        AND tr.id IS NOT NULL
    `);
    
    const uniqueCount = parseInt(uniqueQuery.rows[0]?.unique_count || '0');
    console.log(`🔢 Unique accommodation requests: ${uniqueCount}`);
    
    // Check for potential duplicates in trf_accommodation_details
    const duplicateQuery = await pool.query(`
      SELECT 
        trf_id,
        COUNT(*) as detail_count
      FROM trf_accommodation_details 
      GROUP BY trf_id 
      HAVING COUNT(*) > 1
      ORDER BY detail_count DESC
    `);
    
    console.log(`\n🔍 Duplicate accommodation details found: ${duplicateQuery.rows.length}`);
    
    if (duplicateQuery.rows.length > 0) {
      console.log('\n📋 Duplicate entries:');
      duplicateQuery.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. TRF ID: ${row.trf_id} - ${row.detail_count} detail records`);
      });
    }
    
    // Get sample of accommodation requests
    const sampleQuery = await pool.query(`
      SELECT 
        tr.id,
        tr.requestor_name,
        tr.status,
        tr.travel_type,
        tr.submitted_at,
        COUNT(tad.id) as detail_count
      FROM travel_requests tr
      LEFT JOIN trf_accommodation_details tad ON tad.trf_id = tr.id
      WHERE tr.travel_type = 'Accommodation'
      GROUP BY tr.id, tr.requestor_name, tr.status, tr.travel_type, tr.submitted_at
      ORDER BY tr.submitted_at DESC
      LIMIT 10
    `);
    
    console.log(`\n📋 Sample accommodation requests:`);
    sampleQuery.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.id}: ${row.requestor_name} (${row.status}) - ${row.detail_count} details`);
    });
    
    // Check if there are any orphaned accommodation details
    const orphanedQuery = await pool.query(`
      SELECT COUNT(*) as orphaned_count
      FROM trf_accommodation_details tad
      LEFT JOIN travel_requests tr ON tad.trf_id = tr.id
      WHERE tr.id IS NULL
    `);
    
    const orphanedCount = parseInt(orphanedQuery.rows[0]?.orphaned_count || '0');
    console.log(`\n⚠️  Orphaned accommodation details: ${orphanedCount}`);
    
    // Summary
    console.log('\n📊 SUMMARY:');
    console.log(`   Total accommodation requests: ${totalCount}`);
    console.log(`   Unique accommodation requests: ${uniqueCount}`);
    console.log(`   Duplicate detail records: ${duplicateQuery.rows.length}`);
    console.log(`   Orphaned detail records: ${orphanedCount}`);
    
    if (totalCount !== uniqueCount) {
      console.log('\n⚠️  WARNING: Count mismatch detected!');
      console.log('   This could be due to:');
      console.log('   - Multiple accommodation detail records per TRF');
      console.log('   - Orphaned accommodation detail records');
      console.log('   - Data integrity issues');
    } else {
      console.log('\n✅ Count verification passed!');
    }
    
  } catch (error) {
    console.error('💥 Error verifying accommodation count:', error);
  } finally {
    await pool.end();
  }
}

// Run the verification
verifyAccommodationCount();
