#!/usr/bin/env node

require('dotenv').config();
const postgres = require('postgres');

async function analyzeClaimIds() {
  const sql = postgres({
    host: process.env.DATABASE_HOST || 'localhost',
    database: process.env.DATABASE_NAME || 'syntra',
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.NODE_ENV === 'production'
  });

  try {
    console.log('🔍 Analyzing claim ID formats in database...\n');
    
    // Get all claims with their document_number (which should be the claim ID)
    const allClaims = await sql`
      SELECT 
        id as internal_id,
        document_number,
        staff_name,
        purpose_of_claim,
        total_advance_claim_amount,
        created_at,
        status
      FROM expense_claims 
      ORDER BY created_at DESC
    `;
    
    console.log(`📊 Found ${allClaims.length} claims in database:`);
    console.log('═'.repeat(100));
    
    let correctFormat = 0;
    let incorrectFormat = 0;
    let nullOrEmpty = 0;
    const problematicClaims = [];
    
    allClaims.forEach((claim, index) => {
      const docNumber = claim.document_number;
      const isCorrectFormat = docNumber && docNumber.match(/^CLM-\d{8}-\d{4}-[A-Z0-9]{5}-[A-Z0-9]{4}$/);
      const isNullEmpty = !docNumber || docNumber.trim() === '';
      
      let status = '';
      if (isNullEmpty) {
        status = '❌ NULL/EMPTY';
        nullOrEmpty++;
        problematicClaims.push(claim);
      } else if (isCorrectFormat) {
        status = '✅ CORRECT';
        correctFormat++;
      } else {
        status = '⚠️ WRONG FORMAT';
        incorrectFormat++;
        problematicClaims.push(claim);
      }
      
      const indexStr = (index + 1).toString().padStart(2);
      const docStr = (docNumber || '[NULL]').padEnd(35);
      const nameStr = claim.staff_name.padEnd(20);
      const amountStr = (claim.total_advance_claim_amount || 0).toString().padStart(8);
      console.log(`${indexStr}. ${status} | ${docStr} | ${nameStr} | $${amountStr} | ${claim.status}`);
    });
    
    console.log('═'.repeat(100));
    console.log('📈 SUMMARY STATISTICS:');
    console.log(`   ✅ Correct format (CLM-YYYYMMDD-HHMM-XXXXX-XXXX): ${correctFormat} claims`);
    console.log(`   ⚠️ Wrong format: ${incorrectFormat} claims`);
    console.log(`   ❌ NULL/Empty: ${nullOrEmpty} claims`);
    console.log(`   🔧 Need fixing: ${problematicClaims.length} claims`);
    
    if (problematicClaims.length > 0) {
      console.log('\n🚨 PROBLEMATIC CLAIMS DETAILS:');
      console.log('═'.repeat(80));
      
      problematicClaims.forEach((claim, index) => {
        console.log(`${index + 1}. Internal ID: ${claim.internal_id}`);
        console.log(`   Document Number: "${claim.document_number || '[NULL]'}"`);
        console.log(`   Staff: ${claim.staff_name}`);
        console.log(`   Purpose: ${claim.purpose_of_claim}`);
        console.log(`   Amount: $${claim.total_advance_claim_amount || 0}`);
        console.log(`   Created: ${claim.created_at}`);
        console.log(`   Status: ${claim.status}`);
        
        // Suggest new ID based on creation date
        const createdDate = new Date(claim.created_at);
        const year = createdDate.getFullYear();
        const month = String(createdDate.getMonth() + 1).padStart(2, '0');
        const day = String(createdDate.getDate()).padStart(2, '0');
        const hours = String(createdDate.getHours()).padStart(2, '0');
        const minutes = String(createdDate.getMinutes()).padStart(2, '0');
        
        // Generate random 5+4 character codes
        const randomCode1 = Math.random().toString(36).substr(2, 5).toUpperCase();
        const randomCode2 = Math.random().toString(36).substr(2, 4).toUpperCase();
        
        const suggestedId = `CLM-${year}${month}${day}-${hours}${minutes}-${randomCode1}-${randomCode2}`;
        console.log(`   🔧 SUGGESTED NEW ID: ${suggestedId}`);
        console.log('   ' + '-'.repeat(50));
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📝 RECOMMENDED ACTIONS:');
    console.log('='.repeat(80));
    
    if (problematicClaims.length > 0) {
      console.log(`1. 🔧 FIX ${problematicClaims.length} claims with incorrect/missing document numbers`);
      console.log('2. 🛠️  UPDATE claim ID generation code to ensure CLM prefix');
      console.log('3. ✅ VERIFY that new claims get proper CLM-YYYYMMDD-HHMM-XXXXX-XXXX format');
    } else {
      console.log('✅ All claim IDs are in correct format! No action needed.');
    }
    
    console.log('\n🔍 EXPECTED FORMAT: CLM-YYYYMMDD-HHMM-XXXXX-XXXX');
    console.log('   Example: CLM-20250906-1032-QWSDF-P4Z5');
    console.log('   - CLM: Prefix for claims');
    console.log('   - YYYYMMDD: Creation date');
    console.log('   - HHMM: Creation time');
    console.log('   - XXXXX-XXXX: Random alphanumeric codes for uniqueness');
    
    await sql.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

analyzeClaimIds();