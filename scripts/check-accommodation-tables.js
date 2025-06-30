// scripts/check-accommodation-tables.js
const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Database connection configuration from environment variables
const dbConfig = {
  host: process.env.DATABASE_HOST || 'localhost',
  database: process.env.DATABASE_NAME || 'syntra',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || '221202',
  port: process.env.DATABASE_PORT || 5432,
};

async function checkAccommodationTables() {
  console.log('SynTra Accommodation Tables Check');
  console.log('=================================');
  console.log(`Host: ${dbConfig.host}`);
  console.log(`Database: ${dbConfig.database}`);
  console.log(`User: ${dbConfig.user}`);
  console.log('Connecting to PostgreSQL...');

  const client = new Client(dbConfig);

  try {
    // Connect to the database
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    // Check if accommodation tables exist
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'accommodation%'
      ORDER BY table_name;
    `;
    
    const tableResult = await client.query(tableQuery);
    
    console.log('\nAccommodation Tables:');
    if (tableResult.rows.length === 0) {
      console.log('No accommodation tables found.');
    } else {
      tableResult.rows.forEach(row => {
        console.log(`- ${row.table_name}`);
      });
    }

    // For each table, get the column information
    for (const row of tableResult.rows) {
      const tableName = row.table_name;
      const columnQuery = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `;
      
      const columnResult = await client.query(columnQuery, [tableName]);
      
      console.log(`\nColumns for ${tableName}:`);
      columnResult.rows.forEach(col => {
        console.log(`- ${col.column_name} (${col.data_type}, ${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
    }

  } catch (error) {
    console.error('Error checking accommodation tables:', error.message);
  } finally {
    // Close the database connection
    await client.end();
    console.log('\nDatabase connection closed.');
  }
}

// Run the check function
checkAccommodationTables();
