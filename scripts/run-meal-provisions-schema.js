// Script to create the missing trf_meal_provisions table
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

async function createMealProvisionsTable() {
  console.log('Starting meal provisions table creation...');
  
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
    const sqlFilePath = path.join(__dirname, 'create-meal-provisions-table.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('Executing meal provisions table creation SQL...');
    
    // Execute the SQL
    await sql.unsafe(sqlContent);
    
    console.log('Meal provisions table creation completed successfully!');
    
    // Verify the table was created
    const tables = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `;
    
    console.log('Current tables in database:');
    tables.forEach(table => console.log(`- ${table.tablename}`));
    
    // If the table exists, show its columns
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'trf_meal_provisions'
    `;
    
    if (columns.length > 0) {
      console.log('Columns in trf_meal_provisions table:');
      columns.forEach(col => console.log(`- ${col.column_name}`));
    }
    
  } catch (error) {
    console.error('Error creating meal provisions table:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await sql.end();
    console.log('Database connection closed');
  }
}

// Run the function
createMealProvisionsTable().catch(console.error);
