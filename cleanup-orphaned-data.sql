-- Cleanup Orphaned Data Script
-- This script removes orphaned data that could cause issues with recent activities

-- 1. Remove orphaned accommodation details (details without travel requests)
DELETE FROM trf_accommodation_details 
WHERE trf_id NOT IN (SELECT id FROM travel_requests);

-- 2. Update travel requests that have no accommodation details but might be referenced
-- First, let's see what we're dealing with
SELECT 
  tr.id,
  tr.requestor_name,
  tr.status,
  tr.updated_at
FROM travel_requests tr
LEFT JOIN trf_accommodation_details tad ON tad.trf_id = tr.id
WHERE tad.id IS NULL
  AND tr.travel_type IN ('Domestic', 'Overseas')
  AND tr.updated_at > NOW() - INTERVAL '30 days';

-- 3. Optional: Remove travel requests that have no accommodation details
-- Uncomment the following if you want to remove them completely
-- DELETE FROM travel_requests 
-- WHERE id IN (
--   SELECT tr.id
--   FROM travel_requests tr
--   LEFT JOIN trf_accommodation_details tad ON tad.trf_id = tr.id
--   WHERE tad.id IS NULL
--     AND tr.travel_type IN ('Domestic', 'Overseas')
--     AND tr.updated_at > NOW() - INTERVAL '30 days'
-- );

-- 4. Verify cleanup results
SELECT 
  'Valid accommodation requests' as type,
  COUNT(DISTINCT tr.id) as count
FROM travel_requests tr
INNER JOIN trf_accommodation_details tad ON tad.trf_id = tr.id

UNION ALL

SELECT 
  'Orphaned travel requests' as type,
  COUNT(tr.id) as count
FROM travel_requests tr
LEFT JOIN trf_accommodation_details tad ON tad.trf_id = tr.id
WHERE tad.id IS NULL
  AND tr.travel_type IN ('Domestic', 'Overseas')

UNION ALL

SELECT 
  'Orphaned accommodation details' as type,
  COUNT(tad.id) as count
FROM trf_accommodation_details tad
LEFT JOIN travel_requests tr ON tad.trf_id = tr.id
WHERE tr.id IS NULL;
