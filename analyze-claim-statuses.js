#!/usr/bin/env node

require('dotenv').config();
const postgres = require('postgres');

async function analyzeClaimStatuses() {
  const sql = postgres({
    host: process.env.DATABASE_HOST || 'localhost',
    database: process.env.DATABASE_NAME || 'syntra',
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.NODE_ENV === 'production'
  });

  try {
    console.log('🔍 Analyzing current claim statuses in database...\n');
    
    // 1. Get all unique statuses from database
    const currentStatuses = await sql`
      SELECT 
        status, 
        COUNT(*) as count,
        MIN(created_at) as first_seen,
        MAX(created_at) as last_seen
      FROM expense_claims 
      WHERE status IS NOT NULL
      GROUP BY status 
      ORDER BY count DESC
    `;
    
    console.log('📊 Current claim statuses in database:');
    console.log('═'.repeat(70));
    currentStatuses.forEach(row => {
      console.log(`   📋 "${row.status}": ${row.count} claims (First: ${row.first_seen?.toDateString()}, Last: ${row.last_seen?.toDateString()})`);
    });
    
    // 2. Compare with TypeScript definitions
    const expectedStatuses = [
      'Pending Verification',
      'Pending Department Focal', 
      'Pending Line Manager', 
      'Pending HOD', 
      'Approved',
      'Processing with Claims Admin',
      'Processed',
      'Rejected', 
      'Cancelled'
    ];
    
    console.log('\n🎯 Expected claim statuses (from TypeScript types):');
    console.log('═'.repeat(50));
    expectedStatuses.forEach(status => {
      const found = currentStatuses.find(s => s.status === status);
      console.log(`   ${found ? '✅' : '❌'} "${status}": ${found ? `${found.count} claims` : 'NOT FOUND in database'}`);
    });
    
    // 3. Find database statuses not in TypeScript
    const databaseStatusNames = currentStatuses.map(s => s.status);
    const unexpectedStatuses = databaseStatusNames.filter(status => !expectedStatuses.includes(status));
    
    if (unexpectedStatuses.length > 0) {
      console.log('\n⚠️ Database statuses NOT in TypeScript types:');
      console.log('═'.repeat(50));
      unexpectedStatuses.forEach(status => {
        const statusData = currentStatuses.find(s => s.status === status);
        console.log(`   🔴 "${status}": ${statusData.count} claims - NEEDS ATTENTION`);
      });
    }
    
    // 4. Analyze workflow issues
    console.log('\n🔄 Workflow Analysis:');
    console.log('═'.repeat(40));
    
    const approvedClaims = currentStatuses.find(s => s.status === 'Approved');
    const processingClaims = currentStatuses.find(s => s.status === 'Processing with Claims Admin');
    const processedClaims = currentStatuses.find(s => s.status === 'Processed');
    
    if (approvedClaims) {
      console.log(`   📝 "Approved": ${approvedClaims.count} claims`);
      console.log('      🤔 ISSUE: Should these be "Processing with Claims Admin"?');
      console.log('      💡 After HOD approval, claims should go to Claims Admin, not stay "Approved"');
    }
    
    if (processingClaims) {
      console.log(`   ⚙️ "Processing with Claims Admin": ${processingClaims.count} claims`);
      console.log('      ✅ GOOD: This is the correct status after HOD approval');
    }
    
    if (processedClaims) {
      console.log(`   ✅ "Processed": ${processedClaims.count} claims`);
      console.log('      ✅ GOOD: Final status when Claims Admin completes processing');
    }
    
    // 5. Check for legacy statuses that need migration
    const legacyStatuses = [
      'Pending Finance Approval',
      'Pending HOD Approval', 
      'Reimbursement Completed',
      'Finance Approved'
    ];
    
    console.log('\n🕰️ Legacy Status Check:');
    console.log('═'.repeat(30));
    
    for (const legacyStatus of legacyStatuses) {
      const found = currentStatuses.find(s => s.status === legacyStatus);
      if (found) {
        console.log(`   📜 "${legacyStatus}": ${found.count} claims`);
        
        // Suggest migration
        if (legacyStatus === 'Pending Finance Approval') {
          console.log('      🔄 MIGRATE TO: "Processing with Claims Admin"');
        } else if (legacyStatus === 'Pending HOD Approval') {
          console.log('      🔄 MIGRATE TO: "Pending HOD"');
        } else if (legacyStatus === 'Reimbursement Completed' || legacyStatus === 'Finance Approved') {
          console.log('      🔄 MIGRATE TO: "Processed"');
        }
      }
    }
    
    // 6. Check recent claims with concerning statuses
    console.log('\n🔍 Recent Claims Analysis (Last 30 days):');
    console.log('═'.repeat(45));
    
    const recentClaims = await sql`
      SELECT status, COUNT(*) as count
      FROM expense_claims 
      WHERE created_at >= NOW() - INTERVAL '30 days'
      AND status IS NOT NULL
      GROUP BY status 
      ORDER BY count DESC
    `;
    
    recentClaims.forEach(row => {
      const isProblematic = !expectedStatuses.includes(row.status) || row.status === 'Approved';
      console.log(`   ${isProblematic ? '⚠️' : '✅'} "${row.status}": ${row.count} recent claims${isProblematic ? ' - NEEDS REVIEW' : ''}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('📝 SUMMARY RECOMMENDATIONS:');
    console.log('='.repeat(80));
    
    if (approvedClaims && approvedClaims.count > 0) {
      console.log('1. 🔄 MIGRATE "Approved" status claims to "Processing with Claims Admin"');
    }
    
    const pendingFinance = currentStatuses.find(s => s.status === 'Pending Finance Approval');
    if (pendingFinance) {
      console.log('2. 🔄 MIGRATE "Pending Finance Approval" to "Processing with Claims Admin"');
    }
    
    const reimburseComplete = currentStatuses.find(s => s.status === 'Reimbursement Completed');
    if (reimburseComplete) {
      console.log('3. 🔄 MIGRATE "Reimbursement Completed" to "Processed"');
    }
    
    if (unexpectedStatuses.length > 0) {
      console.log('4. 🧹 CLEAN UP unexpected statuses: ' + unexpectedStatuses.join(', '));
    }
    
    console.log('5. 📧 FIX notification for requestor when claim reaches final approval');
    
    await sql.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

analyzeClaimStatuses();