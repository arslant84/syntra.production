const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
});

async function checkSpecificTrfs() {
  try {
    await client.connect();
    console.log('Connected to database successfully');
    
    // The specific TRF IDs to investigate
    const trfIds = [
      'TSR-20250901-0926-TUR-RMHH',
      'TSR-20250826-1933-TUR-EC52', 
      'TSR-20250717-1443-TUR-BVJM',
      'TSR-20250702-1158-ASB-GVC4'
    ];
    
    console.log('\n=== CHECKING SPECIFIC TRF RECORDS ===\n');
    
    for (const trfId of trfIds) {
      console.log(`\n--- Checking TRF: ${trfId} ---`);
      
      // Check if TRF exists
      const trfQuery = await client.query(`
        SELECT 
          id,
          requestor_name,
          travel_type,
          status,
          purpose,
          staff_id,
          department,
          submitted_at,
          created_at
        FROM travel_requests 
        WHERE id = $1
      `, [trfId]);
      
      if (trfQuery.rows.length === 0) {
        console.log(`❌ TRF ${trfId} NOT FOUND in travel_requests table`);
        continue;
      }
      
      const trf = trfQuery.rows[0];
      console.log(`✅ TRF ${trfId} FOUND:`);
      console.log(`   Requestor: ${trf.requestor_name}`);
      console.log(`   Travel Type: ${trf.travel_type}`);
      console.log(`   Status: ${trf.status}`);
      console.log(`   Purpose: ${trf.purpose}`);
      console.log(`   Staff ID: ${trf.staff_id}`);
      console.log(`   Department: ${trf.department}`);
      console.log(`   Submitted: ${trf.submitted_at}`);
      console.log(`   Created: ${trf.created_at}`);
      
      // Check if there's a flight booking for this TRF
      const flightBookingQuery = await client.query(`
        SELECT 
          id,
          trf_id,
          flight_number,
          departure_location,
          arrival_location,
          departure_date,
          arrival_date,
          booking_reference,
          status,
          created_at
        FROM trf_flight_bookings 
        WHERE trf_id = $1
      `, [trfId]);
      
      if (flightBookingQuery.rows.length > 0) {
        console.log(`   ✈️  FLIGHT BOOKING EXISTS:`);
        const booking = flightBookingQuery.rows[0];
        console.log(`       Booking ID: ${booking.id}`);
        console.log(`       Flight: ${booking.flight_number}`);
        console.log(`       Route: ${booking.departure_location} → ${booking.arrival_location}`);
        console.log(`       PNR: ${booking.booking_reference}`);
        console.log(`       Booking Status: ${booking.status}`);
        console.log(`       Booked: ${booking.created_at}`);
      } else {
        console.log(`   ❌ NO FLIGHT BOOKING found for this TRF`);
      }
    }
    
    // Now let's check what TRFs with "Approved" status exist for comparison
    console.log('\n\n=== CHECKING ALL APPROVED TRFs ===\n');
    
    const approvedTrfsQuery = await client.query(`
      SELECT 
        id,
        requestor_name,
        travel_type,
        status,
        staff_id,
        department,
        submitted_at
      FROM travel_requests 
      WHERE status = 'Approved'
      ORDER BY submitted_at DESC
      LIMIT 20
    `);
    
    console.log(`Found ${approvedTrfsQuery.rows.length} TRFs with 'Approved' status:`);
    approvedTrfsQuery.rows.forEach(trf => {
      console.log(`  ${trf.id} | ${trf.requestor_name} | ${trf.travel_type} | ${trf.status} | ${trf.submitted_at}`);
    });
    
    // Check trf_flight_bookings table structure
    console.log('\n\n=== TRF FLIGHT BOOKINGS TABLE STRUCTURE ===\n');
    
    const flightBookingsSchema = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'trf_flight_bookings'
      ORDER BY ordinal_position
    `);
    
    if (flightBookingsSchema.rows.length > 0) {
      console.log('trf_flight_bookings table columns:');
      flightBookingsSchema.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'} ${col.column_default ? `[default: ${col.column_default}]` : ''}`);
      });
      
      // Check total count of flight bookings
      const flightBookingCount = await client.query('SELECT COUNT(*) as count FROM trf_flight_bookings');
      console.log(`\nTotal flight bookings in database: ${flightBookingCount.rows[0].count}`);
    } else {
      console.log('❌ trf_flight_bookings table does not exist');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

checkSpecificTrfs();