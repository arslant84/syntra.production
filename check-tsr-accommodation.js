// Simple script to check for TSR-named accommodation requests
const { sql } = require('./src/lib/db.ts');

console.log('Checking for TSR-named accommodation requests...');

try {
  // Check travel_requests table for accommodation type with TSR IDs
  const tsrAccommodation = await sql`
    SELECT id, requestor_name, travel_type, status, submitted_at, purpose
    FROM travel_requests 
    WHERE travel_type = 'Accommodation' 
    AND id LIKE 'TSR%'
    ORDER BY submitted_at DESC
    LIMIT 20
  `;

  console.log(`Found ${tsrAccommodation.length} accommodation requests with TSR naming:`);
  
  if (tsrAccommodation.length > 0) {
    console.table(tsrAccommodation);
    
    // Check if these have accommodation details
    const tsrIds = tsrAccommodation.map(req => req.id);
    const accommodationDetails = await sql`
      SELECT trf_id, location, check_in_date, check_out_date, accommodation_type
      FROM trf_accommodation_details 
      WHERE trf_id = ANY(${tsrIds})
    `;
    
    console.log(`Found ${accommodationDetails.length} accommodation details for these TSR IDs:`);
    if (accommodationDetails.length > 0) {
      console.table(accommodationDetails);
    }
  }
  
  // Also check for properly named ACCOM requests
  const accomRequests = await sql`
    SELECT id, requestor_name, travel_type, status, submitted_at
    FROM travel_requests 
    WHERE travel_type = 'Accommodation' 
    AND id LIKE 'ACCOM%'
    ORDER BY submitted_at DESC
    LIMIT 10
  `;
  
  console.log(`\nFound ${accomRequests.length} properly named ACCOM requests:`);
  if (accomRequests.length > 0) {
    console.table(accomRequests);
  }
  
} catch (error) {
  console.error('Error checking accommodation requests:', error);
} finally {
  process.exit(0);
}