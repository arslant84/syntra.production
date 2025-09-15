-- Investigation Script for TSR Workflow Display Issues
-- TSRs: TSR-20250717-1443-TUR-BVJM and TSR-20250702-1158-ASB-GVC4

-- 1. Check main travel_requests table for both TSRs
SELECT 
    id,
    requestor_name,
    status,
    travel_type,
    purpose,
    submitted_at,
    created_at,
    updated_at,
    staff_id,
    department
FROM travel_requests 
WHERE id IN ('TSR-20250717-1443-TUR-BVJM', 'TSR-20250702-1158-ASB-GVC4')
ORDER BY id;

-- 2. Check workflow_executions table for both TSRs
SELECT 
    we.id as execution_id,
    we.request_id,
    we.request_type,
    we.current_step_number,
    we.status as workflow_status,
    we.started_at,
    we.completed_at,
    wt.name as workflow_template_name
FROM workflow_executions we
LEFT JOIN workflow_templates wt ON we.workflow_id = wt.id
WHERE we.request_id IN ('TSR-20250717-1443-TUR-BVJM', 'TSR-20250702-1158-ASB-GVC4')
ORDER BY we.request_id, we.started_at;

-- 3. Check step_executions for both TSRs
SELECT 
    se.id as step_id,
    we.request_id,
    se.step_number,
    se.assigned_role,
    se.status as step_status,
    se.started_at,
    se.completed_at,
    se.action_taken_by,
    se.comments,
    u.name as action_by_name,
    u.email as action_by_email
FROM step_executions se
JOIN workflow_executions we ON se.execution_id = we.id
LEFT JOIN users u ON se.action_taken_by = u.id
WHERE we.request_id IN ('TSR-20250717-1443-TUR-BVJM', 'TSR-20250702-1158-ASB-GVC4')
ORDER BY we.request_id, se.step_number;

-- 4. Check workflow_audit_log for both TSRs
SELECT 
    wal.id,
    we.request_id,
    wal.step_number,
    wal.action,
    wal.performed_by,
    wal.details,
    wal.created_at,
    u.name as performed_by_name,
    u.email as performed_by_email
FROM workflow_audit_log wal
JOIN workflow_executions we ON wal.execution_id = we.id
LEFT JOIN users u ON wal.performed_by = u.id
WHERE we.request_id IN ('TSR-20250717-1443-TUR-BVJM', 'TSR-20250702-1158-ASB-GVC4')
ORDER BY we.request_id, wal.created_at;

-- 5. Check TRF approval steps (legacy system) for both TSRs
SELECT 
    id,
    trf_id,
    step_role,
    step_name,
    status as step_status,
    step_date,
    comments,
    assigned_by,
    assigned_at
FROM trf_approval_steps 
WHERE trf_id IN ('TSR-20250717-1443-TUR-BVJM', 'TSR-20250702-1158-ASB-GVC4')
ORDER BY trf_id, step_date;

-- 6. Check if there are any TSRs with similar status issues
SELECT 
    COUNT(*) as total_approved_tsrs,
    COUNT(CASE WHEN we.status = 'active' THEN 1 END) as active_workflows_count,
    COUNT(CASE WHEN we.status = 'completed' THEN 1 END) as completed_workflows_count,
    COUNT(CASE WHEN we.status IS NULL THEN 1 END) as no_workflow_count
FROM travel_requests tr
LEFT JOIN workflow_executions we ON tr.id = we.request_id AND we.request_type = 'trf'
WHERE tr.status ILIKE '%approved%';

-- 7. Show all TSRs with "Approved" status but active workflows
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
ORDER BY tr.submitted_at DESC;

-- 8. Check current workflow step details for problematic TSRs
SELECT 
    tr.id as tsr_id,
    tr.status as tsr_status,
    we.current_step_number,
    se.step_number,
    se.assigned_role,
    se.status as step_status,
    se.started_at as step_started,
    se.completed_at as step_completed,
    wt.steps::text as workflow_definition
FROM travel_requests tr
LEFT JOIN workflow_executions we ON tr.id = we.request_id AND we.request_type = 'trf'
LEFT JOIN step_executions se ON we.id = se.execution_id AND se.step_number = we.current_step_number
LEFT JOIN workflow_templates wt ON we.workflow_id = wt.id
WHERE tr.id IN ('TSR-20250717-1443-TUR-BVJM', 'TSR-20250702-1158-ASB-GVC4');

-- 9. Check for any orphaned workflow executions
SELECT 
    we.id,
    we.request_id,
    we.request_type,
    we.status,
    tr.id as travel_request_exists
FROM workflow_executions we
LEFT JOIN travel_requests tr ON we.request_id = tr.id
WHERE we.request_id IN ('TSR-20250717-1443-TUR-BVJM', 'TSR-20250702-1158-ASB-GVC4');

-- 10. Show workflow template structure for TRF
SELECT 
    id,
    name,
    module,
    steps::text,
    is_active
FROM workflow_templates
WHERE module = 'trf' AND is_active = true;