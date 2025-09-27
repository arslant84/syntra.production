-- ============================================================================
-- SynTra Production Database Setup Script
-- ============================================================================
-- This script creates the complete database structure for production deployment
-- Run this on your production PostgreSQL server after creating the database
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to automatically update timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to hash passwords automatically
CREATE OR REPLACE FUNCTION hash_user_password()
RETURNS TRIGGER AS $$
BEGIN
  -- Only hash if password is not null and not already hashed
  IF NEW.password IS NOT NULL AND NOT (NEW.password LIKE '$2b$%') THEN
    NEW.password := crypt(NEW.password, gen_salt('bf', 12));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CORE TABLES (Base entities that other tables depend on)
-- ============================================================================

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_id, permission_id)
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT,
    role_id TEXT,
    role TEXT,
    department TEXT,
    staff_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'Active',
    gender TEXT,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- NOTIFICATION SYSTEM
-- ============================================================================

-- Notification event types
CREATE TABLE IF NOT EXISTS notification_event_types (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification templates
CREATE TABLE IF NOT EXISTS notification_templates (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    role_target TEXT,
    template_subject TEXT NOT NULL,
    template_body TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TRAVEL REQUEST SYSTEM
-- ============================================================================

-- Main travel requests table
CREATE TABLE IF NOT EXISTS travel_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    requestor_name TEXT NOT NULL,
    staff_id TEXT,
    department TEXT,
    position TEXT,
    cost_center TEXT,
    tel_email TEXT,
    email TEXT,
    travel_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending Department Focal',
    purpose TEXT,
    estimated_cost NUMERIC(12,2) DEFAULT 0,
    additional_comments TEXT,
    external_full_name TEXT,
    external_organization TEXT,
    external_ref_to_authority_letter TEXT,
    external_cost_center TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    additional_data JSONB
);

-- Travel request approval steps
CREATE TABLE IF NOT EXISTS trf_approval_steps (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    trf_id TEXT NOT NULL,
    step_role TEXT NOT NULL,
    step_name TEXT NOT NULL,
    status TEXT NOT NULL,
    step_date TIMESTAMPTZ DEFAULT NOW(),
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Travel request itinerary segments
CREATE TABLE IF NOT EXISTS trf_itinerary_segments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    trf_id TEXT NOT NULL,
    from_location TEXT NOT NULL,
    to_location TEXT NOT NULL,
    departure_date DATE NOT NULL,
    departure_time TIME,
    arrival_date DATE,
    arrival_time TIME,
    segment_order INTEGER NOT NULL DEFAULT 1,
    transport_type TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ACCOMMODATION SYSTEM
-- ============================================================================

-- Accommodation details
CREATE TABLE IF NOT EXISTS trf_accommodation_details (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    trf_id TEXT NOT NULL,
    accommodation_type TEXT,
    check_in_date DATE,
    check_out_date DATE,
    location TEXT,
    place_of_stay TEXT,
    estimated_cost_per_night NUMERIC(10,2) DEFAULT 0,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accommodation staff houses
CREATE TABLE IF NOT EXISTS accommodation_staff_houses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    address TEXT,
    contact_person TEXT,
    contact_phone TEXT,
    amenities TEXT,
    rules TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accommodation rooms
CREATE TABLE IF NOT EXISTS accommodation_rooms (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_house_id TEXT NOT NULL,
    name TEXT NOT NULL,
    room_type TEXT,
    capacity INTEGER DEFAULT 1,
    amenities TEXT,
    status TEXT DEFAULT 'Available',
    daily_rate NUMERIC(8,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accommodation bookings
CREATE TABLE IF NOT EXISTS accommodation_bookings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    trf_id TEXT,
    staff_house_id TEXT,
    room_id TEXT,
    staff_id TEXT,
    date DATE NOT NULL,
    status TEXT DEFAULT 'Confirmed',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FLIGHT SYSTEM
-- ============================================================================

-- Flight bookings
CREATE TABLE IF NOT EXISTS trf_flight_bookings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    trf_id TEXT NOT NULL,
    flight_number TEXT,
    airline TEXT,
    departure_location TEXT,
    arrival_location TEXT,
    departure_date DATE,
    departure_time TIME,
    arrival_date DATE,
    arrival_time TIME,
    booking_reference TEXT,
    status TEXT DEFAULT 'Pending',
    remarks TEXT,
    booking_cost NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TRANSPORT SYSTEM
-- ============================================================================

-- Transport requests
CREATE TABLE IF NOT EXISTS transport_requests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    requestor_name TEXT NOT NULL,
    staff_id TEXT,
    department TEXT,
    contact_details TEXT,
    transport_type TEXT NOT NULL,
    pickup_location TEXT,
    destination TEXT,
    pickup_date DATE,
    pickup_time TIME,
    return_date DATE,
    return_time TIME,
    passenger_count INTEGER DEFAULT 1,
    purpose TEXT,
    status TEXT NOT NULL DEFAULT 'Pending',
    assigned_vehicle TEXT,
    assigned_driver TEXT,
    estimated_cost NUMERIC(10,2) DEFAULT 0,
    actual_cost NUMERIC(10,2) DEFAULT 0,
    remarks TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Company transport details
CREATE TABLE IF NOT EXISTS trf_company_transport_details (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    trf_id TEXT NOT NULL,
    transport_type TEXT,
    pickup_location TEXT,
    destination TEXT,
    pickup_date DATE,
    pickup_time TIME,
    return_date DATE,
    return_time TIME,
    passenger_count INTEGER DEFAULT 1,
    special_requirements TEXT,
    estimated_cost NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- EXPENSE CLAIMS SYSTEM
-- ============================================================================

-- Expense claims
CREATE TABLE IF NOT EXISTS expense_claims (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    document_number TEXT NOT NULL UNIQUE,
    requestor_name TEXT NOT NULL,
    staff_id TEXT,
    department TEXT,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending Department Focal',
    total_advance_claim_amount NUMERIC(12,2) DEFAULT 0,
    balance_claim_repayment NUMERIC(12,2) DEFAULT 0,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense claim items
CREATE TABLE IF NOT EXISTS expense_claim_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id TEXT NOT NULL,
    date DATE NOT NULL,
    claim_or_travel_details TEXT NOT NULL,
    official_mileage_km NUMERIC(8,2) DEFAULT 0,
    transport NUMERIC(10,2) DEFAULT 0,
    hotel_accommodation_allowance NUMERIC(10,2) DEFAULT 0,
    out_station_allowance_meal NUMERIC(10,2) DEFAULT 0,
    miscellaneous_allowance_10_percent NUMERIC(10,2) DEFAULT 0,
    other_expenses NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- VISA SYSTEM
-- ============================================================================

-- Visa applications
CREATE TABLE IF NOT EXISTS visa_applications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    application_number TEXT NOT NULL UNIQUE,
    trf_id TEXT,
    applicant_name TEXT NOT NULL,
    staff_id TEXT,
    department TEXT,
    destination_country TEXT NOT NULL,
    visa_type TEXT NOT NULL,
    purpose_of_visit TEXT NOT NULL,
    passport_number TEXT,
    passport_expiry_date DATE,
    intended_travel_date DATE,
    intended_return_date DATE,
    status TEXT NOT NULL DEFAULT 'Pending',
    priority TEXT DEFAULT 'Normal',
    remarks TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Visa approval steps
CREATE TABLE IF NOT EXISTS visa_approval_steps (
    id SERIAL PRIMARY KEY,
    visa_id TEXT NOT NULL,
    step_role TEXT NOT NULL,
    step_name TEXT NOT NULL,
    status TEXT NOT NULL,
    step_date TIMESTAMPTZ DEFAULT NOW(),
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Visa documents
CREATE TABLE IF NOT EXISTS visa_documents (
    id SERIAL PRIMARY KEY,
    visa_id TEXT NOT NULL,
    document_type TEXT NOT NULL,
    document_name TEXT NOT NULL,
    file_path TEXT,
    file_size INTEGER,
    uploaded_by TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    is_required BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'Uploaded'
);

-- ============================================================================
-- WORKFLOW SYSTEM
-- ============================================================================

-- Workflow templates
CREATE TABLE IF NOT EXISTS workflow_templates (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    workflow_type TEXT NOT NULL,
    steps JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow instances
CREATE TABLE IF NOT EXISTS workflow_instances (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    current_step INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Active',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow step executions
CREATE TABLE IF NOT EXISTS workflow_step_executions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_instance_id TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    step_name TEXT NOT NULL,
    status TEXT NOT NULL,
    executed_by TEXT,
    executed_at TIMESTAMPTZ,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MEAL PROVISIONS
-- ============================================================================

-- Meal provisions
CREATE TABLE IF NOT EXISTS trf_meal_provisions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    trf_id TEXT NOT NULL,
    location TEXT NOT NULL,
    meal_date DATE NOT NULL,
    breakfast BOOLEAN DEFAULT false,
    lunch BOOLEAN DEFAULT false,
    dinner BOOLEAN DEFAULT false,
    special_requirements TEXT,
    estimated_cost NUMERIC(8,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily meal selections
CREATE TABLE IF NOT EXISTS trf_daily_meal_selections (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    trf_id TEXT NOT NULL,
    meal_date DATE NOT NULL,
    breakfast_selected BOOLEAN DEFAULT false,
    lunch_selected BOOLEAN DEFAULT false,
    dinner_selected BOOLEAN DEFAULT false,
    special_dietary_requirements TEXT,
    estimated_daily_cost NUMERIC(8,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ADVANCE PAYMENTS
-- ============================================================================

-- Advance amount requested items
CREATE TABLE IF NOT EXISTS trf_advance_amount_requested_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    trf_id TEXT NOT NULL,
    item_description TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    justification TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Advance bank details
CREATE TABLE IF NOT EXISTS trf_advance_bank_details (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    trf_id TEXT NOT NULL,
    bank_name TEXT,
    account_number TEXT,
    account_holder_name TEXT,
    iban TEXT,
    swift_code TEXT,
    branch_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PASSPORT DETAILS
-- ============================================================================

-- Passport details
CREATE TABLE IF NOT EXISTS trf_passport_details (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    trf_id TEXT NOT NULL,
    passport_number TEXT,
    issue_date DATE,
    expiry_date DATE,
    issuing_country TEXT,
    nationality TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SYSTEM TABLES
-- ============================================================================

-- Application settings
CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    category TEXT DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration log
CREATE TABLE IF NOT EXISTS migration_log (
    id SERIAL PRIMARY KEY,
    migration_name TEXT NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    success BOOLEAN DEFAULT true,
    error_message TEXT
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Role permissions
ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_role
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;

-- Users
ALTER TABLE users ADD CONSTRAINT fk_users_role
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;

-- Travel request relationships
ALTER TABLE trf_approval_steps ADD CONSTRAINT fk_trf_approval_steps_trf
    FOREIGN KEY (trf_id) REFERENCES travel_requests(id) ON DELETE CASCADE;
ALTER TABLE trf_itinerary_segments ADD CONSTRAINT fk_trf_itinerary_segments_trf
    FOREIGN KEY (trf_id) REFERENCES travel_requests(id) ON DELETE CASCADE;
ALTER TABLE trf_accommodation_details ADD CONSTRAINT fk_trf_accommodation_details_trf
    FOREIGN KEY (trf_id) REFERENCES travel_requests(id) ON DELETE CASCADE;
ALTER TABLE trf_flight_bookings ADD CONSTRAINT fk_trf_flight_bookings_trf
    FOREIGN KEY (trf_id) REFERENCES travel_requests(id) ON DELETE CASCADE;
ALTER TABLE trf_company_transport_details ADD CONSTRAINT fk_trf_company_transport_details_trf
    FOREIGN KEY (trf_id) REFERENCES travel_requests(id) ON DELETE CASCADE;
ALTER TABLE trf_meal_provisions ADD CONSTRAINT fk_trf_meal_provisions_trf
    FOREIGN KEY (trf_id) REFERENCES travel_requests(id) ON DELETE CASCADE;
ALTER TABLE trf_daily_meal_selections ADD CONSTRAINT fk_trf_daily_meal_selections_trf
    FOREIGN KEY (trf_id) REFERENCES travel_requests(id) ON DELETE CASCADE;
ALTER TABLE trf_advance_amount_requested_items ADD CONSTRAINT fk_trf_advance_amount_requested_items_trf
    FOREIGN KEY (trf_id) REFERENCES travel_requests(id) ON DELETE CASCADE;
ALTER TABLE trf_advance_bank_details ADD CONSTRAINT fk_trf_advance_bank_details_trf
    FOREIGN KEY (trf_id) REFERENCES travel_requests(id) ON DELETE CASCADE;
ALTER TABLE trf_passport_details ADD CONSTRAINT fk_trf_passport_details_trf
    FOREIGN KEY (trf_id) REFERENCES travel_requests(id) ON DELETE CASCADE;

-- Accommodation relationships
ALTER TABLE accommodation_rooms ADD CONSTRAINT fk_accommodation_rooms_staff_house
    FOREIGN KEY (staff_house_id) REFERENCES accommodation_staff_houses(id) ON DELETE CASCADE;
ALTER TABLE accommodation_bookings ADD CONSTRAINT fk_accommodation_bookings_trf
    FOREIGN KEY (trf_id) REFERENCES travel_requests(id) ON DELETE SET NULL;
ALTER TABLE accommodation_bookings ADD CONSTRAINT fk_accommodation_bookings_staff_house
    FOREIGN KEY (staff_house_id) REFERENCES accommodation_staff_houses(id) ON DELETE SET NULL;
ALTER TABLE accommodation_bookings ADD CONSTRAINT fk_accommodation_bookings_room
    FOREIGN KEY (room_id) REFERENCES accommodation_rooms(id) ON DELETE SET NULL;

-- Expense claims relationships
ALTER TABLE expense_claim_items ADD CONSTRAINT fk_expense_claim_items_claim
    FOREIGN KEY (claim_id) REFERENCES expense_claims(id) ON DELETE CASCADE;

-- Visa relationships
ALTER TABLE visa_applications ADD CONSTRAINT fk_visa_applications_trf
    FOREIGN KEY (trf_id) REFERENCES travel_requests(id) ON DELETE SET NULL;
ALTER TABLE visa_approval_steps ADD CONSTRAINT fk_visa_approval_steps_visa
    FOREIGN KEY (visa_id) REFERENCES visa_applications(id) ON DELETE CASCADE;
ALTER TABLE visa_documents ADD CONSTRAINT fk_visa_documents_visa
    FOREIGN KEY (visa_id) REFERENCES visa_applications(id) ON DELETE CASCADE;

-- Workflow relationships
ALTER TABLE workflow_instances ADD CONSTRAINT fk_workflow_instances_template
    FOREIGN KEY (template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE;
ALTER TABLE workflow_step_executions ADD CONSTRAINT fk_workflow_step_executions_instance
    FOREIGN KEY (workflow_instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_staff_id ON users(staff_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Travel requests indexes
CREATE INDEX IF NOT EXISTS idx_travel_requests_status ON travel_requests(status);
CREATE INDEX IF NOT EXISTS idx_travel_requests_travel_type ON travel_requests(travel_type);
CREATE INDEX IF NOT EXISTS idx_travel_requests_staff_id ON travel_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_travel_requests_created_at ON travel_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_travel_requests_submitted_at ON travel_requests(submitted_at);

-- Approval steps indexes
CREATE INDEX IF NOT EXISTS idx_trf_approval_steps_trf_id ON trf_approval_steps(trf_id);
CREATE INDEX IF NOT EXISTS idx_trf_approval_steps_status ON trf_approval_steps(status);

-- Accommodation indexes
CREATE INDEX IF NOT EXISTS idx_accommodation_bookings_date ON accommodation_bookings(date);
CREATE INDEX IF NOT EXISTS idx_accommodation_bookings_trf_id ON accommodation_bookings(trf_id);
CREATE INDEX IF NOT EXISTS idx_accommodation_bookings_room_id ON accommodation_bookings(room_id);

-- Transport indexes
CREATE INDEX IF NOT EXISTS idx_transport_requests_status ON transport_requests(status);
CREATE INDEX IF NOT EXISTS idx_transport_requests_pickup_date ON transport_requests(pickup_date);

-- Expense claims indexes
CREATE INDEX IF NOT EXISTS idx_expense_claims_status ON expense_claims(status);
CREATE INDEX IF NOT EXISTS idx_expense_claims_staff_id ON expense_claims(staff_id);

-- Visa indexes
CREATE INDEX IF NOT EXISTS idx_visa_applications_status ON visa_applications(status);
CREATE INDEX IF NOT EXISTS idx_visa_applications_staff_id ON visa_applications(staff_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Timestamp update triggers
CREATE TRIGGER set_timestamp_roles BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_permissions BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_travel_requests BEFORE UPDATE ON travel_requests FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_accommodation_staff_houses BEFORE UPDATE ON accommodation_staff_houses FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_accommodation_rooms BEFORE UPDATE ON accommodation_rooms FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_accommodation_bookings BEFORE UPDATE ON accommodation_bookings FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_expense_claims BEFORE UPDATE ON expense_claims FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_visa_applications BEFORE UPDATE ON visa_applications FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_transport_requests BEFORE UPDATE ON transport_requests FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_workflow_templates BEFORE UPDATE ON workflow_templates FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_workflow_instances BEFORE UPDATE ON workflow_instances FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Password hashing trigger
CREATE TRIGGER hash_password_trigger BEFORE INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION hash_user_password();

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SynTra Database Setup Complete!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Database schema has been successfully created.';
    RAISE NOTICE 'You can now connect your application to this database.';
    RAISE NOTICE 'Total tables created: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public');
    RAISE NOTICE 'Setup completed at: %', NOW();
    RAISE NOTICE '========================================';
END $$;