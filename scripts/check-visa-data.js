// check-visa-data.js
const { Pool } = require('pg');

async function checkVisaData() {
  console.log('SynTra Visa Data Check');
  console.log('=====================');

  // Read environment variables or use defaults
  const host = process.env.DATABASE_HOST || 'localhost';
  const database = process.env.DATABASE_NAME || 'syntra';
  const user = process.env.DATABASE_USER || 'postgres';
  const password = process.env.DATABASE_PASSWORD || '221202';

  console.log(`Host: ${host}`);
  console.log(`Database: ${database}`);
  console.log(`User: ${user}`);

  const pool = new Pool({
    host,
    database,
    user,
    password,
    ssl: false // Disable SSL for local development
  });

  try {
    console.log('Connecting to PostgreSQL...');
    const client = await pool.connect();
    console.log('Connected to PostgreSQL successfully.');

    // Check visa_applications table structure
    console.log('\nChecking visa_applications table structure:');
    const tableStructure = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'visa_applications'
      ORDER BY ordinal_position;
    `);
    
    tableStructure.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });

    // Check visa applications data
    console.log('\nChecking visa applications data:');
    const visaData = await client.query('SELECT * FROM visa_applications');
    
    console.log(`Found ${visaData.rows.length} visa applications:`);
    visaData.rows.forEach((row, index) => {
      console.log(`\nApplication #${index + 1}:`);
      console.log(`- ID: ${row.id}`);
      console.log(`- Requestor: ${row.requestor_name}`);
      console.log(`- Destination: ${row.destination}`);
      console.log(`- Purpose: ${row.travel_purpose}`);
      console.log(`- Status: ${row.status}`);
      console.log(`- Submitted: ${row.submitted_date}`);
    });

    client.release();
  } catch (err) {
    console.error('Error checking visa data:', err.message);
  } finally {
    await pool.end();
    console.log('\nDatabase connection closed.');
  }
}

checkVisaData().catch(console.error);
