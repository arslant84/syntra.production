require('dotenv').config({ path: '../.env' });
const { Client } = require('pg');

async function testTrfData(trfId) {
  console.log(`Testing TRF data for: ${trfId}`);
  
  const client = new Client({
    host: process.env.DATABASE_HOST,
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    ssl: false // Disable SSL for localhost
  });
  
  try {
    await client.connect();
    
    // Check main TRF data
    const mainTrfResult = await client.query('SELECT * FROM travel_requests WHERE id = $1', [trfId]);
    console.log('Main TRF data:', mainTrfResult.rows[0]);
    
    // Check itinerary segments
    const itineraryResult = await client.query('SELECT * FROM trf_itinerary_segments WHERE trf_id = $1', [trfId]);
    console.log('Itinerary segments:', itineraryResult.rows);
    
    // Check meal provisions
    const mealProvisionResult = await client.query('SELECT * FROM trf_meal_provisions WHERE trf_id = $1', [trfId]);
    console.log('Meal provision data:', mealProvisionResult.rows);
    
    // Check accommodation details
    const accommodationResult = await client.query('SELECT * FROM trf_accommodation_details WHERE trf_id = $1', [trfId]);
    console.log('Accommodation details:', accommodationResult.rows);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

// Get TRF ID from command line argument
const trfId = process.argv[2];
if (!trfId) {
  console.log('Usage: node test-trf-data.js <TRF_ID>');
  process.exit(1);
}

testTrfData(trfId).then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
}); 