const postgres = require('postgres');
const config = require('./config.js');

const sql = postgres({
  host: config.database.host,
  port: config.database.port,
  database: config.database.database,
  username: config.database.user,
  password: config.database.password,
});

async function fixWorkflowsAndClaims() {
  try {
    console.log('🔧 Starting workflow and claims system fixes...');

    // 1. Create claims approval steps table if it doesn't exist
    console.log('1. Creating claims approval steps table...');
    await sql`
      CREATE TABLE IF NOT EXISTS claims_approval_steps (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
          claim_id TEXT NOT NULL REFERENCES expense_claims(id) ON DELETE CASCADE,
          step_role TEXT NOT NULL,
          step_name TEXT,
          status TEXT NOT NULL DEFAULT 'Not Started',
          step_date TIMESTAMPTZ,
          comments TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TRIGGER set_timestamp_claims_approval_steps
      BEFORE UPDATE ON claims_approval_steps
      FOR EACH ROW
      EXECUTE FUNCTION trigger_set_timestamp()
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_claims_approval_steps_claim_id ON claims_approval_steps(claim_id)
    `;

    // 2. Clear existing mock workflow data
    console.log('2. Clearing existing mock workflow data...');
    await sql`DELETE FROM workflow_step_executions`;
    await sql`DELETE FROM workflow_instances`;
    await sql`DELETE FROM workflow_steps`;
    await sql`DELETE FROM workflow_templates`;

    // 3. Create proper workflow templates
    console.log('3. Creating proper workflow templates...');

    // TRF Workflow
    const trfWorkflow = await sql`
      INSERT INTO workflow_templates (name, description, module, is_active)
      VALUES ('TRF Standard Approval', 'Travel Request Form standard approval workflow', 'trf', true)
      RETURNING id
    `;

    await sql`
      INSERT INTO workflow_steps (workflow_template_id, step_number, step_name, required_role, description, is_mandatory, can_delegate, timeout_days, escalation_role)
      VALUES 
        (${trfWorkflow[0].id}, 1, 'Department Focal Verification', 'Department Focal', 'Initial verification of travel request by department focal point', true, false, 2, 'Line Manager'),
        (${trfWorkflow[0].id}, 2, 'Line Manager Approval', 'Line Manager', 'Direct supervisor approval for travel request', true, true, 3, 'HOD'),
        (${trfWorkflow[0].id}, 3, 'HOD Final Approval', 'HOD', 'Head of Department final approval (for high-cost or international travel)', false, false, 5, null)
    `;

    // Transport Workflow
    const transportWorkflow = await sql`
      INSERT INTO workflow_templates (name, description, module, is_active)
      VALUES ('Transport Standard Approval', 'Transport request standard approval workflow', 'transport', true)
      RETURNING id
    `;

    await sql`
      INSERT INTO workflow_steps (workflow_template_id, step_number, step_name, required_role, description, is_mandatory, can_delegate, timeout_days, escalation_role)
      VALUES 
        (${transportWorkflow[0].id}, 1, 'Line Manager Approval', 'Line Manager', 'Direct supervisor approval for transport request', true, true, 2, 'HOD'),
        (${transportWorkflow[0].id}, 2, 'Department Focal Review', 'Department Focal', 'Department focal point review and verification', true, false, 2, 'HOD'),
        (${transportWorkflow[0].id}, 3, 'HOD Approval', 'HOD', 'Head of Department approval (if required based on cost)', false, false, 3, null)
    `;

    // Visa Workflow
    const visaWorkflow = await sql`
      INSERT INTO workflow_templates (name, description, module, is_active)
      VALUES ('Visa Standard Approval', 'Visa application standard approval and processing workflow', 'visa', true)
      RETURNING id
    `;

    await sql`
      INSERT INTO workflow_steps (workflow_template_id, step_number, step_name, required_role, description, is_mandatory, can_delegate, timeout_days, escalation_role)
      VALUES 
        (${visaWorkflow[0].id}, 1, 'Department Focal Verification', 'Department Focal', 'Verify visa application details and supporting documents', true, false, 1, 'Line Manager'),
        (${visaWorkflow[0].id}, 2, 'Line Manager Approval', 'Line Manager', 'Supervisor approval for visa application and travel purpose', true, true, 2, 'HOD'),
        (${visaWorkflow[0].id}, 3, 'HR Processing', 'HR Admin', 'HR processes visa application with embassy/consulate', true, false, 5, 'HR Manager')
    `;

    // Claims Workflow
    const claimsWorkflow = await sql`
      INSERT INTO workflow_templates (name, description, module, is_active)
      VALUES ('Claims Standard Approval', 'Expense claims standard verification and approval workflow', 'claims', true)
      RETURNING id
    `;

    await sql`
      INSERT INTO workflow_steps (workflow_template_id, step_number, step_name, required_role, description, is_mandatory, can_delegate, timeout_days, escalation_role)
      VALUES 
        (${claimsWorkflow[0].id}, 1, 'Finance Verification', 'Finance Clerk', 'Verify expense claim documents and amounts', true, false, 2, 'Finance Manager'),
        (${claimsWorkflow[0].id}, 2, 'Department Focal Review', 'Department Focal', 'Department focal point review of expense justification', true, false, 2, 'Line Manager'),
        (${claimsWorkflow[0].id}, 3, 'HOD Final Approval', 'HOD', 'Final approval by Head of Department (for high-value claims)', false, false, 3, null)
    `;

    // Accommodation Workflow
    const accommodationWorkflow = await sql`
      INSERT INTO workflow_templates (name, description, module, is_active)
      VALUES ('Accommodation Standard Approval', 'Accommodation request standard approval workflow', 'accommodation', true)
      RETURNING id
    `;

    await sql`
      INSERT INTO workflow_steps (workflow_template_id, step_number, step_name, required_role, description, is_mandatory, can_delegate, timeout_days, escalation_role)
      VALUES 
        (${accommodationWorkflow[0].id}, 1, 'Accommodation Admin Review', 'Accommodation Admin', 'Check availability and review accommodation request', true, false, 1, 'Accommodation Manager'),
        (${accommodationWorkflow[0].id}, 2, 'Line Manager Approval', 'Line Manager', 'Supervisor approval for accommodation booking', true, true, 2, 'HOD'),
        (${accommodationWorkflow[0].id}, 3, 'Final Processing', 'Accommodation Manager', 'Final booking confirmation and processing', true, false, 1, null)
    `;

    // 4. Show summary
    console.log('4. Checking results...');
    const workflows = await sql`
      SELECT 
        wt.name,
        wt.module,
        COUNT(ws.id) as step_count
      FROM workflow_templates wt
      LEFT JOIN workflow_steps ws ON wt.id = ws.workflow_template_id
      GROUP BY wt.id, wt.name, wt.module
      ORDER BY wt.module
    `;

    console.log('\n✅ Workflow System Fixed Successfully!');
    console.log('\n📋 Current Workflows:');
    workflows.forEach(w => {
      console.log(`  ${w.module.toUpperCase()}: ${w.name} (${w.step_count} steps)`);
    });

    console.log('\n🎯 What was fixed:');
    console.log('  ✓ Added missing claims_approval_steps table');
    console.log('  ✓ Replaced mock workflows with real system workflows');
    console.log('  ✓ All 5 modules now have proper workflows: TRF, Transport, Visa, Claims, Accommodation');
    console.log('  ✓ Workflows match your actual approval system structure');

    await sql.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error fixing workflows:', error);
    process.exit(1);
  }
}

fixWorkflowsAndClaims();