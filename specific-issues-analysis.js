// specific-issues-analysis.js
// Identify specific problematic visa applications that need fixing

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

async function analyzeSpecificIssues() {
  console.log('🎯 SPECIFIC VISA WORKFLOW ISSUES ANALYSIS\n');
  console.log('=' + '='.repeat(79));

  try {
    // 1. Applications that should be further along based on their approval steps
    console.log('\n1. APPLICATIONS WITH STATUS/STEPS MISMATCH:');
    console.log('-'.repeat(50));
    
    const statusMismatches = await sql`
      WITH latest_approval AS (
        SELECT 
          visa_id,
          step_role,
          status,
          step_date,
          ROW_NUMBER() OVER (PARTITION BY visa_id ORDER BY created_at DESC) as rn
        FROM visa_approval_steps
      ),
      approval_progress AS (
        SELECT 
          visa_id,
          MAX(CASE WHEN step_role = 'Department Focal' AND status = 'Approved' THEN 1 ELSE 0 END) as focal_approved,
          MAX(CASE WHEN step_role = 'Line Manager' AND status = 'Approved' THEN 1 ELSE 0 END) as manager_approved,
          MAX(CASE WHEN step_role = 'HOD' AND status = 'Approved' THEN 1 ELSE 0 END) as hod_approved,
          MAX(CASE WHEN step_role = 'Visa Admin' AND status = 'Completed' THEN 1 ELSE 0 END) as visa_admin_completed
        FROM visa_approval_steps
        GROUP BY visa_id
      )
      SELECT 
        va.id,
        va.requestor_name,
        va.department,
        va.status as current_status,
        va.submitted_date,
        EXTRACT(DAYS FROM NOW() - va.submitted_date) as days_old,
        ap.focal_approved,
        ap.manager_approved,
        ap.hod_approved,
        ap.visa_admin_completed,
        la.step_role as latest_step_role,
        la.status as latest_step_status,
        CASE 
          WHEN va.status = 'Pending Line Manager' AND ap.manager_approved = 1 THEN 'MANAGER_APPROVED_BUT_PENDING'
          WHEN va.status = 'Pending HOD' AND ap.hod_approved = 1 THEN 'HOD_APPROVED_BUT_PENDING'
          WHEN va.status LIKE '%Pending%' AND ap.visa_admin_completed = 1 THEN 'COMPLETED_BUT_PENDING'
          WHEN va.status = 'Processing with Visa Admin' AND ap.visa_admin_completed = 1 THEN 'ADMIN_COMPLETED_BUT_PROCESSING'
          WHEN va.status = 'Pending Department Focal' AND ap.focal_approved = 1 THEN 'FOCAL_APPROVED_BUT_PENDING'
          ELSE NULL
        END as issue_type
      FROM visa_applications va
      LEFT JOIN approval_progress ap ON va.id = ap.visa_id
      LEFT JOIN latest_approval la ON va.id = la.visa_id AND la.rn = 1
      WHERE va.status != 'Draft'
      ORDER BY va.submitted_date DESC;
    `;
    
    const problemApps = statusMismatches.filter(app => app.issue_type !== null);
    
    console.log(`Found ${problemApps.length} applications with status/steps mismatches:\n`);
    
    problemApps.forEach(app => {
      console.log(`🔍 ${app.id} (${app.requestor_name})`);
      console.log(`   Current Status: ${app.current_status}`);
      console.log(`   Issue: ${app.issue_type.replace(/_/g, ' ')}`);
      console.log(`   Days Old: ${app.days_old}`);
      console.log(`   Latest Step: ${app.latest_step_role} (${app.latest_step_status})`);
      console.log(`   Progress: Focal:${app.focal_approved ? '✅' : '❌'} Manager:${app.manager_approved ? '✅' : '❌'} HOD:${app.hod_approved ? '✅' : '❌'} Admin:${app.visa_admin_completed ? '✅' : '❌'}`);
      console.log('');
    });

    // 2. Applications stuck at specific stages for too long
    console.log('\n2. APPLICATIONS STUCK TOO LONG AT EACH STAGE:');
    console.log('-'.repeat(50));
    
    const stuckApplications = await sql`
      SELECT 
        va.id,
        va.requestor_name,
        va.department,
        va.status,
        va.submitted_date,
        va.last_updated_date,
        EXTRACT(DAYS FROM NOW() - va.submitted_date) as days_since_submission,
        EXTRACT(DAYS FROM NOW() - va.last_updated_date) as days_since_update,
        CASE 
          WHEN va.status = 'Pending Department Focal' AND EXTRACT(DAYS FROM NOW() - va.submitted_date) > 3 THEN 'FOCAL_STUCK'
          WHEN va.status = 'Pending Line Manager' AND EXTRACT(DAYS FROM NOW() - va.last_updated_date) > 3 THEN 'MANAGER_STUCK'
          WHEN va.status = 'Pending HOD' AND EXTRACT(DAYS FROM NOW() - va.last_updated_date) > 5 THEN 'HOD_STUCK'
          WHEN va.status = 'Processing with Visa Admin' AND EXTRACT(DAYS FROM NOW() - va.last_updated_date) > 10 THEN 'ADMIN_STUCK'
          ELSE NULL
        END as stuck_type
      FROM visa_applications va
      WHERE va.status LIKE '%Pending%' OR va.status = 'Processing with Visa Admin'
      ORDER BY va.submitted_date ASC;
    `;
    
    const stuckApps = stuckApplications.filter(app => app.stuck_type !== null);
    
    console.log(`Found ${stuckApps.length} applications stuck for too long:\n`);
    
    stuckApps.forEach(app => {
      console.log(`⏱️  ${app.id} (${app.requestor_name})`);
      console.log(`   Status: ${app.status}`);
      console.log(`   Stuck Type: ${app.stuck_type.replace(/_/g, ' ')}`);
      console.log(`   Submitted: ${app.days_since_submission} days ago`);
      console.log(`   Last Updated: ${app.days_since_update} days ago`);
      console.log('');
    });

    // 3. Applications with incomplete approval step sequences
    console.log('\n3. APPLICATIONS WITH INCOMPLETE APPROVAL SEQUENCES:');
    console.log('-'.repeat(50));
    
    const incompleteSequences = await sql`
      WITH step_counts AS (
        SELECT 
          visa_id,
          COUNT(DISTINCT step_role) as unique_roles,
          COUNT(*) as total_steps,
          STRING_AGG(DISTINCT step_role, ', ' ORDER BY step_role) as roles_involved,
          MAX(CASE WHEN status = 'Submitted' THEN 1 ELSE 0 END) as has_submitted,
          MAX(CASE WHEN status = 'Approved' OR status = 'Completed' THEN 1 ELSE 0 END) as has_approvals
        FROM visa_approval_steps
        GROUP BY visa_id
      )
      SELECT 
        va.id,
        va.requestor_name,
        va.status,
        va.submitted_date,
        sc.unique_roles,
        sc.total_steps,
        sc.roles_involved,
        sc.has_submitted,
        sc.has_approvals,
        CASE 
          WHEN sc.unique_roles = 1 AND sc.has_submitted = 1 AND sc.has_approvals = 0 THEN 'NO_APPROVALS_YET'
          WHEN va.status = 'Processed' AND sc.unique_roles < 4 THEN 'PROCESSED_TOO_FEW_STEPS'
          WHEN va.status LIKE '%HOD%' AND sc.roles_involved NOT LIKE '%Department Focal%' THEN 'MISSING_FOCAL_STEP'
          WHEN va.status LIKE '%HOD%' AND sc.roles_involved NOT LIKE '%Line Manager%' THEN 'MISSING_MANAGER_STEP'
          ELSE NULL
        END as sequence_issue
      FROM visa_applications va
      LEFT JOIN step_counts sc ON va.id = sc.visa_id
      WHERE va.status != 'Draft'
      ORDER BY va.submitted_date DESC;
    `;
    
    const sequenceIssues = incompleteSequences.filter(app => app.sequence_issue !== null);
    
    console.log(`Found ${sequenceIssues.length} applications with incomplete sequences:\n`);
    
    sequenceIssues.forEach(app => {
      console.log(`🔗 ${app.id} (${app.requestor_name})`);
      console.log(`   Status: ${app.status}`);
      console.log(`   Issue: ${app.sequence_issue.replace(/_/g, ' ')}`);
      console.log(`   Roles Involved: ${app.roles_involved || 'None'}`);
      console.log(`   Steps: ${app.total_steps} (${app.unique_roles} unique roles)`);
      console.log('');
    });

    // 4. Generate specific fix recommendations
    console.log('\n4. SPECIFIC FIX RECOMMENDATIONS:');
    console.log('='.repeat(50));
    
    const allIssues = [...problemApps, ...stuckApps, ...sequenceIssues];
    const uniqueIssues = [...new Set(allIssues.map(app => app.id))];
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`  Total applications analyzed: ${statusMismatches.length}`);
    console.log(`  Applications with issues: ${uniqueIssues.length}`);
    console.log(`  Status/Steps mismatches: ${problemApps.length}`);
    console.log(`  Stuck applications: ${stuckApps.length}`);
    console.log(`  Sequence issues: ${sequenceIssues.length}`);
    
    console.log(`\n🔧 IMMEDIATE ACTIONS NEEDED:`);
    
    if (problemApps.length > 0) {
      console.log(`\n  1. Fix Status Mismatches (${problemApps.length} apps):`);
      problemApps.forEach(app => {
        if (app.issue_type === 'HOD_APPROVED_BUT_PENDING') {
          console.log(`     - ${app.id}: Move from "${app.current_status}" to "Processing with Visa Admin"`);
        } else if (app.issue_type === 'MANAGER_APPROVED_BUT_PENDING') {
          console.log(`     - ${app.id}: Move from "${app.current_status}" to "Pending HOD"`);
        } else if (app.issue_type === 'ADMIN_COMPLETED_BUT_PROCESSING') {
          console.log(`     - ${app.id}: Move from "${app.current_status}" to "Processed"`);
        }
      });
    }
    
    if (stuckApps.length > 0) {
      console.log(`\n  2. Escalate Stuck Applications (${stuckApps.length} apps):`);
      stuckApps.forEach(app => {
        console.log(`     - ${app.id}: ${app.stuck_type.replace(/_/g, ' ')} (${app.days_since_update} days)`);
      });
    }
    
    console.log(`\n  3. System-Level Fixes Needed:`);
    console.log(`     - Implement automated status updates when approval steps complete`);
    console.log(`     - Add workflow step validation to prevent status mismatches`);
    console.log(`     - Migrate to new workflow_instances system for better tracking`);
    console.log(`     - Add automated escalation for applications stuck beyond thresholds`);

    // 5. Generate SQL fixes for the specific issues found
    console.log('\n\n5. SQL FIXES FOR IMMEDIATE ISSUES:');
    console.log('-'.repeat(50));
    
    if (problemApps.length > 0) {
      console.log('\n-- Fix status mismatches (run these SQL commands):');
      
      problemApps.forEach(app => {
        let newStatus = app.current_status;
        
        if (app.issue_type === 'HOD_APPROVED_BUT_PENDING') {
          newStatus = 'Processing with Visa Admin';
        } else if (app.issue_type === 'MANAGER_APPROVED_BUT_PENDING') {
          newStatus = 'Pending HOD';
        } else if (app.issue_type === 'ADMIN_COMPLETED_BUT_PROCESSING') {
          newStatus = 'Processed';
        }
        
        if (newStatus !== app.current_status) {
          console.log(`UPDATE visa_applications SET status = '${newStatus}', last_updated_date = NOW() WHERE id = '${app.id}'; -- ${app.requestor_name}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  } finally {
    await sql.end();
    console.log('\n🎯 Specific issues analysis completed.');
  }
}

analyzeSpecificIssues().catch(console.error);