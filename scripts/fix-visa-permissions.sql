-- Add create_visa_applications permission for better granular control
INSERT INTO permissions (name, description) VALUES
    ('create_visa_applications', 'Can create new visa applications.')
ON CONFLICT (name) DO NOTHING;

-- Grant create_visa_applications permission to Requestor role
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id from roles WHERE name = 'Requestor'),
    p.id
FROM permissions p
WHERE p.name IN ('create_visa_applications')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant create_visa_applications permission to other roles that should be able to create visa applications
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('Department Focal', 'Line Manager', 'HOD', 'System Administrator')
  AND p.name = 'create_visa_applications'
ON CONFLICT (role_id, permission_id) DO NOTHING;