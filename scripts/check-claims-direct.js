// Script to check claims in the database using direct PostgreSQL connection
const { Pool } = require('pg');

// Create a connection pool using environment variables or default values
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DATABASE || 'syntra',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres'
});

async function checkClaims() {
  const client = await pool.connect();
  
  try {
    console.log('Checking claims in the database...');
    
    // Count total claims
    const countResult = await client.query('SELECT COUNT(*) as count FROM expense_claims');
    console.log(`Total claims in database: ${countResult.rows[0].count}`);
    
    // Get all claims if any exist
    if (parseInt(countResult.rows[0].count) > 0) {
      const claimsResult = await client.query(`
        SELECT id, staff_name, purpose_of_claim, total_advance_claim_amount, status, submitted_at 
        FROM expense_claims 
        ORDER BY submitted_at DESC
      `);
      
      console.log('\nClaims found:');
      claimsResult.rows.forEach((claim, index) => {
        console.log(`\nClaim #${index + 1}:`);
        console.log(`- ID: ${claim.id}`);
        console.log(`- Staff: ${claim.staff_name}`);
        console.log(`- Purpose: ${claim.purpose_of_claim}`);
        console.log(`- Amount: ${claim.total_advance_claim_amount}`);
        console.log(`- Status: ${claim.status}`);
        console.log(`- Submitted: ${claim.submitted_at}`);
      });
    } else {
      console.log('No claims found in the database.');
    }
  } catch (error) {
    console.error('Error checking claims:', error);
  } finally {
    client.release();
    pool.end();
  }
}

checkClaims();
