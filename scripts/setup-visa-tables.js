// setup-visa-tables.js
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupVisaTables() {
  console.log('SynTra Visa Tables Setup');
  console.log('=======================');

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

    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'visa-tables.sql');
    console.log(`Reading SQL file: ${sqlFilePath}`);
    const sqlCommands = fs.readFileSync(sqlFilePath, 'utf8');

    // Execute SQL commands
    console.log('Executing SQL commands...');
    await client.query(sqlCommands);
    console.log('Visa tables created successfully.');

    // Check if tables were created
    const { rows } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'visa%'
    `);
    
    console.log('Created visa tables:');
    rows.forEach(row => console.log(`- ${row.table_name}`));

    // Check if sample data was inserted
    const { rows: visaApps } = await client.query('SELECT COUNT(*) FROM visa_applications');
    console.log(`Sample visa applications in database: ${visaApps[0].count}`);

    client.release();
  } catch (err) {
    console.error('Error setting up visa tables:', err.message);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

setupVisaTables().catch(console.error);
