require('dotenv').config();
const postgres = require('postgres');

// Simple ID generator function
function generateAccommodationId() {
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15);
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ACCOM-${timestamp}-KIYAN-${randomSuffix}`;
}

async function manuallyGenerateAccommodationRequest() {
  console.log('Starting manual accommodation request generation...');
  
  // Load environment variables
  const {
    DATABASE_HOST,
    DATABASE_NAME,
    DATABASE_USER,
    DATABASE_PASSWORD,
  } = process.env;

  // Initialize PostgreSQL client
  const sql = postgres({
    host: DATABASE_HOST,
    database: DATABASE_NAME,
    username: DATABASE_USER,
    password: DATABASE_PASSWORD,
    ssl: false,
  });

  try {
    const trfId = 'TSR-20250826-1949-TUR-SQZB';
    
    // Fetch TRF data
    const trfData = await sql`
      SELECT * FROM travel_requests WHERE id = ${trfId}
    `;
    
    if (trfData.length === 0) {
      console.log('TRF not found');
      return;
    }
    
    const trf = trfData[0];
    console.log('TRF found:', trf.requestor_name);
    
    // Fetch accommodation details
    const accommodationDetails = await sql`
      SELECT * FROM trf_accommodation_details WHERE trf_id = ${trfId}
    `;
    
    console.log('Accommodation details found:', accommodationDetails.length);
    
    for (const accom of accommodationDetails) {
      console.log('Processing accommodation:', {
        id: accom.id,
        type: accom.accommodation_type,
        checkIn: accom.check_in_date,
        checkOut: accom.check_out_date
      });
      
      // Generate accommodation request ID
      const accomRequestId = generateAccommodationId();
      console.log('Generated accommodation request ID:', accomRequestId);
      
      // Create accommodation request
      await sql.begin(async (tx) => {
        // Create travel request entry
        const newTravelRequest = await tx`
          INSERT INTO travel_requests (
            id, requestor_name, staff_id, department, travel_type, status, 
            additional_comments, submitted_at
          ) VALUES (
            ${accomRequestId}, 
            ${trf.requestor_name}, 
            ${trf.staff_id}, 
            ${trf.department}, 
            'Accommodation', 
            'Pending Department Focal', 
            ${`Auto-generated from TSR ${trfId}: ${trf.purpose}`}, 
            NOW()
          ) RETURNING *
        `;
        
        console.log('Created accommodation travel request:', newTravelRequest[0].id);
        
        // Create accommodation details entry
        await tx`
          INSERT INTO trf_accommodation_details (
            trf_id, check_in_date, check_out_date, accommodation_type, 
            location, place_of_stay, estimated_cost_per_night, remarks
          ) VALUES (
            ${newTravelRequest[0].id}, 
            ${accom.check_in_date},
            ${accom.check_out_date}, 
            ${accom.accommodation_type}, 
            'Kiyanly',
            ${accom.place_of_stay || ''},
            ${accom.estimated_cost_per_night || 0},
            ${accom.remarks || 'Auto-generated from TSR'}
          )
        `;
        
        console.log('Created accommodation details for request:', newTravelRequest[0].id);
        
        // Remove accommodation details from original TSR
        await tx`
          DELETE FROM trf_accommodation_details 
          WHERE trf_id = ${trfId} AND id = ${accom.id}
        `;
        
        console.log('Removed accommodation details from original TSR');
      });
      
      console.log('✅ Successfully created accommodation request:', accomRequestId);
    }
    
  } catch (error) {
    console.error('Error generating accommodation request:', error);
  } finally {
    await sql.end();
    console.log('Database connection closed');
  }
}

// Run the function
manuallyGenerateAccommodationRequest().catch(console.error);