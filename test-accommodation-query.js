const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra', 
  user: 'postgres',
  password: '221202'
});

async function testAccommodationQuery() {
  try {
    await client.connect();
    
    console.log('Testing accommodation query...');
    
    // Test the main query that the API uses
    const result = await client.query(`
      SELECT 
        tr.id, 
        tr.requestor_name AS "requestorName", 
        tr.staff_id AS "staffId",
        tr.department,
        tr.status, 
        tr.submitted_at AS "submittedAt",
        tr.purpose,
        ad.accommodation_type AS "accommodationType",
        ad.check_in_date AS "checkInDate",
        ad.check_out_date AS "checkOutDate",
        ad.location,
        ad.check_in_time AS "checkInTime",
        ad.check_out_time AS "checkOutTime",
        ad.place_of_stay AS "placeOfStay",
        ad.estimated_cost_per_night AS "estimatedCostPerNight",
        ad.remarks
      FROM travel_requests tr
      LEFT JOIN trf_accommodation_details ad ON tr.id = ad.trf_id
      WHERE ad.trf_id IS NOT NULL
      ORDER BY tr.submitted_at DESC
      LIMIT 10
    `);
    
    console.log(`Query returned ${result.rows.length} accommodation requests:`);
    result.rows.forEach(row => {
      console.log(`- ${row.id}: ${row.requestorName} - ${row.status} - ${row.accommodationType || 'No type'}`);
    });
    
    // Test if we can access accommodation booking tables
    try {
      const bookingTest = await client.query(`
        SELECT ab.trf_id, COUNT(*) as booking_count
        FROM accommodation_bookings ab
        GROUP BY ab.trf_id
        LIMIT 5
      `);
      console.log(`\nFound ${bookingTest.rows.length} TRFs with accommodation bookings`);
    } catch (bookingError) {
      console.log('\nNo accommodation bookings found or table issue:', bookingError.message);
    }
    
  } catch (error) {
    console.error('Query error:', error.message);
  } finally {
    await client.end();
  }
}

testAccommodationQuery();