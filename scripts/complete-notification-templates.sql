-- Complete Notification Templates for All Workflow Steps
-- This script ensures every workflow step has dedicated notification templates for both approver and requestor

-- First, ensure notification_templates table has all required columns
ALTER TABLE notification_templates 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS event_type_id TEXT,
ADD COLUMN IF NOT EXISTS notification_type TEXT DEFAULT 'email',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS variables_available TEXT[],
ADD COLUMN IF NOT EXISTS recipient_type TEXT DEFAULT 'approver'; -- 'approver', 'requestor', 'both'

-- =============================================================================
-- TSR/TRF NOTIFICATION TEMPLATES
-- =============================================================================

-- TRF SUBMITTED - Notification for Department Focal
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
    'trf_submitted_approver',
    'New Travel Request Requires Your Approval: {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
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
                <a href="{approvalUrl}" 
                   style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    ✗ Decline Request
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

-- TRF SUBMITTED - Confirmation for Requestor
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
    'trf_submitted_requestor',
    'Travel Request Submitted Successfully: {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
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
            
            <p>You will receive email notifications as your request moves through the approval process. You can also check the status anytime by clicking the link below.</p>
            
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

-- TRF APPROVED BY DEPARTMENT FOCAL - Notification for Line Manager
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
    'trf_approved_focal_next_approver',
    'Travel Request Requires Your Approval: {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">✈️ Travel Request Approval</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Your Approval Required</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
            <p>Dear <strong>{approverName}</strong>,</p>
            
            <p>A travel request has been approved by the Department Focal and now requires your approval as Line Manager:</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                <p><strong>Request ID:</strong> {entityId}</p>
                <p><strong>Requestor:</strong> {requestorName}</p>
                <p><strong>Department:</strong> {department}</p>
                <p><strong>Travel Purpose:</strong> {travelPurpose}</p>
                <p><strong>Travel Dates:</strong> {travelDates}</p>
                <p><strong>Previous Approver:</strong> {previousApprover}</p>
                <p><strong>Current Status:</strong> {currentStatus}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{approvalUrl}" 
                   style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
                    ✓ Review & Approve
                </a>
                <a href="{approvalUrl}" 
                   style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    ✗ Decline Request
                </a>
            </div>
        </div>
        
        <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
            This is an automated notification from the TMS System.<br>
            Please do not reply to this email.
        </div>
    </div>',
    'Notification sent to Line Manager when TRF is approved by Department Focal',
    'email',
    'approver',
    ARRAY['entityId', 'requestorName', 'approverName', 'department', 'travelPurpose', 'travelDates', 'previousApprover', 'currentStatus', 'approvalUrl']
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    description = EXCLUDED.description,
    variables_available = EXCLUDED.variables_available,
    updated_at = NOW();

-- TRF APPROVED BY DEPARTMENT FOCAL - Update for Requestor
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
    'trf_approved_focal_requestor',
    'Travel Request Update: Approved by Department Focal - {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">✅ Approval Progress Update</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Your Travel Request</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
            <p>Dear <strong>{requestorName}</strong>,</p>
            
            <p>Good news! Your travel request has been approved by your Department Focal and is moving forward in the approval process.</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                <p><strong>Request ID:</strong> {entityId}</p>
                <p><strong>Travel Purpose:</strong> {travelPurpose}</p>
                <p><strong>Travel Dates:</strong> {travelDates}</p>
                <p><strong>Approved by:</strong> {approverName}</p>
                <p><strong>Current Status:</strong> {currentStatus}</p>
                <p><strong>Next Approver:</strong> {nextApprover}</p>
            </div>
            
            <p>Your request is now waiting for approval from your Line Manager. You will be notified of any further updates.</p>
            
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
    'Update sent to requestor when TRF is approved by Department Focal',
    'email',
    'requestor',
    ARRAY['entityId', 'requestorName', 'travelPurpose', 'travelDates', 'approverName', 'currentStatus', 'nextApprover', 'viewUrl']
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    description = EXCLUDED.description,
    variables_available = EXCLUDED.variables_available,
    updated_at = NOW();

-- TRF APPROVED BY LINE MANAGER - Notification for HOD
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
    'trf_approved_manager_next_approver',
    'Travel Request Final Approval Required: {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #ff6b35; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">✈️ Final Approval Required</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Travel Request</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
            <p>Dear <strong>{approverName}</strong> (HOD),</p>
            
            <p>A travel request has been approved by both the Department Focal and Line Manager, and now requires your final approval:</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ff6b35;">
                <p><strong>Request ID:</strong> {entityId}</p>
                <p><strong>Requestor:</strong> {requestorName}</p>
                <p><strong>Department:</strong> {department}</p>
                <p><strong>Travel Purpose:</strong> {travelPurpose}</p>
                <p><strong>Travel Dates:</strong> {travelDates}</p>
                <p><strong>Approved by Focal:</strong> {departmentFocalApprover}</p>
                <p><strong>Approved by Manager:</strong> {lineManagerApprover}</p>
                <p><strong>Current Status:</strong> {currentStatus}</p>
            </div>
            
            <p><strong>This is the final approval step.</strong> Once approved by you, the requestor will be able to proceed with travel arrangements.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{approvalUrl}" 
                   style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
                    ✓ Final Approval
                </a>
                <a href="{approvalUrl}" 
                   style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    ✗ Decline Request
                </a>
            </div>
        </div>
        
        <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
            This is an automated notification from the TMS System.<br>
            Please do not reply to this email.
        </div>
    </div>',
    'Notification sent to HOD when TRF is approved by Line Manager',
    'email',
    'approver',
    ARRAY['entityId', 'requestorName', 'approverName', 'department', 'travelPurpose', 'travelDates', 'departmentFocalApprover', 'lineManagerApprover', 'currentStatus', 'approvalUrl']
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    description = EXCLUDED.description,
    variables_available = EXCLUDED.variables_available,
    updated_at = NOW();

-- TRF FULLY APPROVED - Final notification to requestor
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
    'trf_fully_approved_requestor',
    '🎉 Travel Request APPROVED: {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
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
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #28a745;">
                <h4 style="color: #28a745; margin-top: 0;">Approval History:</h4>
                <p>✅ <strong>Department Focal:</strong> {departmentFocalApprover}</p>
                <p>✅ <strong>Line Manager:</strong> {lineManagerApprover}</p>
                <p>✅ <strong>HOD:</strong> {hodApprover}</p>
            </div>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <h4 style="color: #856404; margin-top: 0;">Next Steps:</h4>
                <ul style="color: #856404; margin: 0; padding-left: 20px;">
                    <li>Proceed with flight booking if required</li>
                    <li>Arrange accommodation if needed</li>
                    <li>Submit any advance claims if applicable</li>
                    <li>Prepare necessary travel documents</li>
                </ul>
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
    ARRAY['entityId', 'requestorName', 'travelPurpose', 'travelDates', 'departmentFocalApprover', 'lineManagerApprover', 'hodApprover', 'viewUrl', 'bookingUrl']
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    description = EXCLUDED.description,
    variables_available = EXCLUDED.variables_available,
    updated_at = NOW();

-- TRF REJECTED - Notification to requestor
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
    'trf_rejected_requestor',
    'Travel Request Declined: {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
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
            
            <p>If you have questions about this decision or wish to discuss the rejection, please contact your {approverRole} directly.</p>
            
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
    ARRAY['entityId', 'requestorName', 'travelPurpose', 'travelDates', 'approverName', 'approverRole', 'rejectionReason', 'viewUrl', 'newRequestUrl']
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    description = EXCLUDED.description,
    variables_available = EXCLUDED.variables_available,
    updated_at = NOW();

-- =============================================================================
-- VISA APPLICATION NOTIFICATION TEMPLATES
-- =============================================================================

-- VISA SUBMITTED - Notification for Department Focal
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
    'visa_submitted_approver',
    'New Visa Application Requires Your Approval: {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #6f42c1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">🛂 New Visa Application</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Approval Required</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
            <p>Dear <strong>{approverName}</strong>,</p>
            
            <p><strong>{requestorName}</strong> has submitted a new visa application that requires your approval:</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #6f42c1;">
                <p><strong>Application ID:</strong> {entityId}</p>
                <p><strong>Applicant:</strong> {requestorName}</p>
                <p><strong>Employee ID:</strong> {employeeId}</p>
                <p><strong>Department:</strong> {department}</p>
                <p><strong>Travel Purpose:</strong> {travelPurpose}</p>
                <p><strong>Travel Dates:</strong> {travelDates}</p>
                <p><strong>Destination:</strong> {destination}</p>
                <p><strong>Status:</strong> {currentStatus}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{approvalUrl}" 
                   style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
                    ✓ Review Application
                </a>
                <a href="{approvalUrl}" 
                   style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    ✗ Decline Application
                </a>
            </div>
        </div>
        
        <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
            This is an automated notification from the TMS System.<br>
            Please do not reply to this email.
        </div>
    </div>',
    'Notification sent to Department Focal when a new visa application is submitted',
    'email',
    'approver',
    ARRAY['entityId', 'requestorName', 'approverName', 'employeeId', 'department', 'travelPurpose', 'travelDates', 'destination', 'currentStatus', 'approvalUrl']
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    description = EXCLUDED.description,
    variables_available = EXCLUDED.variables_available,
    updated_at = NOW();

-- Continue with more visa templates...
-- VISA APPROVED BY DEPARTMENT FOCAL - Next approver (Line Manager/HOD)
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
    'visa_approved_focal_next_approver',
    'Visa Application Requires Your Approval: {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">🛂 Visa Application Approval</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Your Approval Required</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
            <p>Dear <strong>{approverName}</strong>,</p>
            
            <p>A visa application has been approved by the Department Focal and now requires your approval as Line Manager/HOD:</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                <p><strong>Application ID:</strong> {entityId}</p>
                <p><strong>Applicant:</strong> {requestorName}</p>
                <p><strong>Employee ID:</strong> {employeeId}</p>
                <p><strong>Travel Purpose:</strong> {travelPurpose}</p>
                <p><strong>Travel Dates:</strong> {travelDates}</p>
                <p><strong>Previous Approver:</strong> {previousApprover}</p>
                <p><strong>Current Status:</strong> {currentStatus}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{approvalUrl}" 
                   style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
                    ✓ Review & Approve
                </a>
                <a href="{approvalUrl}" 
                   style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    ✗ Decline Application
                </a>
            </div>
        </div>
        
        <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
            This is an automated notification from the TMS System.<br>
            Please do not reply to this email.
        </div>
    </div>',
    'Notification sent to Line Manager/HOD when visa is approved by Department Focal',
    'email',
    'approver',
    ARRAY['entityId', 'requestorName', 'approverName', 'employeeId', 'travelPurpose', 'travelDates', 'previousApprover', 'currentStatus', 'approvalUrl']
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    description = EXCLUDED.description,
    variables_available = EXCLUDED.variables_available,
    updated_at = NOW();

-- VISA APPROVED BY LINE MANAGER/HOD - Notification for Visa Clerk
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
    'visa_approved_manager_clerk',
    'Visa Application Ready for Processing: {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #17a2b8; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">🛂 Visa Processing Required</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Application Approved - Ready for Processing</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
            <p>Dear Visa Clerk,</p>
            
            <p>A visa application has been fully approved by management and is now ready for processing:</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #17a2b8;">
                <p><strong>Application ID:</strong> {entityId}</p>
                <p><strong>Applicant:</strong> {requestorName}</p>
                <p><strong>Employee ID:</strong> {employeeId}</p>
                <p><strong>Travel Purpose:</strong> {travelPurpose}</p>
                <p><strong>Travel Dates:</strong> {travelDates}</p>
                <p><strong>Destination:</strong> {destination}</p>
                <p><strong>Approved by Focal:</strong> {departmentFocalApprover}</p>
                <p><strong>Approved by Manager:</strong> {managerApprover}</p>
                <p><strong>Current Status:</strong> {currentStatus}</p>
            </div>
            
            <p>Please proceed with the visa application process and embassy submission.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{processingUrl}" 
                   style="background-color: #17a2b8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    Start Processing
                </a>
            </div>
        </div>
        
        <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
            This is an automated notification from the TMS System.<br>
            Please do not reply to this email.
        </div>
    </div>',
    'Notification sent to Visa Clerk when application is approved by Line Manager/HOD',
    'email',
    'approver',
    ARRAY['entityId', 'requestorName', 'employeeId', 'travelPurpose', 'travelDates', 'destination', 'departmentFocalApprover', 'managerApprover', 'currentStatus', 'processingUrl']
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    description = EXCLUDED.description,
    variables_available = EXCLUDED.variables_available,
    updated_at = NOW();

-- =============================================================================
-- CLAIMS NOTIFICATION TEMPLATES
-- =============================================================================

-- CLAIMS SUBMITTED - Notification for Department Focal
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
    'claim_submitted_approver',
    'New Expense Claim Requires Your Approval: {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
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
                <p><strong>Staff ID:</strong> {staffId}</p>
                <p><strong>Department:</strong> {department}</p>
                <p><strong>Claim Purpose:</strong> {claimPurpose}</p>
                <p><strong>Claim Amount:</strong> ${claimAmount}</p>
                <p><strong>Claim Period:</strong> {claimPeriod}</p>
                <p><strong>Status:</strong> {currentStatus}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{approvalUrl}" 
                   style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
                    ✓ Review Claim
                </a>
                <a href="{approvalUrl}" 
                   style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    ✗ Decline Claim
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
    ARRAY['entityId', 'requestorName', 'approverName', 'staffId', 'department', 'claimPurpose', 'claimAmount', 'claimPeriod', 'currentStatus', 'approvalUrl']
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    description = EXCLUDED.description,
    variables_available = EXCLUDED.variables_available,
    updated_at = NOW();

-- =============================================================================
-- TRANSPORT REQUEST NOTIFICATION TEMPLATES
-- =============================================================================

-- TRANSPORT SUBMITTED - Notification for Department Focal
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
    'transport_submitted_approver',
    'New Transport Request Requires Your Approval: {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #20c997; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">🚗 New Transport Request</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Approval Required</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
            <p>Dear <strong>{approverName}</strong>,</p>
            
            <p><strong>{requestorName}</strong> has submitted a new transport request that requires your approval:</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #20c997;">
                <p><strong>Request ID:</strong> {entityId}</p>
                <p><strong>Requestor:</strong> {requestorName}</p>
                <p><strong>Staff ID:</strong> {staffId}</p>
                <p><strong>Department:</strong> {department}</p>
                <p><strong>Transport Purpose:</strong> {transportPurpose}</p>
                <p><strong>Travel Date:</strong> {travelDate}</p>
                <p><strong>Route:</strong> {route}</p>
                <p><strong>Status:</strong> {currentStatus}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{approvalUrl}" 
                   style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
                    ✓ Review Request
                </a>
                <a href="{approvalUrl}" 
                   style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    ✗ Decline Request
                </a>
            </div>
        </div>
        
        <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
            This is an automated notification from the TMS System.<br>
            Please do not reply to this email.
        </div>
    </div>',
    'Notification sent to Department Focal when a new transport request is submitted',
    'email',
    'approver',
    ARRAY['entityId', 'requestorName', 'approverName', 'staffId', 'department', 'transportPurpose', 'travelDate', 'route', 'currentStatus', 'approvalUrl']
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    description = EXCLUDED.description,
    variables_available = EXCLUDED.variables_available,
    updated_at = NOW();

-- =============================================================================
-- ACCOMMODATION REQUEST NOTIFICATION TEMPLATES
-- =============================================================================

-- ACCOMMODATION SUBMITTED - Notification for Department Focal
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
    'accommodation_submitted_approver',
    'New Accommodation Request Requires Your Approval: {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #e83e8c; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">🏨 New Accommodation Request</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Approval Required</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
            <p>Dear <strong>{approverName}</strong>,</p>
            
            <p><strong>{requestorName}</strong> has submitted a new accommodation request that requires your approval:</p>
            
            <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e83e8c;">
                <p><strong>Request ID:</strong> {entityId}</p>
                <p><strong>Requestor:</strong> {requestorName}</p>
                <p><strong>Staff ID:</strong> {staffId}</p>
                <p><strong>Department:</strong> {department}</p>
                <p><strong>Accommodation Purpose:</strong> {accommodationPurpose}</p>
                <p><strong>Check-in Date:</strong> {checkinDate}</p>
                <p><strong>Check-out Date:</strong> {checkoutDate}</p>
                <p><strong>Location:</strong> {location}</p>
                <p><strong>Status:</strong> {currentStatus}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{approvalUrl}" 
                   style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
                    ✓ Review Request
                </a>
                <a href="{approvalUrl}" 
                   style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    ✗ Decline Request
                </a>
            </div>
        </div>
        
        <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
            This is an automated notification from the TMS System.<br>
            Please do not reply to this email.
        </div>
    </div>',
    'Notification sent to Department Focal when a new accommodation request is submitted',
    'email',
    'approver',
    ARRAY['entityId', 'requestorName', 'approverName', 'staffId', 'department', 'accommodationPurpose', 'checkinDate', 'checkoutDate', 'location', 'currentStatus', 'approvalUrl']
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    description = EXCLUDED.description,
    variables_available = EXCLUDED.variables_available,
    updated_at = NOW();

-- =============================================================================
-- REMINDER NOTIFICATION TEMPLATES
-- =============================================================================

-- PENDING APPROVAL REMINDER
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
    'approval_reminder',
    'REMINDER: Pending Approval Required - {entityType} {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #ffc107; color: #212529; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">⏰ APPROVAL REMINDER</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.8;">Pending Your Action</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
            <p>Dear <strong>{approverName}</strong>,</p>
            
            <p>This is a reminder that you have a <strong>{entityType}</strong> request awaiting your approval:</p>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <p><strong>Request Type:</strong> {entityType}</p>
                <p><strong>Request ID:</strong> {entityId}</p>
                <p><strong>Requestor:</strong> {requestorName}</p>
                <p><strong>Department:</strong> {department}</p>
                <p><strong>Submitted:</strong> {submittedDate}</p>
                <p><strong>Days Pending:</strong> {daysPending}</p>
                <p><strong>Current Status:</strong> {currentStatus}</p>
            </div>
            
            <p>Please take action on this request at your earliest convenience.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{approvalUrl}" 
                   style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
                    ✓ Review & Approve
                </a>
                <a href="{approvalUrl}" 
                   style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    ✗ Decline Request
                </a>
            </div>
        </div>
        
        <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
            This is an automated reminder from the TMS System.<br>
            Please do not reply to this email.
        </div>
    </div>',
    'Reminder notification sent to approvers for pending requests',
    'email',
    'approver',
    ARRAY['entityType', 'entityId', 'requestorName', 'approverName', 'department', 'submittedDate', 'daysPending', 'currentStatus', 'approvalUrl']
)
ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    description = EXCLUDED.description,
    variables_available = EXCLUDED.variables_available,
    updated_at = NOW();

-- =============================================================================
-- INDEX AND CLEANUP
-- =============================================================================

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

COMMENT ON TABLE notification_templates IS 'Email notification templates for all workflow steps across all modules';
COMMENT ON COLUMN notification_templates.recipient_type IS 'Who receives this notification: approver, requestor, or both';
COMMENT ON COLUMN notification_templates.variables_available IS 'Array of template variables that can be used in subject/body';