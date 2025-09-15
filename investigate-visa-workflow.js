// investigate-visa-workflow.js
// Script to investigate visa approval workflow issues

require('dotenv').config();
const postgres = require('postgres');

// Database configuration
const sql = postgres({
  host: process.env.DATABASE_HOST || 'localhost',
  database: process.env.DATABASE_NAME || 'syntra',
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || '221202',
  ssl: false, // Localhost connection
  max: 5, // Reduced for investigation script
  debug: false
});

async function investigateVisaWorkflow() {
  console.log('🔍 INVESTIGATING VISA APPROVAL WORKFLOW SYSTEM\n');
  console.log('=' * 80);

  try {
    // 1. Check visa_applications table structure and current statuses
    console.log('\n1. VISA APPLICATIONS TABLE STRUCTURE AND DATA:');
    console.log('-' * 50);
    
    // Get table structure
    const tableInfo = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'visa_applications'
      ORDER BY ordinal_position;
    `;
    
    console.log('Table Structure:');
    tableInfo.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });
    
    // Get current visa applications and their statuses
    const visaApps = await sql`
      SELECT 
        id,
        requestor_name,
        staff_id,
        department,
        destination,
        status,
        submitted_date,
        last_updated_date
      FROM visa_applications
      ORDER BY submitted_date DESC
      LIMIT 20;
    `;
    
    console.log(`\nFound ${visaApps.length} visa applications:`);
    visaApps.forEach(app => {
      console.log(`  ${app.id.substring(0, 8)}... | ${app.requestor_name} | ${app.department} | Status: ${app.status} | Submitted: ${app.submitted_date?.toISOString().split('T')[0]}`);
    });
    
    // Get status distribution
    const statusDistribution = await sql`
      SELECT status, COUNT(*) as count
      FROM visa_applications
      GROUP BY status
      ORDER BY count DESC;
    `;
    
    console.log('\nStatus Distribution:');
    statusDistribution.forEach(row => {
      console.log(`  ${row.status}: ${row.count} applications`);
    });

    // 2. Check visa_approval_steps table
    console.log('\n\n2. VISA APPROVAL STEPS TABLE:');
    console.log('-' * 50);
    
    // Check if table exists
    const stepTableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'visa_approval_steps'
      );
    `;
    
    if (stepTableExists[0].exists) {
      // Get table structure
      const stepTableInfo = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'visa_approval_steps'
        ORDER BY ordinal_position;
      `;
      
      console.log('Visa Approval Steps Table Structure:');
      stepTableInfo.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
      });
      
      // Get recent approval steps
      const approvalSteps = await sql`
        SELECT 
          vas.id,
          vas.visa_id,
          va.requestor_name,
          va.status as app_status,
          vas.step_role,
          vas.step_name,
          vas.status as step_status,
          vas.step_date,
          vas.comments
        FROM visa_approval_steps vas
        JOIN visa_applications va ON vas.visa_id = va.id
        ORDER BY vas.created_at DESC
        LIMIT 30;
      `;
      
      console.log(`\nFound ${approvalSteps.length} approval steps:`);
      approvalSteps.forEach(step => {
        console.log(`  App: ${step.visa_id.substring(0, 8)}... (${step.requestor_name}) | Step: ${step.step_role} | Status: ${step.step_status} | App Status: ${step.app_status}`);
      });
    } else {
      console.log('❌ visa_approval_steps table does not exist!');
    }

    // 3. Check for workflow-related tables
    console.log('\n\n3. WORKFLOW-RELATED TABLES:');
    console.log('-' * 50);
    
    const workflowTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name LIKE '%workflow%'
      ORDER BY table_name;
    `;
    
    console.log('Workflow tables found:');
    if (workflowTables.length > 0) {
      workflowTables.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
      
      // Check workflow_instances if it exists
      const workflowInstancesExists = workflowTables.some(t => t.table_name === 'workflow_instances');
      if (workflowInstancesExists) {
        const workflowInstances = await sql`
          SELECT 
            wi.id,
            wi.entity_id,
            wi.entity_type,
            wi.status,
            wi.current_step_id,
            wi.initiated_at,
            wi.completed_at,
            wt.name as template_name
          FROM workflow_instances wi
          LEFT JOIN workflow_templates wt ON wi.workflow_template_id = wt.id
          WHERE wi.entity_type = 'visa'
          ORDER BY wi.initiated_at DESC
          LIMIT 20;
        `;
        
        console.log(`\nFound ${workflowInstances.length} visa workflow instances:`);
        workflowInstances.forEach(instance => {
          console.log(`  ${instance.entity_id.substring(0, 8)}... | Template: ${instance.template_name} | Status: ${instance.status} | Initiated: ${instance.initiated_at?.toISOString().split('T')[0]}`);
        });
      }
      
      // Check workflow_step_executions if it exists
      const stepExecutionsExists = workflowTables.some(t => t.table_name === 'workflow_step_executions');
      if (stepExecutionsExists) {
        const stepExecutions = await sql`
          SELECT 
            wse.id,
            wse.workflow_instance_id,
            wi.entity_id,
            wse.assigned_to_role,
            wse.status,
            wse.action_taken_at,
            ws.step_name
          FROM workflow_step_executions wse
          JOIN workflow_instances wi ON wse.workflow_instance_id = wi.id
          LEFT JOIN workflow_steps ws ON wse.workflow_step_id = ws.id
          WHERE wi.entity_type = 'visa'
          ORDER BY wse.created_at DESC
          LIMIT 30;
        `;
        
        console.log(`\nFound ${stepExecutions.length} visa workflow step executions:`);
        stepExecutions.forEach(exec => {
          console.log(`  ${exec.entity_id?.substring(0, 8)}... | Step: ${exec.step_name} | Role: ${exec.assigned_to_role} | Status: ${exec.status} | Taken: ${exec.action_taken_at?.toISOString().split('T')[0] || 'Pending'}`);
        });
      }
    } else {
      console.log('❌ No workflow tables found!');
    }

    // 4. Identify problematic applications
    console.log('\n\n4. PROBLEMATIC APPLICATIONS ANALYSIS:');
    console.log('-' * 50);
    
    // Find applications that might be stuck
    const problemApps = await sql`
      SELECT 
        id,
        requestor_name,
        department,
        status,
        submitted_date,
        last_updated_date,
        EXTRACT(DAYS FROM NOW() - submitted_date) as days_since_submission,
        EXTRACT(DAYS FROM NOW() - last_updated_date) as days_since_update
      FROM visa_applications
      WHERE status IN ('Pending Department Focal', 'Processing with Visa Admin', 'Processed')
        AND submitted_date < NOW() - INTERVAL '7 days'
      ORDER BY submitted_date ASC;
    `;
    
    console.log(`Found ${problemApps.length} potentially problematic applications:`);
    problemApps.forEach(app => {
      console.log(`  ${app.id.substring(0, 8)}... | ${app.requestor_name} | ${app.department} | Status: ${app.status} | ${app.days_since_submission} days old | Last updated: ${app.days_since_update} days ago`);
    });

    // 5. Cross-reference with approval steps
    if (stepTableExists[0].exists) {
      console.log('\n\n5. APPROVAL STEPS vs APPLICATION STATUS MISMATCH:');
      console.log('-' * 50);
      
      const mismatchedApps = await sql`
        WITH latest_steps AS (
          SELECT 
            visa_id,
            step_role,
            step_name,
            status as step_status,
            ROW_NUMBER() OVER (PARTITION BY visa_id ORDER BY created_at DESC) as rn
          FROM visa_approval_steps
        )
        SELECT 
          va.id,
          va.requestor_name,
          va.department,
          va.status as app_status,
          ls.step_role,
          ls.step_name,
          ls.step_status
        FROM visa_applications va
        LEFT JOIN latest_steps ls ON va.id = ls.visa_id AND ls.rn = 1
        WHERE va.status != 'Draft'
        ORDER BY va.submitted_date DESC;
      `;
      
      console.log(`Analysis of ${mismatchedApps.length} applications:`);
      mismatchedApps.forEach(app => {
        const potentialIssue = 
          (app.app_status === 'Approved' && app.step_status !== 'approved') ||
          (app.app_status === 'Processing with Visa Admin' && !app.step_role) ||
          (app.step_status === 'approved' && app.app_status.includes('Pending'));
        
        const indicator = potentialIssue ? '⚠️  ' : '✅ ';
        console.log(`  ${indicator}${app.id.substring(0, 8)}... | ${app.requestor_name} | App: ${app.app_status} | Latest Step: ${app.step_role || 'None'} (${app.step_status || 'None'})`);
      });
    }

    // 6. Summary and recommendations
    console.log('\n\n6. SUMMARY AND ANALYSIS:');
    console.log('=' * 50);
    
    console.log('Issues Identified:');
    if (!stepTableExists[0].exists) {
      console.log('❌ CRITICAL: visa_approval_steps table is missing');
    }
    
    if (workflowTables.length === 0) {
      console.log('❌ CRITICAL: No workflow system tables found');
    }
    
    const oldPendingApps = problemApps.filter(app => 
      app.status.includes('Pending') && app.days_since_submission > 7
    );
    
    if (oldPendingApps.length > 0) {
      console.log(`⚠️  ${oldPendingApps.length} applications have been pending for more than 7 days`);
    }
    
    console.log('\nRecommendations:');
    console.log('1. Verify workflow tables are properly created');
    console.log('2. Check if workflow instances are being created for visa applications');
    console.log('3. Ensure approval step records are being updated when status changes');
    console.log('4. Implement proper status synchronization between workflow steps and application status');

  } catch (error) {
    console.error('❌ Investigation failed:', error);
  } finally {
    await sql.end();
    console.log('\n🔍 Investigation completed.');
  }
}

// Run the investigation
investigateVisaWorkflow().catch(console.error);