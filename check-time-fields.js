// Check flight booking time fields structure and data
const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
  port: 5432,
});

async function checkTimeFields() {
  try {
    await client.connect();

    console.log('🔍 CHECKING FLIGHT BOOKING TIME FIELDS');
    console.log('=====================================');
    console.log('');

    // Check the trf_flight_bookings table structure
    const tableInfo = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'trf_flight_bookings'
      ORDER BY ordinal_position
    `);

    console.log('📋 TABLE STRUCTURE:');
    tableInfo.rows.forEach(col => {
      console.log(`   ${col.column_name} (${col.data_type}) - ${col.is_nullable}`);
    });

    console.log('');

    // Check actual data
    const sampleData = await client.query(`
      SELECT id, trf_id, departure_time, arrival_time, departure_date, arrival_date,
             departure_datetime, arrival_datetime
      FROM trf_flight_bookings
      WHERE trf_id = 'TSR-20250828-1112-TUR-9ANX'
    `);

    console.log('📊 SAMPLE DATA (TSR-20250828-1112-TUR-9ANX):');
    if (sampleData.rows.length > 0) {
      const data = sampleData.rows[0];
      console.log(`   departure_time: ${data.departure_time}`);
      console.log(`   arrival_time: ${data.arrival_time}`);
      console.log(`   departure_date: ${data.departure_date}`);
      console.log(`   arrival_date: ${data.arrival_date}`);
      console.log(`   departure_datetime: ${data.departure_datetime}`);
      console.log(`   arrival_datetime: ${data.arrival_datetime}`);
    } else {
      console.log('   No data found for this TRF');
    }

    console.log('');

    // Check what fields are being used in API
    console.log('🔍 CHECKING API FIELD MAPPING:');
    console.log('API fetches: departure_time, arrival_time (separate fields)');
    console.log('API also has: departure_date, arrival_date, departure_datetime, arrival_datetime');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkTimeFields().catch(console.error);