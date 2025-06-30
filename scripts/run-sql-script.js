// scripts/run-sql-script.js
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Get SQL file path from command line arguments
const sqlFilePath = process.argv[2] ? path.resolve(process.argv[2]) : null;

if (!sqlFilePath) {
  console.error('Error: No SQL file specified. Usage: node run-sql-script.js <path-to-sql-file>');
  process.exit(1);
}

// Database connection configuration from environment variables
const dbConfig = {
  host: process.env.DATABASE_HOST || 'localhost',
  database: process.env.DATABASE_NAME || 'syntra',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || '221202',
  port: process.env.DATABASE_PORT || 5432,
};

async function runSqlScript() {
  console.log('SynTra SQL Script Runner');
  console.log('=======================');
  console.log(`Host: ${dbConfig.host}`);
  console.log(`Database: ${dbConfig.database}`);
  console.log(`User: ${dbConfig.user}`);
  console.log(`SQL File: ${sqlFilePath}`);
  console.log('Connecting to PostgreSQL...');

  const client = new Client(dbConfig);
  let sql;

  try {
    // Connect to the database
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    // Check if SQL file exists
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL file not found: ${sqlFilePath}`);
    }

    // Read the SQL file
    console.log(`Reading SQL file: ${sqlFilePath}`);
    sql = fs.readFileSync(sqlFilePath, 'utf8');

    // Execute the SQL commands
    console.log('Executing SQL commands...');
    await client.query(sql);

    console.log('SQL script executed successfully!');

  } catch (error) {
    console.error('Error executing SQL script:', error.message);
    if (error.position && sql) {
      // If there's a syntax error, show the position and nearby SQL
      const errorPosition = parseInt(error.position);
      const errorContext = sql.substring(
        Math.max(0, errorPosition - 100),
        Math.min(sql.length, errorPosition + 100)
      );
      console.error('Error near position', errorPosition, ':', errorContext);
    }
  } finally {
    // Close the database connection
    if (client) {
      await client.end();
      console.log('Database connection closed.');
    }
  }
}

// Run the script
runSqlScript();
