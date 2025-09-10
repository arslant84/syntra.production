-- RBAC System Validation Test
-- Run these queries to verify the fixes are working correctly

-- ====================================
-- 1. VERIFY ROLE-PERMISSION ASSIGNMENTS
-- ====================================
SELECT 
    '=== ROLE-PERMISSION ASSIGNMENTS ===' as test_section;

SELECT 
    r.name as role_name,
    COUNT(rp.permission_id) as total_permissions,
    STRING_AGG(p.name, ', ' ORDER BY p.name) as assigned_permissions
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
GROUP BY r.id, r.name
ORDER BY r.name;

-- ====================================
-- 2. CHECK CRITICAL ADMIN MODULE PERMISSIONS
-- ====================================
SELECT 
    '=== ADMIN MODULE ACCESS VERIFICATION ===' as test_section;

SELECT 
    r.name as role_name,
    MAX(CASE WHEN p.name = 'process_claims' THEN '✓' ELSE '✗' END) as can_process_claims,
    MAX(CASE WHEN p.name = 'view_admin_claims' THEN '✓' ELSE '✗' END) as can_view_claims_admin,
    MAX(CASE WHEN p.name = 'process_flights' THEN '✓' ELSE '✗' END) as can_process_flights,
    MAX(CASE WHEN p.name = 'view_admin_flights' THEN '✓' ELSE '✗' END) as can_view_flights_admin,
    MAX(CASE WHEN p.name = 'process_visa_applications' THEN '✓' ELSE '✗' END) as can_process_visa,
    MAX(CASE WHEN p.name = 'view_admin_visa' THEN '✓' ELSE '✗' END) as can_view_visa_admin,
    MAX(CASE WHEN p.name = 'manage_transport_requests' THEN '✓' ELSE '✗' END) as can_manage_transport,
    MAX(CASE WHEN p.name = 'view_admin_transport' THEN '✓' ELSE '✗' END) as can_view_transport_admin,
    MAX(CASE WHEN p.name = 'manage_accommodation_bookings' THEN '✓' ELSE '✗' END) as can_manage_accommodation,
    MAX(CASE WHEN p.name = 'view_admin_accommodation' THEN '✓' ELSE '✗' END) as can_view_accommodation_admin
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
WHERE r.name IN ('Finance Clerk', 'Ticketing Admin', 'Visa Clerk', 'Transport Admin', 'Accommodation Admin', 'System Administrator')
GROUP BY r.id, r.name
ORDER BY r.name;

-- ====================================
-- 3. CHECK APPROVAL PERMISSIONS
-- ====================================
SELECT 
    '=== APPROVAL PERMISSIONS VERIFICATION ===' as test_section;

SELECT 
    r.name as role_name,
    MAX(CASE WHEN p.name = 'approve_claims_focal' THEN '✓' ELSE '✗' END) as focal_claims,
    MAX(CASE WHEN p.name = 'approve_claims_manager' THEN '✓' ELSE '✗' END) as manager_claims,
    MAX(CASE WHEN p.name = 'approve_claims_hod' THEN '✓' ELSE '✗' END) as hod_claims,
    MAX(CASE WHEN p.name = 'approve_trf_focal' THEN '✓' ELSE '✗' END) as focal_trf,
    MAX(CASE WHEN p.name = 'approve_trf_manager' THEN '✓' ELSE '✗' END) as manager_trf,
    MAX(CASE WHEN p.name = 'approve_trf_hod' THEN '✓' ELSE '✗' END) as hod_trf,
    MAX(CASE WHEN p.name = 'approve_transport_requests' THEN '✓' ELSE '✗' END) as approve_transport
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
WHERE r.name IN ('Department Focal', 'Line Manager', 'HOD', 'System Administrator')
GROUP BY r.id, r.name
ORDER BY r.name;

-- ====================================
-- 4. IDENTIFY MISSING CRITICAL PERMISSIONS
-- ====================================
SELECT 
    '=== MISSING CRITICAL PERMISSIONS ===' as test_section;

-- Finance Clerk should have both process_claims AND view_admin_claims
SELECT 
    'Finance Clerk Missing Permissions' as issue_type,
    r.name as role_name,
    CASE WHEN process_claims.role_id IS NULL THEN 'MISSING: process_claims' ELSE 'OK: process_claims' END as process_permission,
    CASE WHEN view_admin.role_id IS NULL THEN 'MISSING: view_admin_claims' ELSE 'OK: view_admin_claims' END as view_permission
FROM roles r
LEFT JOIN (
    SELECT rp.role_id 
    FROM role_permissions rp 
    JOIN permissions p ON rp.permission_id = p.id 
    WHERE p.name = 'process_claims'
) process_claims ON r.id = process_claims.role_id
LEFT JOIN (
    SELECT rp.role_id 
    FROM role_permissions rp 
    JOIN permissions p ON rp.permission_id = p.id 
    WHERE p.name = 'view_admin_claims'
) view_admin ON r.id = view_admin.role_id
WHERE r.name = 'Finance Clerk';

-- Ticketing Admin should have both process_flights AND view_admin_flights
SELECT 
    'Ticketing Admin Missing Permissions' as issue_type,
    r.name as role_name,
    CASE WHEN process_flights.role_id IS NULL THEN 'MISSING: process_flights' ELSE 'OK: process_flights' END as process_permission,
    CASE WHEN view_admin.role_id IS NULL THEN 'MISSING: view_admin_flights' ELSE 'OK: view_admin_flights' END as view_permission
FROM roles r
LEFT JOIN (
    SELECT rp.role_id 
    FROM role_permissions rp 
    JOIN permissions p ON rp.permission_id = p.id 
    WHERE p.name = 'process_flights'
) process_flights ON r.id = process_flights.role_id
LEFT JOIN (
    SELECT rp.role_id 
    FROM role_permissions rp 
    JOIN permissions p ON rp.permission_id = p.id 
    WHERE p.name = 'view_admin_flights'
) view_admin ON r.id = view_admin.role_id
WHERE r.name = 'Ticketing Admin';

-- ====================================
-- 5. SYSTEM ADMINISTRATOR COMPLETENESS CHECK
-- ====================================
SELECT 
    '=== SYSTEM ADMINISTRATOR PERMISSION COMPLETENESS ===' as test_section;

SELECT 
    p.name as permission_name,
    CASE WHEN rp.role_id IS NOT NULL THEN '✓' ELSE '✗ MISSING' END as assigned_to_sysadmin
FROM permissions p
LEFT JOIN role_permissions rp ON p.id = rp.permission_id
LEFT JOIN roles r ON rp.role_id = r.id AND r.name = 'System Administrator'
ORDER BY p.name;

-- ====================================
-- 6. REDUNDANT PERMISSIONS CHECK
-- ====================================
SELECT 
    '=== POTENTIALLY REDUNDANT PERMISSIONS ===' as test_section;

-- Find permissions that exist but are never assigned to any role
SELECT 
    p.name as unused_permission,
    p.description,
    'No roles assigned' as status
FROM permissions p
LEFT JOIN role_permissions rp ON p.id = rp.permission_id
WHERE rp.role_id IS NULL
ORDER BY p.name;