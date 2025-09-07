#!/usr/bin/env node

require('dotenv').config();
const postgres = require('postgres');

async function migrateApprovedClaims() {
  const sql = postgres({
    host: process.env.DATABASE_HOST || 'localhost',
    database: process.env.DATABASE_NAME || 'syntra',
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.NODE_ENV === 'production'
  });

  try {
    console.log('🔄 Starting migration of "Approved" status claims...\n');
    
    // 1. First, let's see what we're working with
    console.log('📊 Before Migration - Current Status Distribution:');
    const beforeStats = await sql`
      SELECT status, COUNT(*) as count
      FROM expense_claims 
      GROUP BY status 
      ORDER BY count DESC
    `;
    
    beforeStats.forEach(row => {
      console.log(`   📋 "${row.status}": ${row.count} claims`);
    });
    
    // 2. Get details of claims that will be migrated
    console.log('\n🔍 Claims to be migrated from "Approved" to "Processing with Claims Admin":');
    const claimsToMigrate = await sql`
      SELECT 
        id, 
        document_number, 
        staff_name, 
        purpose_of_claim, 
        total_advance_claim_amount,
        created_at,
        updated_at
      FROM expense_claims 
      WHERE status = 'Approved'
      ORDER BY created_at DESC
    `;
    
    if (claimsToMigrate.length === 0) {
      console.log('   ✅ No claims found with "Approved" status. Migration not needed.');
      await sql.end();
      return;
    }
    
    console.log(`   📝 Found ${claimsToMigrate.length} claims to migrate:`);
    claimsToMigrate.forEach((claim, index) => {
      console.log(`   ${index + 1}. ${claim.document_number} - ${claim.staff_name} - ${claim.purpose_of_claim} ($${claim.total_advance_claim_amount || 0})`);
    });
    
    // 3. Perform the migration
    console.log('\n🔄 Performing migration...');
    
    const updateResult = await sql`
      UPDATE expense_claims 
      SET 
        status = 'Processing with Claims Admin',
        updated_at = NOW()
      WHERE status = 'Approved'
    `;
    
    console.log(`✅ Successfully migrated ${updateResult.count} claims`);
    
    // 4. Create approval steps for migrated claims (if they don't exist)
    console.log('\n📝 Adding approval steps for migrated claims...');
    
    for (const claim of claimsToMigrate) {
      // Check if HOD approval step exists
      const existingHODStep = await sql`
        SELECT id FROM claims_approval_steps 
        WHERE claim_id = ${claim.id} 
        AND step_role = 'HOD' 
        AND status = 'Approved'
      `;
      
      if (existingHODStep.length === 0) {
        // Add HOD approval step
        await sql`
          INSERT INTO claims_approval_steps (
            claim_id, step_role, step_name, status, step_date, comments
          ) VALUES (
            ${claim.id}, 'HOD', 'HOD', 'Approved', NOW(), 
            'Migrated: Previously approved claim now ready for Claims Admin processing'
          )
        `;
        console.log(`   📋 Added HOD approval step for claim ${claim.document_number}`);
      }
    }
    
    // 5. Verify the migration
    console.log('\n🔍 After Migration - Verification:');
    const afterStats = await sql`
      SELECT status, COUNT(*) as count
      FROM expense_claims 
      GROUP BY status 
      ORDER BY count DESC
    `;
    
    afterStats.forEach(row => {
      console.log(`   📋 "${row.status}": ${row.count} claims`);
    });
    
    const stillApproved = afterStats.find(s => s.status === 'Approved');
    if (stillApproved) {
      console.log(`   ❌ ERROR: Still have ${stillApproved.count} claims with "Approved" status!`);
    } else {
      console.log('   ✅ SUCCESS: No more claims with "Approved" status');
    }
    
    const processingClaims = afterStats.find(s => s.status === 'Processing with Claims Admin');
    if (processingClaims) {
      console.log(`   ✅ GOOD: Now have ${processingClaims.count} claims "Processing with Claims Admin"`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📝 MIGRATION SUMMARY:');
    console.log('='.repeat(80));
    console.log(`✅ Migrated ${updateResult.count} claims from "Approved" to "Processing with Claims Admin"`);
    console.log('✅ Added missing HOD approval steps where needed');
    console.log('✅ Claims workflow now consistent with transport workflow');
    console.log('📧 NEXT: Fix requestor notifications for final approval');
    
    await sql.end();
    
  } catch (error) {
    console.error('❌ Migration Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

migrateApprovedClaims();