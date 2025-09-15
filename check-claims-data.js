// Script to check if there are any claims in the database
require('dotenv').config();
const postgres = require('postgres');

async function checkClaimsData() {
  console.log('Checking claims data in the database...');
  
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
    // Check if there are any claims in the expense_claims table
    const claimsCount = await sql`
      SELECT COUNT(*) as count FROM expense_claims
    `;
    
    console.log(`Number of claims in the database: ${claimsCount[0]?.count}`);
    
    if (claimsCount[0]?.count > 0) {
      // Fetch all claims
      const claims = await sql`
        SELECT * FROM expense_claims
      `;
      
      console.log('\nClaims in the database:');
      claims.forEach((claim, index) => {
        console.log(`\nClaim #${index + 1}:`);
        console.log(`- ID: ${claim.id}`);
        console.log(`- Staff Name: ${claim.staff_name}`);
        console.log(`- Purpose: ${claim.purpose_of_claim}`);
        console.log(`- Amount: ${claim.total_advance_claim_amount}`);
        console.log(`- Status: ${claim.status}`);
        console.log(`- Submitted At: ${claim.submitted_at}`);
      });
      
      // Check if there are any expense items for the first claim
      if (claims.length > 0) {
        const firstClaimId = claims[0].id;
        const expenseItems = await sql`
          SELECT * FROM expense_claim_items WHERE claim_id = ${firstClaimId}
        `;
        
        console.log(`\nExpense items for claim ${firstClaimId}: ${expenseItems.length}`);
        if (expenseItems.length > 0) {
          expenseItems.forEach((item, index) => {
            console.log(`\nItem #${index + 1}:`);
            console.log(`- Date: ${item.item_date}`);
            console.log(`- Details: ${item.claim_or_travel_details}`);
            console.log(`- Amount: ${item.transport + item.hotel_accommodation_allowance + item.out_station_allowance_meal + item.other_expenses}`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('Error checking claims data:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await sql.end();
    console.log('\nDatabase connection closed');
  }
}

// Run the function
checkClaimsData().catch(console.error);
