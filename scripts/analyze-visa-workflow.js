#!/usr/bin/env node

require('dotenv').config();
const postgres = require('postgres');

async function analyzeVisaWorkflow() {
  const sql = postgres({
    host: process.env.DATABASE_HOST || 'localhost',
    database: process.env.DATABASE_NAME || 'syntra',
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.NODE_ENV === 'production'
  });

  try {
    console.log('🔍 Analyzing current visa workflow and templates...\n');
    
    // 1. Check current visa statuses in database
    console.log('📊 Current visa statuses in database:');
    const visaStatuses = await sql`
      SELECT 
        status, 
        COUNT(*) as count,
        MIN(created_at) as first_seen,
        MAX(created_at) as last_seen
      FROM visa_applications 
      WHERE status IS NOT NULL
      GROUP BY status 
      ORDER BY count DESC
    `;
    
    console.log('═'.repeat(80));
    if (visaStatuses.length === 0) {
      console.log('   ❌ No visa applications found in database');
    } else {
      visaStatuses.forEach(row => {
        console.log(`   📋 "${row.status}": ${row.count} applications (${row.first_seen?.toDateString()} - ${row.last_seen?.toDateString()})`);
      });
    }
    
    // 2. Check visa notification templates
    console.log('\n📧 Current visa notification templates:');
    const visaTemplates = await sql`
      SELECT name, subject, recipient_type, description
      FROM notification_templates 
      WHERE name LIKE '%visa%' 
      ORDER BY name
    `;
    
    console.log('═'.repeat(80));
    if (visaTemplates.length === 0) {
      console.log('   ❌ No visa notification templates found');
    } else {
      visaTemplates.forEach(t => {
        console.log(`   📋 ${t.name} (${t.recipient_type})`);
        console.log(`      Subject: ${t.subject}`);
        console.log(`      Description: ${t.description || 'None'}`);
        console.log('      ' + '-'.repeat(50));
      });
    }
    
    // 3. Compare with expected workflow templates (based on transport/claims)
    console.log('\n🎯 EXPECTED visa workflow templates (based on transport/claims pattern):');
    const expectedTemplates = [
      'visa_submission_to_focal',           // When visa submitted → Focal
      'visa_focal_approved_to_manager',     // Focal approved → Manager
      'visa_manager_approved_to_hod',       // Manager approved → HOD
      'visa_hod_approved_to_admin',         // HOD approved → Visa Admin (MAIN FIX)
      'visa_hod_approved_to_requestor',     // HOD approved → Requestor notification (MAIN FIX)
      'visa_admin_completed_to_requestor',  // Visa Admin completed → Requestor (MAIN FIX)
      'visa_rejected'                       // Rejected → Requestor
    ];
    
    console.log('═'.repeat(80));
    expectedTemplates.forEach(expectedName => {
      const exists = visaTemplates.find(t => t.name === expectedName);
      console.log(`   ${exists ? '✅' : '❌'} ${expectedName}: ${exists ? 'EXISTS' : 'MISSING'}`);
    });
    
    // 4. Check current visa types in TypeScript
    console.log('\n📝 CURRENT vs EXPECTED workflow:');
    console.log('═'.repeat(80));
    console.log('   CURRENT (WRONG):');
    console.log('     Department Focal → Line Manager → HOD → "Processing with Embassy" ❌');
    console.log('   ');
    console.log('   EXPECTED (LIKE TRANSPORT/CLAIMS):');
    console.log('     Department Focal → Line Manager → HOD → "Processing with Visa Admin" ✅');
    console.log('   ');
    console.log('   NOTIFICATIONS NEEDED:');
    console.log('     1. HOD approval → Visa Admin (TO: Visa Admin, CC: Requestor)');
    console.log('     2. HOD approval → Requestor (TO: Requestor - separate notification)');
    console.log('     3. Visa Admin completion → Requestor (TO: Requestor only)');
    
    // 5. Check for problematic visa statuses
    const problematicStatuses = visaStatuses.filter(vs => 
      vs.status.includes('Embassy') || 
      vs.status === 'Approved' ||
      !['Pending Department Focal', 'Pending Line Manager', 'Pending HOD', 
        'Processing with Visa Admin', 'Processed', 'Rejected', 'Cancelled'].includes(vs.status)
    );
    
    if (problematicStatuses.length > 0) {
      console.log('\n⚠️ PROBLEMATIC visa statuses found:');
      console.log('═'.repeat(50));
      problematicStatuses.forEach(status => {
        console.log(`   🔴 "${status.status}": ${status.count} applications - NEEDS RENAMING`);
        if (status.status.includes('Embassy')) {
          console.log(`      → Should be: "Processing with Visa Admin"`);
        } else if (status.status === 'Approved') {
          console.log(`      → Should be: "Processing with Visa Admin"`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📝 SUMMARY RECOMMENDATIONS:');
    console.log('='.repeat(80));
    
    const missingTemplates = expectedTemplates.filter(expected => 
      !visaTemplates.find(existing => existing.name === expected)
    );
    
    if (missingTemplates.length > 0) {
      console.log(`1. 📧 CREATE ${missingTemplates.length} missing templates:`);
      missingTemplates.forEach(template => console.log(`   - ${template}`));
    }
    
    if (problematicStatuses.length > 0) {
      console.log(`2. 🔄 MIGRATE ${problematicStatuses.length} problematic visa status(es)`);
    }
    
    console.log('3. 🛠️ UPDATE visa workflow action route to match transport/claims pattern');
    console.log('4. 🔧 UPDATE visa types to include "Processing with Visa Admin" status');
    
    await sql.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

analyzeVisaWorkflow();