-- Workflow System Database Migration
-- Creates tables for configurable approval workflows

-- Workflow Templates Table
CREATE TABLE IF NOT EXISTS workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    module VARCHAR(50) NOT NULL CHECK (module IN ('trf', 'claims', 'visa', 'transport', 'accommodation')),
    steps JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(name, module) -- Prevent duplicate workflow names per module
);

-- Workflow Executions Table
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES workflow_templates(id),
    request_id VARCHAR(100) NOT NULL,
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('trf', 'claims', 'visa', 'transport', 'accommodation')),
    current_step_number INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'failed')),
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    INDEX(request_id, request_type),
    INDEX(workflow_id),
    INDEX(status)
);

-- Step Executions Table
CREATE TABLE IF NOT EXISTS step_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID REFERENCES workflow_executions(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    assigned_user_id UUID REFERENCES users(id),
    assigned_role VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'delegated', 'escalated', 'timeout')),
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    action_taken_by UUID REFERENCES users(id),
    comments TEXT,
    delegated_to UUID REFERENCES users(id),
    escalated_to UUID REFERENCES users(id),
    
    UNIQUE(execution_id, step_number),
    INDEX(assigned_user_id),
    INDEX(status),
    INDEX(execution_id)
);

-- Step Timeouts Table (for timeout management)
CREATE TABLE IF NOT EXISTS step_timeouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID REFERENCES workflow_executions(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    timeout_at TIMESTAMP NOT NULL,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(execution_id, step_number),
    INDEX(timeout_at),
    INDEX(processed_at)
);

-- Workflow Audit Log
CREATE TABLE IF NOT EXISTS workflow_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID REFERENCES workflow_executions(id),
    step_number INTEGER,
    action VARCHAR(50) NOT NULL,
    performed_by UUID REFERENCES users(id),
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    
    INDEX(execution_id),
    INDEX(performed_by),
    INDEX(created_at)
);

-- Insert default workflow templates for existing modules
INSERT INTO workflow_templates (name, description, module, steps, is_active, created_by) VALUES
('Standard TRF Approval', 'Default approval workflow for Travel Request Forms', 'trf', 
'[
  {
    "stepNumber": 1,
    "stepName": "Department Focal Review",
    "requiredRole": "Department Focal",
    "description": "Initial review by department focal point",
    "isMandatory": true,
    "canDelegate": true,
    "timeoutDays": 3
  },
  {
    "stepNumber": 2,
    "stepName": "Line Manager Approval",
    "requiredRole": "Line Manager",
    "description": "Approval by direct line manager",
    "isMandatory": true,
    "canDelegate": true,
    "timeoutDays": 5
  },
  {
    "stepNumber": 3,
    "stepName": "HOD Final Approval",
    "requiredRole": "HOD",
    "description": "Final approval by Head of Department",
    "isMandatory": true,
    "canDelegate": false,
    "timeoutDays": 7,
    "escalationRole": "Senior Management"
  }
]'::jsonb, true, (SELECT id FROM users WHERE role = 'Admin' LIMIT 1)),

('Standard Claims Approval', 'Default approval workflow for Expense Claims', 'claims',
'[
  {
    "stepNumber": 1,
    "stepName": "Department Focal Verification",
    "requiredRole": "Department Focal",
    "description": "Verify claim details and supporting documents",
    "isMandatory": true,
    "canDelegate": true,
    "timeoutDays": 3
  },
  {
    "stepNumber": 2,
    "stepName": "Line Manager Approval",
    "requiredRole": "Line Manager", 
    "description": "Approve claim amount and validity",
    "isMandatory": true,
    "canDelegate": true,
    "timeoutDays": 5
  },
  {
    "stepNumber": 3,
    "stepName": "HOD Authorization",
    "requiredRole": "HOD",
    "description": "Final authorization for payment processing",
    "isMandatory": true,
    "canDelegate": false,
    "timeoutDays": 7
  }
]'::jsonb, true, (SELECT id FROM users WHERE role = 'Admin' LIMIT 1)),

('Standard Visa Approval', 'Default approval workflow for Visa Applications', 'visa',
'[
  {
    "stepNumber": 1,
    "stepName": "HR Initial Review",
    "requiredRole": "HR",
    "description": "Review visa application and documentation",
    "isMandatory": true,
    "canDelegate": true,
    "timeoutDays": 2
  },
  {
    "stepNumber": 2,
    "stepName": "Line Manager Endorsement",
    "requiredRole": "Line Manager",
    "description": "Endorse business need for visa",
    "isMandatory": true,
    "canDelegate": true,
    "timeoutDays": 3
  },
  {
    "stepNumber": 3,
    "stepName": "HOD Final Approval",
    "requiredRole": "HOD",
    "description": "Final approval for visa processing",
    "isMandatory": true,
    "canDelegate": false,
    "timeoutDays": 5
  }
]'::jsonb, true, (SELECT id FROM users WHERE role = 'Admin' LIMIT 1)),

('Standard Transport Approval', 'Default approval workflow for Transport Requests', 'transport',
'[
  {
    "stepNumber": 1,
    "stepName": "Line Manager Approval",
    "requiredRole": "Line Manager",
    "description": "Approve transport request and business justification",
    "isMandatory": true,
    "canDelegate": true,
    "timeoutDays": 2
  },
  {
    "stepNumber": 2,
    "stepName": "HOD Authorization",
    "requiredRole": "HOD",
    "description": "Final authorization for transport arrangement",
    "isMandatory": true,
    "canDelegate": false,
    "timeoutDays": 3
  }
]'::jsonb, true, (SELECT id FROM users WHERE role = 'Admin' LIMIT 1)),

('Standard Accommodation Approval', 'Default approval workflow for Accommodation Requests', 'accommodation',
'[
  {
    "stepNumber": 1,
    "stepName": "HR Review",
    "requiredRole": "HR",
    "description": "Review accommodation request and eligibility",
    "isMandatory": true,
    "canDelegate": true,
    "timeoutDays": 2
  },
  {
    "stepNumber": 2,
    "stepName": "Line Manager Approval",
    "requiredRole": "Line Manager",
    "description": "Approve accommodation need",
    "isMandatory": true,
    "canDelegate": true,
    "timeoutDays": 3
  },
  {
    "stepNumber": 3,
    "stepName": "HOD Final Approval",
    "requiredRole": "HOD",
    "description": "Final approval for accommodation booking",
    "isMandatory": true,
    "canDelegate": false,
    "timeoutDays": 5
  }
]'::jsonb, true, (SELECT id FROM users WHERE role = 'Admin' LIMIT 1));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_templates_module_active ON workflow_templates(module, is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_request ON workflow_executions(request_id, request_type);
CREATE INDEX IF NOT EXISTS idx_step_executions_assigned_user ON step_executions(assigned_user_id, status);
CREATE INDEX IF NOT EXISTS idx_step_timeouts_timeout_pending ON step_timeouts(timeout_at) WHERE processed_at IS NULL;

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workflow_templates_updated_at 
    BEFORE UPDATE ON workflow_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_executions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON step_executions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON step_timeouts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_audit_log TO authenticated;