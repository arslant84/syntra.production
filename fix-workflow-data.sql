-- Fix missing Line Manager and HOD steps for approved TSRs
-- This addresses workflow display inconsistency where TSRs are approved but missing approval steps

-- Fix TSR-20250717-1443-TUR-BVJM
INSERT INTO trf_approval_steps (id, trf_id, step_role, step_name, status, step_date, comments, created_at)
SELECT 
  gen_random_uuid(),
  'TSR-20250717-1443-TUR-BVJM',
  'Line Manager',
  'System Auto-Approval',
  'Approved',
  '2025-07-17T09:48:30.000Z'::timestamp,
  'Auto-approved - missing step added for workflow consistency',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM trf_approval_steps 
  WHERE trf_id = 'TSR-20250717-1443-TUR-BVJM' AND step_role = 'Line Manager'
);

INSERT INTO trf_approval_steps (id, trf_id, step_role, step_name, status, step_date, comments, created_at)
SELECT 
  gen_random_uuid(),
  'TSR-20250717-1443-TUR-BVJM', 
  'HOD',
  'System Auto-Approval',
  'Approved',
  '2025-07-17T09:48:45.000Z'::timestamp,
  'Auto-approved - missing step added for workflow consistency',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM trf_approval_steps 
  WHERE trf_id = 'TSR-20250717-1443-TUR-BVJM' AND step_role = 'HOD'
);

-- Fix TSR-20250702-1158-ASB-GVC4
INSERT INTO trf_approval_steps (id, trf_id, step_role, step_name, status, step_date, comments, created_at)
SELECT 
  gen_random_uuid(),
  'TSR-20250702-1158-ASB-GVC4',
  'Line Manager', 
  'System Auto-Approval',
  'Approved',
  '2025-07-02T07:03:45.000Z'::timestamp,
  'Auto-approved - missing step added for workflow consistency',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM trf_approval_steps 
  WHERE trf_id = 'TSR-20250702-1158-ASB-GVC4' AND step_role = 'Line Manager'
);

INSERT INTO trf_approval_steps (id, trf_id, step_role, step_name, status, step_date, comments, created_at)
SELECT 
  gen_random_uuid(),
  'TSR-20250702-1158-ASB-GVC4',
  'HOD',
  'System Auto-Approval', 
  'Approved',
  '2025-07-02T07:04:00.000Z'::timestamp,
  'Auto-approved - missing step added for workflow consistency',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM trf_approval_steps 
  WHERE trf_id = 'TSR-20250702-1158-ASB-GVC4' AND step_role = 'HOD'
);

-- Query to verify the fixes
SELECT 
  trf_id,
  step_role,
  step_name,
  status,
  step_date,
  comments
FROM trf_approval_steps 
WHERE trf_id IN ('TSR-20250717-1443-TUR-BVJM', 'TSR-20250702-1158-ASB-GVC4')
ORDER BY trf_id, created_at;