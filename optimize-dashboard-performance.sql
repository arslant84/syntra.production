-- Dashboard Performance Optimization Script
-- This script adds critical indexes to improve dashboard loading performance
-- Run this script on your PostgreSQL database to optimize query performance

-- Add timing to see improvement
\timing on

-- Create indexes for travel_requests table (most frequently accessed)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_travel_requests_dashboard 
ON travel_requests (staff_id, status, updated_at DESC, travel_type) 
WHERE status LIKE 'Pending%' OR status = 'Draft';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_travel_requests_requestor_name 
ON travel_requests USING gin (requestor_name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_travel_requests_user_activity 
ON travel_requests (updated_at DESC, status, travel_type) 
WHERE travel_type != 'Accommodation';

-- Create indexes for visa_applications table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visa_applications_dashboard 
ON visa_applications (staff_id, user_id, status, updated_at DESC) 
WHERE status LIKE 'Pending%' OR status LIKE 'Processing%';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visa_applications_email 
ON visa_applications (email, status, updated_at DESC);

-- Create indexes for expense_claims table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expense_claims') THEN
        -- Create index for expense_claims
        EXECUTE 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expense_claims_dashboard 
                ON expense_claims (staff_no, status, updated_at DESC) 
                WHERE status = ''Draft'' OR status = ''Pending Verification'' OR status LIKE ''Pending%'' OR status IS NULL';
        
        EXECUTE 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expense_claims_staff_name 
                ON expense_claims USING gin (staff_name gin_trgm_ops)';
        
        RAISE NOTICE 'Created indexes for expense_claims table';
    END IF;
END $$;

-- Create indexes for claims table (fallback)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'claims') THEN
        -- Create index for claims table
        EXECUTE 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_claims_dashboard 
                ON claims (staff_no, status, updated_at DESC) 
                WHERE status = ''Draft'' OR status = ''Pending Verification'' OR status LIKE ''Pending%'' OR status IS NULL';
        
        EXECUTE 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_claims_staff_name 
                ON claims USING gin (staff_name gin_trgm_ops)';
        
        RAISE NOTICE 'Created indexes for claims table';
    END IF;
END $$;

-- Create indexes for transport_requests table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transport_requests_dashboard 
ON transport_requests (staff_id, created_by, status, updated_at DESC) 
WHERE status LIKE 'Pending%';

-- Create indexes for accommodation details join
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trf_accommodation_details_trf_id 
ON trf_accommodation_details (trf_id);

-- Create composite index for accommodation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_travel_requests_accommodation 
ON travel_requests (staff_id, status, updated_at DESC) 
WHERE status LIKE 'Pending%' OR status = 'Draft';

-- Add trigram extension if not exists (for faster ILIKE queries)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create functional indexes for case-insensitive text searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_travel_requests_requestor_name_lower 
ON travel_requests (lower(requestor_name), status, updated_at DESC);

-- Analyze tables to update statistics after creating indexes
ANALYZE travel_requests;
ANALYZE visa_applications;
ANALYZE transport_requests;
ANALYZE trf_accommodation_details;

-- Analyze claims tables if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expense_claims') THEN
        EXECUTE 'ANALYZE expense_claims';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'claims') THEN
        EXECUTE 'ANALYZE claims';  
    END IF;
END $$;

-- Show index information
SELECT 
    schemaname,
    tablename, 
    indexname, 
    indexdef
FROM pg_indexes 
WHERE tablename IN ('travel_requests', 'visa_applications', 'expense_claims', 'claims', 'transport_requests', 'trf_accommodation_details')
    AND indexname LIKE '%dashboard%'
ORDER BY tablename, indexname;

-- Show table sizes after optimization
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables 
WHERE tablename IN ('travel_requests', 'visa_applications', 'expense_claims', 'claims', 'transport_requests', 'trf_accommodation_details')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

PRINT 'Dashboard performance optimization completed!';
PRINT 'Indexes created for faster dashboard queries';
PRINT 'Expected performance improvement: 5-10x faster loading';