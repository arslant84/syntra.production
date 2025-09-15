// Script to create the trf_flight_bookings table
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'syntra',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
};

async function createFlightBookingsTable() {
  const client = new Client(dbConfig);
  
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected to database successfully');

    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'create-flight-bookings-table.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('Executing flight bookings table creation script...');
    await client.query(sqlContent);
    
    // Verify the table was created
    const tableCheckResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'trf_flight_bookings'
      ) as exists
    `);
    
    if (tableCheckResult.rows[0].exists) {
      console.log('✅ trf_flight_bookings table created successfully!');
      
      // Show table structure
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'trf_flight_bookings' 
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `);
      
      console.log('\nTable structure:');
      console.log('Columns in trf_flight_bookings table:');
      columnsResult.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'} ${col.column_default ? `[default: ${col.column_default}]` : ''}`);
      });
      
      // Show indexes
      const indexesResult = await client.query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'trf_flight_bookings'
      `);
      
      console.log('\nIndexes:');
      indexesResult.rows.forEach(idx => {
        console.log(`  - ${idx.indexname}`);
      });
      
    } else {
      console.log('❌ Failed to create trf_flight_bookings table');
    }
    
  } catch (error) {
    console.error('❌ Error creating flight bookings table:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

// Run the script
if (require.main === module) {
  createFlightBookingsTable()
    .then(() => {
      console.log('\n🎉 Flight bookings table setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Flight bookings table setup failed:', error);
      process.exit(1);
    });
}

module.exports = { createFlightBookingsTable }; 