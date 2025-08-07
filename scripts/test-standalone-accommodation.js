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

async function testStandaloneAccommodation() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🧪 Testing standalone accommodation requests for approval queue...');
    
    const accommodationStatuses = ['Pending Department Focal', 'Pending Approval'];
    
    const result = await pool.query(`
      SELECT DISTINCT ON (tr.id)
        tr.id,
        NULL as "trfId",
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
        AND tr.travel_type = 'Accommodation'
      ORDER BY 
        tr.id, tr.submitted_at DESC
      LIMIT 10
    `, [accommodationStatuses]);
    
    console.log(`   Found ${result.rows.length} standalone accommodation requests:`);
    for (const row of result.rows) {
      console.log(`     - ${row.id}: ${row.requestorName} (${row.status}) - ${row.travel_type}`);
    }
    
    if (result.rows.length > 0) {
      console.log('   ✅ These should now appear in the unified approval queue under Accommodation');
    } else {
      console.log('   ❌ No standalone accommodation requests found');
    }
    
  } catch (error) {
    console.error('❌ Error testing standalone accommodation:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testStandaloneAccommodation()
    .then(() => {
      console.log('\\n✅ Standalone accommodation test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\\n💥 Standalone accommodation test failed:', error);
      process.exit(1);
    });
}

module.exports = { testStandaloneAccommodation };