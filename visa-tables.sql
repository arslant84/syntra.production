-- Visa Applications Table
CREATE TABLE IF NOT EXISTS visa_applications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    requestor_name TEXT NOT NULL,
    staff_id TEXT,
    department TEXT,
    position TEXT,
    email TEXT,
    destination TEXT NOT NULL,
    travel_purpose TEXT NOT NULL,
    visa_type TEXT NOT NULL,
    trip_start_date DATE,
    trip_end_date DATE,
    passport_number TEXT,
    passport_expiry_date DATE,
    status TEXT NOT NULL DEFAULT 'Pending Department Focal',
    additional_comments TEXT,
    submitted_date TIMESTAMPTZ DEFAULT NOW(),
    last_updated_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to update the updated_at field
CREATE TRIGGER set_timestamp_visa_applications
BEFORE UPDATE ON visa_applications
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Visa Application Documents Table
CREATE TABLE IF NOT EXISTS visa_documents (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    visa_application_id TEXT NOT NULL REFERENCES visa_applications(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- passport, photo, invitation_letter, etc.
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to update the updated_at field
CREATE TRIGGER set_timestamp_visa_documents
BEFORE UPDATE ON visa_documents
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Visa Application Approval Steps
CREATE TABLE IF NOT EXISTS visa_approval_steps (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    visa_application_id TEXT NOT NULL REFERENCES visa_applications(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_role TEXT NOT NULL,
    step_name TEXT,
    status TEXT NOT NULL,
    step_date TIMESTAMPTZ,
    approver_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    approver_name TEXT,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to update the updated_at field
CREATE TRIGGER set_timestamp_visa_approval_steps
BEFORE UPDATE ON visa_approval_steps
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Mock visa application data has been removed
-- To add real visa applications, use the application interface
