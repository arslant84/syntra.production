-- Application Settings Table
-- This table stores global application configuration settings

CREATE TABLE IF NOT EXISTS application_settings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    setting_type TEXT NOT NULL DEFAULT 'string', -- 'string', 'boolean', 'number', 'json'
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE, -- Whether this setting can be accessed by non-admin users
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trigger for application_settings
CREATE TRIGGER set_timestamp_application_settings
BEFORE UPDATE ON application_settings
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_application_settings_key ON application_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_application_settings_public ON application_settings(is_public);

-- Insert default application settings
INSERT INTO application_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
    ('application_name', 'Synchronised Travel', 'string', 'The name of the application displayed in the UI', true),
    ('maintenance_mode', 'false', 'boolean', 'Enable/disable maintenance mode to prevent user access', false),
    ('default_currency', 'USD', 'string', 'Default currency for financial calculations', true),
    ('max_file_upload_size', '10485760', 'number', 'Maximum file upload size in bytes (10MB)', false),
    ('session_timeout_minutes', '480', 'number', 'User session timeout in minutes (8 hours)', false),
    ('enable_email_notifications', 'true', 'boolean', 'Enable/disable email notifications system-wide', false),
    ('company_logo_url', '/logo.png', 'string', 'URL path to company logo', true),
    ('support_email', 'support@syntra.com', 'string', 'Support contact email address', true),
    ('app_version', '1.0.0', 'string', 'Current application version', true),
    ('timezone', 'UTC', 'string', 'Default application timezone', true)
ON CONFLICT (setting_key) DO NOTHING;