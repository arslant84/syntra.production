-- Fix notification templates with clean HTML

-- Update transport submission template
UPDATE notification_templates 
SET 
    subject = 'Transport Request Submitted: {entityId}',
    body = '<html><body><div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><h2 style="color: #333; margin-bottom: 20px;">Transport Request Submitted</h2><p>Dear Approver,</p><p><strong>{requestorName}</strong> has submitted a new transport request that requires your approval:</p><div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #dee2e6;"><p style="margin: 5px 0;"><strong>Request ID:</strong> {entityId}</p><p style="margin: 5px 0;"><strong>Requestor:</strong> {requestorName}</p><p style="margin: 5px 0;"><strong>Department:</strong> {department}</p><p style="margin: 5px 0;"><strong>Status:</strong> {currentStatus}</p></div><p>Please review this request at your earliest convenience.</p><div style="margin: 30px 0; text-align: center;"><a href="{approvalUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 0 8px; display: inline-block;">View &amp; Review Request</a><a href="{dashboardUrl}" style="background-color: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 0 8px; display: inline-block;">Go to Dashboard</a></div><hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;"><p style="font-size: 12px; color: #666;">This is an automated notification from the TMS System. Please do not reply to this email.</p></div></body></html>',
    updated_at = NOW()
WHERE name = 'new_transport_request';

-- Insert/Update transport approved template
INSERT INTO notification_templates (name, subject, body) 
VALUES (
    'transport_approved',
    'Transport Request Approved: {entityId}',
    '<html><body><div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><h2 style="color: #28a745; margin-bottom: 20px;">✅ Transport Request Approved</h2><p>Dear {requestorName},</p><p>Good news! Your transport request has been approved.</p><div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #c3e6cb;"><p style="margin: 5px 0;"><strong>Request ID:</strong> {entityId}</p><p style="margin: 5px 0;"><strong>Status:</strong> {currentStatus}</p><p style="margin: 5px 0;"><strong>Approved by:</strong> {approverName}</p><p style="margin: 5px 0;"><strong>Comments:</strong> {comments}</p></div><p>You can view the full details of your request using the link below:</p><div style="margin: 30px 0; text-align: center;"><a href="{approvalUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">View Request Details</a></div><hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;"><p style="font-size: 12px; color: #666;">This is an automated notification from the TMS System. Please do not reply to this email.</p></div></body></html>'
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    updated_at = NOW();

-- Insert/Update transport rejected template
INSERT INTO notification_templates (name, subject, body) 
VALUES (
    'transport_rejected',
    'Transport Request Rejected: {entityId}',
    '<html><body><div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><h2 style="color: #dc3545; margin-bottom: 20px;">❌ Transport Request Rejected</h2><p>Dear {requestorName},</p><p>We regret to inform you that your transport request has been rejected.</p><div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #f1aeb5;"><p style="margin: 5px 0;"><strong>Request ID:</strong> {entityId}</p><p style="margin: 5px 0;"><strong>Status:</strong> {currentStatus}</p><p style="margin: 5px 0;"><strong>Rejected by:</strong> {approverName}</p><p style="margin: 5px 0;"><strong>Reason:</strong> {comments}</p></div><p>If you have questions about this decision, please contact your supervisor or the approving authority.</p><div style="margin: 30px 0; text-align: center;"><a href="{approvalUrl}" style="background-color: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">View Request Details</a></div><hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;"><p style="font-size: 12px; color: #666;">This is an automated notification from the TMS System. Please do not reply to this email.</p></div></body></html>'
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    updated_at = NOW();