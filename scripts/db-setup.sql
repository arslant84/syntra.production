-- SynTra Database Setup Script
-- This script creates all the necessary tables and relationships for the SynTra application
-- It is idempotent and can be run multiple times without error

-- Trigger function to auto-update 'updated_at' timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role_id TEXT, -- Foreign key will be added after roles table is created
    role TEXT, -- Denormalized role name, keep in sync with role_id's role name
    department TEXT,
    staff_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'Active', -- e.g., 'Active', 'Inactive'
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Permissions Table: Stores all available permissions in the system
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,          -- e.g., "manage_users", "create_trf", "approve_claims"
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_permissions
BEFORE UPDATE ON permissions
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Roles Table: Stores user roles
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,          -- e.g., "Admin Focal", "Requestor", "HOD"
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_roles
BEFORE UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Add foreign key to users table now that roles table exists
-- Ensure this ALTER TABLE is run after 'roles' table is created.
DO $$
BEGIN
   IF NOT EXISTS (
       SELECT 1 FROM pg_constraint 
       WHERE conname = 'fk_users_role_id' AND conrelid = 'users'::regclass
   ) THEN
       ALTER TABLE users
       ADD CONSTRAINT fk_users_role_id
       FOREIGN KEY (role_id) REFERENCES roles(id)
       ON DELETE SET NULL
       ON UPDATE CASCADE;
   END IF;
END
$$;

-- Role_Permissions Table: Maps permissions to roles (Many-to-Many)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- Main Travel Requests Table
CREATE TABLE IF NOT EXISTS travel_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    requestor_name TEXT NOT NULL,
    staff_id TEXT,
    department TEXT,
    position TEXT,
    cost_center TEXT,
    tel_email TEXT,
    email TEXT,
    travel_type TEXT NOT NULL, -- 'Domestic', 'Overseas', 'Home Leave Passage', 'External Parties'
    status TEXT NOT NULL DEFAULT 'Pending Department Focal',
    purpose TEXT,
    estimated_cost NUMERIC(12, 2) DEFAULT 0, -- For potential HOD approval rules
    additional_comments TEXT,
    -- For external party info
    external_full_name TEXT,
    external_organization TEXT,
    external_ref_to_authority_letter TEXT,
    external_cost_center TEXT,
    -- Timestamps
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_timestamp_travel_requests
BEFORE UPDATE ON travel_requests
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Itinerary Segments Table (Common for all TRF types)
CREATE TABLE IF NOT EXISTS trf_itinerary_segments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    trf_id TEXT NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
    segment_date DATE,
    day_of_week TEXT,
    from_location TEXT,
    to_location TEXT,
    departure_time TEXT,
    arrival_time TEXT,
    purpose TEXT,
    -- Meal allowances (for domestic travel)
    breakfast INTEGER DEFAULT 0,
    lunch INTEGER DEFAULT 0,
    dinner INTEGER DEFAULT 0,
    supper INTEGER DEFAULT 0,
    refreshment INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accommodation Details Table (Handles both Domestic & External types)
CREATE TABLE IF NOT EXISTS trf_accommodation_details (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    trf_id TEXT NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
    -- For Domestic Accommodation
    check_in_date DATE,
    check_out_date DATE,
    accommodation_type TEXT, -- 'Staff House', 'Camp', 'Hotel'
    location TEXT,
    -- For External Parties
    from_date DATE,
    to_date DATE,
    from_location TEXT,
    to_location TEXT,
    bt_no_required TEXT,
    accommodation_type_n TEXT,
    address TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Advance Bank Details Table (For Overseas/Home Leave)
CREATE TABLE IF NOT EXISTS trf_advance_bank_details (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    trf_id TEXT NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE UNIQUE,
    bank_name TEXT,
    account_number TEXT,
    account_name TEXT,
    swift_code TEXT,
    iban TEXT,
    branch_address TEXT,
    currency TEXT,
    amount NUMERIC(12, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Passport Details Table (For Overseas/Home Leave)
CREATE TABLE IF NOT EXISTS trf_passport_details (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    trf_id TEXT NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
    full_name TEXT,
    passport_number TEXT,
    nationality TEXT,
    date_of_birth DATE,
    place_of_birth TEXT,
    passport_issue_date DATE,
    passport_expiry_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval Steps Table (Tracks all approvals for a TRF)
CREATE TABLE IF NOT EXISTS trf_approval_steps (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    trf_id TEXT NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
    step_role TEXT NOT NULL,
    step_name TEXT,
    status TEXT NOT NULL,
    step_date TIMESTAMPTZ,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed some basic permissions (idempotent with ON CONFLICT)
INSERT INTO permissions (name, description) VALUES
    ('manage_users', 'Can create, edit, delete, and assign roles to users.'),
    ('view_users', 'Can view the user list.'),
    ('manage_roles', 'Can create, edit, and delete roles and assign permissions to them.'),
    ('view_system_settings', 'Can view the system settings page.'),
    ('create_trf', 'Can create new Travel Request Forms.'),
    ('approve_trf_focal', 'Can perform Department Focal approval for TRFs.'),
    ('approve_trf_manager', 'Can perform Line Manager approval for TRFs.'),
    ('approve_trf_hod', 'Can perform HOD approval for TRFs.'),
    ('process_flights', 'Can manage flight bookings (Ticketing Admin).'),
    ('manage_accommodation_bookings', 'Can manage accommodation bookings (Accommodation Admin).'),
    ('process_visa_applications', 'Can manage visa applications (Visa Clerk).'),
    ('create_claims', 'Can create new Expense Claims.'),
    ('approve_claims_focal', 'Can perform Department Focal approval for Claims.'),
    ('approve_claims_manager', 'Can perform Line Manager approval for Claims.'),
    ('approve_claims_hod', 'Can perform HOD approval for Claims.'),
    ('process_claims', 'Can process claims for payment (Finance Clerk).'),
    ('view_all_trf', 'Can view all TRFs across departments.'),
    ('view_all_claims', 'Can view all Claims across departments.')
ON CONFLICT (name) DO NOTHING;

-- Seed some basic roles (idempotent with ON CONFLICT)
INSERT INTO roles (name, description) VALUES
    ('System Administrator', 'Has full access to all system features and settings.'),
    ('Requestor', 'Can submit requests (TRF, Claims, Visa).'),
    ('Department Focal', 'Verifies initial requests from their department.'),
    ('Line Manager', 'Approves requests from their direct reports.'),
    ('HOD', 'Head of Department, approves high-cost or international requests.'),
    ('Ticketing Admin', 'Processes flight bookings for approved TRFs.'),
    ('Accommodation Admin', 'Manages staff house and camp bookings.'),
    ('Visa Clerk', 'Processes visa applications.'),
    ('Finance Clerk', 'Verifies and processes expense claims for payment.')
ON CONFLICT (name) DO NOTHING;

-- Associate all permissions to System Administrator role
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id from roles WHERE name = 'System Administrator'),
    p.id
FROM permissions p
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Associate appropriate permissions to other roles
-- Requestor permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id from roles WHERE name = 'Requestor'),
    p.id
FROM permissions p
WHERE p.name IN ('create_trf', 'create_claims')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Department Focal permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id from roles WHERE name = 'Department Focal'),
    p.id
FROM permissions p
WHERE p.name IN ('approve_trf_focal', 'approve_claims_focal', 'view_users')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Line Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id from roles WHERE name = 'Line Manager'),
    p.id
FROM permissions p
WHERE p.name IN ('approve_trf_manager', 'approve_claims_manager', 'view_users')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HOD permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    (SELECT id from roles WHERE name = 'HOD'),
    p.id
FROM permissions p
WHERE p.name IN ('approve_trf_hod', 'approve_claims_hod', 'view_users', 'view_all_trf', 'view_all_claims')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Create a test admin user
INSERT INTO users (name, email, role_id, role, department, staff_id, status)
VALUES (
    'System Admin',
    'admin@syntra.com',
    (SELECT id FROM roles WHERE name = 'System Administrator'),
    'System Administrator',
    'IT',
    'ADMIN001',
    'Active'
)
ON CONFLICT (email) DO NOTHING;

-- Create a test requestor user
INSERT INTO users (name, email, role_id, role, department, staff_id, status)
VALUES (
    'Test Requestor',
    'requestor@syntra.com',
    (SELECT id FROM roles WHERE name = 'Requestor'),
    'Requestor',
    'Finance',
    'REQ001',
    'Active'
)
ON CONFLICT (email) DO NOTHING;