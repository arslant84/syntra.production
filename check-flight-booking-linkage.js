const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra', 
  user: 'postgres',
  password: '221202'
});

async function checkFlightBookingLinkage() {
  try {
    await client.connect();
    
    // Check flight bookings and their associated TSRs
    const flightBookings = await client.query(`
      SELECT tfb.*, tr.travel_type, tr.requestor_name, tr.status as tsr_status
      FROM trf_flight_bookings tfb
      LEFT JOIN travel_requests tr ON tfb.trf_id = tr.id
      ORDER BY tfb.created_at DESC
    `);
    
    console.log('Flight bookings and their TSRs:');
    flightBookings.rows.forEach((row, index) => {
      console.log(`${index + 1}. Flight Booking ID: ${row.id}`);
      console.log(`   - TRF ID: ${row.trf_id}`);
      console.log(`   - TSR exists: ${row.requestor_name ? 'Yes' : 'No'}`);
      console.log(`   - Requestor: ${row.requestor_name || 'Not found'}`);
      console.log(`   - Travel Type: ${row.travel_type || 'N/A'}`);
      console.log(`   - TSR Status: ${row.tsr_status || 'N/A'}`);
      console.log(`   - Flight: ${row.flight_number} (${row.departure_location} → ${row.arrival_location})`);
      console.log(`   - Flight Status: ${row.status}`);
      console.log('');
    });
    
    // Check if the TRF exists that has flight booking
    const trfWithFlight = await client.query(`
      SELECT * FROM travel_requests WHERE id = 'TSR-20250818-1018-TUR-QC6E'
    `);
    
    console.log('TSR with flight booking exists:', trfWithFlight.rows.length > 0);
    if (trfWithFlight.rows.length > 0) {
      const tsr = trfWithFlight.rows[0];
      console.log(`TSR Details: ${tsr.id} - ${tsr.requestor_name} - ${tsr.travel_type} - ${tsr.status}`);
    }
    
    // Check all TSRs that might need flights
    console.log('\nAll TSRs by travel type:');
    const allTravelTypes = await client.query(`
      SELECT travel_type, COUNT(*) as count, 
             string_agg(id || ' (' || status || ')', ', ' ORDER BY submitted_at DESC) as tsrs
      FROM travel_requests 
      GROUP BY travel_type
      ORDER BY count DESC
    `);
    
    allTravelTypes.rows.forEach(row => {
      console.log(`${row.travel_type}: ${row.count} TSRs`);
      console.log(`  ${row.tsrs}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await client.end();
  }
}

checkFlightBookingLinkage();