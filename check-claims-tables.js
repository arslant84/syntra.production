// Script to check if the claims tables exist in the database
require('dotenv').config();
const postgres = require('postgres');

async function checkClaimsTables() {
  console.log('Checking claims tables in the database...');
  
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
    // Check if the expense_claims table exists
    const expenseClaimsExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'expense_claims'
      ) as exists
    `;
    
    console.log(`expense_claims table exists: ${expenseClaimsExists[0]?.exists}`);
    
    // Check if the expense_claim_items table exists
    const expenseClaimItemsExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'expense_claim_items'
      ) as exists
    `;
    
    console.log(`expense_claim_items table exists: ${expenseClaimItemsExists[0]?.exists}`);
    
    // Check if the expense_claim_fx_rates table exists
    const expenseClaimFxRatesExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'expense_claim_fx_rates'
      ) as exists
    `;
    
    console.log(`expense_claim_fx_rates table exists: ${expenseClaimFxRatesExists[0]?.exists}`);
    
    // If the expense_claims table exists, check its structure
    if (expenseClaimsExists[0]?.exists) {
      const columns = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'expense_claims'
        ORDER BY ordinal_position
      `;
      
      console.log('\nColumns in expense_claims table:');
      columns.forEach(col => console.log(`- ${col.column_name} (${col.data_type})`));
      
      // Check if there are any records in the expense_claims table
      const claimCount = await sql`
        SELECT COUNT(*) as count FROM expense_claims
      `;
      
      console.log(`\nNumber of records in expense_claims table: ${claimCount[0]?.count}`);
    }
    
  } catch (error) {
    console.error('Error checking claims tables:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await sql.end();
    console.log('Database connection closed');
  }
}

// Run the function
checkClaimsTables().catch(console.error);
