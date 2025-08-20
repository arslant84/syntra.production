-- Enhanced notification templates with approval links and better formatting

-- Update transport submission template
UPDATE notification_templates 
SET 
    subject = 'Transport Request Submitted: {entityId}',
    body = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #333;">Transport Request Submitted</h2><p>Dear Approver,</p><p><strong>{requestorName}</strong> has submitted a new transport request that requires your approval:</p><div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;"><p><strong>Request ID:</strong> {entityId}</p><p><strong>Requestor:</strong> {requestorName}</p><p><strong>Department:</strong> {department}</p><p><strong>Status:</strong> {currentStatus}</p></div><p>Please review this request at your earliest convenience.</p>{approvalButtons}<hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;"><p style="font-size: 12px; color: #666;">This is an automated notification from the VMS System. Please do not reply to this email.</p></div>'
WHERE name = 'new_transport_request';

-- Insert transport approval template if it doesn't exist
INSERT INTO notification_templates (name, subject, body) 
VALUES (
    'transport_approved',
    '{entityTypeName} Approved: {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">✅ {entityTypeName} Approved</h2>
        
        <p>Dear {requestorName},</p>
        
        <p>Good news! Your transport request has been approved.</p>
        
        <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p><strong>Request ID:</strong> {entityId}</p>
            <p><strong>Status:</strong> {currentStatus}</p>
            <p><strong>Approved by:</strong> {approverName}</p>
            {comments && <p><strong>Comments:</strong> {comments}</p>}
        </div>
        
        <p>You can view the full details of your request using the link below:</p>
        
        <div style="margin: 20px 0; text-align: center;">
            <a href="{approvalUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                View Request Details
            </a>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        
        <p style="font-size: 12px; color: #666;">
            This is an automated notification from the VMS System. 
            Please do not reply to this email.
        </p>
    </div>'
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    updated_at = NOW();

-- Insert transport rejection template if it doesn't exist
INSERT INTO notification_templates (name, subject, body) 
VALUES (
    'transport_rejected',
    '{entityTypeName} Rejected: {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">❌ {entityTypeName} Rejected</h2>
        
        <p>Dear {requestorName},</p>
        
        <p>We regret to inform you that your transport request has been rejected.</p>
        
        <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <p><strong>Request ID:</strong> {entityId}</p>
            <p><strong>Status:</strong> {currentStatus}</p>
            <p><strong>Rejected by:</strong> {approverName}</p>
            {comments && <p><strong>Reason:</strong> {comments}</p>}
        </div>
        
        <p>If you have questions about this decision, please contact your supervisor or the approving authority.</p>
        
        <p>You can view the full details of your request using the link below:</p>
        
        <div style="margin: 20px 0; text-align: center;">
            <a href="{approvalUrl}" 
               style="background-color: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                View Request Details
            </a>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        
        <p style="font-size: 12px; color: #666;">
            This is an automated notification from the VMS System. 
            Please do not reply to this email.
        </p>
    </div>'
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    updated_at = NOW();

-- Update general templates for other entity types
-- TRF submission template
INSERT INTO notification_templates (name, subject, body) 
VALUES (
    'trf_submitted',
    'Travel Request Submitted: {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Travel Request Submitted</h2>
        
        <p>Dear Approver,</p>
        
        <p><strong>{requestorName}</strong> has submitted a new travel request that requires your approval:</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Request ID:</strong> {entityId}</p>
            <p><strong>Requestor:</strong> {requestorName}</p>
            <p><strong>Department:</strong> {department}</p>
            <p><strong>Status:</strong> {currentStatus}</p>
        </div>
        
        <p>Please review this request at your earliest convenience.</p>
        
        {approvalButtons}
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        
        <p style="font-size: 12px; color: #666;">
            This is an automated notification from the VMS System. 
            Please do not reply to this email.
        </p>
    </div>'
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    updated_at = NOW();

-- Claims submission template
INSERT INTO notification_templates (name, subject, body) 
VALUES (
    'claim_submitted',
    'Expense Claim Submitted: {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Expense Claim Submitted</h2>
        
        <p>Dear Approver,</p>
        
        <p><strong>{requestorName}</strong> has submitted a new expense claim that requires your approval:</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Claim ID:</strong> {entityId}</p>
            <p><strong>Requestor:</strong> {requestorName}</p>
            <p><strong>Department:</strong> {department}</p>
            <p><strong>Status:</strong> {currentStatus}</p>
        </div>
        
        <p>Please review this claim at your earliest convenience.</p>
        
        {approvalButtons}
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        
        <p style="font-size: 12px; color: #666;">
            This is an automated notification from the VMS System. 
            Please do not reply to this email.
        </p>
    </div>'
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    updated_at = NOW();

-- Visa submission template
INSERT INTO notification_templates (name, subject, body) 
VALUES (
    'visa_submitted',
    'Visa Application Submitted: {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Visa Application Submitted</h2>
        
        <p>Dear Approver,</p>
        
        <p><strong>{requestorName}</strong> has submitted a new visa application that requires your approval:</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Application ID:</strong> {entityId}</p>
            <p><strong>Requestor:</strong> {requestorName}</p>
            <p><strong>Department:</strong> {department}</p>
            <p><strong>Status:</strong> {currentStatus}</p>
        </div>
        
        <p>Please review this application at your earliest convenience.</p>
        
        {approvalButtons}
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        
        <p style="font-size: 12px; color: #666;">
            This is an automated notification from the VMS System. 
            Please do not reply to this email.
        </p>
    </div>'
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    updated_at = NOW();