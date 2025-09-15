// Script to create the claims tables in the database
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

async function createClaimsTables() {
  console.log('Starting claims tables creation...');
  
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
    const sqlFilePath = path.join(__dirname, 'create-claims-tables.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('Executing claims tables creation SQL...');
    
    // Execute the SQL
    await sql.unsafe(sqlContent);
    
    console.log('Claims tables creation completed successfully!');
    
    // Verify the tables were created
    const tables = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      AND tablename IN ('expense_claims', 'expense_claim_items', 'expense_claim_fx_rates')
      ORDER BY tablename
    `;
    
    console.log('Created claims tables:');
    tables.forEach(table => console.log(`- ${table.tablename}`));
    
    // Check the structure of the expense_claims table
    if (tables.some(t => t.tablename === 'expense_claims')) {
      const columns = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'expense_claims'
        ORDER BY ordinal_position
      `;
      
      console.log('\nColumns in expense_claims table:');
      columns.forEach(col => console.log(`- ${col.column_name} (${col.data_type})`));
    }
    
  } catch (error) {
    console.error('Error creating claims tables:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await sql.end();
    console.log('Database connection closed');
  }
}

// Run the function
createClaimsTables().catch(console.error);
