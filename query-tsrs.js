const postgres = require('postgres');

// Database configuration
const sql = postgres({
  host: 'localhost',
  database: 'syntra',
  username: 'postgres',
  password: '221202',
  ssl: false
});

async function investigateTSRs() {
  console.log('Investigating TSR workflow inconsistency...\n');
  
  const tsrIds = ['TSR-20250717-1443-TUR-BVJM', 'TSR-20250702-1158-ASB-GVC4'];
  
  for (const tsrId of tsrIds) {
    console.log(`\n=== ${tsrId} ===`);
    
    // 1. Check main travel_requests record
    console.log('\n1. Travel Requests Table:');
    try {
      const trfRecord = await sql`
        SELECT id, requestor_name, status, travel_type, purpose, 
               submitted_at, created_at, updated_at, staff_id, department
        FROM travel_requests 
        WHERE id = ${tsrId}
      `;
      
      if (trfRecord.length > 0) {
        console.log(JSON.stringify(trfRecord[0], null, 2));
      } else {
        console.log(`No travel_requests record found for ${tsrId}`);
      }
    } catch (err) {
      console.error('Error querying travel_requests:', err.message);
    }
    
    // 2. Check workflow_executions
    console.log('\n2. Workflow Executions:');
    try {
      const workflowExecs = await sql`
        SELECT we.id as execution_id, we.request_id, we.request_type, 
               we.current_step_number, we.status as workflow_status, 
               we.started_at, we.completed_at,
               wt.name as workflow_template_name
        FROM workflow_executions we
        LEFT JOIN workflow_templates wt ON we.workflow_id = wt.id
        WHERE we.request_id = ${tsrId}
      `;
      
      if (workflowExecs.length > 0) {
        workflowExecs.forEach(exec => console.log(JSON.stringify(exec, null, 2)));
      } else {
        console.log(`No workflow_executions found for ${tsrId}`);
      }
    } catch (err) {
      console.error('Error querying workflow_executions:', err.message);
    }
    
    // 3. Check step_executions
    console.log('\n3. Step Executions:');
    try {
      const stepExecs = await sql`
        SELECT se.id as step_id, we.request_id, se.step_number, 
               se.assigned_role, se.status as step_status, 
               se.started_at, se.completed_at, se.action_taken_by, se.comments,
               u.name as action_by_name, u.email as action_by_email
        FROM step_executions se
        JOIN workflow_executions we ON se.execution_id = we.id
        LEFT JOIN users u ON se.action_taken_by = u.id
        WHERE we.request_id = ${tsrId}
        ORDER BY se.step_number
      `;
      
      if (stepExecs.length > 0) {
        stepExecs.forEach(step => console.log(JSON.stringify(step, null, 2)));
      } else {
        console.log(`No step_executions found for ${tsrId}`);
      }
    } catch (err) {
      console.error('Error querying step_executions:', err.message);
    }
    
    // 4. Check TRF approval steps (legacy)
    console.log('\n4. TRF Approval Steps (Legacy):');
    try {
      const approvalSteps = await sql`
        SELECT id, trf_id, step_role, step_name, status as step_status, 
               step_date, comments, assigned_by, assigned_at
        FROM trf_approval_steps 
        WHERE trf_id = ${tsrId}
        ORDER BY step_date
      `;
      
      if (approvalSteps.length > 0) {
        approvalSteps.forEach(step => console.log(JSON.stringify(step, null, 2)));
      } else {
        console.log(`No trf_approval_steps found for ${tsrId}`);
      }
    } catch (err) {
      console.error('Error querying trf_approval_steps:', err.message);
    }
    
    console.log('\n' + '='.repeat(50));
  }
  
  // 5. Check overall pattern with approved TSRs
  console.log('\n\n=== OVERALL ANALYSIS ===');
  console.log('\n5. Count of Approved TSRs with Active Workflows:');
  try {
    const analysis = await sql`
      SELECT 
        COUNT(*) as total_approved_tsrs,
        COUNT(CASE WHEN we.status = 'active' THEN 1 END) as active_workflows_count,
        COUNT(CASE WHEN we.status = 'completed' THEN 1 END) as completed_workflows_count,
        COUNT(CASE WHEN we.status IS NULL THEN 1 END) as no_workflow_count
      FROM travel_requests tr
      LEFT JOIN workflow_executions we ON tr.id = we.request_id AND we.request_type = 'trf'
      WHERE tr.status ILIKE '%approved%'
    `;
    
    console.log(JSON.stringify(analysis[0], null, 2));
  } catch (err) {
    console.error('Error in analysis query:', err.message);
  }
  
  // 6. Show all problematic TSRs
  console.log('\n6. All TSRs with "Approved" status but Active Workflows:');
  try {
    const problematic = await sql`
      SELECT 
        tr.id,
        tr.requestor_name,
        tr.status as tsr_status,
        we.status as workflow_status,
        we.current_step_number,
        we.started_at,
        wt.name as workflow_name
      FROM travel_requests tr
      LEFT JOIN workflow_executions we ON tr.id = we.request_id AND we.request_type = 'trf'
      LEFT JOIN workflow_templates wt ON we.workflow_id = wt.id
      WHERE tr.status ILIKE '%approved%' AND we.status = 'active'
      ORDER BY tr.submitted_at DESC
      LIMIT 20
    `;
    
    if (problematic.length > 0) {
      problematic.forEach(tsr => console.log(JSON.stringify(tsr, null, 2)));
    } else {
      console.log('No problematic TSRs found');
    }
  } catch (err) {
    console.error('Error querying problematic TSRs:', err.message);
  }
  
  await sql.end();
}

investigateTSRs().catch(console.error);