// Script to run the accommodation admin setup SQL
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runAccommodationSetup() {
  console.log('Starting accommodation admin database setup...');
  
  // Create a PostgreSQL client
  const pool = new Pool({
    host: process.env.DATABASE_HOST,
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    port: 5432,
  });

  try {
    // Connect to the database
    const client = await pool.connect();
    console.log(`Connected to database: ${process.env.DATABASE_NAME}`);
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'accommodation-admin-setup.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Execute the SQL
    console.log('Executing accommodation admin setup SQL...');
    await client.query(sql);
    
    console.log('Accommodation admin database setup completed successfully!');
    client.release();
  } catch (error) {
    console.error('Error setting up accommodation admin database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runAccommodationSetup();
