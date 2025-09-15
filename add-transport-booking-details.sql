-- Add booking_details column to transport_requests table
-- This column will store JSON data for booking details

ALTER TABLE transport_requests 
ADD COLUMN IF NOT EXISTS booking_details JSONB;

-- Add index for booking_details column for better query performance
CREATE INDEX IF NOT EXISTS idx_transport_requests_booking_details ON transport_requests USING GIN (booking_details);

-- Update existing transport requests that are completed but don't have booking details
-- (This is optional - you may want to leave them null for historical records)
-- UPDATE transport_requests 
-- SET booking_details = '{}'::jsonb 
-- WHERE status = 'Completed' AND booking_details IS NULL;