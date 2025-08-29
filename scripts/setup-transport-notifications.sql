-- Setup Transport Notification Templates
-- Simple script to ensure transport notifications work

-- Ensure notification_templates table has required columns
ALTER TABLE notification_templates 
ADD COLUMN IF NOT EXISTS notification_type TEXT DEFAULT 'email',
ADD COLUMN IF NOT EXISTS recipient_type TEXT DEFAULT 'approver',
ADD COLUMN IF NOT EXISTS variables_available TEXT[];

-- Insert transport submission template
INSERT INTO notification_templates (name, subject, body, notification_type, recipient_type) 
VALUES (
    'transport_submitted_approver',
    'New Transport Request Requires Your Approval: {entityId}',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #20c997; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">🚗 New Transport Request</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Approval Required</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
            <p>Dear Department Focal,</p>
            
            <p><strong>{requestorName}</strong> has submitted a new transport request that requires your approval:</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #20c997;">
                <p><strong>Request ID:</strong> {entityId}</p>
                <p><strong>Requestor:</strong> {requestorName}</p>
                <p><strong>Department:</strong> {department}</p>
                <p><strong>Status:</strong> {currentStatus}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{approvalUrl}" 
                   style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
                    Review & Approve Request
                </a>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #6c757d;">
                Please review this request and take appropriate action. You can access the full details by clicking the link above.
            </p>
        </div>
        
        <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
            This is an automated notification from the TMS System.<br>
            Please do not reply to this email.
        </div>
    </div>',
    'email',
    'approver'
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    notification_type = EXCLUDED.notification_type,
    recipient_type = EXCLUDED.recipient_type;

-- Ensure the approve_transport_requests permission exists
INSERT INTO permissions (name, description) 
VALUES (
    'approve_transport_requests',
    'Can approve transport requests'
)
ON CONFLICT (name) DO NOTHING;

-- Show what we created
SELECT 'Transport notification template created' as status, name, subject 
FROM notification_templates 
WHERE name = 'transport_submitted_approver';