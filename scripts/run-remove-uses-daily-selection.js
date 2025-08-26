// Script to remove the uses_daily_selection column from trf_meal_provisions table
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

async function removeUsesDailySelectionColumn() {
  console.log('Starting removal of uses_daily_selection column...');
  
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
    const sqlFilePath = path.join(__dirname, 'remove-uses-daily-selection-column.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('Executing column removal SQL...');
    
    // Execute the SQL
    await sql.unsafe(sqlContent);
    
    console.log('uses_daily_selection column removal completed successfully!');
    
    // Verify the column was removed
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'trf_meal_provisions'
      ORDER BY ordinal_position
    `;
    
    console.log('Current columns in trf_meal_provisions table:');
    columns.forEach(col => console.log(`- ${col.column_name}`));
    
    // Check if uses_daily_selection column still exists
    const usesDailySelectionExists = columns.some(col => col.column_name === 'uses_daily_selection');
    if (!usesDailySelectionExists) {
      console.log('✅ uses_daily_selection column successfully removed');
    } else {
      console.log('⚠️  uses_daily_selection column still exists');
    }
    
  } catch (error) {
    console.error('Error removing uses_daily_selection column:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await sql.end();
    console.log('Database connection closed');
  }
}

// Run the function
removeUsesDailySelectionColumn().catch(console.error);