-- ================================================================
-- POST-FIX VERIFICATION QUERIES
-- Run these queries after applying comprehensive-tsr-workflow-fix.sql
-- to confirm all workflow issues have been resolved
-- ================================================================

\echo 'POST-FIX VERIFICATION STARTING...'
\echo '=================================='

-- ================================================================
-- 1. VERIFY ALL APPROVED TSRs HAVE COMPLETE WORKFLOWS
-- ================================================================
\echo '1. APPROVED TSRs WORKFLOW COMPLETENESS CHECK:'

SELECT 
    tr.id,
    tr.requestor_name,
    tr.status,
    tr.travel_type,
    tr.submitted_at,
    COUNT(tas.id) as total_approval_steps,
    COUNT(CASE WHEN tas.step_role = 'Department Focal' THEN 1 END) as has_dept_focal,
    COUNT(CASE WHEN tas.step_role = 'Line Manager' THEN 1 END) as has_line_manager,
    COUNT(CASE WHEN tas.step_role = 'HOD' THEN 1 END) as has_hod,
    CASE 
        WHEN COUNT(CASE WHEN tas.step_role = 'Department Focal' THEN 1 END) > 0 
         AND COUNT(CASE WHEN tas.step_role = 'Line Manager' THEN 1 END) > 0
         AND COUNT(CASE WHEN tas.step_role = 'HOD' THEN 1 END) > 0 
        THEN '✅ COMPLETE'
        ELSE '❌ INCOMPLETE'
    END as workflow_status
FROM travel_requests tr
LEFT JOIN trf_approval_steps tas ON tr.id = tas.trf_id
WHERE tr.status ILIKE '%approved%'
GROUP BY tr.id, tr.requestor_name, tr.status, tr.travel_type, tr.submitted_at
ORDER BY tr.submitted_at DESC;

-- ================================================================
-- 2. DETAILED WORKFLOW CHAIN VERIFICATION
-- ================================================================
\echo ''
\echo '2. DETAILED WORKFLOW CHAINS:'

SELECT 
    trf_id,
    step_role,
    step_name,
    status,
    step_date,
    CASE 
        WHEN comments LIKE '%Auto-approved - missing step%' THEN '🔧 ADDED BY FIX'
        ELSE '📝 ORIGINAL'
    END as step_origin,
    comments
FROM trf_approval_steps
WHERE trf_id IN (
    SELECT id FROM travel_requests WHERE status ILIKE '%approved%'
)
ORDER BY trf_id, step_date;

-- ================================================================
-- 3. SUMMARY STATISTICS
-- ================================================================
\echo ''
\echo '3. WORKFLOW COMPLETION SUMMARY:'

WITH workflow_summary AS (
    SELECT 
        tr.id,
        COUNT(CASE WHEN tas.step_role = 'Department Focal' THEN 1 END) > 0 as has_focal,
        COUNT(CASE WHEN tas.step_role = 'Line Manager' THEN 1 END) > 0 as has_manager,
        COUNT(CASE WHEN tas.step_role = 'HOD' THEN 1 END) > 0 as has_hod
    FROM travel_requests tr
    LEFT JOIN trf_approval_steps tas ON tr.id = tas.trf_id
    WHERE tr.status ILIKE '%approved%'
    GROUP BY tr.id
)
SELECT 
    'WORKFLOW COMPLETION STATISTICS' as metric,
    COUNT(*) as total_approved_tsrs,
    COUNT(CASE WHEN has_focal THEN 1 END) as with_dept_focal,
    COUNT(CASE WHEN has_manager THEN 1 END) as with_line_manager,
    COUNT(CASE WHEN has_hod THEN 1 END) as with_hod,
    COUNT(CASE WHEN has_focal AND has_manager AND has_hod THEN 1 END) as complete_workflows,
    ROUND(
        COUNT(CASE WHEN has_focal AND has_manager AND has_hod THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as completion_percentage
FROM workflow_summary;

-- ================================================================
-- 4. VERIFY NO REMAINING ISSUES
-- ================================================================
\echo ''
\echo '4. REMAINING WORKFLOW ISSUES CHECK:'

WITH remaining_issues AS (
    SELECT 
        tr.id,
        tr.requestor_name,
        tr.status,
        CASE WHEN COUNT(CASE WHEN tas.step_role = 'Department Focal' THEN 1 END) = 0 
             THEN 'Missing Department Focal' END as missing_focal,
        CASE WHEN COUNT(CASE WHEN tas.step_role = 'Line Manager' THEN 1 END) = 0 
             THEN 'Missing Line Manager' END as missing_manager,
        CASE WHEN COUNT(CASE WHEN tas.step_role = 'HOD' THEN 1 END) = 0 
             THEN 'Missing HOD' END as missing_hod
    FROM travel_requests tr
    LEFT JOIN trf_approval_steps tas ON tr.id = tas.trf_id
    WHERE tr.status ILIKE '%approved%'
    GROUP BY tr.id, tr.requestor_name, tr.status
)
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ NO REMAINING ISSUES - ALL WORKFLOWS COMPLETE!'
        ELSE '❌ ISSUES STILL EXIST:'
    END as status,
    COUNT(*) as remaining_issue_count
FROM remaining_issues
WHERE missing_focal IS NOT NULL OR missing_manager IS NOT NULL OR missing_hod IS NOT NULL;

-- Show any remaining issues if they exist
SELECT 
    id,
    requestor_name,
    status,
    CONCAT_WS(', ', missing_focal, missing_manager, missing_hod) as remaining_issues
FROM (
    SELECT 
        tr.id,
        tr.requestor_name,
        tr.status,
        CASE WHEN COUNT(CASE WHEN tas.step_role = 'Department Focal' THEN 1 END) = 0 
             THEN 'Missing Department Focal' END as missing_focal,
        CASE WHEN COUNT(CASE WHEN tas.step_role = 'Line Manager' THEN 1 END) = 0 
             THEN 'Missing Line Manager' END as missing_manager,
        CASE WHEN COUNT(CASE WHEN tas.step_role = 'HOD' THEN 1 END) = 0 
             THEN 'Missing HOD' END as missing_hod
    FROM travel_requests tr
    LEFT JOIN trf_approval_steps tas ON tr.id = tas.trf_id
    WHERE tr.status ILIKE '%approved%'
    GROUP BY tr.id, tr.requestor_name, tr.status
) remaining_check
WHERE missing_focal IS NOT NULL OR missing_manager IS NOT NULL OR missing_hod IS NOT NULL;

-- ================================================================
-- 5. FIX IMPACT ANALYSIS
-- ================================================================
\echo ''
\echo '5. FIX IMPACT ANALYSIS:'

SELECT 
    'STEPS ADDED BY FIX' as category,
    COUNT(*) as count,
    STRING_AGG(DISTINCT trf_id, ', ') as affected_tsrs
FROM trf_approval_steps
WHERE comments LIKE '%Auto-approved - missing step%'

UNION ALL

SELECT 
    'TOTAL APPROVAL STEPS' as category,
    COUNT(*) as count,
    'All TSRs' as affected_tsrs
FROM trf_approval_steps
WHERE trf_id IN (SELECT id FROM travel_requests WHERE status ILIKE '%approved%')

UNION ALL

SELECT 
    'FIXED TSRs' as category,
    COUNT(DISTINCT trf_id) as count,
    STRING_AGG(DISTINCT trf_id, ', ') as affected_tsrs
FROM trf_approval_steps
WHERE comments LIKE '%Auto-approved - missing step%';

-- ================================================================
-- 6. TIMELINE VERIFICATION
-- ================================================================
\echo ''
\echo '6. TIMELINE VERIFICATION (Added Steps Should Follow Logical Order):'

SELECT 
    trf_id,
    step_role,
    step_date,
    CASE 
        WHEN comments LIKE '%Auto-approved - missing step%' THEN '🔧 ADDED'
        ELSE '📝 ORIGINAL'
    END as step_type,
    LAG(step_date) OVER (PARTITION BY trf_id ORDER BY step_date) as previous_step_date,
    CASE 
        WHEN LAG(step_date) OVER (PARTITION BY trf_id ORDER BY step_date) IS NOT NULL
        THEN EXTRACT(EPOCH FROM (step_date - LAG(step_date) OVER (PARTITION BY trf_id ORDER BY step_date))) / 60
        ELSE NULL
    END as minutes_since_previous
FROM trf_approval_steps
WHERE trf_id IN (
    SELECT DISTINCT trf_id FROM trf_approval_steps 
    WHERE comments LIKE '%Auto-approved - missing step%'
)
ORDER BY trf_id, step_date;

\echo ''
\echo '=================================='
\echo 'POST-FIX VERIFICATION COMPLETED!'
\echo '=================================='