/**
 * Cleanup Orphaned Activities Script
 * This script identifies and reports orphaned activities that reference deleted data
 */

const { Pool } = require('pg');
const config = require('./config');

// Database configuration
const pool = new Pool(config.database);

async function cleanupOrphanedActivities() {
  console.log('🔍 Checking for orphaned activities...');
  
  try {
    // Check for orphaned accommodation requests
    console.log('\n1. Checking for orphaned accommodation requests:');
    
    const orphanedAccommodationQuery = await pool.query(`
      SELECT 
        tr.id,
        tr.requestor_name,
        tr.status,
        tr.updated_at
      FROM travel_requests tr
      LEFT JOIN trf_accommodation_details tad ON tad.trf_id = tr.id
      WHERE tad.id IS NULL
        AND tr.travel_type IN ('Domestic', 'Overseas')
        AND tr.updated_at > NOW() - INTERVAL '30 days'
      ORDER BY tr.updated_at DESC
    `);
    
    console.log(`   Found ${orphanedAccommodationQuery.rows.length} travel requests without accommodation details:`);
    orphanedAccommodationQuery.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.id}: ${row.requestor_name} (${row.status}) - ${row.updated_at}`);
    });
    
    // Check for orphaned accommodation details
    console.log('\n2. Checking for orphaned accommodation details:');
    
    const orphanedDetailsQuery = await pool.query(`
      SELECT 
        tad.id,
        tad.trf_id,
        tad.location,
        tad.accommodation_type
      FROM trf_accommodation_details tad
      LEFT JOIN travel_requests tr ON tad.trf_id = tr.id
      WHERE tr.id IS NULL
      ORDER BY tad.id
    `);
    
    console.log(`   Found ${orphanedDetailsQuery.rows.length} accommodation details without travel requests:`);
    orphanedDetailsQuery.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. Detail ID: ${row.id}, TRF ID: ${row.trf_id}, Location: ${row.location}`);
    });
    
    // Check current valid accommodation requests
    console.log('\n3. Current valid accommodation requests:');
    
    const validAccommodationQuery = await pool.query(`
      SELECT DISTINCT ON (tr.id)
        tr.id,
        tr.requestor_name,
        tr.status,
        tr.updated_at,
        tad.location,
        tad.accommodation_type
      FROM travel_requests tr
      INNER JOIN trf_accommodation_details tad ON tad.trf_id = tr.id
      ORDER BY tr.id, tr.updated_at DESC
    `);
    
    console.log(`   Found ${validAccommodationQuery.rows.length} valid accommodation requests:`);
    validAccommodationQuery.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.id}: ${row.requestor_name} (${row.status}) - ${row.location}`);
    });
    
    // Check for the specific ID mentioned in the error
    console.log('\n4. Checking for specific accommodation request ID:');
    const specificId = '69539bb9-680d-42c3-ac99-5af7474d7247';
    
    const specificQuery = await pool.query(`
      SELECT 
        tr.id,
        tr.requestor_name,
        tr.status,
        tr.updated_at
      FROM travel_requests tr
      WHERE tr.id = $1
    `, [specificId]);
    
    if (specificQuery.rows.length > 0) {
      console.log(`   ✅ Found travel request: ${specificQuery.rows[0].id} - ${specificQuery.rows[0].requestor_name}`);
      
      // Check if it has accommodation details
      const accommodationDetailsQuery = await pool.query(`
        SELECT 
          tad.id,
          tad.location,
          tad.accommodation_type
        FROM trf_accommodation_details tad
        WHERE tad.trf_id = $1
      `, [specificId]);
      
      if (accommodationDetailsQuery.rows.length > 0) {
        console.log(`   ✅ Has accommodation details: ${accommodationDetailsQuery.rows.length} records`);
      } else {
        console.log(`   ❌ No accommodation details found`);
      }
    } else {
      console.log(`   ❌ Travel request ${specificId} not found`);
    }
    
    // Summary and recommendations
    console.log('\n📊 SUMMARY:');
    console.log(`   Valid accommodation requests: ${validAccommodationQuery.rows.length}`);
    console.log(`   Orphaned travel requests: ${orphanedAccommodationQuery.rows.length}`);
    console.log(`   Orphaned accommodation details: ${orphanedDetailsQuery.rows.length}`);
    
    if (orphanedAccommodationQuery.rows.length > 0 || orphanedDetailsQuery.rows.length > 0) {
      console.log('\n⚠️  RECOMMENDATIONS:');
      console.log('   1. Clean up orphaned accommodation details');
      console.log('   2. Update or remove orphaned travel requests');
      console.log('   3. Verify recent activity links work correctly');
    } else {
      console.log('\n✅ No orphaned data found');
    }
    
  } catch (error) {
    console.error('💥 Error checking orphaned activities:', error);
  } finally {
    await pool.end();
  }
}

// Run the cleanup check
cleanupOrphanedActivities();
