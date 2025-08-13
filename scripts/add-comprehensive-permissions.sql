-- Add comprehensive permissions for all SynTra application features
-- This script is idempotent and can be run multiple times

-- Add any missing permissions that aren't in the original db-setup.sql
INSERT INTO permissions (name, description) VALUES
    ('manage_notifications', 'Can create, edit, and delete notification templates.'),
    ('view_all_data', 'Can view all data across departments (admin level access).'),
    ('manage_system_settings', 'Can modify system-wide settings and configurations.'),
    ('manage_workflows', 'Can create, edit, and delete workflow steps and modules.'),
    ('approve_high_cost_requests', 'Can approve requests above a certain cost threshold.'),
    ('manage_transport_bookings', 'Can manage transport requests and bookings.'),
    ('view_reports', 'Can access and generate system reports.'),
    ('manage_accommodation_locations', 'Can add, edit, and delete accommodation locations.'),
    ('approve_visa_applications', 'Can approve visa applications at various workflow steps.'),
    ('process_payments', 'Can process expense claim payments.')
ON CONFLICT (name) DO NOTHING;

-- Update role permissions for better coverage
-- Visa Clerk permissions (add missing ones)
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id from roles WHERE name = 'Visa Clerk'),
    p.id
FROM permissions p
WHERE p.name IN ('process_visa_applications', 'approve_visa_applications')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Ticketing Admin permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id from roles WHERE name = 'Ticketing Admin'),
    p.id
FROM permissions p
WHERE p.name IN ('process_flights')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Accommodation Admin permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id from roles WHERE name = 'Accommodation Admin'),
    p.id
FROM permissions p
WHERE p.name IN ('manage_accommodation_bookings', 'manage_accommodation_locations')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Finance Clerk permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id from roles WHERE name = 'Finance Clerk'),
    p.id
FROM permissions p
WHERE p.name IN ('process_claims', 'process_payments', 'view_all_claims')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Add a 'view_visa_applications' permission specifically for viewing (not processing)
INSERT INTO permissions (name, description) VALUES
    ('view_visa_applications', 'Can view visa applications without processing capabilities.')
ON CONFLICT (name) DO NOTHING;

-- Grant viewing permissions to approvers who need to see visa applications
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id from roles WHERE name = 'Department Focal'),
    p.id
FROM permissions p
WHERE p.name IN ('view_visa_applications')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id from roles WHERE name = 'Line Manager'),
    p.id
FROM permissions p
WHERE p.name IN ('view_visa_applications')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id from roles WHERE name = 'HOD'),
    p.id
FROM permissions p
WHERE p.name IN ('view_visa_applications', 'view_all_data')
ON CONFLICT (role_id, permission_id) DO NOTHING;