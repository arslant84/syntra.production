-- =============================================
-- Approval Workflow Configuration Tables
-- =============================================

-- 1. Workflow Templates Table
-- This defines different types of workflows (TRF, Visa, Transport, etc.)
CREATE TABLE workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE, -- e.g., 'TRF Approval', 'Visa Approval'
    description TEXT,
    module VARCHAR(50) NOT NULL, -- e.g., 'trf', 'visa', 'transport', 'accommodation'
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Workflow Steps Configuration Table  
-- This defines the steps in each workflow template
CREATE TABLE workflow_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL, -- Order of the step (1, 2, 3...)
    step_name VARCHAR(100) NOT NULL, -- e.g., 'Department Focal Review'
    required_role VARCHAR(100) NOT NULL, -- e.g., 'Department Focal', 'Line Manager'
    description TEXT,
    is_mandatory BOOLEAN DEFAULT TRUE, -- Can this step be skipped?
    can_delegate BOOLEAN DEFAULT FALSE, -- Can approver delegate to someone else?
    timeout_days INTEGER, -- Auto-escalation after X days
    escalation_role VARCHAR(100), -- Who to escalate to if timeout
    conditions JSONB, -- Conditional logic (e.g., amount thresholds)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workflow_template_id, step_number)
);

-- 3. Workflow Conditions Table
-- For complex conditional workflows (e.g., different paths based on amount, department)
CREATE TABLE workflow_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_step_id UUID NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
    condition_type VARCHAR(50) NOT NULL, -- 'amount', 'department', 'request_type', etc.
    operator VARCHAR(20) NOT NULL, -- '>', '<', '=', 'in', 'contains'
    condition_value TEXT NOT NULL, -- The value to compare against
    next_step_id UUID REFERENCES workflow_steps(id), -- What step to go to if condition is met
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Active Workflow Instances Table
-- Tracks workflows currently in progress
CREATE TABLE workflow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_template_id UUID NOT NULL REFERENCES workflow_templates(id),
    entity_id TEXT NOT NULL, -- ID of the item being approved (TRF ID, Visa ID, etc.)
    entity_type VARCHAR(50) NOT NULL, -- 'trf', 'visa', 'transport', etc.
    current_step_id UUID REFERENCES workflow_steps(id),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
    initiated_by UUID REFERENCES users(id),
    initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB, -- Store additional context (amounts, departments, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Workflow Step Executions Table  
-- Tracks each step execution in a workflow instance
CREATE TABLE workflow_step_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    workflow_step_id UUID NOT NULL REFERENCES workflow_steps(id),
    assigned_to_role VARCHAR(100) NOT NULL,
    assigned_to_user UUID REFERENCES users(id), -- Specific user if assigned
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'skipped', 'escalated'
    action_taken_by UUID REFERENCES users(id),
    action_taken_at TIMESTAMP WITH TIME ZONE,
    comments TEXT,
    attachments JSONB, -- Store file references if needed
    escalated_from UUID REFERENCES workflow_step_executions(id), -- If this was escalated
    due_date TIMESTAMP WITH TIME ZONE, -- When this step should be completed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Workflow Delegations Table
-- For handling delegated approvals
CREATE TABLE workflow_delegations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegator_id UUID NOT NULL REFERENCES users(id),
    delegate_id UUID NOT NULL REFERENCES users(id), 
    workflow_template_id UUID REFERENCES workflow_templates(id), -- Specific workflow or all
    role_name VARCHAR(100), -- Specific role or all roles for user
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Workflow Audit Log Table
-- Complete audit trail of all workflow activities
CREATE TABLE workflow_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_instance_id UUID REFERENCES workflow_instances(id),
    workflow_step_execution_id UUID REFERENCES workflow_step_executions(id),
    action VARCHAR(100) NOT NULL, -- 'started', 'approved', 'rejected', 'escalated', 'delegated'
    performed_by UUID REFERENCES users(id),
    details JSONB, -- Store action details
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- Indexes for Performance
-- =============================================

CREATE INDEX idx_workflow_instances_entity ON workflow_instances(entity_id, entity_type);
CREATE INDEX idx_workflow_instances_status ON workflow_instances(status);
CREATE INDEX idx_workflow_instances_current_step ON workflow_instances(current_step_id);

CREATE INDEX idx_workflow_step_executions_instance ON workflow_step_executions(workflow_instance_id);
CREATE INDEX idx_workflow_step_executions_status ON workflow_step_executions(status);
CREATE INDEX idx_workflow_step_executions_assigned_user ON workflow_step_executions(assigned_to_user);
CREATE INDEX idx_workflow_step_executions_due_date ON workflow_step_executions(due_date);

CREATE INDEX idx_workflow_delegations_delegator ON workflow_delegations(delegator_id, is_active);
CREATE INDEX idx_workflow_delegations_delegate ON workflow_delegations(delegate_id, is_active);

CREATE INDEX idx_workflow_audit_log_instance ON workflow_audit_log(workflow_instance_id);
CREATE INDEX idx_workflow_audit_log_created_at ON workflow_audit_log(created_at);

-- =============================================
-- Insert Default Workflow Templates
-- =============================================

-- TRF (Travel Request Form) Workflow
INSERT INTO workflow_templates (name, description, module) VALUES 
('TRF Standard Approval', 'Standard approval workflow for Travel Request Forms', 'trf');

-- Get the TRF workflow template ID for steps
DO $$
DECLARE 
    trf_workflow_id UUID;
BEGIN
    SELECT id INTO trf_workflow_id FROM workflow_templates WHERE name = 'TRF Standard Approval';
    
    -- TRF Workflow Steps
    INSERT INTO workflow_steps (workflow_template_id, step_number, step_name, required_role, description) VALUES
    (trf_workflow_id, 1, 'Department Focal Review', 'Department Focal', 'Initial review by department focal point'),
    (trf_workflow_id, 2, 'Line Manager Approval', 'Line Manager', 'Approval by direct line manager'),
    (trf_workflow_id, 3, 'HOD Final Approval', 'HOD', 'Final approval by Head of Department');
END $$;

-- Visa Approval Workflow
INSERT INTO workflow_templates (name, description, module) VALUES 
('Visa Standard Approval', 'Standard approval workflow for Visa Applications', 'visa');

DO $$
DECLARE 
    visa_workflow_id UUID;
BEGIN
    SELECT id INTO visa_workflow_id FROM workflow_templates WHERE name = 'Visa Standard Approval';
    
    -- Visa Workflow Steps
    INSERT INTO workflow_steps (workflow_template_id, step_number, step_name, required_role, description) VALUES
    (visa_workflow_id, 1, 'Document Verification', 'HR Admin', 'Verify all required documents are submitted'),
    (visa_workflow_id, 2, 'Supervisor Approval', 'Line Manager', 'Approval by immediate supervisor'),
    (visa_workflow_id, 3, 'HR Final Review', 'HR Manager', 'Final review and processing by HR');
END $$;

-- Transport Request Workflow
INSERT INTO workflow_templates (name, description, module) VALUES 
('Transport Standard Approval', 'Standard approval workflow for Transport Requests', 'transport');

DO $$
DECLARE 
    transport_workflow_id UUID;
BEGIN
    SELECT id INTO transport_workflow_id FROM workflow_templates WHERE name = 'Transport Standard Approval';
    
    -- Transport Workflow Steps
    INSERT INTO workflow_steps (workflow_template_id, step_number, step_name, required_role, description) VALUES
    (transport_workflow_id, 1, 'Transport Admin Review', 'Transport Admin', 'Review transport request details'),
    (transport_workflow_id, 2, 'Budget Approval', 'Finance Manager', 'Approve budget allocation'),
    (transport_workflow_id, 3, 'Final Authorization', 'Transport Manager', 'Final authorization for transport');
END $$;

-- Accommodation Request Workflow
INSERT INTO workflow_templates (name, description, module) VALUES 
('Accommodation Standard Approval', 'Standard approval workflow for Accommodation Requests', 'accommodation');

DO $$
DECLARE 
    accommodation_workflow_id UUID;
BEGIN
    SELECT id INTO accommodation_workflow_id FROM workflow_templates WHERE name = 'Accommodation Standard Approval';
    
    -- Accommodation Workflow Steps
    INSERT INTO workflow_steps (workflow_template_id, step_number, step_name, required_role, description) VALUES
    (accommodation_workflow_id, 1, 'Accommodation Admin Review', 'Accommodation Admin', 'Review accommodation request'),
    (accommodation_workflow_id, 2, 'Manager Approval', 'Line Manager', 'Approval by line manager'),
    (accommodation_workflow_id, 3, 'Final Booking', 'Accommodation Manager', 'Final booking confirmation');
END $$;

COMMIT;