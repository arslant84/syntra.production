-- Add missing accommodation approval permissions
INSERT INTO permissions (name, description) VALUES 
('approve_accommodation_manager', 'Approve accommodation requests as Line Manager'),
('approve_accommodation_hod', 'Approve accommodation requests as HOD')
ON CONFLICT (name) DO NOTHING;

-- Grant permissions to appropriate roles
-- Line Managers get manager approval permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'Line Manager' 
AND p.name = 'approve_accommodation_manager'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- HODs get HOD approval permission  
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'HOD' 
AND p.name = 'approve_accommodation_hod'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- System Administrators get all accommodation permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'System Administrator' 
AND p.name IN ('approve_accommodation_manager', 'approve_accommodation_hod')
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);