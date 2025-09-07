#!/usr/bin/env node

require('dotenv').config();
const postgres = require('postgres');

async function migrateVisaStatuses() {
  const sql = postgres({
    host: process.env.DATABASE_HOST || 'localhost',
    database: process.env.DATABASE_NAME || 'syntra',
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.NODE_ENV === 'production'
  });

  try {
    console.log('🔄 Migrating visa statuses to match transport/claims workflow...\n');
    
    // 1. Check what we're starting with
    console.log('📊 BEFORE migration - Current visa statuses:');
    const beforeStats = await sql`
      SELECT status, COUNT(*) as count
      FROM visa_applications 
      WHERE status IS NOT NULL
      GROUP BY status 
      ORDER BY count DESC
    `;
    
    console.log('═'.repeat(60));
    beforeStats.forEach(row => {
      console.log(`   📋 "${row.status}": ${row.count} applications`);
    });
    
    // 2. Migration mappings
    const statusMigrations = [
      {
        from: 'Processing with Embassy',
        to: 'Processing with Visa Admin',
        reason: 'Updated to match transport/claims workflow pattern'
      },
      {
        from: 'Pending Visa Clerk',
        to: 'Processing with Visa Admin',
        reason: 'Visa Clerk is now Visa Admin, goes directly after HOD approval'
      },
      {
        from: 'Visa Issued',
        to: 'Processed',
        reason: 'Final status renamed to match transport/claims (Processed)'
      },
      {
        from: 'Approved',
        to: 'Processed',
        reason: 'Final status renamed to match transport/claims (Processed)'
      }
    ];
    
    let totalMigrated = 0;
    
    console.log('\n🔄 Performing status migrations:');
    console.log('═'.repeat(60));
    
    for (const migration of statusMigrations) {
      // Check if we have applications with this status
      const appsToMigrate = await sql`
        SELECT id, requestor_name, destination, status
        FROM visa_applications 
        WHERE status = ${migration.from}
      `;
      
      if (appsToMigrate.length === 0) {
        console.log(`✅ "${migration.from}" → "${migration.to}": No applications to migrate`);
        continue;
      }
      
      console.log(`🔄 "${migration.from}" → "${migration.to}": Migrating ${appsToMigrate.length} application(s)`);
      console.log(`   Reason: ${migration.reason}`);
      
      // Show details of applications being migrated
      appsToMigrate.forEach((app, index) => {
        console.log(`   ${index + 1}. ${app.requestor_name} - ${app.destination || 'No destination'} (ID: ${app.id})`);
      });
      
      // Perform the migration
      const updateResult = await sql`
        UPDATE visa_applications 
        SET status = ${migration.to}, last_updated_date = NOW()
        WHERE status = ${migration.from}
      `;
      
      console.log(`   ✅ Successfully migrated ${updateResult.count} application(s)\n`);
      totalMigrated += updateResult.count;
    }
    
    // 3. Verify migrations
    console.log('🔍 AFTER migration - Updated visa statuses:');
    const afterStats = await sql`
      SELECT status, COUNT(*) as count
      FROM visa_applications 
      WHERE status IS NOT NULL
      GROUP BY status 
      ORDER BY count DESC
    `;
    
    console.log('═'.repeat(60));
    afterStats.forEach(row => {
      const isExpected = [
        'Pending Department Focal',
        'Pending Line Manager', 
        'Pending HOD',
        'Processing with Visa Admin',
        'Processed',
        'Rejected',
        'Cancelled'
      ].includes(row.status);
      
      console.log(`   ${isExpected ? '✅' : '⚠️'} "${row.status}": ${row.count} applications`);
    });
    
    // 4. Check for any remaining problematic statuses
    console.log('\n⚠️ Checking for remaining problematic statuses:');
    const expectedStatuses = [
      'Draft',
      'Pending Department Focal',
      'Pending Line Manager', 
      'Pending HOD',
      'Processing with Visa Admin',
      'Processed',
      'Rejected',
      'Cancelled'
    ];
    
    const problematicAfter = afterStats.filter(s => !expectedStatuses.includes(s.status));
    
    if (problematicAfter.length === 0) {
      console.log('✅ SUCCESS: All visa statuses now follow the correct workflow pattern!');
    } else {
      console.log('❌ Still have problematic statuses:');
      problematicAfter.forEach(s => console.log(`   🔴 "${s.status}": ${s.count} applications`));
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📝 MIGRATION SUMMARY:');
    console.log('='.repeat(80));
    console.log(`✅ Total applications migrated: ${totalMigrated}`);
    console.log('✅ Visa workflow now matches transport/claims pattern:');
    console.log('   Department Focal → Line Manager → HOD → Processing with Visa Admin → Processed');
    console.log('✅ Visa Admin will now receive HOD approval notifications');
    console.log('✅ Requestors will get approval notifications like other workflows');
    
    await sql.end();
    
  } catch (error) {
    console.error('❌ Migration Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

migrateVisaStatuses();