#!/usr/bin/env node

require('dotenv').config();
const postgres = require('postgres');

async function fixClaimIds() {
  const sql = postgres({
    host: process.env.DATABASE_HOST || 'localhost',
    database: process.env.DATABASE_NAME || 'syntra',
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.NODE_ENV === 'production'
  });

  try {
    console.log('🔧 Fixing claim IDs that don\'t follow CLM naming convention...\n');
    
    // Get claims with incorrect format
    const problematicClaims = await sql`
      SELECT 
        id as internal_id,
        document_number,
        staff_name,
        purpose_of_claim,
        created_at,
        status
      FROM expense_claims 
      WHERE document_number IS NOT NULL 
      AND document_number NOT SIMILAR TO 'CLM-[0-9]{8}-[0-9]{4}-[A-Z0-9]{5}-[A-Z0-9]{4}'
      ORDER BY created_at DESC
    `;
    
    console.log(`📊 Found ${problematicClaims.length} claims with incorrect ID format:`);
    
    if (problematicClaims.length === 0) {
      console.log('✅ All claim IDs are in correct format! No fixing needed.');
      await sql.end();
      return;
    }
    
    console.log('═'.repeat(80));
    
    const fixedClaims = [];
    
    for (let i = 0; i < problematicClaims.length; i++) {
      const claim = problematicClaims[i];
      console.log(`${i + 1}. FIXING: ${claim.document_number}`);
      console.log(`   Staff: ${claim.staff_name}`);
      console.log(`   Created: ${claim.created_at}`);
      console.log(`   Status: ${claim.status}`);
      
      // Generate new correct ID based on creation date
      const createdDate = new Date(claim.created_at);
      const year = createdDate.getFullYear();
      const month = String(createdDate.getMonth() + 1).padStart(2, '0');
      const day = String(createdDate.getDate()).padStart(2, '0');
      const hours = String(createdDate.getHours()).padStart(2, '0');
      const minutes = String(createdDate.getMinutes()).padStart(2, '0');
      
      // Generate random 5+4 character codes (alphanumeric)
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const randomCode1 = Array.from({length: 5}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
      const randomCode2 = Array.from({length: 4}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
      
      const newId = `CLM-${year}${month}${day}-${hours}${minutes}-${randomCode1}-${randomCode2}`;
      
      console.log(`   OLD ID: ${claim.document_number}`);
      console.log(`   NEW ID: ${newId}`);
      
      // Check if new ID already exists (very unlikely but let's be safe)
      const existingCheck = await sql`
        SELECT id FROM expense_claims WHERE document_number = ${newId}
      `;
      
      if (existingCheck.length > 0) {
        console.log(`   ⚠️ ID ${newId} already exists! Generating new one...`);
        // Generate new one with different random codes
        const newRandomCode1 = Array.from({length: 5}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        const newRandomCode2 = Array.from({length: 4}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        const alternateId = `CLM-${year}${month}${day}-${hours}${minutes}-${newRandomCode1}-${newRandomCode2}`;
        console.log(`   ALTERNATE ID: ${alternateId}`);
        
        // Update with alternate ID
        await sql`
          UPDATE expense_claims 
          SET document_number = ${alternateId}, updated_at = NOW()
          WHERE id = ${claim.internal_id}
        `;
        
        fixedClaims.push({
          oldId: claim.document_number,
          newId: alternateId,
          internalId: claim.internal_id,
          staffName: claim.staff_name
        });
        
        console.log(`   ✅ UPDATED to: ${alternateId}`);
      } else {
        // Update with new ID
        await sql`
          UPDATE expense_claims 
          SET document_number = ${newId}, updated_at = NOW()
          WHERE id = ${claim.internal_id}
        `;
        
        fixedClaims.push({
          oldId: claim.document_number,
          newId: newId,
          internalId: claim.internal_id,
          staffName: claim.staff_name
        });
        
        console.log(`   ✅ UPDATED to: ${newId}`);
      }
      
      console.log('   ' + '-'.repeat(50));
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📝 FIXING SUMMARY:');
    console.log('='.repeat(80));
    
    fixedClaims.forEach((fix, index) => {
      console.log(`${index + 1}. ${fix.staffName}`);
      console.log(`   OLD: ${fix.oldId}`);
      console.log(`   NEW: ${fix.newId}`);
    });
    
    // Verify the fixes
    console.log('\n🔍 VERIFICATION - Checking for any remaining incorrect IDs...');
    const remainingProblems = await sql`
      SELECT document_number
      FROM expense_claims 
      WHERE document_number IS NOT NULL 
      AND document_number NOT SIMILAR TO 'CLM-[0-9]{8}-[0-9]{4}-[A-Z0-9]{5}-[A-Z0-9]{4}'
    `;
    
    if (remainingProblems.length === 0) {
      console.log('✅ SUCCESS: All claim IDs now follow the correct CLM-YYYYMMDD-HHMM-XXXXX-XXXX format!');
    } else {
      console.log(`❌ ERROR: Still have ${remainingProblems.length} problematic IDs:`);
      remainingProblems.forEach(p => console.log(`   - ${p.document_number}`));
    }
    
    console.log(`\n🎉 COMPLETED: Fixed ${fixedClaims.length} claim IDs to follow correct naming convention!`);
    
    await sql.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

fixClaimIds();