-- ================================================================
-- ACCOMMODATION REQUEST NAMING ISSUE - ANALYSIS & VERIFICATION
-- This script identifies TSRs that should have separate ACCOM requests
-- ================================================================

-- 1. SHOW TSRs WITH ACCOMMODATION DETAILS (These need separation)
SELECT 
    'TSRs_NEEDING_SEPARATION' as analysis_type,
    tr.id,
    tr.requestor_name,
    tr.travel_type,
    tr.status,
    COUNT(tad.id) as accommodation_details_count
FROM travel_requests tr
INNER JOIN trf_accommodation_details tad ON tr.id = tad.trf_id
WHERE tr.id LIKE 'TSR-%'
  AND tr.travel_type != 'Accommodation'
  AND NOT EXISTS (
      SELECT 1 FROM travel_requests accom_tr 
      WHERE accom_tr.additional_comments LIKE '%' || tr.id || '%'
        AND accom_tr.travel_type = 'Accommodation'
        AND accom_tr.id LIKE 'ACCOM-%'
  )
GROUP BY tr.id, tr.requestor_name, tr.travel_type, tr.status
ORDER BY tr.id;

-- 2. SHOW EXISTING PROPERLY NAMED ACCOMMODATION REQUESTS
SELECT 
    'EXISTING_ACCOM_REQUESTS' as analysis_type,
    id,
    requestor_name,
    status,
    submitted_at
FROM travel_requests
WHERE id LIKE 'ACCOM-%'
  AND travel_type = 'Accommodation'
ORDER BY submitted_at DESC
LIMIT 10;

-- 3. SHOW ACCOMMODATION DETAILS FOR THE SPECIFIC TSR MENTIONED
SELECT 
    'SPECIFIC_TSR_DETAILS' as analysis_type,
    tad.*
FROM trf_accommodation_details tad
WHERE tad.trf_id = 'TSR-20250914-1553-TUR-JYV8';

-- 4. SUMMARY STATISTICS
SELECT 
    'SUMMARY_STATISTICS' as analysis_type,
    (SELECT COUNT(*) FROM travel_requests WHERE id LIKE 'TSR-%' AND travel_type != 'Accommodation') as total_tsrs,
    (SELECT COUNT(*) FROM travel_requests WHERE id LIKE 'ACCOM-%' AND travel_type = 'Accommodation') as total_accom_requests,
    (SELECT COUNT(DISTINCT tr.id) 
     FROM travel_requests tr
     INNER JOIN trf_accommodation_details tad ON tr.id = tad.trf_id
     WHERE tr.id LIKE 'TSR-%'
       AND tr.travel_type != 'Accommodation'
       AND NOT EXISTS (
           SELECT 1 FROM travel_requests accom_tr 
           WHERE accom_tr.additional_comments LIKE '%' || tr.id || '%'
             AND accom_tr.travel_type = 'Accommodation'
             AND accom_tr.id LIKE 'ACCOM-%'
       )) as tsrs_needing_separation;

-- 5. VERIFY NAMING PATTERNS
SELECT 
    'NAMING_PATTERN_VERIFICATION' as analysis_type,
    CASE 
        WHEN id LIKE 'TSR-%' THEN 'TSR_FORMAT'
        WHEN id LIKE 'ACCOM-%' THEN 'ACCOM_FORMAT'
        WHEN id LIKE 'TRANS-%' THEN 'TRANSPORT_FORMAT'
        ELSE 'OTHER_FORMAT'
    END as naming_pattern,
    travel_type,
    COUNT(*) as count
FROM travel_requests
WHERE travel_type IN ('Domestic', 'Overseas', 'Home Leave Passage', 'External Parties', 'Accommodation', 'Transport')
GROUP BY 
    CASE 
        WHEN id LIKE 'TSR-%' THEN 'TSR_FORMAT'
        WHEN id LIKE 'ACCOM-%' THEN 'ACCOM_FORMAT'
        WHEN id LIKE 'TRANS-%' THEN 'TRANSPORT_FORMAT'
        ELSE 'OTHER_FORMAT'
    END,
    travel_type
ORDER BY naming_pattern, travel_type;