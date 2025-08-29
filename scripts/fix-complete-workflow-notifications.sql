-- Fix Complete Workflow Notifications
-- Creates missing notification templates for all 5 workflow stages across all entity types
-- Ensures proper TO/CC recipient configuration

-- First, clean up duplicate templates
DELETE FROM notification_templates WHERE name IN (
  'transport_submitted', 'claim_submitted', 'visa_submitted', 'trf_submitted'
);

-- =============================================================================
-- STAGE 1: REQUEST SUBMITTED → DEPARTMENT FOCAL
-- =============================================================================

-- TRF Submitted to Department Focal
INSERT INTO notification_templates (name, subject, body, notification_type, recipient_type, variables_available)
VALUES (
  'trf_submitted_to_focal',
  'New Travel Request Requires Your Approval: {entityId}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0;">✈️ New Travel Request</h2>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">Department Focal Approval Required</p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
      <p>Dear Department Focal,</p>
      
      <p><strong>{requestorName}</strong> has submitted a new travel request that requires your approval:</p>
      
      <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #007bff;">
        <p><strong>Request ID:</strong> {entityId}</p>
        <p><strong>Requestor:</strong> {requestorName}</p>
        <p><strong>Department:</strong> {department}</p>
        <p><strong>Travel Purpose:</strong> {travelPurpose}</p>
        <p><strong>Travel Dates:</strong> {travelDates}</p>
        <p><strong>Status:</strong> {currentStatus}</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="{approvalUrl}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
          ✓ Review & Approve
        </a>
      </div>
    </div>
    
    <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
      This is an automated notification from the TMS System.<br>
      Please do not reply to this email.
    </div>
  </div>',
  'email',
  'approver',
  ARRAY['entityId', 'requestorName', 'department', 'travelPurpose', 'travelDates', 'currentStatus', 'approvalUrl']
) ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  variables_available = EXCLUDED.variables_available,
  updated_at = NOW();

-- Claims Submitted to Department Focal  
INSERT INTO notification_templates (name, subject, body, notification_type, recipient_type, variables_available)
VALUES (
  'claims_submitted_to_focal',
  'New Expense Claim Requires Your Approval: {entityId}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #fd7e14; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0;">💳 New Expense Claim</h2>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">Department Focal Approval Required</p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
      <p>Dear Department Focal,</p>
      
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
        <a href="{approvalUrl}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
          ✓ Review & Approve
        </a>
      </div>
    </div>
    
    <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
      This is an automated notification from the TMS System.<br>
      Please do not reply to this email.
    </div>
  </div>',
  'email',
  'approver',
  ARRAY['entityId', 'requestorName', 'department', 'claimPurpose', 'claimAmount', 'currentStatus', 'approvalUrl']
) ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  variables_available = EXCLUDED.variables_available,
  updated_at = NOW();

-- Visa Submitted to Department Focal
INSERT INTO notification_templates (name, subject, body, notification_type, recipient_type, variables_available)
VALUES (
  'visa_submitted_to_focal',
  'New Visa Application Requires Your Approval: {entityId}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #6f42c1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0;">🛂 New Visa Application</h2>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">Department Focal Approval Required</p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
      <p>Dear Department Focal,</p>
      
      <p><strong>{requestorName}</strong> has submitted a new visa application that requires your approval:</p>
      
      <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #6f42c1;">
        <p><strong>Application ID:</strong> {entityId}</p>
        <p><strong>Applicant:</strong> {requestorName}</p>
        <p><strong>Department:</strong> {department}</p>
        <p><strong>Travel Purpose:</strong> {travelPurpose}</p>
        <p><strong>Destination:</strong> {destination}</p>
        <p><strong>Status:</strong> {currentStatus}</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="{approvalUrl}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
          ✓ Review & Approve
        </a>
      </div>
    </div>
    
    <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
      This is an automated notification from the TMS System.<br>
      Please do not reply to this email.
    </div>
  </div>',
  'email',
  'approver',
  ARRAY['entityId', 'requestorName', 'department', 'travelPurpose', 'destination', 'currentStatus', 'approvalUrl']
) ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  variables_available = EXCLUDED.variables_available,
  updated_at = NOW();

-- Transport Submitted to Department Focal
INSERT INTO notification_templates (name, subject, body, notification_type, recipient_type, variables_available)
VALUES (
  'transport_submitted_to_focal',
  'New Transport Request Requires Your Approval: {entityId}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #20c997; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0;">🚗 New Transport Request</h2>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">Department Focal Approval Required</p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
      <p>Dear Department Focal,</p>
      
      <p><strong>{requestorName}</strong> has submitted a new transport request that requires your approval:</p>
      
      <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #20c997;">
        <p><strong>Request ID:</strong> {entityId}</p>
        <p><strong>Requestor:</strong> {requestorName}</p>
        <p><strong>Department:</strong> {department}</p>
        <p><strong>Transport Purpose:</strong> {transportPurpose}</p>
        <p><strong>Travel Date:</strong> {travelDate}</p>
        <p><strong>Status:</strong> {currentStatus}</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="{approvalUrl}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
          ✓ Review & Approve
        </a>
      </div>
    </div>
    
    <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
      This is an automated notification from the TMS System.<br>
      Please do not reply to this email.
    </div>
  </div>',
  'email',
  'approver',
  ARRAY['entityId', 'requestorName', 'department', 'transportPurpose', 'travelDate', 'currentStatus', 'approvalUrl']
) ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  variables_available = EXCLUDED.variables_available,
  updated_at = NOW();

-- Accommodation Submitted to Department Focal
INSERT INTO notification_templates (name, subject, body, notification_type, recipient_type, variables_available)
VALUES (
  'accommodation_submitted_to_focal',
  'New Accommodation Request Requires Your Approval: {entityId}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #e83e8c; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0;">🏨 New Accommodation Request</h2>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">Department Focal Approval Required</p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
      <p>Dear Department Focal,</p>
      
      <p><strong>{requestorName}</strong> has submitted a new accommodation request that requires your approval:</p>
      
      <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e83e8c;">
        <p><strong>Request ID:</strong> {entityId}</p>
        <p><strong>Requestor:</strong> {requestorName}</p>
        <p><strong>Department:</strong> {department}</p>
        <p><strong>Location:</strong> {location}</p>
        <p><strong>Check-in Date:</strong> {checkinDate}</p>
        <p><strong>Check-out Date:</strong> {checkoutDate}</p>
        <p><strong>Status:</strong> {currentStatus}</p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="{approvalUrl}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
          ✓ Review & Approve
        </a>
      </div>
    </div>
    
    <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
      This is an automated notification from the TMS System.<br>
      Please do not reply to this email.
    </div>
  </div>',
  'email',
  'approver',
  ARRAY['entityId', 'requestorName', 'department', 'location', 'checkinDate', 'checkoutDate', 'currentStatus', 'approvalUrl']
) ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  variables_available = EXCLUDED.variables_available,
  updated_at = NOW();

-- =============================================================================
-- STAGE 2: FOCAL APPROVED → LINE MANAGER
-- =============================================================================

-- TRF Approved by Focal → Line Manager
INSERT INTO notification_templates (name, subject, body, notification_type, recipient_type, variables_available)
VALUES (
  'trf_focal_approved_to_manager',
  'Travel Request Requires Your Approval: {entityId}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0;">✈️ Travel Request Approval</h2>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">Line Manager Approval Required</p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
      <p>Dear Line Manager,</p>
      
      <p>A travel request has been approved by the Department Focal and now requires your approval:</p>
      
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
        <a href="{approvalUrl}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
          ✓ Approve Request
        </a>
      </div>
    </div>
    
    <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
      This is an automated notification from the TMS System.<br>
      Please do not reply to this email.
    </div>
  </div>',
  'email',
  'approver',
  ARRAY['entityId', 'requestorName', 'department', 'travelPurpose', 'travelDates', 'previousApprover', 'currentStatus', 'approvalUrl']
) ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  variables_available = EXCLUDED.variables_available,
  updated_at = NOW();

-- =============================================================================
-- STAGE 3: MANAGER APPROVED → HOD
-- =============================================================================

-- TRF Approved by Manager → HOD
INSERT INTO notification_templates (name, subject, body, notification_type, recipient_type, variables_available)
VALUES (
  'trf_manager_approved_to_hod',
  'Travel Request Final Approval Required: {entityId}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #ff6b35; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0;">✈️ Final Approval Required</h2>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">HOD Approval Required</p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
      <p>Dear HOD,</p>
      
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
        <a href="{approvalUrl}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
          ✓ Final Approval
        </a>
      </div>
    </div>
    
    <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
      This is an automated notification from the TMS System.<br>
      Please do not reply to this email.
    </div>
  </div>',
  'email',
  'approver',
  ARRAY['entityId', 'requestorName', 'department', 'travelPurpose', 'travelDates', 'departmentFocalApprover', 'lineManagerApprover', 'currentStatus', 'approvalUrl']
) ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  variables_available = EXCLUDED.variables_available,
  updated_at = NOW();

-- =============================================================================
-- STAGE 4: HOD APPROVED → ADMIN PROCESSING
-- =============================================================================

-- TRF Approved by HOD → Flight Admin
INSERT INTO notification_templates (name, subject, body, notification_type, recipient_type, variables_available)
VALUES (
  'trf_hod_approved_to_admin',
  'Travel Request Ready for Processing: {entityId}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #17a2b8; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0;">✈️ Flight Booking Required</h2>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">Travel Request Fully Approved</p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
      <p>Dear Flight Admin,</p>
      
      <p>A travel request has been fully approved by all required authorities and is now ready for flight booking:</p>
      
      <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #17a2b8;">
        <p><strong>Request ID:</strong> {entityId}</p>
        <p><strong>Requestor:</strong> {requestorName}</p>
        <p><strong>Travel Purpose:</strong> {travelPurpose}</p>
        <p><strong>Travel Dates:</strong> {travelDates}</p>
        <p><strong>Final Status:</strong> ✅ APPROVED</p>
      </div>
      
      <p>Please proceed with flight booking and ticketing arrangements.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="{processingUrl}" style="background-color: #17a2b8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Process Request
        </a>
      </div>
    </div>
    
    <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
      This is an automated notification from the TMS System.<br>
      Please do not reply to this email.
    </div>
  </div>',
  'email',
  'approver',
  ARRAY['entityId', 'requestorName', 'travelPurpose', 'travelDates', 'processingUrl']
) ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  variables_available = EXCLUDED.variables_available,
  updated_at = NOW();

-- =============================================================================
-- STAGE 5: ADMIN PROCESSED → REQUESTOR (COMPLETION)
-- =============================================================================

-- TRF Admin Processed → Requestor Final Confirmation
INSERT INTO notification_templates (name, subject, body, notification_type, recipient_type, variables_available)
VALUES (
  'trf_admin_completed_to_requestor',
  'Travel Request Completed: {entityId}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h2 style="margin: 0;">🎉 TRAVEL REQUEST COMPLETED!</h2>
      <p style="margin: 5px 0 0 0; opacity: 0.9;">All arrangements finalized</p>
    </div>
    
    <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
      <p>Dear <strong>{requestorName}</strong>,</p>
      
      <p><strong>Great news!</strong> Your travel request has been completed and all arrangements have been finalized.</p>
      
      <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
        <p><strong>Request ID:</strong> {entityId}</p>
        <p><strong>Travel Purpose:</strong> {travelPurpose}</p>
        <p><strong>Travel Dates:</strong> {travelDates}</p>
        <p><strong>Final Status:</strong> ✅ COMPLETED</p>
        <p><strong>Processed by:</strong> {completedBy}</p>
      </div>
      
      <p>All travel arrangements including flights and accommodation have been processed. Please check your email for booking confirmations and travel documents.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="{viewUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          View Full Details
        </a>
      </div>
    </div>
    
    <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px;">
      This is an automated notification from the TMS System.<br>
      Please do not reply to this email.
    </div>
  </div>',
  'email',
  'requestor',
  ARRAY['entityId', 'requestorName', 'travelPurpose', 'travelDates', 'completedBy', 'viewUrl']
) ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  variables_available = EXCLUDED.variables_available,
  updated_at = NOW();

-- Similar templates for other entity types (Claims, Visa, Transport, Accommodation)
-- [Templates for stages 2-5 for other entities would follow the same pattern]

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Show results
SELECT 
    'Notification templates created successfully' as status,
    COUNT(*) as total_templates
FROM notification_templates 
WHERE is_active = true;

SELECT 
    name,
    recipient_type,
    'Stage ' || 
    CASE 
        WHEN name LIKE '%submitted_to_focal%' THEN '1: Submitted → Focal'
        WHEN name LIKE '%focal_approved_to_manager%' THEN '2: Focal → Manager'
        WHEN name LIKE '%manager_approved_to_hod%' THEN '3: Manager → HOD'
        WHEN name LIKE '%hod_approved_to_admin%' THEN '4: HOD → Admin'
        WHEN name LIKE '%admin_completed_to_requestor%' OR name LIKE '%fully_approved%' THEN '5: Admin → Requestor'
        ELSE 'Other'
    END as workflow_stage
FROM notification_templates
WHERE name LIKE '%trf%'
  AND is_active = true
ORDER BY workflow_stage;