-- Add the most critical foreign key indexes (simplified version)
-- This version creates indexes one at a time without CONCURRENTLY to avoid timeout issues

-- 1. Most critical: accommodation bookings (high activity table)
CREATE INDEX IF NOT EXISTS idx_accommodation_bookings_staff_house_id ON accommodation_bookings(staff_house_id);
CREATE INDEX IF NOT EXISTS idx_accommodation_bookings_staff_id ON accommodation_bookings(staff_id);
CREATE INDEX IF NOT EXISTS idx_accommodation_bookings_trf_id ON accommodation_bookings(trf_id);

-- 2. TRF related (travel request forms)
CREATE INDEX IF NOT EXISTS idx_trf_approval_steps_trf_id ON trf_approval_steps(trf_id);
CREATE INDEX IF NOT EXISTS idx_trf_accommodation_details_trf_id ON trf_accommodation_details(trf_id);
CREATE INDEX IF NOT EXISTS idx_trf_itinerary_segments_trf_id ON trf_itinerary_segments(trf_id);

-- 3. User and role related
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_visa_applications_user_id ON visa_applications(user_id);

-- Show created indexes
SELECT 'Index creation completed' as status, count(*) as new_indexes 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname IN (
    'idx_accommodation_bookings_staff_house_id',
    'idx_accommodation_bookings_staff_id', 
    'idx_accommodation_bookings_trf_id',
    'idx_trf_approval_steps_trf_id',
    'idx_trf_accommodation_details_trf_id',
    'idx_trf_itinerary_segments_trf_id',
    'idx_users_role_id',
    'idx_visa_applications_user_id'
);