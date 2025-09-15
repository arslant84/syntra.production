/**
 * Create Workflow Configuration Tables
 * This script creates the database tables needed for approval workflow management
 */

const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  database: process.env.DATABASE_NAME || 'syntra',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD,
  port: process.env.DATABASE_PORT || 5432,
});

async function createWorkflowTables() {
  console.log('🔄 Creating workflow configuration tables...');
  
  try {
    // 1. Create workflow_templates table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workflow_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        module VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Created workflow_templates table');
    
    // 2. Create workflow_steps table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workflow_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL,
        step_name VARCHAR(100) NOT NULL,
        required_role VARCHAR(100) NOT NULL,
        description TEXT,
        is_mandatory BOOLEAN DEFAULT TRUE,
        can_delegate BOOLEAN DEFAULT FALSE,
        timeout_days INTEGER,
        escalation_role VARCHAR(100),
        conditions JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(workflow_template_id, step_number)
      );
    `);
    console.log('✅ Created workflow_steps table');
    
    // 3. Create workflow_instances table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workflow_instances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id),
        entity_id TEXT NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        current_step_id UUID REFERENCES workflow_steps(id),
        status VARCHAR(50) DEFAULT 'pending',
        initiated_by UUID,
        initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Created workflow_instances table');
    
    // 4. Create workflow_step_executions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workflow_step_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
        workflow_step_id UUID NOT NULL REFERENCES workflow_steps(id),
        assigned_to_role VARCHAR(100) NOT NULL,
        assigned_to_user UUID,
        status VARCHAR(50) DEFAULT 'pending',
        action_taken_by UUID,
        action_taken_at TIMESTAMP WITH TIME ZONE,
        comments TEXT,
        attachments JSONB,
        escalated_from UUID REFERENCES workflow_step_executions(id),
        due_date TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✅ Created workflow_step_executions table');
    
    // 5. Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_workflow_instances_entity ON workflow_instances(entity_id, entity_type);
      CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON workflow_instances(status);
      CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_instance ON workflow_step_executions(workflow_instance_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_status ON workflow_step_executions(status);
    `);
    console.log('✅ Created indexes');
    
    // 6. Insert default workflow templates
    console.log('📋 Inserting default workflow templates...');
    
    // Insert TRF workflow
    const trfResult = await pool.query(`
      INSERT INTO workflow_templates (name, description, module) 
      VALUES ('TRF Standard Approval', 'Standard approval workflow for Travel Request Forms', 'trf')
      ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
      RETURNING id
    `);
    
    let trfId;
    if (trfResult.rows.length > 0) {
      trfId = trfResult.rows[0].id;
    } else {
      const existingTrf = await pool.query(`SELECT id FROM workflow_templates WHERE name = 'TRF Standard Approval'`);
      trfId = existingTrf.rows[0].id;
    }
    
    // Insert TRF workflow steps
    await pool.query(`
      INSERT INTO workflow_steps (workflow_template_id, step_number, step_name, required_role, description) VALUES
      ($1, 1, 'Department Focal Review', 'Department Focal', 'Initial review by department focal point'),
      ($1, 2, 'Line Manager Approval', 'Line Manager', 'Approval by direct line manager'),
      ($1, 3, 'HOD Final Approval', 'HOD', 'Final approval by Head of Department')
      ON CONFLICT (workflow_template_id, step_number) 
      DO UPDATE SET updated_at = NOW()
    `, [trfId]);
    console.log('✅ Created TRF workflow');
    
    // Insert Visa workflow
    const visaResult = await pool.query(`
      INSERT INTO workflow_templates (name, description, module) 
      VALUES ('Visa Standard Approval', 'Standard approval workflow for Visa Applications', 'visa')
      ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
      RETURNING id
    `);
    
    let visaId;
    if (visaResult.rows.length > 0) {
      visaId = visaResult.rows[0].id;
    } else {
      const existingVisa = await pool.query(`SELECT id FROM workflow_templates WHERE name = 'Visa Standard Approval'`);
      visaId = existingVisa.rows[0].id;
    }
    
    await pool.query(`
      INSERT INTO workflow_steps (workflow_template_id, step_number, step_name, required_role, description) VALUES
      ($1, 1, 'Document Verification', 'HR Admin', 'Verify all required documents are submitted'),
      ($1, 2, 'Supervisor Approval', 'Line Manager', 'Approval by immediate supervisor'),
      ($1, 3, 'HR Final Review', 'HR Manager', 'Final review and processing by HR')
      ON CONFLICT (workflow_template_id, step_number) 
      DO UPDATE SET updated_at = NOW()
    `, [visaId]);
    console.log('✅ Created Visa workflow');
    
    // Insert Transport workflow
    const transportResult = await pool.query(`
      INSERT INTO workflow_templates (name, description, module) 
      VALUES ('Transport Standard Approval', 'Standard approval workflow for Transport Requests', 'transport')
      ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
      RETURNING id
    `);
    
    let transportId;
    if (transportResult.rows.length > 0) {
      transportId = transportResult.rows[0].id;
    } else {
      const existingTransport = await pool.query(`SELECT id FROM workflow_templates WHERE name = 'Transport Standard Approval'`);
      transportId = existingTransport.rows[0].id;
    }
    
    await pool.query(`
      INSERT INTO workflow_steps (workflow_template_id, step_number, step_name, required_role, description) VALUES
      ($1, 1, 'Transport Admin Review', 'Transport Admin', 'Review transport request details'),
      ($1, 2, 'Budget Approval', 'Finance Manager', 'Approve budget allocation'),
      ($1, 3, 'Final Authorization', 'Transport Manager', 'Final authorization for transport')
      ON CONFLICT (workflow_template_id, step_number) 
      DO UPDATE SET updated_at = NOW()
    `, [transportId]);
    console.log('✅ Created Transport workflow');
    
    // Show created workflows
    const workflows = await pool.query(`
      SELECT wt.name, wt.module, COUNT(ws.id) as steps_count
      FROM workflow_templates wt
      LEFT JOIN workflow_steps ws ON wt.id = ws.workflow_template_id
      GROUP BY wt.id, wt.name, wt.module
      ORDER BY wt.name
    `);
    
    console.log('\n📊 Created Workflows:');
    console.table(workflows.rows);
    
    console.log('\n🎉 Workflow configuration tables created successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Review the created workflow templates in the admin interface');
    console.log('2. Customize workflow steps as needed');
    console.log('3. Configure role mappings');
    console.log('4. Test workflow execution');
    
  } catch (error) {
    console.error('❌ Error creating workflow tables:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Check if required environment variables are set
if (!process.env.DATABASE_PASSWORD) {
  console.error('❌ DATABASE_PASSWORD environment variable is required');
  process.exit(1);
}

// Create the workflow tables
createWorkflowTables();