/**
 * Check All Accommodation Data Script
 * This script checks all possible accommodation-related tables and data
 */

const { Pool } = require('pg');
const config = require('./config');

// Database configuration
const pool = new Pool(config.database);

async function checkAllAccommodationData() {
  console.log('🔍 Checking all accommodation-related data...');
  
  try {
    // Check travel_requests table for any accommodation-related entries
    console.log('\n1. Checking travel_requests table:');
    
    const trQuery = await pool.query(`
      SELECT 
        id,
        travel_type,
        requestor_name,
        status,
        submitted_at,
        created_at
      FROM travel_requests 
      WHERE travel_type LIKE '%accommodation%' 
         OR travel_type LIKE '%Accommodation%'
         OR travel_type = 'Accommodation'
      ORDER BY submitted_at DESC
    `);
    
    console.log(`   Found ${trQuery.rows.length} accommodation travel requests:`);
    trQuery.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.id}: ${row.requestor_name} (${row.travel_type} - ${row.status})`);
    });
    
    // Check all travel_requests to see what travel types exist
    const allTypesQuery = await pool.query(`
      SELECT DISTINCT travel_type, COUNT(*) as count
      FROM travel_requests 
      GROUP BY travel_type
      ORDER BY count DESC
    `);
    
    console.log(`\n2. All travel types in travel_requests:`);
    allTypesQuery.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.travel_type || 'NULL'}: ${row.count} requests`);
    });
    
    // Check trf_accommodation_details table
    console.log('\n3. Checking trf_accommodation_details table:');
    
    const tadQuery = await pool.query(`
      SELECT 
        id,
        trf_id,
        location,
        accommodation_type,
        check_in_date,
        check_out_date
      FROM trf_accommodation_details 
      ORDER BY check_in_date DESC
      LIMIT 10
    `);
    
    console.log(`   Found ${tadQuery.rows.length} accommodation details:`);
    tadQuery.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ID: ${row.id}, TRF: ${row.trf_id}, Location: ${row.location}, Type: ${row.accommodation_type}`);
    });
    
    // Check accommodation_bookings table if it exists
    console.log('\n4. Checking accommodation_bookings table:');
    
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'accommodation_bookings'
      ) as exists
    `);
    
    if (tableCheck.rows[0]?.exists) {
      const bookingsQuery = await pool.query(`
        SELECT 
          id,
          purpose,
          status,
          created_at,
          updated_at
        FROM accommodation_bookings 
        ORDER BY created_at DESC
        LIMIT 10
      `);
      
      console.log(`   Found ${bookingsQuery.rows.length} accommodation bookings:`);
      bookingsQuery.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.id}: ${row.purpose} (${row.status})`);
      });
    } else {
      console.log('   accommodation_bookings table does not exist');
    }
    
    // Check for any travel requests that might be accommodation but with different travel_type
    console.log('\n5. Checking for potential accommodation requests with different travel types:');
    
    const potentialAccommodationQuery = await pool.query(`
      SELECT 
        tr.id,
        tr.travel_type,
        tr.requestor_name,
        tr.status,
        tr.submitted_at,
        tad.id as accommodation_detail_id,
        tad.location,
        tad.accommodation_type
      FROM travel_requests tr
      LEFT JOIN trf_accommodation_details tad ON tad.trf_id = tr.id
      WHERE tad.id IS NOT NULL
      ORDER BY tr.submitted_at DESC
      LIMIT 10
    `);
    
    console.log(`   Found ${potentialAccommodationQuery.rows.length} travel requests with accommodation details:`);
    potentialAccommodationQuery.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.id}: ${row.requestor_name} (${row.travel_type} - ${row.status}) - Location: ${row.location}`);
    });
    
    // Check total count of travel requests with accommodation details
    const totalWithAccommodationQuery = await pool.query(`
      SELECT COUNT(DISTINCT tr.id) as total_count
      FROM travel_requests tr
      INNER JOIN trf_accommodation_details tad ON tad.trf_id = tr.id
    `);
    
    const totalWithAccommodation = parseInt(totalWithAccommodationQuery.rows[0]?.total_count || '0');
    console.log(`\n📊 Total travel requests with accommodation details: ${totalWithAccommodation}`);
    
    // Summary
    console.log('\n📋 SUMMARY:');
    console.log(`   Travel requests with 'Accommodation' travel_type: ${trQuery.rows.length}`);
    console.log(`   Total accommodation details: ${tadQuery.rows.length}`);
    console.log(`   Travel requests with accommodation details: ${totalWithAccommodation}`);
    
    if (totalWithAccommodation > 0) {
      console.log('\n💡 INSIGHT:');
      console.log('   The accommodation requests might be stored as regular travel requests');
      console.log('   with accommodation details linked via trf_accommodation_details table.');
      console.log('   The travel_type might not be set to "Accommodation" but they still have');
      console.log('   accommodation details associated with them.');
    }
    
  } catch (error) {
    console.error('💥 Error checking accommodation data:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkAllAccommodationData();
