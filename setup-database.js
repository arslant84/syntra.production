// scripts/setup-database.js
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

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

// Path to the SQL file
const sqlFilePath = path.resolve(__dirname, './db-setup.sql');

async function setupDatabase() {
  console.log('SynTra Database Setup');
  console.log('=====================');
  console.log(`Host: ${dbConfig.host}`);
  console.log(`Database: ${dbConfig.database}`);
  console.log(`User: ${dbConfig.user}`);
  console.log('Connecting to PostgreSQL...');

  const client = new Client(dbConfig);
  let sql;

  try {
    // Connect to the database
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    // Read the SQL file
    console.log(`Reading SQL file: ${sqlFilePath}`);
    sql = fs.readFileSync(sqlFilePath, 'utf8');

    // Execute the SQL commands
    console.log('Executing SQL commands...');
    await client.query(sql);

    console.log('Database setup completed successfully!');

    // Verify tables were created by querying information_schema
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    const tableResult = await client.query(tableQuery);
    
    console.log('\nTables created:');
    tableResult.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });

    // Count users
    const userCountResult = await client.query('SELECT COUNT(*) FROM users;');
    console.log(`\nTotal users created: ${userCountResult.rows[0].count}`);

    // Count roles
    const roleCountResult = await client.query('SELECT COUNT(*) FROM roles;');
    console.log(`Total roles created: ${roleCountResult.rows[0].count}`);

    // Count permissions
    const permissionCountResult = await client.query('SELECT COUNT(*) FROM permissions;');
    console.log(`Total permissions created: ${permissionCountResult.rows[0].count}`);

  } catch (error) {
    console.error('Error setting up database:', error.message);
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
    await client.end();
    console.log('Database connection closed.');
  }
}

// Run the setup function
setupDatabase();
