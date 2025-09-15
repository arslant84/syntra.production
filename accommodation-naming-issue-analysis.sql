-- Accommodation Request Naming Issue Analysis
-- This script analyzes the accommodation request naming inconsistency issue

-- 1. Check if TSR-20250914-1553-TUR-JYV8 exists in travel_requests table
SELECT 
  'TSR-20250914-1553-TUR-JYV8 in travel_requests' as check_name,
  id, 
  requestor_name, 
  travel_type, 
  status, 
  submitted_at,
  additional_comments
FROM travel_requests 
WHERE id = 'TSR-20250914-1553-TUR-JYV8';

-- 2. Check if this TSR has accommodation details
SELECT 
  'Accommodation details for TSR-20250914-1553-TUR-JYV8' as check_name,
  trf_id,
  accommodation_type,
  check_in_date,
  check_out_date,
  location,
  place_of_stay
FROM trf_accommodation_details 
WHERE trf_id = 'TSR-20250914-1553-TUR-JYV8';

-- 3. Find all TSR-style IDs that should be accommodation requests (travel_type = 'Accommodation')
SELECT 
  'TSRs with accommodation travel_type (should be ACCOM- IDs)' as issue_type,
  id,
  requestor_name,
  travel_type,
  status,
  submitted_at,
  additional_comments
FROM travel_requests 
WHERE id LIKE 'TSR-%' 
  AND travel_type = 'Accommodation'
ORDER BY submitted_at DESC;

-- 4. Find TSRs that have accommodation details but haven't been separated
SELECT 
  'TSRs with accommodation details (need separation)' as issue_type,
  tr.id,
  tr.requestor_name,
  tr.travel_type,
  tr.status,
  COUNT(tad.id) as accommodation_details_count
FROM travel_requests tr
INNER JOIN trf_accommodation_details tad ON tr.id = tad.trf_id
WHERE tr.id LIKE 'TSR-%'
  AND tr.travel_type != 'Accommodation'
GROUP BY tr.id, tr.requestor_name, tr.travel_type, tr.status
ORDER BY tr.submitted_at DESC;

-- 5. Find properly named ACCOM- requests for comparison
SELECT 
  'Properly named accommodation requests (ACCOM- prefix)' as check_name,
  id,
  requestor_name,
  travel_type,
  status,
  submitted_at
FROM travel_requests 
WHERE id LIKE 'ACCOM-%'
ORDER BY submitted_at DESC
LIMIT 10;

-- 6. Count all accommodation-related requests by naming pattern
SELECT 
  'Summary of accommodation request naming patterns' as summary,
  CASE 
    WHEN id LIKE 'TSR-%' AND travel_type = 'Accommodation' THEN 'TSR- prefix (INCORRECT)'
    WHEN id LIKE 'ACCOM-%' THEN 'ACCOM- prefix (CORRECT)'
    WHEN id LIKE 'TSR-%' AND travel_type != 'Accommodation' THEN 'TSR- with accommodation details'
    ELSE 'Other'
  END as naming_pattern,
  COUNT(*) as count
FROM travel_requests tr
WHERE travel_type = 'Accommodation' 
   OR EXISTS (SELECT 1 FROM trf_accommodation_details WHERE trf_id = tr.id)
GROUP BY 
  CASE 
    WHEN id LIKE 'TSR-%' AND travel_type = 'Accommodation' THEN 'TSR- prefix (INCORRECT)'
    WHEN id LIKE 'ACCOM-%' THEN 'ACCOM- prefix (CORRECT)'
    WHEN id LIKE 'TSR-%' AND travel_type != 'Accommodation' THEN 'TSR- with accommodation details'
    ELSE 'Other'
  END
ORDER BY count DESC;

-- 7. Find all accommodation requests created in the same timeframe as the example
SELECT 
  'Accommodation requests from 2025-09-14' as timeframe_check,
  id,
  requestor_name,
  travel_type,
  status,
  submitted_at
FROM travel_requests 
WHERE (travel_type = 'Accommodation' OR id LIKE 'ACCOM-%')
  AND DATE(submitted_at) = '2025-09-14'
ORDER BY submitted_at DESC;

-- 8. Check for any auto-generated accommodation requests with TSR naming pattern
SELECT 
  'Auto-generated accommodation requests with TSR pattern' as auto_gen_check,
  id,
  requestor_name,
  travel_type,
  status,
  additional_comments
FROM travel_requests 
WHERE id LIKE 'TSR-%' 
  AND travel_type = 'Accommodation'
  AND (additional_comments LIKE '%Auto-generated%' OR additional_comments LIKE '%auto-generated%')
ORDER BY submitted_at DESC;

-- 9. Check workflow and approval steps for the specific TSR
SELECT 
  'Workflow steps for TSR-20250914-1553-TUR-JYV8' as workflow_check,
  trf_id,
  step_role,
  step_name,
  status,
  step_date,
  comments
FROM trf_approval_steps 
WHERE trf_id = 'TSR-20250914-1553-TUR-JYV8'
ORDER BY step_date;

-- 10. Check if there are any ACCOM- requests related to the TSR
SELECT 
  'Related ACCOM requests for TSR-20250914-1553-TUR-JYV8' as related_check,
  id,
  requestor_name,
  travel_type,
  status,
  additional_comments
FROM travel_requests 
WHERE id LIKE 'ACCOM-%'
  AND (additional_comments LIKE '%TSR-20250914-1553-TUR-JYV8%' OR additional_comments LIKE '%TSR-20250914%')
ORDER BY submitted_at DESC;