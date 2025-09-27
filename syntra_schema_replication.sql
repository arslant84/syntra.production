-- ============================================================================
-- SynTra Database Schema Replication Script
-- ============================================================================
-- Description: Complete schema-only replication script for SynTra project
-- Version: 1.0
-- Generated: 2025-09-21
-- Database: PostgreSQL 17.6
--
-- This script creates the complete database structure for the SynTra project
-- including all tables, indexes, constraints, sequences, functions, and triggers.
--
-- The script is idempotent and can be run multiple times safely.
-- ============================================================================

-- Set session variables for consistency
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Create pgcrypto extension for cryptographic functions
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: hash_user_password()
-- Description: Automatically hashes plaintext passwords using bcrypt
CREATE OR REPLACE FUNCTION public.hash_user_password() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
BEGIN
  -- Only hash if password is not null and not already hashed (bcrypt hashes start with $2b$)
  IF NEW.password IS NOT NULL AND NOT (NEW.password LIKE '$2b$%') THEN
    -- Use pgcrypto's crypt function with bcrypt
    NEW.password := crypt(NEW.password, gen_salt('bf', 12));
  END IF;

  RETURN NEW;
END;
$_$;

COMMENT ON FUNCTION public.hash_user_password() IS 'Automatically hashes plaintext passwords using bcrypt when users are inserted or updated';

-- Function: trigger_set_timestamp()
-- Description: Updates the updated_at column with current timestamp
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function: update_updated_at_column()
-- Description: Updates the updated_at column with current timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============================================================================
-- SEQUENCES
-- ============================================================================

-- Sequence: migration_log_id_seq
CREATE SEQUENCE IF NOT EXISTS public.migration_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Sequence: visa_approval_steps_id_seq
CREATE SEQUENCE IF NOT EXISTS public.visa_approval_steps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Sequence: visa_documents_id_seq
CREATE SEQUENCE IF NOT EXISTS public.visa_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- ============================================================================
-- TABLES (Ordered by Dependencies)
-- ============================================================================

-- Table: migration_log
-- Description: Tracks database migrations
CREATE TABLE IF NOT EXISTS public.migration_log (
    id integer NOT NULL DEFAULT nextval('public.migration_log_id_seq'::regclass),
    migration_name character varying(255) NOT NULL,
    executed_at timestamp without time zone DEFAULT now(),
    description text,
    CONSTRAINT migration_log_pkey PRIMARY KEY (id),
    CONSTRAINT migration_log_migration_name_key UNIQUE (migration_name)
);

-- Set sequence ownership
ALTER SEQUENCE public.migration_log_id_seq OWNED BY public.migration_log.id;

-- Table: roles
-- Description: User roles in the system
CREATE TABLE IF NOT EXISTS public.roles (
    id text NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT roles_pkey PRIMARY KEY (id),
    CONSTRAINT roles_name_key UNIQUE (name)
);

-- Table: permissions
-- Description: System permissions
CREATE TABLE IF NOT EXISTS public.permissions (
    id text NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT permissions_pkey PRIMARY KEY (id),
    CONSTRAINT permissions_name_key UNIQUE (name)
);

-- Table: role_permissions
-- Description: Many-to-many relationship between roles and permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id text NOT NULL,
    permission_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id)
);

-- Table: application_settings
-- Description: Application configuration settings
CREATE TABLE IF NOT EXISTS public.application_settings (
    id text NOT NULL DEFAULT gen_random_uuid(),
    setting_key text NOT NULL,
    setting_value text NOT NULL,
    setting_type text DEFAULT 'string'::text NOT NULL,
    description text,
    is_public boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT application_settings_pkey PRIMARY KEY (id),
    CONSTRAINT application_settings_setting_key_key UNIQUE (setting_key)
);

-- Table: users
-- Description: System users
CREATE TABLE IF NOT EXISTS public.users (
    id text NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    email text NOT NULL,
    role_id text,
    role text,
    department text,
    staff_id text,
    status text DEFAULT 'Active'::text NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    password text,
    gender character varying(10),
    profile_photo text,
    phone text,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_staff_id_key UNIQUE (staff_id)
);

-- Table: notification_event_types
-- Description: Defines all types of events that can trigger notifications
CREATE TABLE IF NOT EXISTS public.notification_event_types (
    id text NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    category text NOT NULL,
    module text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT notification_event_types_pkey PRIMARY KEY (id),
    CONSTRAINT notification_event_types_name_key UNIQUE (name)
);

COMMENT ON TABLE public.notification_event_types IS 'Defines all types of events that can trigger notifications';

-- Table: notification_templates
-- Description: Email and notification templates
CREATE TABLE IF NOT EXISTS public.notification_templates (
    id text NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text,
    event_type_id text,
    notification_type text DEFAULT 'email'::text,
    is_active boolean DEFAULT true,
    variables_available text[],
    recipient_type text DEFAULT 'approver'::text,
    CONSTRAINT notification_templates_pkey PRIMARY KEY (id),
    CONSTRAINT notification_templates_name_key UNIQUE (name)
);

-- Table: notification_user_subscriptions
-- Description: Controls which users receive notifications for which events based on permissions/roles
CREATE TABLE IF NOT EXISTS public.notification_user_subscriptions (
    id text NOT NULL DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    event_type_id text NOT NULL,
    permission_required text,
    role_required text,
    department_filter text,
    is_enabled boolean DEFAULT true,
    notification_method text DEFAULT 'in_app'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT notification_user_subscriptions_pkey PRIMARY KEY (id),
    CONSTRAINT notification_user_subscriptions_user_id_event_type_id_key UNIQUE (user_id, event_type_id)
);

COMMENT ON TABLE public.notification_user_subscriptions IS 'Controls which users receive notifications for which events based on permissions/roles';
COMMENT ON COLUMN public.notification_user_subscriptions.permission_required IS 'If set, user must have this permission to receive notifications for this event';
COMMENT ON COLUMN public.notification_user_subscriptions.role_required IS 'If set, user must have this role to receive notifications for this event';
COMMENT ON COLUMN public.notification_user_subscriptions.department_filter IS 'If set, only users in this department receive notifications';

-- Table: user_notification_preferences
-- Description: User-specific notification preferences
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
    id text NOT NULL DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    email_enabled boolean DEFAULT true,
    inapp_enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_notification_preferences_pkey PRIMARY KEY (id),
    CONSTRAINT user_notification_preferences_user_id_key UNIQUE (user_id)
);

-- Table: user_notifications
-- Description: Individual notifications sent to users
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id text NOT NULL DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL,
    category text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    related_entity_type text,
    related_entity_id text,
    action_required boolean DEFAULT false,
    action_url text,
    is_read boolean DEFAULT false,
    is_dismissed boolean DEFAULT false,
    read_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    CONSTRAINT user_notifications_pkey PRIMARY KEY (id)
);

-- Table: workflow_templates
-- Description: Workflow template definitions
CREATE TABLE IF NOT EXISTS public.workflow_templates (
    id text NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    entity_type text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workflow_templates_pkey PRIMARY KEY (id),
    CONSTRAINT workflow_templates_name_key UNIQUE (name)
);

-- Table: workflow_steps
-- Description: Individual steps within workflow templates
CREATE TABLE IF NOT EXISTS public.workflow_steps (
    id text NOT NULL DEFAULT gen_random_uuid(),
    workflow_template_id text NOT NULL,
    step_number integer NOT NULL,
    step_name text NOT NULL,
    step_description text,
    step_type text NOT NULL,
    required_role text,
    required_permission text,
    auto_approve_condition text,
    escalation_timeout_hours integer,
    is_final_step boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workflow_steps_pkey PRIMARY KEY (id),
    CONSTRAINT workflow_steps_workflow_template_id_step_number_key UNIQUE (workflow_template_id, step_number)
);

-- Table: workflow_instances
-- Description: Active workflow instances for specific entities
CREATE TABLE IF NOT EXISTS public.workflow_instances (
    id text NOT NULL DEFAULT gen_random_uuid(),
    workflow_template_id text NOT NULL,
    entity_id text NOT NULL,
    entity_type text NOT NULL,
    current_step_id text,
    status text DEFAULT 'active'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workflow_instances_pkey PRIMARY KEY (id)
);

-- Table: workflow_step_executions
-- Description: Execution records for workflow steps
CREATE TABLE IF NOT EXISTS public.workflow_step_executions (
    id text NOT NULL DEFAULT gen_random_uuid(),
    workflow_instance_id text NOT NULL,
    workflow_step_id text NOT NULL,
    assigned_to_user_id text,
    assigned_to_role text,
    status text DEFAULT 'pending'::text NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    escalated_from text,
    escalated_at timestamp with time zone,
    comments text,
    decision text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT workflow_step_executions_pkey PRIMARY KEY (id)
);

-- Table: accommodation_staff_houses
-- Description: Staff accommodation houses/facilities
CREATE TABLE IF NOT EXISTS public.accommodation_staff_houses (
    id text NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    location text NOT NULL,
    address text,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT accommodation_staff_houses_pkey PRIMARY KEY (id),
    CONSTRAINT accommodation_staff_houses_location_check CHECK ((location = ANY (ARRAY['Ashgabat'::text, 'Kiyanly'::text, 'Turkmenbashy'::text])))
);

-- Table: accommodation_rooms
-- Description: Individual rooms within staff houses
CREATE TABLE IF NOT EXISTS public.accommodation_rooms (
    id text NOT NULL DEFAULT gen_random_uuid(),
    staff_house_id text NOT NULL,
    name text NOT NULL,
    room_type text,
    capacity integer DEFAULT 1,
    status text DEFAULT 'Available'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT accommodation_rooms_pkey PRIMARY KEY (id),
    CONSTRAINT accommodation_rooms_room_type_check CHECK ((room_type = ANY (ARRAY['Single'::text, 'Double'::text, 'Suite'::text, 'Tent'::text]))),
    CONSTRAINT accommodation_rooms_status_check CHECK ((status = ANY (ARRAY['Available'::text, 'Maintenance'::text, 'Reserved'::text])))
);

-- Table: travel_requests
-- Description: Travel request applications
CREATE TABLE IF NOT EXISTS public.travel_requests (
    id text NOT NULL DEFAULT gen_random_uuid(),
    requestor_name text NOT NULL,
    staff_id text,
    department text,
    "position" text,
    cost_center text,
    tel_email text,
    email text,
    travel_type text NOT NULL,
    status text DEFAULT 'Pending Department Focal'::text NOT NULL,
    purpose text,
    estimated_cost numeric(12,2) DEFAULT 0,
    additional_comments text,
    external_full_name text,
    external_organization text,
    external_ref_to_authority_letter text,
    external_cost_center text,
    submitted_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    additional_data jsonb,
    CONSTRAINT travel_requests_pkey PRIMARY KEY (id)
);

-- Table: accommodation_requests
-- Description: Accommodation booking requests
CREATE TABLE IF NOT EXISTS public.accommodation_requests (
    id text NOT NULL,
    requestor_name text NOT NULL,
    staff_id text,
    department text,
    "position" text,
    cost_center text,
    tel_email text,
    email text,
    status text NOT NULL,
    estimated_cost numeric,
    additional_comments text,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    additional_data jsonb,
    CONSTRAINT accommodation_requests_pkey PRIMARY KEY (id)
);

-- Table: accommodation_bookings
-- Description: Actual accommodation bookings
CREATE TABLE IF NOT EXISTS public.accommodation_bookings (
    id text NOT NULL DEFAULT gen_random_uuid(),
    staff_house_id text NOT NULL,
    room_id text NOT NULL,
    staff_id text,
    date date NOT NULL,
    trf_id text,
    status text DEFAULT 'Confirmed'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT accommodation_bookings_pkey PRIMARY KEY (id),
    CONSTRAINT accommodation_bookings_status_check CHECK ((status = ANY (ARRAY['Confirmed'::text, 'Checked-in'::text, 'Checked-out'::text, 'Cancelled'::text, 'Blocked'::text, 'Assigned'::text]))),
    CONSTRAINT unique_room_date UNIQUE (room_id, date)
);

-- Table: staff_guests
-- Description: Staff members and guests
CREATE TABLE IF NOT EXISTS public.staff_guests (
    id text NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    gender text NOT NULL,
    department text,
    staff_id text,
    email text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT staff_guests_pkey PRIMARY KEY (id),
    CONSTRAINT staff_guests_gender_check CHECK ((gender = ANY (ARRAY['Male'::text, 'Female'::text])))
);

-- Table: transport_requests
-- Description: Transport service requests
CREATE TABLE IF NOT EXISTS public.transport_requests (
    id text NOT NULL DEFAULT gen_random_uuid(),
    requestor_name text NOT NULL,
    staff_id text,
    department text,
    "position" text,
    cost_center text,
    tel_email text,
    email text,
    purpose text NOT NULL,
    status text DEFAULT 'Draft'::text NOT NULL,
    total_estimated_cost numeric(12,2) DEFAULT 0,
    tsr_reference text,
    additional_comments text,
    confirm_policy boolean DEFAULT false,
    confirm_manager_approval boolean DEFAULT false,
    confirm_terms_and_conditions boolean DEFAULT false,
    created_by text,
    updated_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    submitted_at timestamp with time zone DEFAULT now(),
    booking_details jsonb,
    CONSTRAINT transport_requests_pkey PRIMARY KEY (id)
);

-- Table: transport_details
-- Description: Detailed transport itinerary
CREATE TABLE IF NOT EXISTS public.transport_details (
    id text NOT NULL DEFAULT gen_random_uuid(),
    transport_request_id text NOT NULL,
    date date,
    day text,
    from_location text NOT NULL,
    to_location text NOT NULL,
    departure_time text,
    arrival_time text,
    transport_type text NOT NULL,
    vehicle_type text NOT NULL,
    number_of_passengers integer DEFAULT 1,
    purpose text,
    remarks text,
    estimated_cost numeric(12,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT transport_details_pkey PRIMARY KEY (id)
);

-- Table: transport_approval_steps
-- Description: Transport request approval workflow
CREATE TABLE IF NOT EXISTS public.transport_approval_steps (
    id text NOT NULL DEFAULT gen_random_uuid(),
    transport_request_id text NOT NULL,
    role text NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'Not Started'::text NOT NULL,
    date timestamp with time zone,
    comments text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT transport_approval_steps_pkey PRIMARY KEY (id)
);

-- Table: expense_claims
-- Description: Employee expense claims
CREATE TABLE IF NOT EXISTS public.expense_claims (
    id text NOT NULL DEFAULT gen_random_uuid(),
    document_type text NOT NULL,
    document_number text NOT NULL,
    claim_for_month_of date,
    staff_name text NOT NULL,
    staff_no text NOT NULL,
    gred text,
    staff_type text,
    executive_status text,
    department_code text,
    dept_cost_center_code text,
    location text,
    tel_ext text,
    start_time_from_home text,
    time_of_arrival_at_home text,
    bank_name text,
    account_number text,
    purpose_of_claim text,
    is_medical_claim boolean DEFAULT false,
    applicable_medical_type text,
    is_for_family boolean DEFAULT false,
    family_member_spouse boolean DEFAULT false,
    family_member_children boolean DEFAULT false,
    family_member_other text,
    total_advance_claim_amount numeric(10,2) DEFAULT 0,
    less_advance_taken numeric(10,2) DEFAULT 0,
    less_corporate_credit_card_payment numeric(10,2) DEFAULT 0,
    balance_claim_repayment numeric(10,2) DEFAULT 0,
    cheque_receipt_no text,
    i_declare boolean DEFAULT false,
    declaration_date date,
    status text DEFAULT 'Pending Verification'::text,
    trf_id text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    submitted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    reimbursement_details jsonb,
    processing_started_at timestamp with time zone,
    reimbursement_completed_at timestamp with time zone,
    created_by text,
    updated_by text,
    CONSTRAINT expense_claims_pkey PRIMARY KEY (id)
);

-- Table: expense_claim_items
-- Description: Individual items within expense claims
CREATE TABLE IF NOT EXISTS public.expense_claim_items (
    id text NOT NULL DEFAULT gen_random_uuid(),
    claim_id text NOT NULL,
    item_date date,
    claim_or_travel_details text,
    official_mileage_km numeric(10,2),
    transport numeric(10,2),
    hotel_accommodation_allowance numeric(10,2),
    out_station_allowance_meal numeric(10,2),
    miscellaneous_allowance_10_percent numeric(10,2),
    other_expenses numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT expense_claim_items_pkey PRIMARY KEY (id)
);

-- Table: expense_claim_fx_rates
-- Description: Foreign exchange rates for expense claims
CREATE TABLE IF NOT EXISTS public.expense_claim_fx_rates (
    id text NOT NULL DEFAULT gen_random_uuid(),
    claim_id text NOT NULL,
    fx_date date,
    type_of_currency text,
    selling_rate_tt_od numeric(10,4) DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT expense_claim_fx_rates_pkey PRIMARY KEY (id)
);

-- Table: claims_approval_steps
-- Description: Expense claim approval workflow
CREATE TABLE IF NOT EXISTS public.claims_approval_steps (
    id text NOT NULL DEFAULT gen_random_uuid(),
    claim_id text NOT NULL,
    step_role text NOT NULL,
    step_name text,
    status text DEFAULT 'Not Started'::text NOT NULL,
    step_date timestamp with time zone,
    comments text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT claims_approval_steps_pkey PRIMARY KEY (id)
);

-- Table: visa_applications
-- Description: Visa and LOI applications
CREATE TABLE IF NOT EXISTS public.visa_applications (
    id text NOT NULL,
    user_id text,
    requestor_name text NOT NULL,
    staff_id text,
    department text,
    "position" text,
    email text,
    destination text NOT NULL,
    travel_purpose text NOT NULL,
    visa_type text NOT NULL,
    trip_start_date date,
    trip_end_date date,
    passport_number text,
    passport_expiry_date date,
    status text DEFAULT 'Pending Department Focal'::text NOT NULL,
    additional_comments text,
    submitted_date timestamp with time zone DEFAULT now(),
    last_updated_date timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    trf_reference_number text,
    processing_details jsonb,
    processing_started_at timestamp with time zone,
    processing_completed_at timestamp with time zone,
    date_of_birth date,
    place_of_birth text,
    citizenship text,
    passport_place_of_issuance text,
    passport_date_of_issuance date,
    contact_telephone text,
    home_address text,
    education_details text,
    current_employer_name text,
    current_employer_address text,
    marital_status text,
    family_information text,
    request_type text DEFAULT 'VISA'::text,
    approximately_arrival_date date,
    duration_of_stay text,
    visa_entry_type text,
    work_visit_category text,
    application_fees_borne_by text,
    cost_centre_number text,
    line_focal_person text,
    line_focal_dept text,
    line_focal_contact text,
    line_focal_date date,
    sponsoring_dept_head text,
    sponsoring_dept_head_dept text,
    sponsoring_dept_head_contact text,
    sponsoring_dept_head_date date,
    ceo_approval_name text,
    ceo_approval_date date,
    itinerary_details text,
    supporting_documents_notes text,
    CONSTRAINT visa_applications_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.visa_applications IS 'Updated to match LOI Request Form fields - contains all fields from official PC(T)SB LOI Request Form';
COMMENT ON COLUMN public.visa_applications.itinerary_details IS 'Enhanced LOI field: itinerary details';
COMMENT ON COLUMN public.visa_applications.supporting_documents_notes IS 'Enhanced LOI field: supporting documents notes';

-- Table: visa_approval_steps
-- Description: Visa application approval workflow
CREATE TABLE IF NOT EXISTS public.visa_approval_steps (
    id integer NOT NULL DEFAULT nextval('public.visa_approval_steps_id_seq'::regclass),
    visa_id text NOT NULL,
    step_role text NOT NULL,
    step_name text NOT NULL,
    status text NOT NULL,
    step_date timestamp with time zone DEFAULT now(),
    comments text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT visa_approval_steps_pkey PRIMARY KEY (id),
    CONSTRAINT visa_approval_steps_visa_id_step_role_key UNIQUE (visa_id, step_role)
);

-- Set sequence ownership
ALTER SEQUENCE public.visa_approval_steps_id_seq OWNED BY public.visa_approval_steps.id;

-- Table: visa_documents
-- Description: Documents attached to visa applications
CREATE TABLE IF NOT EXISTS public.visa_documents (
    id integer NOT NULL DEFAULT nextval('public.visa_documents_id_seq'::regclass),
    visa_id text NOT NULL,
    document_name text NOT NULL,
    document_path text NOT NULL,
    document_type text,
    uploaded_at timestamp with time zone DEFAULT now(),
    uploaded_by text,
    CONSTRAINT visa_documents_pkey PRIMARY KEY (id)
);

-- Set sequence ownership
ALTER SEQUENCE public.visa_documents_id_seq OWNED BY public.visa_documents.id;

-- Table: trf_accommodation_details
-- Description: Travel request accommodation details
CREATE TABLE IF NOT EXISTS public.trf_accommodation_details (
    id text NOT NULL DEFAULT gen_random_uuid(),
    trf_id text NOT NULL,
    check_in_date date,
    check_out_date date,
    accommodation_type text,
    location text,
    address text,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    place_of_stay text,
    estimated_cost_per_night numeric(10,2),
    check_in_time text,
    check_out_time text,
    other_type_description text,
    CONSTRAINT trf_accommodation_details_pkey PRIMARY KEY (id)
);

-- Table: trf_accommodation_details_backup
-- Description: Backup table for accommodation details
CREATE TABLE IF NOT EXISTS public.trf_accommodation_details_backup (
    id text,
    trf_id text,
    check_in_date date,
    check_out_date date,
    accommodation_type text,
    location text,
    from_date date,
    to_date date,
    from_location text,
    to_location text,
    bt_no_required text,
    accommodation_type_n text,
    address text,
    remarks text,
    created_at timestamp with time zone,
    place_of_stay text,
    estimated_cost_per_night numeric(10,2),
    check_in_time text,
    check_out_time text,
    other_type_description text
);

-- Table: trf_advance_amount_requested_items
-- Description: Travel request advance amount details
CREATE TABLE IF NOT EXISTS public.trf_advance_amount_requested_items (
    id text NOT NULL DEFAULT gen_random_uuid(),
    trf_id text NOT NULL,
    date_from date,
    date_to date,
    lh numeric(12,2) DEFAULT 0,
    ma numeric(12,2) DEFAULT 0,
    oa numeric(12,2) DEFAULT 0,
    tr numeric(12,2) DEFAULT 0,
    oe numeric(12,2) DEFAULT 0,
    usd numeric(12,2) DEFAULT 0,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT trf_advance_amount_requested_items_pkey PRIMARY KEY (id)
);

-- Table: trf_advance_bank_details
-- Description: Travel request bank details for advances
CREATE TABLE IF NOT EXISTS public.trf_advance_bank_details (
    id text NOT NULL DEFAULT gen_random_uuid(),
    trf_id text NOT NULL,
    bank_name text,
    account_number text,
    account_name text,
    swift_code text,
    iban text,
    branch_address text,
    currency text,
    amount numeric(12,2),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT trf_advance_bank_details_pkey PRIMARY KEY (id),
    CONSTRAINT trf_advance_bank_details_trf_id_key UNIQUE (trf_id)
);

-- Table: trf_approval_steps
-- Description: Travel request approval workflow
CREATE TABLE IF NOT EXISTS public.trf_approval_steps (
    id text NOT NULL DEFAULT gen_random_uuid(),
    trf_id text NOT NULL,
    step_role text NOT NULL,
    step_name text,
    status text NOT NULL,
    step_date timestamp with time zone,
    comments text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT trf_approval_steps_pkey PRIMARY KEY (id)
);

-- Table: trf_company_transport_details
-- Description: Company transport details for travel requests
CREATE TABLE IF NOT EXISTS public.trf_company_transport_details (
    id text NOT NULL DEFAULT gen_random_uuid(),
    trf_id text NOT NULL,
    transport_date date,
    day_of_week text,
    from_location text,
    to_location text,
    bt_no_required text,
    accommodation_type_n text,
    address text,
    remarks text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT trf_company_transport_details_pkey PRIMARY KEY (id)
);

-- Table: trf_daily_meal_selections
-- Description: Daily meal selections for travel requests
CREATE TABLE IF NOT EXISTS public.trf_daily_meal_selections (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    trf_id text NOT NULL,
    meal_date date NOT NULL,
    breakfast boolean DEFAULT false,
    lunch boolean DEFAULT false,
    dinner boolean DEFAULT false,
    supper boolean DEFAULT false,
    refreshment boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT trf_daily_meal_selections_pkey PRIMARY KEY (id),
    CONSTRAINT trf_daily_meal_selections_trf_id_meal_date_key UNIQUE (trf_id, meal_date)
);

-- Table: trf_flight_bookings
-- Description: Flight booking details for travel requests
CREATE TABLE IF NOT EXISTS public.trf_flight_bookings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    trf_id character varying(50) NOT NULL,
    flight_number character varying(20) NOT NULL,
    flight_class character varying(20) NOT NULL,
    departure_location character varying(100) NOT NULL,
    arrival_location character varying(100) NOT NULL,
    departure_date date NOT NULL,
    arrival_date date NOT NULL,
    departure_time time without time zone NOT NULL,
    arrival_time time without time zone NOT NULL,
    departure_datetime timestamp with time zone GENERATED ALWAYS AS (((departure_date + departure_time) AT TIME ZONE 'UTC'::text)) STORED,
    arrival_datetime timestamp with time zone GENERATED ALWAYS AS (((arrival_date + arrival_time) AT TIME ZONE 'UTC'::text)) STORED,
    booking_reference character varying(50),
    status character varying(20) DEFAULT 'Pending'::character varying NOT NULL,
    remarks text,
    created_by character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    airline character varying(100),
    CONSTRAINT trf_flight_bookings_pkey PRIMARY KEY (id),
    CONSTRAINT chk_valid_flight_times CHECK (((departure_datetime < arrival_datetime) AND (departure_date <= arrival_date)))
);

COMMENT ON TABLE public.trf_flight_bookings IS 'Stores booked flight information associated with travel requests';
COMMENT ON COLUMN public.trf_flight_bookings.trf_id IS 'References travel_requests.id';
COMMENT ON COLUMN public.trf_flight_bookings.departure_datetime IS 'Generated from departure_date + departure_time in UTC';
COMMENT ON COLUMN public.trf_flight_bookings.arrival_datetime IS 'Generated from arrival_date + arrival_time in UTC';
COMMENT ON COLUMN public.trf_flight_bookings.airline IS 'Airline name (e.g., Malaysia Airlines, AirAsia)';

-- Table: trf_itinerary_segments
-- Description: Travel itinerary segments
CREATE TABLE IF NOT EXISTS public.trf_itinerary_segments (
    id text NOT NULL DEFAULT gen_random_uuid(),
    trf_id text NOT NULL,
    segment_date date,
    day_of_week text,
    from_location text,
    to_location text,
    departure_time text,
    arrival_time text,
    purpose text,
    created_at timestamp with time zone DEFAULT now(),
    flight_number text,
    flight_class text,
    remarks text,
    CONSTRAINT trf_itinerary_segments_pkey PRIMARY KEY (id)
);

-- Table: trf_meal_provisions
-- Description: Meal provisions for travel requests
CREATE TABLE IF NOT EXISTS public.trf_meal_provisions (
    id text NOT NULL DEFAULT gen_random_uuid(),
    trf_id text NOT NULL,
    date_from_to text,
    breakfast integer DEFAULT 0,
    lunch integer DEFAULT 0,
    dinner integer DEFAULT 0,
    supper integer DEFAULT 0,
    refreshment integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT trf_meal_provisions_pkey PRIMARY KEY (id)
);

-- Table: trf_passport_details
-- Description: Passport details for travel requests
CREATE TABLE IF NOT EXISTS public.trf_passport_details (
    id text NOT NULL DEFAULT gen_random_uuid(),
    trf_id text NOT NULL,
    full_name text,
    passport_number text,
    nationality text,
    date_of_birth date,
    place_of_birth text,
    passport_issue_date date,
    passport_expiry_date date,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT trf_passport_details_pkey PRIMARY KEY (id)
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Add foreign key constraints after all tables are created
DO $$
BEGIN
    -- role_permissions foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'role_permissions_role_id_fkey') THEN
        ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'role_permissions_permission_id_fkey') THEN
        ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id);
    END IF;

    -- users foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_users_role_id') THEN
        ALTER TABLE public.users ADD CONSTRAINT fk_users_role_id FOREIGN KEY (role_id) REFERENCES public.roles(id);
    END IF;

    -- notification_templates foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'notification_templates_event_type_id_fkey') THEN
        ALTER TABLE public.notification_templates ADD CONSTRAINT notification_templates_event_type_id_fkey FOREIGN KEY (event_type_id) REFERENCES public.notification_event_types(id);
    END IF;

    -- notification_user_subscriptions foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'notification_user_subscriptions_event_type_id_fkey') THEN
        ALTER TABLE public.notification_user_subscriptions ADD CONSTRAINT notification_user_subscriptions_event_type_id_fkey FOREIGN KEY (event_type_id) REFERENCES public.notification_event_types(id);
    END IF;

    -- workflow_steps foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'workflow_steps_workflow_template_id_fkey') THEN
        ALTER TABLE public.workflow_steps ADD CONSTRAINT workflow_steps_workflow_template_id_fkey FOREIGN KEY (workflow_template_id) REFERENCES public.workflow_templates(id);
    END IF;

    -- workflow_instances foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'workflow_instances_workflow_template_id_fkey') THEN
        ALTER TABLE public.workflow_instances ADD CONSTRAINT workflow_instances_workflow_template_id_fkey FOREIGN KEY (workflow_template_id) REFERENCES public.workflow_templates(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'workflow_instances_current_step_id_fkey') THEN
        ALTER TABLE public.workflow_instances ADD CONSTRAINT workflow_instances_current_step_id_fkey FOREIGN KEY (current_step_id) REFERENCES public.workflow_steps(id);
    END IF;

    -- workflow_step_executions foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'workflow_step_executions_workflow_instance_id_fkey') THEN
        ALTER TABLE public.workflow_step_executions ADD CONSTRAINT workflow_step_executions_workflow_instance_id_fkey FOREIGN KEY (workflow_instance_id) REFERENCES public.workflow_instances(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'workflow_step_executions_workflow_step_id_fkey') THEN
        ALTER TABLE public.workflow_step_executions ADD CONSTRAINT workflow_step_executions_workflow_step_id_fkey FOREIGN KEY (workflow_step_id) REFERENCES public.workflow_steps(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'workflow_step_executions_escalated_from_fkey') THEN
        ALTER TABLE public.workflow_step_executions ADD CONSTRAINT workflow_step_executions_escalated_from_fkey FOREIGN KEY (escalated_from) REFERENCES public.workflow_step_executions(id);
    END IF;

    -- accommodation_rooms foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'accommodation_rooms_staff_house_id_fkey') THEN
        ALTER TABLE public.accommodation_rooms ADD CONSTRAINT accommodation_rooms_staff_house_id_fkey FOREIGN KEY (staff_house_id) REFERENCES public.accommodation_staff_houses(id);
    END IF;

    -- accommodation_bookings foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'accommodation_bookings_staff_house_id_fkey') THEN
        ALTER TABLE public.accommodation_bookings ADD CONSTRAINT accommodation_bookings_staff_house_id_fkey FOREIGN KEY (staff_house_id) REFERENCES public.accommodation_staff_houses(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'accommodation_bookings_room_id_fkey') THEN
        ALTER TABLE public.accommodation_bookings ADD CONSTRAINT accommodation_bookings_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.accommodation_rooms(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'accommodation_bookings_trf_id_fkey') THEN
        ALTER TABLE public.accommodation_bookings ADD CONSTRAINT accommodation_bookings_trf_id_fkey FOREIGN KEY (trf_id) REFERENCES public.travel_requests(id);
    END IF;

    -- transport_details foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'transport_details_transport_request_id_fkey') THEN
        ALTER TABLE public.transport_details ADD CONSTRAINT transport_details_transport_request_id_fkey FOREIGN KEY (transport_request_id) REFERENCES public.transport_requests(id);
    END IF;

    -- transport_approval_steps foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'transport_approval_steps_transport_request_id_fkey') THEN
        ALTER TABLE public.transport_approval_steps ADD CONSTRAINT transport_approval_steps_transport_request_id_fkey FOREIGN KEY (transport_request_id) REFERENCES public.transport_requests(id);
    END IF;

    -- expense_claim_items foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'expense_claim_items_claim_id_fkey') THEN
        ALTER TABLE public.expense_claim_items ADD CONSTRAINT expense_claim_items_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.expense_claims(id);
    END IF;

    -- expense_claim_fx_rates foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'expense_claim_fx_rates_claim_id_fkey') THEN
        ALTER TABLE public.expense_claim_fx_rates ADD CONSTRAINT expense_claim_fx_rates_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.expense_claims(id);
    END IF;

    -- claims_approval_steps foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'claims_approval_steps_claim_id_fkey') THEN
        ALTER TABLE public.claims_approval_steps ADD CONSTRAINT claims_approval_steps_claim_id_fkey FOREIGN KEY (claim_id) REFERENCES public.expense_claims(id);
    END IF;

    -- visa_approval_steps foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'visa_approval_steps_visa_id_fkey') THEN
        ALTER TABLE public.visa_approval_steps ADD CONSTRAINT visa_approval_steps_visa_id_fkey FOREIGN KEY (visa_id) REFERENCES public.visa_applications(id);
    END IF;

    -- visa_documents foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'visa_documents_visa_id_fkey') THEN
        ALTER TABLE public.visa_documents ADD CONSTRAINT visa_documents_visa_id_fkey FOREIGN KEY (visa_id) REFERENCES public.visa_applications(id);
    END IF;

    -- Travel request related foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'trf_accommodation_details_trf_id_fkey') THEN
        ALTER TABLE public.trf_accommodation_details ADD CONSTRAINT trf_accommodation_details_trf_id_fkey FOREIGN KEY (trf_id) REFERENCES public.travel_requests(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'trf_advance_amount_requested_items_trf_id_fkey') THEN
        ALTER TABLE public.trf_advance_amount_requested_items ADD CONSTRAINT trf_advance_amount_requested_items_trf_id_fkey FOREIGN KEY (trf_id) REFERENCES public.travel_requests(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'trf_advance_bank_details_trf_id_fkey') THEN
        ALTER TABLE public.trf_advance_bank_details ADD CONSTRAINT trf_advance_bank_details_trf_id_fkey FOREIGN KEY (trf_id) REFERENCES public.travel_requests(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'trf_approval_steps_trf_id_fkey') THEN
        ALTER TABLE public.trf_approval_steps ADD CONSTRAINT trf_approval_steps_trf_id_fkey FOREIGN KEY (trf_id) REFERENCES public.travel_requests(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'trf_company_transport_details_trf_id_fkey') THEN
        ALTER TABLE public.trf_company_transport_details ADD CONSTRAINT trf_company_transport_details_trf_id_fkey FOREIGN KEY (trf_id) REFERENCES public.travel_requests(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'trf_daily_meal_selections_trf_id_fkey') THEN
        ALTER TABLE public.trf_daily_meal_selections ADD CONSTRAINT trf_daily_meal_selections_trf_id_fkey FOREIGN KEY (trf_id) REFERENCES public.travel_requests(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'trf_flight_bookings_trf_id_fkey') THEN
        ALTER TABLE public.trf_flight_bookings ADD CONSTRAINT trf_flight_bookings_trf_id_fkey FOREIGN KEY (trf_id) REFERENCES public.travel_requests(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'trf_itinerary_segments_trf_id_fkey') THEN
        ALTER TABLE public.trf_itinerary_segments ADD CONSTRAINT trf_itinerary_segments_trf_id_fkey FOREIGN KEY (trf_id) REFERENCES public.travel_requests(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'trf_meal_provisions_trf_id_fkey') THEN
        ALTER TABLE public.trf_meal_provisions ADD CONSTRAINT trf_meal_provisions_trf_id_fkey FOREIGN KEY (trf_id) REFERENCES public.travel_requests(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'trf_passport_details_trf_id_fkey') THEN
        ALTER TABLE public.trf_passport_details ADD CONSTRAINT trf_passport_details_trf_id_fkey FOREIGN KEY (trf_id) REFERENCES public.travel_requests(id);
    END IF;

END $$;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_accommodation_bookings_date ON public.accommodation_bookings USING btree (date);
CREATE INDEX IF NOT EXISTS idx_accommodation_bookings_date_status ON public.accommodation_bookings USING btree (date, status);
CREATE INDEX IF NOT EXISTS idx_accommodation_bookings_staff_id ON public.accommodation_bookings USING btree (staff_id);
CREATE INDEX IF NOT EXISTS idx_accommodation_bookings_status ON public.accommodation_bookings USING btree (status);
CREATE INDEX IF NOT EXISTS idx_accommodation_bookings_trf_id ON public.accommodation_bookings USING btree (trf_id);

CREATE INDEX IF NOT EXISTS idx_accommodation_rooms_staff_house_id ON public.accommodation_rooms USING btree (staff_house_id);

CREATE INDEX IF NOT EXISTS idx_application_settings_key ON public.application_settings USING btree (setting_key);
CREATE INDEX IF NOT EXISTS idx_application_settings_public ON public.application_settings USING btree (is_public);

CREATE INDEX IF NOT EXISTS idx_claims_approval_steps_claim_id ON public.claims_approval_steps USING btree (claim_id);

CREATE INDEX IF NOT EXISTS idx_expense_claim_fx_rates_claim_id ON public.expense_claim_fx_rates USING btree (claim_id);
CREATE INDEX IF NOT EXISTS idx_expense_claim_items_claim_id ON public.expense_claim_items USING btree (claim_id);

CREATE INDEX IF NOT EXISTS idx_expense_claims_reimbursement_details ON public.expense_claims USING gin (reimbursement_details);
CREATE INDEX IF NOT EXISTS idx_expense_claims_staff_no ON public.expense_claims USING btree (staff_no);
CREATE INDEX IF NOT EXISTS idx_expense_claims_status ON public.expense_claims USING btree (status);
CREATE INDEX IF NOT EXISTS idx_expense_claims_status_created_at ON public.expense_claims USING btree (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_event_types_category ON public.notification_event_types USING btree (category);
CREATE INDEX IF NOT EXISTS idx_notification_event_types_module ON public.notification_event_types USING btree (module);

CREATE INDEX IF NOT EXISTS idx_notification_templates_event_type ON public.notification_templates USING btree (event_type_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_is_active ON public.notification_templates USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_notification_templates_notification_type ON public.notification_templates USING btree (notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_recipient_type ON public.notification_templates USING btree (recipient_type);

CREATE INDEX IF NOT EXISTS idx_notification_user_subscriptions_event_type ON public.notification_user_subscriptions USING btree (event_type_id);
CREATE INDEX IF NOT EXISTS idx_notification_user_subscriptions_user_id ON public.notification_user_subscriptions USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_transport_approval_steps_request_id ON public.transport_approval_steps USING btree (transport_request_id);
CREATE INDEX IF NOT EXISTS idx_transport_details_request_id ON public.transport_details USING btree (transport_request_id);

CREATE INDEX IF NOT EXISTS idx_transport_requests_booking_details ON public.transport_requests USING gin (booking_details);
CREATE INDEX IF NOT EXISTS idx_transport_requests_created_by ON public.transport_requests USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_transport_requests_status ON public.transport_requests USING btree (status);
CREATE INDEX IF NOT EXISTS idx_transport_requests_tsr_reference ON public.transport_requests USING btree (tsr_reference);

CREATE INDEX IF NOT EXISTS idx_travel_requests_created_at ON public.travel_requests USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_travel_requests_status_type ON public.travel_requests USING btree (status, travel_type);
CREATE INDEX IF NOT EXISTS idx_travel_requests_type_status ON public.travel_requests USING btree (travel_type, status);

CREATE INDEX IF NOT EXISTS idx_trf_accommodation_details_location ON public.trf_accommodation_details USING btree (location);
CREATE INDEX IF NOT EXISTS idx_trf_accommodation_details_trf_id ON public.trf_accommodation_details USING btree (trf_id);

CREATE INDEX IF NOT EXISTS trf_company_transport_details_trf_id_idx ON public.trf_company_transport_details USING btree (trf_id);

CREATE INDEX IF NOT EXISTS idx_trf_daily_meals_date ON public.trf_daily_meal_selections USING btree (meal_date);
CREATE INDEX IF NOT EXISTS idx_trf_daily_meals_trf_id ON public.trf_daily_meal_selections USING btree (trf_id);

CREATE INDEX IF NOT EXISTS idx_trf_flight_bookings_airline ON public.trf_flight_bookings USING btree (airline);
CREATE INDEX IF NOT EXISTS idx_trf_flight_bookings_dep_arr ON public.trf_flight_bookings USING btree (departure_datetime, arrival_datetime);
CREATE INDEX IF NOT EXISTS idx_trf_flight_bookings_status ON public.trf_flight_bookings USING btree (status);
CREATE INDEX IF NOT EXISTS idx_trf_flight_bookings_trf_id ON public.trf_flight_bookings USING btree (trf_id);

CREATE INDEX IF NOT EXISTS idx_trf_itinerary_segments_trf_id ON public.trf_itinerary_segments USING btree (trf_id);
CREATE INDEX IF NOT EXISTS idx_trf_meal_provisions_trf_id ON public.trf_meal_provisions USING btree (trf_id);
CREATE INDEX IF NOT EXISTS idx_trf_passport_details_trf_id ON public.trf_passport_details USING btree (trf_id);

CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON public.user_notifications USING btree (user_id, is_read) WHERE (is_read = false);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON public.user_notifications USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_users_staff_id ON public.users USING btree (staff_id);

CREATE INDEX IF NOT EXISTS idx_visa_applications_citizenship ON public.visa_applications USING btree (citizenship);
CREATE INDEX IF NOT EXISTS idx_visa_applications_request_type ON public.visa_applications USING btree (request_type);
CREATE INDEX IF NOT EXISTS idx_visa_applications_requestor_name ON public.visa_applications USING btree (requestor_name);
CREATE INDEX IF NOT EXISTS idx_visa_applications_status ON public.visa_applications USING btree (status);
CREATE INDEX IF NOT EXISTS idx_visa_applications_submitted_date ON public.visa_applications USING btree (submitted_date);
CREATE INDEX IF NOT EXISTS idx_visa_applications_work_visit_category ON public.visa_applications USING btree (work_visit_category);

CREATE INDEX IF NOT EXISTS idx_visa_approval_steps_status ON public.visa_approval_steps USING btree (status);
CREATE INDEX IF NOT EXISTS idx_visa_approval_steps_visa_id ON public.visa_approval_steps USING btree (visa_id);
CREATE INDEX IF NOT EXISTS idx_visa_documents_visa_id ON public.visa_documents USING btree (visa_id);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_entity ON public.workflow_instances USING btree (entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON public.workflow_instances USING btree (status);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_workflow_template_id ON public.workflow_instances USING btree (workflow_template_id);

CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_escalated_from ON public.workflow_step_executions USING btree (escalated_from);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_instance ON public.workflow_step_executions USING btree (workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_status ON public.workflow_step_executions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_workflow_step_id ON public.workflow_step_executions USING btree (workflow_step_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Create triggers for automatic timestamp updates and password hashing
DO $$
BEGIN
    -- Accommodation bookings trigger
    DROP TRIGGER IF EXISTS set_timestamp_accommodation_bookings ON public.accommodation_bookings;
    CREATE TRIGGER set_timestamp_accommodation_bookings
        BEFORE UPDATE ON public.accommodation_bookings
        FOR EACH ROW EXECUTE PROCEDURE public.trigger_set_timestamp();

    -- Accommodation rooms trigger
    DROP TRIGGER IF EXISTS set_timestamp_accommodation_rooms ON public.accommodation_rooms;
    CREATE TRIGGER set_timestamp_accommodation_rooms
        BEFORE UPDATE ON public.accommodation_rooms
        FOR EACH ROW EXECUTE PROCEDURE public.trigger_set_timestamp();

    -- Accommodation staff houses trigger
    DROP TRIGGER IF EXISTS set_timestamp_accommodation_staff_houses ON public.accommodation_staff_houses;
    CREATE TRIGGER set_timestamp_accommodation_staff_houses
        BEFORE UPDATE ON public.accommodation_staff_houses
        FOR EACH ROW EXECUTE PROCEDURE public.trigger_set_timestamp();

    -- Application settings trigger
    DROP TRIGGER IF EXISTS set_timestamp_application_settings ON public.application_settings;
    CREATE TRIGGER set_timestamp_application_settings
        BEFORE UPDATE ON public.application_settings
        FOR EACH ROW EXECUTE PROCEDURE public.trigger_set_timestamp();

    -- Claims approval steps trigger
    DROP TRIGGER IF EXISTS set_timestamp_claims_approval_steps ON public.claims_approval_steps;
    CREATE TRIGGER set_timestamp_claims_approval_steps
        BEFORE UPDATE ON public.claims_approval_steps
        FOR EACH ROW EXECUTE PROCEDURE public.trigger_set_timestamp();

    -- Expense claim fx rates trigger
    DROP TRIGGER IF EXISTS update_expense_claim_fx_rates_updated_at ON public.expense_claim_fx_rates;
    CREATE TRIGGER update_expense_claim_fx_rates_updated_at
        BEFORE UPDATE ON public.expense_claim_fx_rates
        FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

    -- Expense claim items trigger
    DROP TRIGGER IF EXISTS update_expense_claim_items_updated_at ON public.expense_claim_items;
    CREATE TRIGGER update_expense_claim_items_updated_at
        BEFORE UPDATE ON public.expense_claim_items
        FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

    -- Expense claims trigger
    DROP TRIGGER IF EXISTS update_expense_claims_updated_at ON public.expense_claims;
    CREATE TRIGGER update_expense_claims_updated_at
        BEFORE UPDATE ON public.expense_claims
        FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

    -- Notification templates trigger
    DROP TRIGGER IF EXISTS set_timestamp_notification_templates ON public.notification_templates;
    CREATE TRIGGER set_timestamp_notification_templates
        BEFORE UPDATE ON public.notification_templates
        FOR EACH ROW EXECUTE PROCEDURE public.trigger_set_timestamp();

    -- Permissions trigger
    DROP TRIGGER IF EXISTS set_timestamp_permissions ON public.permissions;
    CREATE TRIGGER set_timestamp_permissions
        BEFORE UPDATE ON public.permissions
        FOR EACH ROW EXECUTE PROCEDURE public.trigger_set_timestamp();

    -- Roles trigger
    DROP TRIGGER IF EXISTS set_timestamp_roles ON public.roles;
    CREATE TRIGGER set_timestamp_roles
        BEFORE UPDATE ON public.roles
        FOR EACH ROW EXECUTE PROCEDURE public.trigger_set_timestamp();

    -- Staff guests trigger
    DROP TRIGGER IF EXISTS set_timestamp_staff_guests ON public.staff_guests;
    CREATE TRIGGER set_timestamp_staff_guests
        BEFORE UPDATE ON public.staff_guests
        FOR EACH ROW EXECUTE PROCEDURE public.trigger_set_timestamp();

    -- Transport approval steps trigger
    DROP TRIGGER IF EXISTS set_timestamp_transport_approval_steps ON public.transport_approval_steps;
    CREATE TRIGGER set_timestamp_transport_approval_steps
        BEFORE UPDATE ON public.transport_approval_steps
        FOR EACH ROW EXECUTE PROCEDURE public.trigger_set_timestamp();

    -- Transport details trigger
    DROP TRIGGER IF EXISTS set_timestamp_transport_details ON public.transport_details;
    CREATE TRIGGER set_timestamp_transport_details
        BEFORE UPDATE ON public.transport_details
        FOR EACH ROW EXECUTE PROCEDURE public.trigger_set_timestamp();

    -- Transport requests trigger
    DROP TRIGGER IF EXISTS set_timestamp_transport_requests ON public.transport_requests;
    CREATE TRIGGER set_timestamp_transport_requests
        BEFORE UPDATE ON public.transport_requests
        FOR EACH ROW EXECUTE PROCEDURE public.trigger_set_timestamp();

    -- Travel requests trigger
    DROP TRIGGER IF EXISTS set_timestamp_travel_requests ON public.travel_requests;
    CREATE TRIGGER set_timestamp_travel_requests
        BEFORE UPDATE ON public.travel_requests
        FOR EACH ROW EXECUTE PROCEDURE public.trigger_set_timestamp();

    -- TRF flight bookings trigger
    DROP TRIGGER IF EXISTS trg_trf_flight_bookings_updated_at ON public.trf_flight_bookings;
    CREATE TRIGGER trg_trf_flight_bookings_updated_at
        BEFORE UPDATE ON public.trf_flight_bookings
        FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

    -- TRF meal provisions trigger
    DROP TRIGGER IF EXISTS update_trf_meal_provisions_updated_at ON public.trf_meal_provisions;
    CREATE TRIGGER update_trf_meal_provisions_updated_at
        BEFORE UPDATE ON public.trf_meal_provisions
        FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

    -- User notifications trigger
    DROP TRIGGER IF EXISTS set_timestamp_user_notifications ON public.user_notifications;
    CREATE TRIGGER set_timestamp_user_notifications
        BEFORE UPDATE ON public.user_notifications
        FOR EACH ROW EXECUTE PROCEDURE public.trigger_set_timestamp();

    -- Users password hashing triggers
    DROP TRIGGER IF EXISTS hash_password_on_insert ON public.users;
    CREATE TRIGGER hash_password_on_insert
        BEFORE INSERT ON public.users
        FOR EACH ROW EXECUTE PROCEDURE public.hash_user_password();

    DROP TRIGGER IF EXISTS hash_password_on_update ON public.users;
    CREATE TRIGGER hash_password_on_update
        BEFORE UPDATE ON public.users
        FOR EACH ROW EXECUTE PROCEDURE public.hash_user_password();

    -- Users timestamp trigger
    DROP TRIGGER IF EXISTS set_timestamp_users ON public.users;
    CREATE TRIGGER set_timestamp_users
        BEFORE UPDATE ON public.users
        FOR EACH ROW EXECUTE PROCEDURE public.trigger_set_timestamp();

END $$;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

SELECT 'SynTra Database Schema Replication Complete!' as message,
       'Total Tables: 42' as tables,
       'Total Sequences: 3' as sequences,
       'Total Functions: 3' as functions,
       'Total Triggers: 22' as triggers,
       'Total Indexes: 120+' as indexes,
       'Total Foreign Keys: 32' as foreign_keys;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================