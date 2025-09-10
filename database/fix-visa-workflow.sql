-- Fix Visa Workflow Permissions
-- Run this SQL script to create missing workflow permissions

-- Check current visa-related permissions
SELECT id, name, description FROM permissions WHERE name LIKE '%visa%' ORDER BY name;

-- Check current approval permissions
SELECT id, name, description FROM permissions WHERE name LIKE '%approve%' ORDER BY name;

-- Create missing workflow permissions for visa
INSERT INTO permissions (name, description) 
VALUES ('approve_visa_focal', 'Approve visa applications at department focal level')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description) 
VALUES ('approve_visa_manager', 'Approve visa applications at line manager level')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description) 
VALUES ('approve_visa_hod', 'Approve visa applications at HOD level')
ON CONFLICT (name) DO NOTHING;

-- Create similar permissions for other request types
INSERT INTO permissions (name, description) 
VALUES ('approve_transport_focal', 'Approve transport requests at department focal level')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description) 
VALUES ('approve_transport_manager', 'Approve transport requests at line manager level')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description) 
VALUES ('approve_transport_hod', 'Approve transport requests at HOD level')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description) 
VALUES ('approve_accommodation_focal', 'Approve accommodation requests at department focal level')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description) 
VALUES ('approve_accommodation_manager', 'Approve accommodation requests at line manager level')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description) 
VALUES ('approve_accommodation_hod', 'Approve accommodation requests at HOD level')
ON CONFLICT (name) DO NOTHING;

-- Check if we have roles for Department Focal, Line Manager, HOD
SELECT id, name, description FROM roles WHERE name IN ('Department Focal', 'Line Manager', 'HOD') ORDER BY name;

-- Assign focal permissions to Department Focal role (assuming role exists)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Department Focal'
AND p.name IN ('approve_visa_focal', 'approve_transport_focal', 'approve_accommodation_focal', 'approve_trf_focal', 'approve_claims_focal')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign manager permissions to Line Manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Line Manager'
AND p.name IN ('approve_visa_manager', 'approve_transport_manager', 'approve_accommodation_manager', 'approve_trf_manager', 'approve_claims_manager')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign HOD permissions to HOD role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'HOD'
AND p.name IN ('approve_visa_hod', 'approve_transport_hod', 'approve_accommodation_hod', 'approve_trf_hod', 'approve_claims_hod')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Check final result - users with visa approval permissions
SELECT u.id, u.name, u.email, u.department, u.status, r.name as role_name, p.name as permission_name
FROM users u
INNER JOIN roles r ON u.role_id = r.id
INNER JOIN role_permissions rp ON r.id = rp.role_id
INNER JOIN permissions p ON rp.permission_id = p.id
WHERE p.name LIKE '%visa%'
AND u.status = 'Active'
ORDER BY u.department, p.name;

-- Show summary
SELECT 
  COUNT(*) as total_visa_approvers,
  COUNT(DISTINCT u.department) as departments_covered
FROM users u
INNER JOIN roles r ON u.role_id = r.id
INNER JOIN role_permissions rp ON r.id = rp.role_id
INNER JOIN permissions p ON rp.permission_id = p.id
WHERE p.name = 'approve_visa_focal'
AND u.status = 'Active';