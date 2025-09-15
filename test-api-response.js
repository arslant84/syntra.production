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

async function testApiResponse() {
  console.log('🧪 Testing API response for duplicates...');
  
  // Test the exact queries that the API endpoints use
  const pool = new Pool(dbConfig);
  
  try {
    // Test 1: Direct database query (like the API does)
    console.log('\n1. Testing direct database query (similar to API)...');
    
    const query = await pool.query(`
      SELECT DISTINCT ON (tr.id)
        tr.id,
        CASE 
          WHEN tr.travel_type = 'Accommodation' THEN NULL 
          ELSE tr.id 
        END as "trfId",
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
        tr.additional_comments as "specialRequests",
        tad.check_in_time as "flightArrivalTime",
        tad.check_out_time as "flightDepartureTime"
      FROM 
        trf_accommodation_details tad
      LEFT JOIN 
        travel_requests tr ON tad.trf_id = tr.id
      ORDER BY 
        tr.id, tr.submitted_at DESC
      LIMIT 50
    `);
    
    console.log(`Query returned ${query.rows.length} rows`);
    
    // Check for duplicates  
    const idCounts = {};
    const duplicates = [];
    
    for (const row of query.rows) {
      idCounts[row.id] = (idCounts[row.id] || 0) + 1;
      if (idCounts[row.id] > 1) {
        duplicates.push(row.id);
      }
    }
    
    if (duplicates.length > 0) {
      console.log(`❌ Found ${duplicates.length} duplicate IDs in database query:`);
      for (const id of [...new Set(duplicates)]) {
        console.log(`   - ${id}: ${idCounts[id]} times`);
      }
    } else {
      console.log('✅ No duplicates in database query');
    }
    
    // Test 2: Simulate what happens when the data gets to the frontend
    console.log('\n2. Simulating frontend data processing...');
    
    // This simulates what the frontend receives
    const accommodationRequests = query.rows.map(req => ({
      ...req,
      requestedCheckInDate: req.requestedCheckInDate ? new Date(req.requestedCheckInDate).toISOString() : null,
      requestedCheckOutDate: req.requestedCheckOutDate ? new Date(req.requestedCheckOutDate).toISOString() : null,
      submittedDate: req.submittedDate ? new Date(req.submittedDate).toISOString() : null,
      lastUpdatedDate: req.lastUpdatedDate ? new Date(req.lastUpdatedDate).toISOString() : null,
    }));
    
    console.log(`Frontend receives ${accommodationRequests.length} records`);
    
    // Check for duplicates in frontend data
    const frontendIdCounts = {};
    const frontendDuplicates = [];
    
    for (const req of accommodationRequests) {
      frontendIdCounts[req.id] = (frontendIdCounts[req.id] || 0) + 1;
      if (frontendIdCounts[req.id] > 1) {
        frontendDuplicates.push(req.id);
      }
    }
    
    if (frontendDuplicates.length > 0) {
      console.log(`❌ Found ${frontendDuplicates.length} duplicate IDs in frontend data:`);
      for (const id of [...new Set(frontendDuplicates)]) {
        console.log(`   - ${id}: ${frontendIdCounts[id]} times`);
      }
    } else {
      console.log('✅ No duplicates in frontend data');
    }
    
    // Test 3: Show some sample records
    console.log('\n3. Sample records:');
    for (let i = 0; i < Math.min(5, accommodationRequests.length); i++) {
      const req = accommodationRequests[i];
      console.log(`   ${i + 1}. ID: ${req.id}, Location: ${req.location}, Status: ${req.status}`);
    }
    
    // Test 4: Check if there might be multiple sources of data
    console.log('\n4. Checking if there are multiple data sources...');
    
    // Check if there are accommodation requests coming from different tables/sources
    const allTravelRequests = await pool.query(`
      SELECT tr.id, tr.travel_type, COUNT(tad.id) as accom_count
      FROM travel_requests tr
      INNER JOIN trf_accommodation_details tad ON tr.id = tad.trf_id
      GROUP BY tr.id, tr.travel_type
      ORDER BY tr.id
    `);
    
    console.log(`Found ${allTravelRequests.rows.length} travel requests with accommodation:`);
    let multiAccomCount = 0;
    for (const tr of allTravelRequests.rows) {
      if (tr.accom_count > 1) {
        console.log(`   ⚠️  ${tr.id} (${tr.travel_type}): ${tr.accom_count} accommodation records`);
        multiAccomCount++;
      }
    }
    
    if (multiAccomCount === 0) {
      console.log('   ✅ All travel requests have only 1 accommodation record each');
    } else {
      console.log(`   ❌ ${multiAccomCount} travel requests have multiple accommodation records`);
    }
    
  } catch (error) {
    console.error('❌ Error testing API response:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testApiResponse()
    .then(() => {
      console.log('\n✅ API response test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 API response test failed:', error);
      process.exit(1);
    });
}

module.exports = { testApiResponse };