-- Quick database maintenance for high dead tuple tables
-- Focus on the most problematic tables identified in analysis

-- VACUUM the tables with highest dead tuple ratios
VACUUM ANALYZE travel_requests;
VACUUM ANALYZE accommodation_bookings; 
VACUUM ANALYZE trf_approval_steps;
VACUUM ANALYZE transport_requests;
VACUUM ANALYZE expense_claims;
VACUUM ANALYZE trf_meal_provisions;

-- Update all table statistics
ANALYZE;

-- Clean up old read notifications (older than 30 days)
DELETE FROM user_notifications 
WHERE is_read = true 
AND read_at < NOW() - INTERVAL '30 days';

SELECT 'Database maintenance completed' as status;