// Script to run the SQL update for the accommodation schema
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

async function updateSchema() {
  console.log('Starting database schema update...');
  
  // Load environment variables
  const {
    DATABASE_HOST,
    DATABASE_NAME,
    DATABASE_USER,
    DATABASE_PASSWORD,
  } = process.env;

  // Validate environment variables
  if (!DATABASE_HOST || !DATABASE_NAME || !DATABASE_USER || !DATABASE_PASSWORD) {
    console.error('Missing required database environment variables');
    process.exit(1);
  }

  console.log(`Connecting to database: ${DATABASE_NAME} on ${DATABASE_HOST}`);
  
  // Initialize PostgreSQL client
  const sql = postgres({
    host: DATABASE_HOST,
    database: DATABASE_NAME,
    username: DATABASE_USER,
    password: DATABASE_PASSWORD,
    ssl: false, // Set to true if your database requires SSL
  });

  try {
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'update-accommodation-schema.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('Executing schema update SQL...');
    
    // Execute the SQL
    await sql.unsafe(sqlContent);
    
    console.log('Schema update completed successfully!');
    
    // Verify the columns were added
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'trf_accommodation_details'
    `;
    
    console.log('Current columns in trf_accommodation_details table:');
    columns.forEach(col => console.log(`- ${col.column_name}`));
    
  } catch (error) {
    console.error('Error updating schema:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await sql.end();
    console.log('Database connection closed');
  }
}

// Run the update function
updateSchema().catch(console.error);
