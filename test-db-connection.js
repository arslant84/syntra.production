// test-db-connection.js
require('dotenv').config({ path: '../.env' });
const { Client } = require('pg');

console.log('Testing database connection...');
console.log('DATABASE_HOST:', process.env.DATABASE_HOST ? 'Set' : 'NOT SET');
console.log('DATABASE_NAME:', process.env.DATABASE_NAME ? 'Set' : 'NOT SET');
console.log('DATABASE_USER:', process.env.DATABASE_USER ? 'Set' : 'NOT SET');
console.log('DATABASE_PASSWORD:', process.env.DATABASE_PASSWORD ? 'Set' : 'NOT SET');

const client = new Client({
  host: process.env.DATABASE_HOST,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: { rejectUnauthorized: false } // For development only
});

async function testConnection() {
  try {
    await client.connect();
    console.log('Successfully connected to the database!');
    const result = await client.query('SELECT NOW()');
    console.log('Database time:', result.rows[0].now);
    
    // Test query to check if users table exists
    try {
      const usersResult = await client.query('SELECT COUNT(*) FROM users');
      console.log('Number of users in database:', usersResult.rows[0].count);
    } catch (err) {
      console.error('Error querying users table:', err.message);
    }
    
    await client.end();
  } catch (err) {
    console.error('Error connecting to the database:', err.message);
  }
}

testConnection();
