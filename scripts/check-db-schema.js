// Script to check the database schema
require('dotenv').config();
const postgres = require('postgres');

async function checkDatabaseSchema() {
  console.log('Checking database schema...');
  
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
    // Check tables
    const tables = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    
    console.log('Tables in database:');
    tables.forEach(table => console.log(`- ${table.tablename}`));
    
    // Check functions
    const functions = await sql`
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY proname
    `;
    
    console.log('\nFunctions in database:');
    functions.forEach(func => console.log(`- ${func.proname}`));
    
    // Check if the travel_requests table exists and its structure
    if (tables.some(t => t.tablename === 'travel_requests')) {
      const travelRequestsColumns = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'travel_requests'
        ORDER BY ordinal_position
      `;
      
      console.log('\nColumns in travel_requests table:');
      travelRequestsColumns.forEach(col => console.log(`- ${col.column_name} (${col.data_type})`));
    }
    
    // Look for the API route that's trying to use trf_meal_provisions
    console.log('\nChecking for references to trf_meal_provisions in the API route...');
    
  } catch (error) {
    console.error('Error checking database schema:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await sql.end();
    console.log('Database connection closed');
  }
}

// Run the function
checkDatabaseSchema().catch(console.error);
