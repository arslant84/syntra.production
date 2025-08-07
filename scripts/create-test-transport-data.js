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

async function createTestTransportData() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🚗 Creating test transport request data...');
    
    // Create a test transport request with pending status
    const testTransportRequest = await pool.query(`
      INSERT INTO transport_requests (
        id, requestor_name, staff_id, department, position, 
        tel_email, email, purpose, status, created_by, created_at
      ) VALUES (
        'TRN-20250807-1200-TEST-ABC1', 
        'John Doe', 
        'STF123', 
        'IT Department', 
        'Manager',
        '+1234567890',
        'john.doe@example.com',
        'Business meeting in city center',
        'Pending Department Focal',
        'system',
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `);
    
    if (testTransportRequest.rows.length > 0) {
      console.log(`   ✅ Created test transport request: ${testTransportRequest.rows[0].id}`);
      
      // Add transport details
      await pool.query(`
        INSERT INTO transport_details (
          transport_request_id, date, day, from_location, to_location,
          departure_time, transport_type, vehicle_type, number_of_passengers
        ) VALUES (
          'TRN-20250807-1200-TEST-ABC1',
          '2025-08-10',
          'Monday',
          'Office',
          'Client Office',
          '09:00',
          'Car',
          'Sedan',
          2
        )
        ON CONFLICT DO NOTHING
      `);
      
      console.log('   ✅ Added transport details');
    } else {
      console.log('   ℹ️  Test transport request already exists');
    }
    
    // Create another test transport request  
    const testTransportRequest2 = await pool.query(`
      INSERT INTO transport_requests (
        id, requestor_name, staff_id, department, position, 
        tel_email, email, purpose, status, created_by, created_at
      ) VALUES (
        'TRN-20250807-1300-TEST-XYZ2', 
        'Jane Smith', 
        'STF456', 
        'HR Department', 
        'Assistant',
        '+1234567891',
        'jane.smith@example.com',
        'Airport transfer for visitor',
        'Pending Line Manager',
        'system',
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `);
    
    if (testTransportRequest2.rows.length > 0) {
      console.log(`   ✅ Created test transport request: ${testTransportRequest2.rows[0].id}`);
      
      // Add transport details
      await pool.query(`
        INSERT INTO transport_details (
          transport_request_id, date, day, from_location, to_location,
          departure_time, transport_type, vehicle_type, number_of_passengers
        ) VALUES (
          'TRN-20250807-1300-TEST-XYZ2',
          '2025-08-12',
          'Wednesday',
          'Airport',
          'Hotel',
          '14:00',
          'Minivan',
          'Minivan',
          4
        )
        ON CONFLICT DO NOTHING
      `);
      
      console.log('   ✅ Added transport details');
    } else {
      console.log('   ℹ️  Test transport request already exists');
    }
    
    console.log('\\n🎉 Test transport data creation completed!');
    console.log('Now testing the approval queue will find these transport requests...');
    
  } catch (error) {
    console.error('❌ Error creating test transport data:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the function if this file is executed directly
if (require.main === module) {
  createTestTransportData()
    .then(() => {
      console.log('\\n✅ Test transport data creation completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\\n💥 Test transport data creation failed:', error);
      process.exit(1);
    });
}

module.exports = { createTestTransportData };