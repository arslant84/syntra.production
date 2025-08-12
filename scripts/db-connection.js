// db-connection.js
const { database } = require('./config');
const { Pool } = require('pg');

// Set up environment for database
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const pool = new Pool(database);

async function testDatabaseConnection() {
  try {
    console.log('Testing database connection with pool...');
    const result = await pool.query('SELECT NOW()');
    console.log('Database connection successful!');
    console.log('Current database time:', result.rows[0].now);
    return result;
  } catch (error) {
    console.error('Error connecting to database:', error.message);
    throw error;
  } finally {
    // Close the pool when done
    await pool.end();
  }
}

// Execute the function if this script is run directly
if (require.main === module) {
  testDatabaseConnection()
    .then(() => console.log('Database test complete'))
    .catch(err => console.error('Database test failed:', err));
}

// Export the pool and function for use in other scripts
module.exports = {
  pool,
  testDatabaseConnection
};