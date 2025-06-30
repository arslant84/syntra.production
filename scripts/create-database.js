// scripts/create-database.js
const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Database connection configuration for the postgres database
const pgConfig = {
  host: process.env.DATABASE_HOST || 'localhost',
  database: 'postgres', // Connect to default postgres database first
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || '221202',
  port: process.env.DATABASE_PORT || 5432,
};

// Target database name
const targetDbName = process.env.DATABASE_NAME || 'syntra';

async function createDatabase() {
  console.log('SynTra Database Creation');
  console.log('=======================');
  console.log(`Host: ${pgConfig.host}`);
  console.log(`Target Database: ${targetDbName}`);
  console.log(`User: ${pgConfig.user}`);
  console.log('Connecting to PostgreSQL default database...');

  const client = new Client(pgConfig);

  try {
    // Connect to the default postgres database
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    // Check if the target database exists
    const checkDbQuery = `
      SELECT 1 FROM pg_database WHERE datname = $1;
    `;
    
    const result = await client.query(checkDbQuery, [targetDbName]);
    
    if (result.rowCount === 0) {
      // Database doesn't exist, create it
      console.log(`Database '${targetDbName}' does not exist. Creating it now...`);
      
      // Create the database
      await client.query(`CREATE DATABASE ${targetDbName};`);
      
      console.log(`Database '${targetDbName}' created successfully!`);
    } else {
      console.log(`Database '${targetDbName}' already exists.`);
    }

  } catch (error) {
    console.error('Error creating database:', error.message);
  } finally {
    // Close the database connection
    await client.end();
    console.log('Database connection closed.');
  }
}

// Run the create database function
createDatabase();
