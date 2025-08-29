-- Apply Notification Templates to Database
-- This script adds the notification templates directly to the database

-- First, ensure notification_templates table has all required columns
ALTER TABLE notification_templates 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS event_type_id TEXT,
ADD COLUMN IF NOT EXISTS notification_type TEXT DEFAULT 'email',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS variables_available TEXT[],
ADD COLUMN IF NOT EXISTS recipient_type TEXT DEFAULT 'approver';

-- Insert TRF submitted approver template
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
  'trf_submitted_approver',
  'New Travel Request Requires Your Approval: {entityId}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">✈️ New Travel Request</h2>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">Approval Required</p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
        <p>Dear <strong>{approverName}</strong>,</p>
        
        <p><strong>{requestorName}</strong> has submitted a new travel request that requires your approval:</p>
        
        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #007bff;">
            <p><strong>Request ID:</strong> {entityId}</p>
            <p><strong>Requestor:</strong> {requestorName}</p>
            <p><strong>Department:</strong> {department}</p>
            <p><strong>Travel Purpose:</strong> {travelPurpose}</p>
            <p><strong>Travel Dates:</strong> {travelDates}</p>
            <p><strong>Status:</strong> {currentStatus}</p>
        </div>
        
        <p>Please review and approve this request at your earliest convenience.</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{approvalUrl}" 
               style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
                ✓ Review Request
            </a>
        </div>
    </div>
    
    <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
        This is an automated notification from the TMS System.<br>
        Please do not reply to this email.
    </div>
</div>',
  'Notification sent to Department Focal when a new TRF is submitted',
  'email',
  'approver',
  ARRAY['entityId', 'requestorName', 'approverName', 'department', 'travelPurpose', 'travelDates', 'currentStatus', 'approvalUrl']
)
ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables_available = EXCLUDED.variables_available,
  updated_at = NOW();

-- Insert TRF submitted requestor template
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
  'trf_submitted_requestor',
  'Travel Request Submitted Successfully: {entityId}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #17a2b8; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">✈️ Travel Request Submitted</h2>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">Awaiting Approval</p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
        <p>Dear <strong>{requestorName}</strong>,</p>
        
        <p>Your travel request has been successfully submitted and is now awaiting approval.</p>
        
        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #17a2b8;">
            <p><strong>Request ID:</strong> {entityId}</p>
            <p><strong>Travel Purpose:</strong> {travelPurpose}</p>
            <p><strong>Travel Dates:</strong> {travelDates}</p>
            <p><strong>Current Status:</strong> {currentStatus}</p>
            <p><strong>Next Approver:</strong> {nextApprover}</p>
        </div>
        
        <p>You will receive email notifications as your request moves through the approval process.</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{viewUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                View Request Status
            </a>
        </div>
    </div>
    
    <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
        This is an automated notification from the TMS System.<br>
        Please do not reply to this email.
    </div>
</div>',
  'Confirmation sent to requestor when TRF is submitted',
  'email',
  'requestor',
  ARRAY['entityId', 'requestorName', 'travelPurpose', 'travelDates', 'currentStatus', 'nextApprover', 'viewUrl']
)
ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables_available = EXCLUDED.variables_available,
  updated_at = NOW();

-- Insert Claims submitted approver template
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
  'claim_submitted_approver',
  'New Expense Claim Requires Your Approval: {entityId}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #fd7e14; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">💳 New Expense Claim</h2>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">Approval Required</p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
        <p>Dear <strong>{approverName}</strong>,</p>
        
        <p><strong>{requestorName}</strong> has submitted a new expense claim that requires your approval:</p>
        
        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #fd7e14;">
            <p><strong>Claim ID:</strong> {entityId}</p>
            <p><strong>Claimant:</strong> {requestorName}</p>
            <p><strong>Department:</strong> {department}</p>
            <p><strong>Claim Purpose:</strong> {claimPurpose}</p>
            <p><strong>Claim Amount:</strong> ${claimAmount}</p>
            <p><strong>Status:</strong> {currentStatus}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{approvalUrl}" 
               style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
                ✓ Review Claim
            </a>
        </div>
    </div>
    
    <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
        This is an automated notification from the TMS System.<br>
        Please do not reply to this email.
    </div>
</div>',
  'Notification sent to Department Focal when a new expense claim is submitted',
  'email',
  'approver',
  ARRAY['entityId', 'requestorName', 'approverName', 'department', 'claimPurpose', 'claimAmount', 'currentStatus', 'approvalUrl']
)
ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables_available = EXCLUDED.variables_available,
  updated_at = NOW();

-- Insert Claims submitted requestor template  
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
  'claim_submitted_requestor',
  'Expense Claim Submitted Successfully: {entityId}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #17a2b8; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">💳 Expense Claim Submitted</h2>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">Awaiting Approval</p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
        <p>Dear <strong>{requestorName}</strong>,</p>
        
        <p>Your expense claim has been successfully submitted and is now awaiting approval.</p>
        
        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #17a2b8;">
            <p><strong>Claim ID:</strong> {entityId}</p>
            <p><strong>Claim Purpose:</strong> {claimPurpose}</p>
            <p><strong>Claim Amount:</strong> ${claimAmount}</p>
            <p><strong>Current Status:</strong> {currentStatus}</p>
            <p><strong>Next Approver:</strong> {nextApprover}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{viewUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                View Claim Status
            </a>
        </div>
    </div>
    
    <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
        This is an automated notification from the TMS System.<br>
        Please do not reply to this email.
    </div>
</div>',
  'Confirmation sent to requestor when expense claim is submitted',
  'email',
  'requestor',
  ARRAY['entityId', 'requestorName', 'claimPurpose', 'claimAmount', 'currentStatus', 'nextApprover', 'viewUrl']
)
ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables_available = EXCLUDED.variables_available,
  updated_at = NOW();

-- Insert TRF fully approved template
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
  'trf_fully_approved_requestor',
  '🎉 Travel Request APPROVED: {entityId}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">🎉 TRAVEL APPROVED!</h2>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">Your request is fully approved</p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
        <p>Dear <strong>{requestorName}</strong>,</p>
        
        <p><strong>Congratulations!</strong> Your travel request has been fully approved by all required authorities. You may now proceed with your travel arrangements.</p>
        
        <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p><strong>Request ID:</strong> {entityId}</p>
            <p><strong>Travel Purpose:</strong> {travelPurpose}</p>
            <p><strong>Travel Dates:</strong> {travelDates}</p>
            <p><strong>Final Status:</strong> ✅ APPROVED</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{viewUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
                View Full Details
            </a>
            <a href="{bookingUrl}" 
               style="background-color: #17a2b8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Book Travel
            </a>
        </div>
    </div>
    
    <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
        This is an automated notification from the TMS System.<br>
        Please do not reply to this email.
    </div>
</div>',
  'Final approval notification sent to requestor when TRF is fully approved',
  'email',
  'requestor',
  ARRAY['entityId', 'requestorName', 'travelPurpose', 'travelDates', 'viewUrl', 'bookingUrl']
)
ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables_available = EXCLUDED.variables_available,
  updated_at = NOW();

-- Insert TRF rejection template
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
  'trf_rejected_requestor',
  'Travel Request Declined: {entityId}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">❌ Request Declined</h2>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">Travel Request</p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
        <p>Dear <strong>{requestorName}</strong>,</p>
        
        <p>We regret to inform you that your travel request has been declined.</p>
        
        <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <p><strong>Request ID:</strong> {entityId}</p>
            <p><strong>Travel Purpose:</strong> {travelPurpose}</p>
            <p><strong>Travel Dates:</strong> {travelDates}</p>
            <p><strong>Declined by:</strong> {approverName}</p>
            <p><strong>Reason:</strong> {rejectionReason}</p>
            <p><strong>Current Status:</strong> ❌ REJECTED</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{viewUrl}" 
               style="background-color: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
                View Details
            </a>
            <a href="{newRequestUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Submit New Request
            </a>
        </div>
    </div>
    
    <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
        This is an automated notification from the TMS System.<br>
        Please do not reply to this email.
    </div>
</div>',
  'Notification sent to requestor when TRF is rejected',
  'email',
  'requestor',
  ARRAY['entityId', 'requestorName', 'travelPurpose', 'travelDates', 'approverName', 'rejectionReason', 'viewUrl', 'newRequestUrl']
)
ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables_available = EXCLUDED.variables_available,
  updated_at = NOW();

-- Insert Claims rejection template
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
  'claim_rejected_requestor',
  'Expense Claim Declined: {entityId}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">❌ Claim Declined</h2>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">Expense Claim</p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
        <p>Dear <strong>{requestorName}</strong>,</p>
        
        <p>We regret to inform you that your expense claim has been declined.</p>
        
        <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <p><strong>Claim ID:</strong> {entityId}</p>
            <p><strong>Claim Purpose:</strong> {claimPurpose}</p>
            <p><strong>Claim Amount:</strong> ${claimAmount}</p>
            <p><strong>Declined by:</strong> {approverName}</p>
            <p><strong>Reason:</strong> {rejectionReason}</p>
            <p><strong>Current Status:</strong> ❌ REJECTED</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{viewUrl}" 
               style="background-color: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
                View Details
            </a>
            <a href="{newRequestUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                Submit New Claim
            </a>
        </div>
    </div>
    
    <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
        This is an automated notification from the TMS System.<br>
        Please do not reply to this email.
    </div>
</div>',
  'Notification sent to requestor when expense claim is rejected',
  'email',
  'requestor',
  ARRAY['entityId', 'requestorName', 'claimPurpose', 'claimAmount', 'approverName', 'rejectionReason', 'viewUrl', 'newRequestUrl']
)
ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables_available = EXCLUDED.variables_available,
  updated_at = NOW();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notification_templates_recipient_type ON notification_templates(recipient_type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_notification_type ON notification_templates(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_is_active ON notification_templates(is_active);

-- Update any templates that don't have recipient_type set
UPDATE notification_templates 
SET recipient_type = 'approver' 
WHERE recipient_type IS NULL AND name LIKE '%_approver';

UPDATE notification_templates 
SET recipient_type = 'requestor' 
WHERE recipient_type IS NULL AND name LIKE '%_requestor';

UPDATE notification_templates 
SET recipient_type = 'approver' 
WHERE recipient_type IS NULL AND name NOT LIKE '%_requestor';

-- Show results
SELECT 
  COUNT(*) as total_templates,
  COUNT(CASE WHEN recipient_type = 'approver' THEN 1 END) as approver_templates,
  COUNT(CASE WHEN recipient_type = 'requestor' THEN 1 END) as requestor_templates
FROM notification_templates 
WHERE is_active = true;