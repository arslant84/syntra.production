-- RBAC System Fix: Add Missing Permissions and Fix Role Assignments
-- Run this script to align database permissions with actual app functionality

-- ====================================
-- 1. ADD MISSING CRITICAL PERMISSIONS
-- ====================================

-- Admin interface view permissions (missing but needed)
INSERT INTO permissions (id, name, description, created_at, updated_at) VALUES 
(gen_random_uuid(), 'view_admin_flights', 'Can access the Flight Admin module interface', NOW(), NOW()),
(gen_random_uuid(), 'view_admin_accommodation', 'Can access the Accommodation Admin module interface', NOW(), NOW()),
(gen_random_uuid(), 'view_admin_visa', 'Can access the Visa Admin module interface', NOW(), NOW()),
(gen_random_uuid(), 'view_admin_transport', 'Can access the Transport Admin module interface', NOW(), NOW()),
(gen_random_uuid(), 'view_admin_claims', 'Can access the Claims Admin module interface', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Missing approval permissions
INSERT INTO permissions (id, name, description, created_at, updated_at) VALUES 
(gen_random_uuid(), 'approve_accommodation_requests', 'Can approve accommodation booking requests', NOW(), NOW()),
(gen_random_uuid(), 'approve_visa_requests', 'Can approve visa application requests', NOW(), NOW()),
(gen_random_uuid(), 'view_visa_applications', 'Can view visa applications (read-only)', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- ====================================
-- 2. ASSIGN MISSING PERMISSIONS TO ROLES
-- ====================================

-- Finance Clerk: Add Claims Admin view permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Finance Clerk' 
AND p.name = 'view_admin_claims'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- Ticketing Admin: Add Flights Admin view permission  
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Ticketing Admin' 
AND p.name = 'view_admin_flights'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- Accommodation Admin: Add Accommodation Admin view permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Accommodation Admin' 
AND p.name = 'view_admin_accommodation'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- Visa Clerk: Add Visa Admin view permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Visa Clerk' 
AND p.name IN ('view_admin_visa', 'view_visa_applications')
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- Transport Admin: Add Transport Admin view permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Transport Admin' 
AND p.name = 'view_admin_transport'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- ====================================
-- 3. ASSIGN CRITICAL MISSING PERMISSIONS
-- ====================================

-- Finance Clerk: Missing the actual claims processing permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Finance Clerk' 
AND p.name = 'process_claims'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- Ticketing Admin: Missing the actual flights processing permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Ticketing Admin' 
AND p.name = 'process_flights'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- Visa Clerk: Missing the actual visa processing permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Visa Clerk' 
AND p.name = 'process_visa_applications'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- ====================================
-- 4. ENSURE SYSTEM ADMINISTRATOR HAS ALL PERMISSIONS
-- ====================================

-- Add any missing permissions to System Administrator
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'System Administrator'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- ====================================
-- 5. VERIFICATION QUERIES
-- ====================================

-- Verify role-permission assignments
SELECT 
    r.name as role_name,
    COUNT(rp.permission_id) as permission_count,
    STRING_AGG(p.name, ', ' ORDER BY p.name) as permissions
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
GROUP BY r.id, r.name
ORDER BY r.name;

-- Check critical permissions for admin modules
SELECT 
    r.name as role_name,
    CASE WHEN MAX(CASE WHEN p.name = 'view_admin_claims' THEN 1 ELSE 0 END) = 1 THEN '✓' ELSE '✗' END as claims_admin,
    CASE WHEN MAX(CASE WHEN p.name = 'view_admin_flights' THEN 1 ELSE 0 END) = 1 THEN '✓' ELSE '✗' END as flights_admin,
    CASE WHEN MAX(CASE WHEN p.name = 'view_admin_visa' THEN 1 ELSE 0 END) = 1 THEN '✓' ELSE '✗' END as visa_admin,
    CASE WHEN MAX(CASE WHEN p.name = 'view_admin_transport' THEN 1 ELSE 0 END) = 1 THEN '✓' ELSE '✗' END as transport_admin,
    CASE WHEN MAX(CASE WHEN p.name = 'view_admin_accommodation' THEN 1 ELSE 0 END) = 1 THEN '✓' ELSE '✗' END as accommodation_admin
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
WHERE r.name IN ('Finance Clerk', 'Ticketing Admin', 'Visa Clerk', 'Transport Admin', 'Accommodation Admin', 'System Administrator')
GROUP BY r.id, r.name
ORDER BY r.name;