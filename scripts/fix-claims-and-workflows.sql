-- Fix claims system and workflow templates to match actual system structure

-- 1. First, create the missing claims approval steps table
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
);

-- Create trigger for claims_approval_steps
CREATE TRIGGER set_timestamp_claims_approval_steps
BEFORE UPDATE ON claims_approval_steps
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_claims_approval_steps_claim_id ON claims_approval_steps(claim_id);

-- 2. Now fix the workflow templates to match your actual system
-- Clear existing templates (they were mock data)
DELETE FROM workflow_step_executions;
DELETE FROM workflow_instances;  
DELETE FROM workflow_steps;
DELETE FROM workflow_templates;

-- Create proper workflow templates based on your actual system structure

-- TRF Workflow (based on your existing trf_approval_steps and status patterns)
INSERT INTO workflow_templates (name, description, module, is_active) VALUES
('TRF Standard Approval', 'Travel Request Form standard approval workflow', 'trf', true);

INSERT INTO workflow_steps (workflow_template_id, step_number, step_name, required_role, description, is_mandatory, can_delegate, timeout_days, escalation_role)
SELECT 
    (SELECT id FROM workflow_templates WHERE name = 'TRF Standard Approval'), 
    1, 'Department Focal Verification', 'Department Focal', 'Initial verification of travel request by department focal point', true, false, 2, 'Line Manager'
UNION ALL SELECT 
    (SELECT id FROM workflow_templates WHERE name = 'TRF Standard Approval'), 
    2, 'Line Manager Approval', 'Line Manager', 'Direct supervisor approval for travel request', true, true, 3, 'HOD'
UNION ALL SELECT 
    (SELECT id FROM workflow_templates WHERE name = 'TRF Standard Approval'), 
    3, 'HOD Final Approval', 'HOD', 'Head of Department final approval (for high-cost or international travel)', false, false, 5, NULL;

-- Transport Workflow (based on transport_approval_steps)
INSERT INTO workflow_templates (name, description, module, is_active) VALUES
('Transport Standard Approval', 'Transport request standard approval workflow', 'transport', true);

INSERT INTO workflow_steps (workflow_template_id, step_number, step_name, required_role, description, is_mandatory, can_delegate, timeout_days, escalation_role)
SELECT 
    (SELECT id FROM workflow_templates WHERE name = 'Transport Standard Approval'), 
    1, 'Line Manager Approval', 'Line Manager', 'Direct supervisor approval for transport request', true, true, 2, 'HOD'
UNION ALL SELECT 
    (SELECT id FROM workflow_templates WHERE name = 'Transport Standard Approval'), 
    2, 'Department Focal Review', 'Department Focal', 'Department focal point review and verification', true, false, 2, 'HOD'
UNION ALL SELECT 
    (SELECT id FROM workflow_templates WHERE name = 'Transport Standard Approval'), 
    3, 'HOD Approval', 'HOD', 'Head of Department approval (if required based on cost)', false, false, 3, NULL;

-- Visa Workflow (based on visa_approval_steps)
INSERT INTO workflow_templates (name, description, module, is_active) VALUES
('Visa Standard Approval', 'Visa application standard approval and processing workflow', 'visa', true);

INSERT INTO workflow_steps (workflow_template_id, step_number, step_name, required_role, description, is_mandatory, can_delegate, timeout_days, escalation_role)
SELECT 
    (SELECT id FROM workflow_templates WHERE name = 'Visa Standard Approval'), 
    1, 'Department Focal Verification', 'Department Focal', 'Verify visa application details and supporting documents', true, false, 1, 'Line Manager'
UNION ALL SELECT 
    (SELECT id FROM workflow_templates WHERE name = 'Visa Standard Approval'), 
    2, 'Line Manager Approval', 'Line Manager', 'Supervisor approval for visa application and travel purpose', true, true, 2, 'HOD'
UNION ALL SELECT 
    (SELECT id FROM workflow_templates WHERE name = 'Visa Standard Approval'), 
    3, 'HR Processing', 'HR Admin', 'HR processes visa application with embassy/consulate', true, false, 5, 'HR Manager';

-- Claims Workflow (based on your expense_claims status and permissions)
INSERT INTO workflow_templates (name, description, module, is_active) VALUES
('Claims Standard Approval', 'Expense claims standard verification and approval workflow', 'claims', true);

INSERT INTO workflow_steps (workflow_template_id, step_number, step_name, required_role, description, is_mandatory, can_delegate, timeout_days, escalation_role)
SELECT 
    (SELECT id FROM workflow_templates WHERE name = 'Claims Standard Approval'), 
    1, 'Finance Verification', 'Finance Clerk', 'Verify expense claim documents and amounts', true, false, 2, 'Finance Manager'
UNION ALL SELECT 
    (SELECT id FROM workflow_templates WHERE name = 'Claims Standard Approval'), 
    2, 'Department Focal Review', 'Department Focal', 'Department focal point review of expense justification', true, false, 2, 'Line Manager'
UNION ALL SELECT 
    (SELECT id FROM workflow_templates WHERE name = 'Claims Standard Approval'), 
    3, 'HOD Final Approval', 'HOD', 'Final approval by Head of Department (for high-value claims)', false, false, 3, NULL;

-- Accommodation Workflow (based on your accommodation system)
INSERT INTO workflow_templates (name, description, module, is_active) VALUES
('Accommodation Standard Approval', 'Accommodation request standard approval workflow', 'accommodation', true);

INSERT INTO workflow_steps (workflow_template_id, step_number, step_name, required_role, description, is_mandatory, can_delegate, timeout_days, escalation_role)
SELECT 
    (SELECT id FROM workflow_templates WHERE name = 'Accommodation Standard Approval'), 
    1, 'Accommodation Admin Review', 'Accommodation Admin', 'Check availability and review accommodation request', true, false, 1, 'Accommodation Manager'
UNION ALL SELECT 
    (SELECT id FROM workflow_templates WHERE name = 'Accommodation Standard Approval'), 
    2, 'Line Manager Approval', 'Line Manager', 'Supervisor approval for accommodation booking', true, true, 2, 'HOD'
UNION ALL SELECT 
    (SELECT id FROM workflow_templates WHERE name = 'Accommodation Standard Approval'), 
    3, 'Final Processing', 'Accommodation Manager', 'Final booking confirmation and processing', true, false, 1, NULL;