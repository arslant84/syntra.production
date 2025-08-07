-- Transport Requests Database Schema
-- This script creates all necessary tables for the transport request module

-- Main Transport Requests Table
CREATE TABLE IF NOT EXISTS transport_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    requestor_name TEXT NOT NULL,
    staff_id TEXT,
    department TEXT,
    position TEXT,
    cost_center TEXT,
    tel_email TEXT,
    email TEXT,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft',
    total_estimated_cost NUMERIC(12, 2) DEFAULT 0,
    tsr_reference TEXT, -- Reference to TSR if created from TSR
    additional_comments TEXT,
    confirm_policy BOOLEAN DEFAULT FALSE,
    confirm_manager_approval BOOLEAN DEFAULT FALSE,
    confirm_terms_and_conditions BOOLEAN DEFAULT FALSE,
    created_by TEXT, -- REFERENCES users(id) ON DELETE SET NULL,
    updated_by TEXT, -- REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS set_timestamp_transport_requests ON transport_requests;

-- Create trigger for transport_requests
CREATE TRIGGER set_timestamp_transport_requests
BEFORE UPDATE ON transport_requests
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Transport Details Table
CREATE TABLE IF NOT EXISTS transport_details (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    transport_request_id TEXT NOT NULL REFERENCES transport_requests(id) ON DELETE CASCADE,
    date DATE,
    day TEXT,
    from_location TEXT NOT NULL,
    to_location TEXT NOT NULL,
    departure_time TEXT,
    arrival_time TEXT,
    transport_type TEXT NOT NULL, -- 'Local', 'Intercity', 'Airport Transfer', 'Charter', 'Other'
    vehicle_type TEXT NOT NULL, -- 'Car', 'Van', 'Bus', 'Motorcycle', 'Other'
    number_of_passengers INTEGER DEFAULT 1,
    purpose TEXT,
    remarks TEXT,
    estimated_cost NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS set_timestamp_transport_details ON transport_details;

-- Create trigger for transport_details
CREATE TRIGGER set_timestamp_transport_details
BEFORE UPDATE ON transport_details
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Transport Approval Steps Table
CREATE TABLE IF NOT EXISTS transport_approval_steps (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    transport_request_id TEXT NOT NULL REFERENCES transport_requests(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- e.g., 'Requestor', 'Line Manager', 'Department Focal', 'HOD'
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Not Started', -- 'Current', 'Pending', 'Approved', 'Rejected', 'Not Started', 'Cancelled'
    date TIMESTAMPTZ,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS set_timestamp_transport_approval_steps ON transport_approval_steps;

-- Create trigger for transport_approval_steps
CREATE TRIGGER set_timestamp_transport_approval_steps
BEFORE UPDATE ON transport_approval_steps
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Insert default approval workflow steps for existing transport requests
INSERT INTO transport_approval_steps (transport_request_id, role, name, status, date)
SELECT
    tr.id,
    'Requestor',
    tr.requestor_name,
    'Current',
    tr.created_at
FROM transport_requests tr
WHERE NOT EXISTS (
    SELECT 1 FROM transport_approval_steps tas
    WHERE tas.transport_request_id = tr.id AND tas.role = 'Requestor'
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transport_requests_status ON transport_requests(status);
CREATE INDEX IF NOT EXISTS idx_transport_requests_created_by ON transport_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_transport_requests_tsr_reference ON transport_requests(tsr_reference);
CREATE INDEX IF NOT EXISTS idx_transport_details_request_id ON transport_details(transport_request_id);
CREATE INDEX IF NOT EXISTS idx_transport_approval_steps_request_id ON transport_approval_steps(transport_request_id); 