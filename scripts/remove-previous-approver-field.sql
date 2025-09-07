-- Remove previousApprover field from notification templates
-- This field is not required and was causing display issues

-- Update TRF focal approved to manager template
UPDATE notification_templates 
SET 
  body = REPLACE(body, '                <p><strong>Previous Approver:</strong> {previousApprover}</p>' || CHR(10), ''),
  variables_available = ARRAY_REMOVE(variables_available, 'previousApprover')
WHERE name = 'trf_focal_approved_to_manager';

-- Update Visa focal approved to manager template  
UPDATE notification_templates 
SET 
  body = REPLACE(body, '                <p><strong>Previous Approver:</strong> {previousApprover}</p>' || CHR(10), ''),
  variables_available = ARRAY_REMOVE(variables_available, 'previousApprover')
WHERE name = 'visa_focal_approved_to_manager';

-- Update TRF manager approved to HOD template
UPDATE notification_templates 
SET 
  body = REPLACE(body, '        <p><strong>Previous Approver:</strong> {previousApprover}</p>' || CHR(10), ''),
  variables_available = ARRAY_REMOVE(variables_available, 'previousApprover')
WHERE name = 'trf_manager_approved_to_hod';

-- Remove previousApprover from any other templates that might have it
UPDATE notification_templates 
SET 
  body = REGEXP_REPLACE(body, '<p><strong>Previous Approver:</strong> \{previousApprover\}</p>\s*', '', 'g'),
  variables_available = ARRAY_REMOVE(variables_available, 'previousApprover')
WHERE body LIKE '%{previousApprover}%';

-- Display updated templates for verification
SELECT name, subject, 
       CASE 
         WHEN LENGTH(body) > 200 THEN SUBSTRING(body, 1, 200) || '...'
         ELSE body 
       END as body_preview,
       variables_available
FROM notification_templates 
WHERE name IN ('trf_focal_approved_to_manager', 'visa_focal_approved_to_manager', 'trf_manager_approved_to_hod')
ORDER BY name;