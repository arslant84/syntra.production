// Script to check claims in the database
const { sql } = require('@/lib/db');

// Handle the path resolution for Next.js aliases
require('module-alias/register');
require('module-alias').addAlias('@', require('path').resolve(process.cwd(), 'src'));

async function checkClaims() {
  try {
    console.log('Checking claims in the database...');
    
    // Count total claims
    const countResult = await sql`SELECT COUNT(*) as count FROM expense_claims`;
    console.log(`Total claims in database: ${countResult[0].count}`);
    
    // Get all claims if any exist
    if (parseInt(countResult[0].count) > 0) {
      const claims = await sql`
        SELECT id, staff_name, purpose_of_claim, total_advance_claim_amount, status, submitted_at 
        FROM expense_claims 
        ORDER BY submitted_at DESC
      `;
      
      console.log('\nClaims found:');
      claims.forEach((claim, index) => {
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
    process.exit(0);
  }
}

checkClaims();
