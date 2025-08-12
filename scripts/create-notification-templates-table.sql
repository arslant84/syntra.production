-- Notification Templates Database Schema
-- This script creates the table for managing email notification templates

CREATE TABLE IF NOT EXISTS notification_templates (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS set_timestamp_notification_templates ON notification_templates;

-- Create trigger for notification_templates
CREATE TRIGGER set_timestamp_notification_templates
BEFORE UPDATE ON notification_templates
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
