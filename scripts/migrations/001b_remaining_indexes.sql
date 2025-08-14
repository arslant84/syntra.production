-- Add remaining critical foreign key indexes

-- More accommodation related
CREATE INDEX IF NOT EXISTS idx_accommodation_bookings_staff_house_id ON accommodation_bookings(staff_house_id);
CREATE INDEX IF NOT EXISTS idx_accommodation_rooms_staff_house_id ON accommodation_rooms(staff_house_id);

-- Remaining TRF related indexes
CREATE INDEX IF NOT EXISTS idx_trf_advance_amount_requested_items_trf_id ON trf_advance_amount_requested_items(trf_id);
CREATE INDEX IF NOT EXISTS idx_trf_flight_bookings_trf_id ON trf_flight_bookings(trf_id);
CREATE INDEX IF NOT EXISTS idx_trf_passport_details_trf_id ON trf_passport_details(trf_id);

-- Visa approval workflow
CREATE INDEX IF NOT EXISTS idx_visa_approval_steps_approver_id ON visa_approval_steps(approver_id);
CREATE INDEX IF NOT EXISTS idx_visa_approval_steps_visa_application_id ON visa_approval_steps(visa_application_id);
CREATE INDEX IF NOT EXISTS idx_visa_documents_visa_application_id ON visa_documents(visa_application_id);

-- Workflow system indexes
CREATE INDEX IF NOT EXISTS idx_workflow_instances_current_step_id ON workflow_instances(current_step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_workflow_template_id ON workflow_instances(workflow_template_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_escalated_from ON workflow_step_executions(escalated_from);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_workflow_step_id ON workflow_step_executions(workflow_step_id);

-- Show final count
SELECT 'All critical indexes completed' as status, count(*) as total_custom_indexes 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%';