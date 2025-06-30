// test-db-connection-direct.js
const { Client } = require('pg');

// Use the same connection details as in your .env file
const client = new Client({
  host: 'localhost',
  database: 'syntra',
  user: 'postgres',
  password: '221202',
  // Disable SSL for local development
  ssl: false
});

async function testConnection() {
  try {
    console.log('Attempting to connect to PostgreSQL database...');
    await client.connect();
    console.log('Successfully connected to the database!');
    
    // Test query to check if users table exists
    try {
      console.log('Checking users table...');
      const usersResult = await client.query('SELECT COUNT(*) FROM users');
      console.log('Number of users in database:', usersResult.rows[0].count);
      
      // Test query to check if roles table exists
      console.log('Checking roles table...');
      const rolesResult = await client.query('SELECT COUNT(*) FROM roles');
      console.log('Number of roles in database:', rolesResult.rows[0].count);
      
      // Test query to check if permissions table exists
      console.log('Checking permissions table...');
      const permissionsResult = await client.query('SELECT COUNT(*) FROM permissions');
      console.log('Number of permissions in database:', permissionsResult.rows[0].count);
    } catch (err) {
      console.error('Error querying tables:', err.message);
    }
    
    await client.end();
  } catch (err) {
    console.error('Error connecting to the database:', err.message);
  }
}

testConnection();
