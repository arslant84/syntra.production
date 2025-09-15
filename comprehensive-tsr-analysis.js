// comprehensive-tsr-analysis.js
// Comprehensive analysis of TSR workflow system issues across the entire database

require('dotenv').config();
const postgres = require('postgres');

const sql = postgres({
  host: process.env.DATABASE_HOST || 'localhost',
  database: process.env.DATABASE_NAME || 'syntra',
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || '221202',
  ssl: false,
  max: 5,
  debug: false
});

async function comprehensiveTSRAnalysis() {
  console.log('🔬 COMPREHENSIVE TSR WORKFLOW SYSTEM ANALYSIS\n');
  console.log('=' + '='.repeat(79));

  try {
    // 1. Basic TSR Statistics
    console.log('\n1. TSR DATABASE OVERVIEW:');
    console.log('-'.repeat(50));
    
    const basicStats = await sql`
      SELECT 
        COUNT(*) as total_tsrs,
        COUNT(CASE WHEN status ILIKE '%approved%' THEN 1 END) as approved_tsrs,
        COUNT(CASE WHEN status ILIKE '%pending%' THEN 1 END) as pending_tsrs,
        COUNT(CASE WHEN status ILIKE '%rejected%' THEN 1 END) as rejected_tsrs,
        COUNT(DISTINCT travel_type) as travel_types_count,
        MIN(created_at) as oldest_tsr,
        MAX(created_at) as newest_tsr
      FROM travel_requests;
    `;
    
    const stats = basicStats[0];
    console.log(`📊 Database Overview:`);
    console.log(`  Total TSRs: ${stats.total_tsrs}`);
    console.log(`  Approved TSRs: ${stats.approved_tsrs}`);
    console.log(`  Pending TSRs: ${stats.pending_tsrs}`);
    console.log(`  Rejected TSRs: ${stats.rejected_tsrs}`);
    console.log(`  Travel Types: ${stats.travel_types_count}`);
    console.log(`  Date Range: ${stats.oldest_tsr?.toDateString()} to ${stats.newest_tsr?.toDateString()}`);

    // 2. Status Distribution
    console.log('\n\n2. TSR STATUS DISTRIBUTION:');
    console.log('-'.repeat(50));
    
    const statusDistribution = await sql`
      SELECT 
        status,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM travel_requests), 2) as percentage
      FROM travel_requests 
      GROUP BY status 
      ORDER BY count DESC;
    `;
    
    console.log('Status breakdown:');
    statusDistribution.forEach(status => {
      console.log(`  ${status.status}: ${status.count} (${status.percentage}%)`);
    });

    // 3. Travel Type Analysis
    console.log('\n\n3. TRAVEL TYPE ANALYSIS:');
    console.log('-'.repeat(50));
    
    const travelTypeStats = await sql`
      SELECT 
        travel_type,
        COUNT(*) as total_count,
        COUNT(CASE WHEN status ILIKE '%approved%' THEN 1 END) as approved_count,
        ROUND(COUNT(CASE WHEN status ILIKE '%approved%' THEN 1 END) * 100.0 / COUNT(*), 2) as approval_rate
      FROM travel_requests 
      GROUP BY travel_type 
      ORDER BY total_count DESC;
    `;
    
    console.log('Travel type breakdown:');
    travelTypeStats.forEach(type => {
      console.log(`  ${type.travel_type}: ${type.total_count} total, ${type.approved_count} approved (${type.approval_rate}%)`);
    });

    // 4. Approved TSRs Workflow Analysis
    console.log('\n\n4. APPROVED TSRs WORKFLOW COMPLETENESS:');
    console.log('-'.repeat(50));
    
    // Get all approved TSRs and their approval step coverage
    const approvedTSRAnalysis = await sql`
      WITH approved_tsrs AS (
        SELECT id, requestor_name, status, travel_type, submitted_at, created_at
        FROM travel_requests 
        WHERE status ILIKE '%approved%'
      ),
      approval_steps_summary AS (
        SELECT 
          trf_id,
          COUNT(*) as total_steps,
          COUNT(CASE WHEN step_role = 'Department Focal' THEN 1 END) as has_focal_step,
          COUNT(CASE WHEN step_role = 'Line Manager' THEN 1 END) as has_manager_step,
          COUNT(CASE WHEN step_role = 'HOD' THEN 1 END) as has_hod_step,
          STRING_AGG(step_role, ', ' ORDER BY step_date) as approval_chain
        FROM trf_approval_steps
        WHERE trf_id IN (SELECT id FROM approved_tsrs)
        GROUP BY trf_id
      )
      SELECT 
        a.id,
        a.requestor_name,
        a.status,
        a.travel_type,
        a.submitted_at,
        COALESCE(s.total_steps, 0) as total_approval_steps,
        CASE WHEN s.has_focal_step > 0 THEN 1 ELSE 0 END as has_dept_focal,
        CASE WHEN s.has_manager_step > 0 THEN 1 ELSE 0 END as has_line_manager,
        CASE WHEN s.has_hod_step > 0 THEN 1 ELSE 0 END as has_hod,
        COALESCE(s.approval_chain, 'NO APPROVAL STEPS') as approval_chain
      FROM approved_tsrs a
      LEFT JOIN approval_steps_summary s ON a.id = s.trf_id
      ORDER BY s.total_steps ASC NULLS FIRST, a.submitted_at DESC;
    `;
    
    console.log(`📋 Approved TSRs Analysis (${approvedTSRAnalysis.length} TSRs):`);
    
    // Categorize the issues
    const noSteps = approvedTSRAnalysis.filter(tsr => tsr.total_approval_steps === 0);
    const missingFocal = approvedTSRAnalysis.filter(tsr => tsr.total_approval_steps > 0 && tsr.has_dept_focal === 0);
    const missingManager = approvedTSRAnalysis.filter(tsr => tsr.total_approval_steps > 0 && tsr.has_line_manager === 0);
    const missingHOD = approvedTSRAnalysis.filter(tsr => tsr.total_approval_steps > 0 && tsr.has_hod === 0);
    const complete = approvedTSRAnalysis.filter(tsr => 
      tsr.has_dept_focal === 1 && tsr.has_line_manager === 1 && tsr.has_hod === 1
    );
    
    console.log(`\n📊 Workflow Completeness Summary:`);
    console.log(`  ❌ No approval steps: ${noSteps.length} TSRs`);
    console.log(`  ⚠️  Missing Department Focal: ${missingFocal.length} TSRs`);
    console.log(`  ⚠️  Missing Line Manager: ${missingManager.length} TSRs`);
    console.log(`  ⚠️  Missing HOD: ${missingHOD.length} TSRs`);
    console.log(`  ✅ Complete workflow: ${complete.length} TSRs`);

    // 5. Detailed Issue Analysis
    console.log('\n\n5. DETAILED ISSUE BREAKDOWN:');
    console.log('-'.repeat(50));

    // TSRs with no approval steps at all
    if (noSteps.length > 0) {
      console.log(`\n❌ CRITICAL: TSRs with NO APPROVAL STEPS (${noSteps.length}):`);
      noSteps.slice(0, 10).forEach(tsr => {
        console.log(`    ${tsr.id} | ${tsr.requestor_name} | ${tsr.travel_type} | ${tsr.submitted_at?.toDateString()}`);
      });
      if (noSteps.length > 10) {
        console.log(`    ... and ${noSteps.length - 10} more`);
      }
    }

    // TSRs missing specific steps
    const allMissingSteps = approvedTSRAnalysis.filter(tsr => 
      tsr.total_approval_steps > 0 && 
      (tsr.has_dept_focal === 0 || tsr.has_line_manager === 0 || tsr.has_hod === 0)
    );

    if (allMissingSteps.length > 0) {
      console.log(`\n⚠️  TSRs with INCOMPLETE APPROVAL CHAINS (${allMissingSteps.length}):`);
      allMissingSteps.slice(0, 15).forEach(tsr => {
        const missing = [];
        if (tsr.has_dept_focal === 0) missing.push('Focal');
        if (tsr.has_line_manager === 0) missing.push('Manager');
        if (tsr.has_hod === 0) missing.push('HOD');
        
        console.log(`    ${tsr.id} | ${tsr.requestor_name} | Missing: ${missing.join(', ')} | Chain: ${tsr.approval_chain}`);
      });
      if (allMissingSteps.length > 15) {
        console.log(`    ... and ${allMissingSteps.length - 15} more`);
      }
    }

    // 6. Travel Type Specific Analysis
    console.log('\n\n6. WORKFLOW ISSUES BY TRAVEL TYPE:');
    console.log('-'.repeat(50));
    
    const travelTypeIssues = await sql`
      WITH travel_type_analysis AS (
        SELECT 
          tr.travel_type,
          COUNT(*) as total_approved,
          COUNT(CASE WHEN tas.trf_id IS NULL THEN 1 END) as no_approval_steps,
          COUNT(CASE WHEN tas.focal_count = 0 THEN 1 END) as missing_focal,
          COUNT(CASE WHEN tas.manager_count = 0 THEN 1 END) as missing_manager,
          COUNT(CASE WHEN tas.hod_count = 0 THEN 1 END) as missing_hod
        FROM travel_requests tr
        LEFT JOIN (
          SELECT 
            trf_id,
            COUNT(*) as total_steps,
            COUNT(CASE WHEN step_role = 'Department Focal' THEN 1 END) as focal_count,
            COUNT(CASE WHEN step_role = 'Line Manager' THEN 1 END) as manager_count,
            COUNT(CASE WHEN step_role = 'HOD' THEN 1 END) as hod_count
          FROM trf_approval_steps
          GROUP BY trf_id
        ) tas ON tr.id = tas.trf_id
        WHERE tr.status ILIKE '%approved%'
        GROUP BY tr.travel_type
      )
      SELECT 
        travel_type,
        total_approved,
        no_approval_steps,
        missing_focal,
        missing_manager,
        missing_hod,
        ROUND((no_approval_steps + missing_focal + missing_manager + missing_hod) * 100.0 / total_approved, 2) as pct_with_issues
      FROM travel_type_analysis
      ORDER BY pct_with_issues DESC;
    `;
    
    console.log('Travel type workflow issues:');
    travelTypeIssues.forEach(type => {
      console.log(`  ${type.travel_type}:`);
      console.log(`    Total approved: ${type.total_approved}`);
      console.log(`    No steps: ${type.no_approval_steps}, Missing Focal: ${type.missing_focal}, Missing Manager: ${type.missing_manager}, Missing HOD: ${type.missing_hod}`);
      console.log(`    Issues rate: ${type.pct_with_issues}%`);
      console.log('');
    });

    // 7. Generate the complete list of TSRs that need fixing
    console.log('\n\n7. COMPLETE LIST OF TSRs REQUIRING FIXES:');
    console.log('-'.repeat(50));
    
    const tsrsNeedingFix = await sql`
      WITH fix_candidates AS (
        SELECT 
          tr.id,
          tr.requestor_name,
          tr.status,
          tr.travel_type,
          tr.submitted_at,
          tr.created_at,
          COALESCE(tas.total_steps, 0) as current_steps,
          CASE WHEN NOT EXISTS (
            SELECT 1 FROM trf_approval_steps t 
            WHERE t.trf_id = tr.id AND t.step_role = 'Department Focal'
          ) THEN 1 ELSE 0 END as needs_focal,
          CASE WHEN NOT EXISTS (
            SELECT 1 FROM trf_approval_steps t 
            WHERE t.trf_id = tr.id AND t.step_role = 'Line Manager'
          ) THEN 1 ELSE 0 END as needs_manager,
          CASE WHEN NOT EXISTS (
            SELECT 1 FROM trf_approval_steps t 
            WHERE t.trf_id = tr.id AND t.step_role = 'HOD'
          ) THEN 1 ELSE 0 END as needs_hod,
          (SELECT MAX(step_date) FROM trf_approval_steps WHERE trf_id = tr.id) as latest_step_date
        FROM travel_requests tr
        LEFT JOIN (
          SELECT trf_id, COUNT(*) as total_steps
          FROM trf_approval_steps
          GROUP BY trf_id
        ) tas ON tr.id = tas.trf_id
        WHERE tr.status ILIKE '%approved%'
      )
      SELECT 
        id,
        requestor_name,
        status,
        travel_type,
        submitted_at,
        created_at,
        current_steps,
        needs_focal,
        needs_manager,
        needs_hod,
        (needs_focal + needs_manager + needs_hod) as total_missing_steps,
        COALESCE(latest_step_date, created_at) as reference_timestamp
      FROM fix_candidates
      WHERE (needs_focal + needs_manager + needs_hod) > 0
      ORDER BY (needs_focal + needs_manager + needs_hod) DESC, submitted_at DESC;
    `;

    console.log(`\n📋 Complete Fix List (${tsrsNeedingFix.length} TSRs need workflow fixes):`);
    
    console.log('\n🔧 TSRs grouped by severity:');
    const criticalFixes = tsrsNeedingFix.filter(tsr => tsr.total_missing_steps === 3);
    const majorFixes = tsrsNeedingFix.filter(tsr => tsr.total_missing_steps === 2);
    const minorFixes = tsrsNeedingFix.filter(tsr => tsr.total_missing_steps === 1);
    
    console.log(`  🚨 CRITICAL (missing all 3 steps): ${criticalFixes.length} TSRs`);
    console.log(`  ⚠️  MAJOR (missing 2 steps): ${majorFixes.length} TSRs`);
    console.log(`  📝 MINOR (missing 1 step): ${minorFixes.length} TSRs`);

    // 8. Check for other workflow system integration
    console.log('\n\n8. NEW WORKFLOW SYSTEM INTEGRATION CHECK:');
    console.log('-'.repeat(50));
    
    // Check if TSRs are using the new workflow_executions system
    const workflowSystemCheck = await sql`
      SELECT 
        COUNT(*) as total_approved_tsrs,
        COUNT(CASE WHEN we.id IS NOT NULL THEN 1 END) as tsrs_with_new_workflow,
        COUNT(CASE WHEN we.id IS NULL THEN 1 END) as tsrs_without_new_workflow
      FROM travel_requests tr
      LEFT JOIN workflow_executions we ON tr.id = we.request_id AND we.request_type = 'trf'
      WHERE tr.status ILIKE '%approved%';
    `;
    
    const workflowCheck = workflowSystemCheck[0];
    console.log('New workflow system usage:');
    console.log(`  Total approved TSRs: ${workflowCheck.total_approved_tsrs}`);
    console.log(`  Using new workflow system: ${workflowCheck.tsrs_with_new_workflow}`);
    console.log(`  Using legacy system only: ${workflowCheck.tsrs_without_new_workflow}`);
    
    if (workflowCheck.tsrs_with_new_workflow > 0) {
      console.log(`  Integration rate: ${((workflowCheck.tsrs_with_new_workflow / workflowCheck.total_approved_tsrs) * 100).toFixed(1)}%`);
    }

    // 9. Summary and Recommendations
    console.log('\n\n9. SUMMARY AND RECOMMENDATIONS:');
    console.log('='.repeat(50));
    
    const totalIssues = tsrsNeedingFix.length;
    const totalApproved = approvedTSRAnalysis.length;
    const issueRate = (totalIssues / totalApproved * 100).toFixed(1);
    
    console.log('\n🔍 KEY FINDINGS:');
    console.log(`  📊 Total approved TSRs: ${totalApproved}`);
    console.log(`  ❌ TSRs with workflow issues: ${totalIssues} (${issueRate}%)`);
    console.log(`  🚨 TSRs with no approval steps: ${noSteps.length}`);
    console.log(`  ⚠️  TSRs with incomplete workflows: ${allMissingSteps.length}`);
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('  1. Create comprehensive SQL fix script for all identified issues');
    console.log('  2. Implement automated workflow validation for future TSRs');
    console.log('  3. Add data integrity constraints to prevent incomplete workflows');
    console.log('  4. Consider migrating to the new workflow system consistently');
    console.log(`  5. Priority order: Critical (${criticalFixes.length}) → Major (${majorFixes.length}) → Minor (${minorFixes.length})`);

    // Export the fix data for SQL script generation
    console.log('\n\n10. EXPORTING FIX DATA:');
    console.log('-'.repeat(50));
    console.log(`Exporting ${tsrsNeedingFix.length} TSRs that need workflow fixes...`);
    
    // Write to a JSON file for easier processing
    const fs = require('fs');
    const fixData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalApproved: totalApproved,
        totalNeedingFix: totalIssues,
        criticalCount: criticalFixes.length,
        majorCount: majorFixes.length,
        minorCount: minorFixes.length,
        issueRate: issueRate
      },
      tsrsNeedingFix: tsrsNeedingFix.map(tsr => ({
        id: tsr.id,
        requestorName: tsr.requestor_name,
        status: tsr.status,
        travelType: tsr.travel_type,
        submittedAt: tsr.submitted_at,
        createdAt: tsr.created_at,
        currentSteps: tsr.current_steps,
        needsFocal: tsr.needs_focal === 1,
        needsManager: tsr.needs_manager === 1,
        needsHOD: tsr.needs_hod === 1,
        totalMissingSteps: tsr.total_missing_steps,
        referenceTimestamp: tsr.reference_timestamp
      }))
    };
    
    fs.writeFileSync('tsr-workflow-fix-data.json', JSON.stringify(fixData, null, 2));
    console.log('✅ Fix data exported to: tsr-workflow-fix-data.json');

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  } finally {
    await sql.end();
    console.log('\n🔬 Comprehensive TSR analysis completed.');
  }
}

comprehensiveTSRAnalysis().catch(console.error);