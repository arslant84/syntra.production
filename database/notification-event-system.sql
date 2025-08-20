-- Enhanced Event-Based Notification System for SynTra
-- This script creates tables and data for managing notifications based on events

-- Create notification_event_types table
CREATE TABLE IF NOT EXISTS notification_event_types (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    category TEXT NOT NULL, -- 'approval', 'status_update', 'system', 'reminder'
    module TEXT NOT NULL, -- 'trf', 'visa', 'claims', 'transport', 'accommodation', 'general'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification_user_subscriptions table for managing who gets what notifications
CREATE TABLE IF NOT EXISTS notification_user_subscriptions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    event_type_id TEXT NOT NULL REFERENCES notification_event_types(id) ON DELETE CASCADE,
    permission_required TEXT, -- Permission needed to receive this notification
    role_required TEXT, -- Role needed to receive this notification
    department_filter TEXT, -- If set, only users in this department get notified
    is_enabled BOOLEAN DEFAULT true,
    notification_method TEXT DEFAULT 'in_app', -- 'email', 'in_app', 'both'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, event_type_id)
);

-- Enhance notification_templates table
ALTER TABLE notification_templates 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS event_type_id TEXT REFERENCES notification_event_types(id),
ADD COLUMN IF NOT EXISTS notification_type TEXT DEFAULT 'email', -- 'email', 'in_app', 'sms'
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS variables_available TEXT[]; -- Array of available template variables

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_event_types_module ON notification_event_types(module);
CREATE INDEX IF NOT EXISTS idx_notification_event_types_category ON notification_event_types(category);
CREATE INDEX IF NOT EXISTS idx_notification_user_subscriptions_user_id ON notification_user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_user_subscriptions_event_type ON notification_user_subscriptions(event_type_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_event_type ON notification_templates(event_type_id);

-- Insert default notification event types
INSERT INTO notification_event_types (name, description, category, module) VALUES 
-- TRF Events
('trf_submitted', 'Travel request submitted', 'approval', 'trf'),
('trf_approved_focal', 'Travel request approved by department focal', 'status_update', 'trf'),
('trf_approved_manager', 'Travel request approved by manager', 'status_update', 'trf'),
('trf_approved_hod', 'Travel request approved by HOD', 'status_update', 'trf'),
('trf_rejected', 'Travel request rejected', 'status_update', 'trf'),
('trf_needs_booking', 'Travel request approved - needs flight booking', 'approval', 'trf'),
('trf_booking_completed', 'Flight booking completed for travel request', 'status_update', 'trf'),

-- Visa Events  
('visa_submitted', 'Visa application submitted', 'approval', 'visa'),
('visa_approved', 'Visa application approved', 'status_update', 'visa'),
('visa_rejected', 'Visa application rejected', 'status_update', 'visa'),
('visa_processing', 'Visa application under processing', 'status_update', 'visa'),
('visa_ready', 'Visa is ready for collection', 'status_update', 'visa'),

-- Claims Events
('claim_submitted', 'Expense claim submitted', 'approval', 'claims'),
('claim_approved_focal', 'Claim approved by department focal', 'status_update', 'claims'),
('claim_approved_manager', 'Claim approved by manager', 'status_update', 'claims'), 
('claim_approved_hod', 'Claim approved by HOD', 'status_update', 'claims'),
('claim_rejected', 'Expense claim rejected', 'status_update', 'claims'),
('claim_paid', 'Expense claim has been paid', 'status_update', 'claims'),

-- Transport Events
('transport_submitted', 'Transport request submitted', 'approval', 'transport'),
('transport_approved', 'Transport request approved', 'status_update', 'transport'),
('transport_rejected', 'Transport request rejected', 'status_update', 'transport'),
('transport_scheduled', 'Transport has been scheduled', 'status_update', 'transport'),

-- Accommodation Events
('accommodation_submitted', 'Accommodation request submitted', 'approval', 'accommodation'),
('accommodation_approved', 'Accommodation request approved', 'status_update', 'accommodation'),
('accommodation_rejected', 'Accommodation request rejected', 'status_update', 'accommodation'),
('accommodation_booked', 'Accommodation has been booked', 'status_update', 'accommodation'),

-- System Events
('system_maintenance', 'System maintenance notification', 'system', 'general'),
('account_created', 'New user account created', 'system', 'general'),
('password_reset', 'Password reset requested', 'system', 'general'),
('deadline_reminder', 'Deadline reminder for pending approvals', 'reminder', 'general')

ON CONFLICT (name) DO NOTHING;

-- Create default notification user subscription rules based on permissions
INSERT INTO notification_user_subscriptions (user_id, event_type_id, permission_required, notification_method)
SELECT 
    'system' as user_id, -- Placeholder, will be replaced by actual user management
    net.id as event_type_id,
    CASE 
        -- Approval events require approval permissions
        WHEN net.name LIKE '%submitted' AND net.module = 'trf' THEN 'approve_trf_focal'
        WHEN net.name LIKE '%submitted' AND net.module = 'visa' THEN 'process_visa_applications'
        WHEN net.name LIKE '%submitted' AND net.module = 'claims' THEN 'approve_claims_focal'
        WHEN net.name LIKE '%submitted' AND net.module = 'transport' THEN 'approve_transport_requests'
        WHEN net.name LIKE '%submitted' AND net.module = 'accommodation' THEN 'approve_accommodation_requests'
        WHEN net.name LIKE '%needs_booking%' THEN 'manage_travel_bookings'
        WHEN net.category = 'system' THEN 'system_admin'
        ELSE NULL
    END as permission_required,
    'both' as notification_method
FROM notification_event_types net
WHERE net.category IN ('approval', 'system')
ON CONFLICT DO NOTHING;

-- Update existing notification templates with event type associations
UPDATE notification_templates 
SET 
    event_type_id = (SELECT id FROM notification_event_types WHERE name = 'transport_submitted'),
    notification_type = 'email',
    variables_available = ARRAY['requestId', 'requestorName', 'date']
WHERE name = 'new_transport_request';

COMMENT ON TABLE notification_event_types IS 'Defines all types of events that can trigger notifications';
COMMENT ON TABLE notification_user_subscriptions IS 'Controls which users receive notifications for which events based on permissions/roles';
COMMENT ON COLUMN notification_user_subscriptions.permission_required IS 'If set, user must have this permission to receive notifications for this event';
COMMENT ON COLUMN notification_user_subscriptions.role_required IS 'If set, user must have this role to receive notifications for this event';
COMMENT ON COLUMN notification_user_subscriptions.department_filter IS 'If set, only users in this department receive notifications';