-- Add missing notification template for flights admin when TSR is approved by HOD
-- This template will notify flights admin that they need to book flights for approved TSRs

INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
    'trf_hod_approved_to_admin',
    '✈️ Flight Booking Required - TSR Approved: {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">✈️ FLIGHT BOOKING REQUIRED</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">TSR Approved - Action Required</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
            <p>Dear Flight Admin,</p>
            
            <p><strong>A travel request has been fully approved and requires flight booking.</strong></p>
            
            <div style="background-color: #e7f3ff; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; color: #007bff;">Travel Request Details</h3>
                <p style="margin: 5px 0;"><strong>TRF ID:</strong> {entityId}</p>
                <p style="margin: 5px 0;"><strong>Requestor:</strong> {requestorName}</p>
                <p style="margin: 5px 0;"><strong>Department:</strong> {department}</p>
                <p style="margin: 5px 0;"><strong>Purpose:</strong> {entityTitle}</p>
                <p style="margin: 5px 0;"><strong>Travel Dates:</strong> {entityDates}</p>
            </div>
            
            <p><strong>Action Required:</strong> Please log into the system to process the flight booking for this approved travel request.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{baseUrl}/admin/flights" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View Flight Admin Dashboard</a>
            </div>
            
            <div style="text-align: center; margin: 20px 0;">
                <a href="{baseUrl}/trf/view/{entityId}" style="background-color: #6c757d; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Full TSR Details</a>
            </div>
        </div>
        
        <div style="background-color: #f1f3f4; padding: 15px; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="margin: 0; font-size: 12px; color: #666;">
                This is an automated notification from SynTra TMS. Please do not reply to this email.
                <br>Generated on {currentDate}
            </p>
        </div>
    </div>
    ',
    'Notification to flights admin when TSR is approved by HOD and requires flight booking',
    'email',
    'approver',
    'entityId,requestorName,department,entityTitle,entityDates,baseUrl,currentDate'
) ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    description = EXCLUDED.description,
    notification_type = EXCLUDED.notification_type,
    recipient_type = EXCLUDED.recipient_type,
    variables_available = EXCLUDED.variables_available;

-- Also add a template for requestor CC notification when sent to flights admin
INSERT INTO notification_templates (name, subject, body, description, notification_type, recipient_type, variables_available) 
VALUES (
    'trf_hod_approved_to_admin_requestor_cc',
    '✅ Travel Request Approved - Flight Booking in Progress: {entityId}',
    '
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">✅ TRAVEL REQUEST APPROVED!</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Flight booking is being processed</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
            <p>Dear <strong>{requestorName}</strong>,</p>
            
            <p>Great news! Your travel request has been fully approved and is now being processed for flight booking.</p>
            
            <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; color: #155724;">Your Travel Request Details</h3>
                <p style="margin: 5px 0;"><strong>TRF ID:</strong> {entityId}</p>
                <p style="margin: 5px 0;"><strong>Purpose:</strong> {entityTitle}</p>
                <p style="margin: 5px 0;"><strong>Travel Dates:</strong> {entityDates}</p>
                <p style="margin: 5px 0;"><strong>Status:</strong> Approved - Processing Flights</p>
            </div>
            
            <p><strong>Next Steps:</strong></p>
            <ul style="margin: 10px 0;">
                <li>Our flights team will process your flight booking</li>
                <li>You will receive flight details once booking is confirmed</li>
                <li>Please ensure your travel documents are ready</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{baseUrl}/trf/view/{entityId}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View Your Request</a>
            </div>
        </div>
        
        <div style="background-color: #f1f3f4; padding: 15px; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="margin: 0; font-size: 12px; color: #666;">
                This is an automated notification from SynTra TMS. Please do not reply to this email.
                <br>Generated on {currentDate}
            </p>
        </div>
    </div>
    ',
    'CC notification to requestor when TSR is sent to flights admin for booking',
    'email',
    'requestor',
    'entityId,requestorName,entityTitle,entityDates,baseUrl,currentDate'
) ON CONFLICT (name) DO UPDATE SET
    subject = EXCLUDED.subject,
    body = EXCLUDED.body,
    description = EXCLUDED.description,
    notification_type = EXCLUDED.notification_type,
    recipient_type = EXCLUDED.recipient_type,
    variables_available = EXCLUDED.variables_available;