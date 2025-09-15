-- ================================================================
-- COMPREHENSIVE TSR WORKFLOW ANALYSIS SCRIPT
-- This script analyzes ALL TSRs in the database to identify workflow inconsistencies
-- ================================================================

-- Set search path and ensure we're using the right database
\echo 'Starting comprehensive TSR workflow analysis...'

-- ================================================================
-- 1. OVERVIEW: Count all TSRs by status
-- ================================================================
\echo '1. TSR STATUS DISTRIBUTION:'
SELECT 
    status,
    COUNT(*) as total_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM travel_requests), 2) as percentage
FROM travel_requests 
GROUP BY status 
ORDER BY total_count DESC;

-- ================================================================
-- 2. IDENTIFY ALL APPROVED TSRs
-- ================================================================
\echo '2. ALL APPROVED TSRs:'
SELECT 
    id,
    requestor_name,
    status,
    travel_type,
    submitted_at,
    created_at
FROM travel_requests 
WHERE status ILIKE '%approved%'
ORDER BY submitted_at DESC;

-- ================================================================
-- 3. CHECK APPROVAL STEPS COVERAGE FOR APPROVED TSRs
-- ================================================================
\echo '3. APPROVAL STEPS ANALYSIS FOR APPROVED TSRs:'
WITH approved_tsrs AS (
    SELECT id, requestor_name, status, travel_type, submitted_at
    FROM travel_requests 
    WHERE status ILIKE '%approved%'
),
approval_steps_summary AS (
    SELECT 
        trf_id,
        COUNT(*) as total_steps,
        COUNT(CASE WHEN step_role = 'Department Focal' THEN 1 END) as has_focal_step,
        COUNT(CASE WHEN step_role = 'Line Manager' THEN 1 END) as has_manager_step,
        COUNT(CASE WHEN step_role = 'HOD' THEN 1 END) as has_hod_step,
        STRING_AGG(step_role, ', ' ORDER BY step_date) as approval_chain,
        STRING_AGG(status, ', ' ORDER BY step_date) as step_statuses
    FROM trf_approval_steps
    WHERE trf_id IN (SELECT id FROM approved_tsrs)
    GROUP BY trf_id
)
SELECT 
    a.id,
    a.requestor_name,
    a.status,
    a.travel_type,
    a.submitted_at,
    COALESCE(s.total_steps, 0) as total_approval_steps,
    CASE WHEN s.has_focal_step > 0 THEN 'Yes' ELSE 'No' END as has_dept_focal,
    CASE WHEN s.has_manager_step > 0 THEN 'Yes' ELSE 'No' END as has_line_manager,
    CASE WHEN s.has_hod_step > 0 THEN 'Yes' ELSE 'No' END as has_hod,
    COALESCE(s.approval_chain, 'NO APPROVAL STEPS') as approval_chain,
    COALESCE(s.step_statuses, 'N/A') as step_statuses
FROM approved_tsrs a
LEFT JOIN approval_steps_summary s ON a.id = s.trf_id
ORDER BY 
    CASE WHEN s.total_steps IS NULL THEN 1 ELSE 0 END,
    s.total_steps ASC,
    a.submitted_at DESC;

-- ================================================================
-- 4. IDENTIFY TSRs WITH MISSING CRITICAL APPROVAL STEPS
-- ================================================================
\echo '4. TSRs MISSING CRITICAL APPROVAL STEPS:'
WITH approved_tsrs AS (
    SELECT id, requestor_name, status, travel_type, submitted_at
    FROM travel_requests 
    WHERE status ILIKE '%approved%'
),
missing_steps AS (
    SELECT 
        a.id,
        a.requestor_name,
        a.status,
        a.travel_type,
        a.submitted_at,
        CASE WHEN NOT EXISTS (
            SELECT 1 FROM trf_approval_steps t 
            WHERE t.trf_id = a.id AND t.step_role = 'Department Focal'
        ) THEN 'Missing Department Focal' ELSE NULL END as missing_focal,
        CASE WHEN NOT EXISTS (
            SELECT 1 FROM trf_approval_steps t 
            WHERE t.trf_id = a.id AND t.step_role = 'Line Manager'
        ) THEN 'Missing Line Manager' ELSE NULL END as missing_manager,
        CASE WHEN NOT EXISTS (
            SELECT 1 FROM trf_approval_steps t 
            WHERE t.trf_id = a.id AND t.step_role = 'HOD'
        ) THEN 'Missing HOD' ELSE NULL END as missing_hod
    FROM approved_tsrs a
)
SELECT 
    id,
    requestor_name,
    status,
    travel_type,
    submitted_at,
    CONCAT_WS(', ', missing_focal, missing_manager, missing_hod) as missing_steps
FROM missing_steps
WHERE (missing_focal IS NOT NULL OR missing_manager IS NOT NULL OR missing_hod IS NOT NULL)
ORDER BY submitted_at DESC;

-- ================================================================
-- 5. CHECK WORKFLOW EXECUTIONS VS TRF_APPROVAL_STEPS
-- ================================================================
\echo '5. WORKFLOW SYSTEM VS LEGACY APPROVAL STEPS COMPARISON:'
SELECT 
    tr.id,
    tr.requestor_name,
    tr.status as tsr_status,
    we.status as workflow_status,
    we.current_step_number,
    COUNT(tas.id) as legacy_approval_steps,
    COUNT(se.id) as new_workflow_steps,
    CASE 
        WHEN we.id IS NULL AND COUNT(tas.id) > 0 THEN 'Legacy Only'
        WHEN we.id IS NOT NULL AND COUNT(tas.id) = 0 THEN 'New Workflow Only'
        WHEN we.id IS NOT NULL AND COUNT(tas.id) > 0 THEN 'Both Systems'
        ELSE 'No Workflow Data'
    END as workflow_type
FROM travel_requests tr
LEFT JOIN workflow_executions we ON tr.id = we.request_id AND we.request_type = 'trf'
LEFT JOIN trf_approval_steps tas ON tr.id = tas.trf_id
LEFT JOIN step_executions se ON we.id = se.execution_id
WHERE tr.status ILIKE '%approved%'
GROUP BY tr.id, tr.requestor_name, tr.status, we.status, we.current_step_number
ORDER BY tr.submitted_at DESC;

-- ================================================================
-- 6. DETAILED ANALYSIS BY TRAVEL TYPE
-- ================================================================
\echo '6. WORKFLOW ISSUES BY TRAVEL TYPE:'
WITH travel_type_analysis AS (
    SELECT 
        tr.travel_type,
        COUNT(*) as total_approved,
        COUNT(CASE WHEN tas.focal_count = 0 THEN 1 END) as missing_focal,
        COUNT(CASE WHEN tas.manager_count = 0 THEN 1 END) as missing_manager,
        COUNT(CASE WHEN tas.hod_count = 0 THEN 1 END) as missing_hod,
        COUNT(CASE WHEN tas.total_steps = 0 THEN 1 END) as no_approval_steps
    FROM travel_requests tr
    LEFT JOIN (
        SELECT 
            trf_id,
            COUNT(*) as total_steps,
            COUNT(CASE WHEN step_role = 'Department Focal' THEN 1 END) as focal_count,
            COUNT(CASE WHEN step_role = 'Line Manager' THEN 1 END) as manager_count,
            COUNT(CASE WHEN step_role = 'HOD' THEN 1 END) as hod_count
        FROM trf_approval_steps
        GROUP BY trf_id
    ) tas ON tr.id = tas.trf_id
    WHERE tr.status ILIKE '%approved%'
    GROUP BY tr.travel_type
)
SELECT 
    travel_type,
    total_approved,
    missing_focal,
    missing_manager,
    missing_hod,
    no_approval_steps,
    ROUND((missing_focal + missing_manager + missing_hod) * 100.0 / total_approved, 2) as pct_with_issues
FROM travel_type_analysis
ORDER BY pct_with_issues DESC;

-- ================================================================
-- 7. IDENTIFY ALL TSRs NEEDING FIXES (COMPLETE LIST)
-- ================================================================
\echo '7. COMPLETE LIST OF TSRs REQUIRING WORKFLOW FIXES:'
WITH fix_candidates AS (
    SELECT 
        tr.id,
        tr.requestor_name,
        tr.status,
        tr.travel_type,
        tr.submitted_at,
        tr.created_at,
        COALESCE(tas.total_steps, 0) as current_steps,
        CASE WHEN NOT EXISTS (
            SELECT 1 FROM trf_approval_steps t 
            WHERE t.trf_id = tr.id AND t.step_role = 'Department Focal'
        ) THEN 1 ELSE 0 END as needs_focal,
        CASE WHEN NOT EXISTS (
            SELECT 1 FROM trf_approval_steps t 
            WHERE t.trf_id = tr.id AND t.step_role = 'Line Manager'
        ) THEN 1 ELSE 0 END as needs_manager,
        CASE WHEN NOT EXISTS (
            SELECT 1 FROM trf_approval_steps t 
            WHERE t.trf_id = tr.id AND t.step_role = 'HOD'
        ) THEN 1 ELSE 0 END as needs_hod,
        -- Get the latest approval step timestamp for sequencing
        (SELECT MAX(step_date) FROM trf_approval_steps WHERE trf_id = tr.id) as latest_step_date
    FROM travel_requests tr
    LEFT JOIN (
        SELECT trf_id, COUNT(*) as total_steps
        FROM trf_approval_steps
        GROUP BY trf_id
    ) tas ON tr.id = tas.trf_id
    WHERE tr.status ILIKE '%approved%'
)
SELECT 
    id,
    requestor_name,
    status,
    travel_type,
    submitted_at,
    created_at,
    current_steps,
    CASE WHEN needs_focal = 1 THEN 'Department Focal' ELSE NULL END as missing_focal,
    CASE WHEN needs_manager = 1 THEN 'Line Manager' ELSE NULL END as missing_manager,
    CASE WHEN needs_hod = 1 THEN 'HOD' ELSE NULL END as missing_hod,
    (needs_focal + needs_manager + needs_hod) as total_missing_steps,
    COALESCE(latest_step_date, created_at) as reference_timestamp
FROM fix_candidates
WHERE (needs_focal + needs_manager + needs_hod) > 0
ORDER BY (needs_focal + needs_manager + needs_hod) DESC, submitted_at DESC;

-- ================================================================
-- 8. CHECK FOR ORPHANED APPROVAL STEPS
-- ================================================================
\echo '8. ORPHANED APPROVAL STEPS (steps without corresponding TSR):'
SELECT 
    tas.id,
    tas.trf_id,
    tas.step_role,
    tas.status,
    tas.step_date,
    'TSR NOT FOUND' as issue
FROM trf_approval_steps tas
LEFT JOIN travel_requests tr ON tas.trf_id = tr.id
WHERE tr.id IS NULL
ORDER BY tas.step_date DESC;

-- ================================================================
-- 9. CHECK FOR DUPLICATE APPROVAL STEPS
-- ================================================================
\echo '9. DUPLICATE APPROVAL STEPS:'
SELECT 
    trf_id,
    step_role,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ') as step_ids,
    STRING_AGG(step_date::text, ', ') as step_dates
FROM trf_approval_steps
GROUP BY trf_id, step_role
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- ================================================================
-- 10. SUMMARY STATISTICS
-- ================================================================
\echo '10. SUMMARY STATISTICS:'
WITH summary_stats AS (
    SELECT 
        COUNT(*) as total_approved_tsrs,
        COUNT(CASE WHEN tas.trf_id IS NULL THEN 1 END) as tsrs_with_no_steps,
        COUNT(CASE WHEN tas.focal_missing = 1 THEN 1 END) as missing_focal_count,
        COUNT(CASE WHEN tas.manager_missing = 1 THEN 1 END) as missing_manager_count,
        COUNT(CASE WHEN tas.hod_missing = 1 THEN 1 END) as missing_hod_count,
        COUNT(CASE WHEN tas.any_missing = 1 THEN 1 END) as tsrs_needing_fixes
    FROM travel_requests tr
    LEFT JOIN (
        SELECT 
            tr_inner.id as trf_id,
            CASE WHEN NOT EXISTS (
                SELECT 1 FROM trf_approval_steps t 
                WHERE t.trf_id = tr_inner.id AND t.step_role = 'Department Focal'
            ) THEN 1 ELSE 0 END as focal_missing,
            CASE WHEN NOT EXISTS (
                SELECT 1 FROM trf_approval_steps t 
                WHERE t.trf_id = tr_inner.id AND t.step_role = 'Line Manager'
            ) THEN 1 ELSE 0 END as manager_missing,
            CASE WHEN NOT EXISTS (
                SELECT 1 FROM trf_approval_steps t 
                WHERE t.trf_id = tr_inner.id AND t.step_role = 'HOD'
            ) THEN 1 ELSE 0 END as hod_missing,
            CASE WHEN (
                NOT EXISTS (SELECT 1 FROM trf_approval_steps t WHERE t.trf_id = tr_inner.id AND t.step_role = 'Department Focal') OR
                NOT EXISTS (SELECT 1 FROM trf_approval_steps t WHERE t.trf_id = tr_inner.id AND t.step_role = 'Line Manager') OR
                NOT EXISTS (SELECT 1 FROM trf_approval_steps t WHERE t.trf_id = tr_inner.id AND t.step_role = 'HOD')
            ) THEN 1 ELSE 0 END as any_missing
        FROM travel_requests tr_inner
        WHERE tr_inner.status ILIKE '%approved%'
    ) tas ON tr.id = tas.trf_id
    WHERE tr.status ILIKE '%approved%'
)
SELECT 
    total_approved_tsrs,
    tsrs_with_no_steps,
    missing_focal_count,
    missing_manager_count,
    missing_hod_count,
    tsrs_needing_fixes,
    ROUND(tsrs_needing_fixes * 100.0 / total_approved_tsrs, 2) as pct_needing_fixes
FROM summary_stats;

\echo 'Comprehensive TSR workflow analysis complete!'