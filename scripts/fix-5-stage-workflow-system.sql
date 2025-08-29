-- =====================================================================================
-- FIX 5-STAGE WORKFLOW SYSTEM
-- Remove redundant templates and ensure clean workflow implementation
-- =====================================================================================

-- STEP 1: Disable legacy/redundant templates that interfere with 5-stage workflow
UPDATE notification_templates SET is_active = false 
WHERE name IN (
  -- Legacy submitted templates (replaced by stage-specific ones)
  'claim_submitted',
  'claim_submitted_approver', 
  'claim_submitted_requestor',
  'transport_submitted',
  'transport_submitted_approver',
  'trf_submitted',
  'trf_submitted_approver', 
  'trf_submitted_requestor',
  'visa_submitted',
  
  -- Legacy approval templates (replaced by stage-specific ones)
  'transport_approved',
  'new_transport_request',
  'trf_fully_approved_requestor'
);

-- STEP 2: Verify the clean 5-stage templates remain active
SELECT 
  'ACTIVE 5-STAGE TEMPLATES' as status,
  COUNT(*) as template_count
FROM notification_templates 
WHERE is_active = true
  AND (name LIKE '%submitted_to_focal%' 
    OR name LIKE '%focal_approved_to_manager%'
    OR name LIKE '%manager_approved_to_hod%' 
    OR name LIKE '%hod_approved_to_admin%'
    OR name LIKE '%admin_completed_to_requestor%');

-- STEP 3: Show remaining active templates (should only be 5-stage + rejections)
SELECT 
  name,
  CASE 
    WHEN name LIKE '%submitted_to_focal%' THEN 'Stage 1'
    WHEN name LIKE '%focal_approved_to_manager%' THEN 'Stage 2'
    WHEN name LIKE '%manager_approved_to_hod%' THEN 'Stage 3'
    WHEN name LIKE '%hod_approved_to_admin%' THEN 'Stage 4'
    WHEN name LIKE '%admin_completed_to_requestor%' THEN 'Stage 5'
    WHEN name LIKE '%rejected%' THEN 'Rejection'
    ELSE 'OTHER'
  END as workflow_stage,
  is_active
FROM notification_templates 
ORDER BY workflow_stage, name;