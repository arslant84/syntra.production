-- Script to update notification templates with proper event types and descriptions
-- Run this script to fix the auto-population issue in the notification template form

-- Update transport templates
UPDATE notification_templates 
SET 
    description = 'Notification sent when transport request is submitted for approval',
    event_type_id = (SELECT id FROM notification_event_types WHERE name = 'transport_submitted' LIMIT 1)
WHERE name = 'transport_submitted' AND event_type_id IS NULL;

UPDATE notification_templates 
SET 
    description = 'Notification sent when transport request is approved',
    event_type_id = (SELECT id FROM notification_event_types WHERE name = 'transport_approved' LIMIT 1)
WHERE name = 'transport_approved' AND event_type_id IS NULL;

UPDATE notification_templates 
SET 
    description = 'Notification sent when transport request is rejected',
    event_type_id = (SELECT id FROM notification_event_types WHERE name = 'transport_rejected' LIMIT 1)
WHERE name = 'transport_rejected' AND event_type_id IS NULL;

-- Update TRF templates
UPDATE notification_templates 
SET 
    description = 'Notification sent when travel request is submitted for approval',
    event_type_id = (SELECT id FROM notification_event_types WHERE name = 'trf_submitted' LIMIT 1)
WHERE name = 'trf_submitted' AND event_type_id IS NULL;

UPDATE notification_templates 
SET 
    description = 'Notification sent when travel request is approved by department focal',
    event_type_id = (SELECT id FROM notification_event_types WHERE name = 'trf_approved_focal' LIMIT 1)
WHERE name = 'trf_approved_focal' AND event_type_id IS NULL;

UPDATE notification_templates 
SET 
    description = 'Notification sent when travel request is approved by manager',
    event_type_id = (SELECT id FROM notification_event_types WHERE name = 'trf_approved_manager' LIMIT 1)
WHERE name = 'trf_approved_manager' AND event_type_id IS NULL;

UPDATE notification_templates 
SET 
    description = 'Notification sent when travel request is approved by HOD',
    event_type_id = (SELECT id FROM notification_event_types WHERE name = 'trf_approved_hod' LIMIT 1)
WHERE name = 'trf_approved_hod' AND event_type_id IS NULL;

UPDATE notification_templates 
SET 
    description = 'Notification sent when travel request is rejected',
    event_type_id = (SELECT id FROM notification_event_types WHERE name = 'trf_rejected' LIMIT 1)
WHERE name = 'trf_rejected' AND event_type_id IS NULL;

-- Update Claims templates
UPDATE notification_templates 
SET 
    description = 'Notification sent when expense claim is submitted for approval',
    event_type_id = (SELECT id FROM notification_event_types WHERE name = 'claim_submitted' LIMIT 1)
WHERE name = 'claim_submitted_approver' AND event_type_id IS NULL;

UPDATE notification_templates 
SET 
    description = 'Notification sent to requestor when expense claim is submitted',
    event_type_id = (SELECT id FROM notification_event_types WHERE name = 'claim_submitted' LIMIT 1)
WHERE name = 'claim_submitted_requestor' AND event_type_id IS NULL;

UPDATE notification_templates 
SET 
    description = 'Notification sent when expense claim is approved',
    event_type_id = (SELECT id FROM notification_event_types WHERE name = 'claim_approved' LIMIT 1)
WHERE name = 'claim_approved' AND event_type_id IS NULL;

UPDATE notification_templates 
SET 
    description = 'Notification sent when expense claim is rejected',
    event_type_id = (SELECT id FROM notification_event_types WHERE name = 'claim_rejected' LIMIT 1)
WHERE name = 'claim_rejected' AND event_type_id IS NULL;

-- Update Visa templates
UPDATE notification_templates 
SET 
    description = 'Notification sent when visa application is submitted',
    event_type_id = (SELECT id FROM notification_event_types WHERE name = 'visa_submitted' LIMIT 1)
WHERE name = 'visa_submitted' AND event_type_id IS NULL;

UPDATE notification_templates 
SET 
    description = 'Notification sent when visa application is approved',
    event_type_id = (SELECT id FROM notification_event_types WHERE name = 'visa_approved' LIMIT 1)
WHERE name = 'visa_approved' AND event_type_id IS NULL;

UPDATE notification_templates 
SET 
    description = 'Notification sent when visa application is rejected',
    event_type_id = (SELECT id FROM notification_event_types WHERE name = 'visa_rejected' LIMIT 1)
WHERE name = 'visa_rejected' AND event_type_id IS NULL;

-- Update Accommodation templates
UPDATE notification_templates 
SET 
    description = 'Notification sent when accommodation request is submitted',
    event_type_id = (SELECT id FROM notification_event_types WHERE name = 'accommodation_submitted' LIMIT 1)
WHERE name = 'accommodation_submitted' AND event_type_id IS NULL;

UPDATE notification_templates 
SET 
    description = 'Notification sent when accommodation is assigned',
    event_type_id = (SELECT id FROM notification_event_types WHERE name = 'accommodation_assigned' LIMIT 1)
WHERE name = 'accommodation_assigned' AND event_type_id IS NULL;

UPDATE notification_templates 
SET 
    description = 'Notification sent when accommodation request is cancelled',
    event_type_id = (SELECT id FROM notification_event_types WHERE name = 'accommodation_cancelled' LIMIT 1)
WHERE name = 'accommodation_cancelled' AND event_type_id IS NULL;

-- Display results
SELECT name, description, event_type_id, 
       (SELECT name FROM notification_event_types WHERE id = notification_templates.event_type_id) as event_name
FROM notification_templates 
WHERE description IS NOT NULL
ORDER BY name;