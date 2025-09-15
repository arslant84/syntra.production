// run-add-missing-tables.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function addMissingTables() {
  console.log('Starting to add missing tables...');
  
  // Create a connection pool
  const pool = new Pool({
    host: process.env.DATABASE_HOST,
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    port: process.env.DATABASE_PORT || 5432,
  });

  try {
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'add-missing-tables.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('Executing SQL to add missing tables...');
    
    // Execute the SQL
    await pool.query(sql);
    
    console.log('Successfully added missing tables!');
  } catch (error) {
    console.error('Error adding missing tables:', error);
    process.exit(1);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the function
addMissingTables();
