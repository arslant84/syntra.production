-- Check for TSR-named accommodation requests
SELECT 
  'TSR-named accommodation requests' as category,
  id, 
  requestor_name, 
  travel_type, 
  status, 
  submitted_at,
  purpose
FROM travel_requests 
WHERE travel_type = 'Accommodation' 
  AND id LIKE 'TSR%'
ORDER BY submitted_at DESC 
LIMIT 10;

-- Check for properly named ACCOM requests
SELECT 
  'ACCOM-named accommodation requests' as category,
  id, 
  requestor_name, 
  travel_type, 
  status, 
  submitted_at,
  purpose
FROM travel_requests 
WHERE travel_type = 'Accommodation' 
  AND id LIKE 'ACCOM%'
ORDER BY submitted_at DESC 
LIMIT 10;

-- Check all accommodation requests
SELECT 
  'All accommodation requests' as category,
  id, 
  requestor_name, 
  travel_type, 
  status, 
  submitted_at
FROM travel_requests 
WHERE travel_type = 'Accommodation'
ORDER BY submitted_at DESC 
LIMIT 15;