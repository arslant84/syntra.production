// detailed-workflow-analysis.js
// Deep dive analysis of visa workflow system issues

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

async function detailedWorkflowAnalysis() {
  console.log('🔬 DETAILED VISA WORKFLOW SYSTEM ANALYSIS\n');
  console.log('=' + '='.repeat(79));

  try {
    // 1. Analyze the workflow system integration
    console.log('\n1. WORKFLOW SYSTEM INTEGRATION ANALYSIS:');
    console.log('-'.repeat(50));
    
    // Check if visa applications are integrated with the new workflow system
    const visaWorkflowIntegration = await sql`
      SELECT 
        COUNT(*) as total_visa_apps,
        COUNT(CASE WHEN wi.id IS NOT NULL THEN 1 END) as apps_with_workflow_instances,
        COUNT(CASE WHEN wi.id IS NULL THEN 1 END) as apps_without_workflow_instances
      FROM visa_applications va
      LEFT JOIN workflow_instances wi ON wi.entity_id = va.id AND wi.entity_type = 'visa';
    `;
    
    console.log('Visa Applications vs Workflow Instances:');
    const integration = visaWorkflowIntegration[0];
    console.log(`  Total visa applications: ${integration.total_visa_apps}`);
    console.log(`  Apps with workflow instances: ${integration.apps_with_workflow_instances}`);
    console.log(`  Apps WITHOUT workflow instances: ${integration.apps_without_workflow_instances}`);
    console.log(`  Integration rate: ${((integration.apps_with_workflow_instances / integration.total_visa_apps) * 100).toFixed(1)}%`);

    // 2. Analyze applications using old vs new system
    console.log('\n\n2. OLD vs NEW WORKFLOW SYSTEM USAGE:');
    console.log('-'.repeat(50));
    
    // Applications using old visa_approval_steps system
    const oldSystemApps = await sql`
      SELECT 
        va.id,
        va.requestor_name,
        va.status,
        va.submitted_date,
        COUNT(vas.id) as approval_steps_count,
        MAX(vas.step_date) as latest_step_date,
        STRING_AGG(DISTINCT vas.step_role, ', ' ORDER BY vas.step_role) as steps_involved
      FROM visa_applications va
      LEFT JOIN visa_approval_steps vas ON va.id = vas.visa_id
      WHERE NOT EXISTS (
        SELECT 1 FROM workflow_instances wi 
        WHERE wi.entity_id = va.id AND wi.entity_type = 'visa'
      )
      GROUP BY va.id, va.requestor_name, va.status, va.submitted_date
      ORDER BY va.submitted_date DESC;
    `;
    
    console.log(`Applications using OLD workflow system (${oldSystemApps.length}):`);
    oldSystemApps.forEach(app => {
      console.log(`  ${app.id.substring(0, 12)} | ${app.requestor_name} | ${app.status} | Steps: ${app.approval_steps_count} | Roles: ${app.steps_involved || 'None'}`);
    });

    // Applications using new workflow system
    const newSystemApps = await sql`
      SELECT 
        va.id,
        va.requestor_name,
        va.status,
        va.submitted_date,
        wi.status as workflow_status,
        wi.initiated_at,
        wi.completed_at,
        COUNT(wse.id) as workflow_executions_count
      FROM visa_applications va
      JOIN workflow_instances wi ON wi.entity_id = va.id AND wi.entity_type = 'visa'
      LEFT JOIN workflow_step_executions wse ON wse.workflow_instance_id = wi.id
      GROUP BY va.id, va.requestor_name, va.status, va.submitted_date, wi.status, wi.initiated_at, wi.completed_at
      ORDER BY va.submitted_date DESC;
    `;
    
    console.log(`\nApplications using NEW workflow system (${newSystemApps.length}):`);
    newSystemApps.forEach(app => {
      console.log(`  ${app.id.substring(0, 12)} | ${app.requestor_name} | App: ${app.status} | Workflow: ${app.workflow_status} | Executions: ${app.workflow_executions_count}`);
    });

    // 3. Detailed analysis of problematic applications
    console.log('\n\n3. DETAILED ANALYSIS OF PROBLEMATIC APPLICATIONS:');
    console.log('-'.repeat(50));
    
    // Find applications with status mismatches
    const problematicApps = await sql`
      WITH approval_summary AS (
        SELECT 
          visa_id,
          COUNT(*) as total_steps,
          SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as approved_steps,
          SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed_steps,
          MAX(CASE WHEN step_role = 'HOD' AND status = 'Approved' THEN 1 ELSE 0 END) as hod_approved,
          MAX(CASE WHEN step_role = 'Visa Admin' AND status = 'Completed' THEN 1 ELSE 0 END) as visa_admin_completed,
          STRING_AGG(step_role || ':' || status, ' → ' ORDER BY created_at) as step_sequence
        FROM visa_approval_steps
        GROUP BY visa_id
      )
      SELECT 
        va.id,
        va.requestor_name,
        va.department,
        va.status,
        va.submitted_date,
        va.last_updated_date,
        EXTRACT(DAYS FROM NOW() - va.submitted_date) as days_pending,
        aps.total_steps,
        aps.approved_steps,
        aps.completed_steps,
        aps.hod_approved,
        aps.visa_admin_completed,
        aps.step_sequence,
        CASE 
          WHEN va.status LIKE '%Pending%' AND aps.hod_approved = 1 THEN 'HOD_APPROVED_BUT_PENDING'
          WHEN va.status = 'Processing with Visa Admin' AND aps.visa_admin_completed = 1 THEN 'VISA_ADMIN_COMPLETED_BUT_PROCESSING'
          WHEN va.status = 'Processed' AND aps.visa_admin_completed = 0 THEN 'PROCESSED_WITHOUT_VISA_ADMIN'
          WHEN EXTRACT(DAYS FROM NOW() - va.submitted_date) > 14 AND va.status LIKE '%Pending%' THEN 'STUCK_TOO_LONG'
          ELSE NULL
        END as issue_type
      FROM visa_applications va
      LEFT JOIN approval_summary aps ON va.id = aps.visa_id
      WHERE va.status != 'Draft'
      ORDER BY va.submitted_date DESC;
    `;
    
    const issuesFound = problematicApps.filter(app => app.issue_type !== null);
    
    console.log(`Analysis of ${problematicApps.length} applications (${issuesFound.length} with issues):\n`);
    
    // Group by issue type
    const issuesByType = issuesFound.reduce((acc, app) => {
      if (!acc[app.issue_type]) acc[app.issue_type] = [];
      acc[app.issue_type].push(app);
      return acc;
    }, {});
    
    Object.entries(issuesByType).forEach(([issueType, apps]) => {
      console.log(`📋 ${issueType.replace(/_/g, ' ')} (${apps.length} applications):`);
      apps.forEach(app => {
        console.log(`    ${app.id.substring(0, 12)} | ${app.requestor_name} | ${app.status} | ${app.days_pending} days old`);
        console.log(`      Steps: ${app.step_sequence || 'None'}`);
      });
      console.log('');
    });

    // 4. Workflow step progression analysis
    console.log('\n4. WORKFLOW STEP PROGRESSION ANALYSIS:');
    console.log('-'.repeat(50));
    
    // Analyze step progression patterns
    const stepProgression = await sql`
      WITH step_analysis AS (
        SELECT 
          visa_id,
          step_role,
          status,
          step_date,
          ROW_NUMBER() OVER (PARTITION BY visa_id ORDER BY created_at) as step_order
        FROM visa_approval_steps
      )
      SELECT 
        step_role,
        status,
        COUNT(*) as occurrence_count,
        AVG(step_order) as avg_step_position
      FROM step_analysis
      GROUP BY step_role, status
      ORDER BY step_role, status;
    `;
    
    console.log('Step Role and Status Analysis:');
    stepProgression.forEach(step => {
      const avgPos = Number(step.avg_step_position) || 0;
      console.log(`  ${step.step_role}: ${step.status} (${step.occurrence_count} times, avg position: ${avgPos.toFixed(1)})`);
    });

    // 5. Check for orphaned workflow data
    console.log('\n\n5. ORPHANED WORKFLOW DATA CHECK:');
    console.log('-'.repeat(50));
    
    // Check for workflow instances without corresponding visa applications
    const orphanedWorkflowInstances = await sql`
      SELECT COUNT(*) as orphaned_count
      FROM workflow_instances wi
      WHERE wi.entity_type = 'visa'
        AND NOT EXISTS (
          SELECT 1 FROM visa_applications va WHERE va.id = wi.entity_id
        );
    `;
    
    console.log(`Orphaned workflow instances: ${orphanedWorkflowInstances[0].orphaned_count}`);
    
    // Check for approval steps without corresponding visa applications
    const orphanedApprovalSteps = await sql`
      SELECT COUNT(*) as orphaned_count
      FROM visa_approval_steps vas
      WHERE NOT EXISTS (
        SELECT 1 FROM visa_applications va WHERE va.id = vas.visa_id
      );
    `;
    
    console.log(`Orphaned approval steps: ${orphanedApprovalSteps[0].orphaned_count}`);

    // 6. Recommendations and next steps
    console.log('\n\n6. KEY FINDINGS AND RECOMMENDATIONS:');
    console.log('='.repeat(50));
    
    const findings = [];
    const recommendations = [];
    
    if (integration.apps_without_workflow_instances > 0) {
      findings.push(`❌ ${integration.apps_without_workflow_instances} visa applications are not using the new workflow system`);
      recommendations.push('Migrate existing visa applications to use the new workflow system');
    }
    
    if (issuesFound.length > 0) {
      findings.push(`⚠️  ${issuesFound.length} applications have workflow status inconsistencies`);
      recommendations.push('Implement status synchronization between approval steps and application status');
    }
    
    const stuckApps = issuesFound.filter(app => app.issue_type === 'STUCK_TOO_LONG');
    if (stuckApps.length > 0) {
      findings.push(`🕒 ${stuckApps.length} applications have been pending for more than 2 weeks`);
      recommendations.push('Implement automated escalation for long-pending applications');
    }
    
    const hodApprovedButPending = issuesFound.filter(app => app.issue_type === 'HOD_APPROVED_BUT_PENDING');
    if (hodApprovedButPending.length > 0) {
      findings.push(`🔄 ${hodApprovedButPending.length} applications are approved by HOD but still show as pending`);
      recommendations.push('Fix the status update logic when HOD approval is completed');
    }
    
    console.log('\n🔍 KEY FINDINGS:');
    findings.forEach(finding => console.log(`  ${finding}`));
    
    console.log('\n💡 RECOMMENDATIONS:');
    recommendations.forEach(rec => console.log(`  1. ${rec}`));
    
    if (newSystemApps.length === 0 && oldSystemApps.length > 0) {
      console.log('\n🚨 CRITICAL ISSUE:');
      console.log('  The system appears to be using ONLY the old visa_approval_steps workflow');
      console.log('  The new workflow_instances system is not being utilized for visa applications');
      console.log('  This indicates a significant integration problem that needs immediate attention');
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  } finally {
    await sql.end();
    console.log('\n🔬 Detailed analysis completed.');
  }
}

detailedWorkflowAnalysis().catch(console.error);