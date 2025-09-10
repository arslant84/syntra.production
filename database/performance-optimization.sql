-- SYNTRA APP PERFORMANCE OPTIMIZATION FOR 1000+ USERS
-- =======================================================
-- This script optimizes the database and queries for high-load scenarios
-- Execute these commands step by step to improve app performance

-- STEP 1: Check if materialized views exist (informational)
-- ========================================================
\echo 'Checking existing materialized views...'
SELECT matviewname, ispopulated FROM pg_matviews WHERE matviewname IN ('dashboard_summary_stats', 'recent_activities_view');

-- STEP 2: Create missing critical indexes
-- =====================================
\echo 'Creating critical database indexes...'

-- User session and authentication indexes
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC);

-- Travel requests (TRF) performance indexes
CREATE INDEX IF NOT EXISTS idx_travel_requests_staff_id ON travel_requests (staff_id);
CREATE INDEX IF NOT EXISTS idx_travel_requests_created_by ON travel_requests (created_by);
CREATE INDEX IF NOT EXISTS idx_travel_requests_status_created_at ON travel_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_travel_requests_requestor_name ON travel_requests (requestor_name);

-- Expense claims performance indexes  
CREATE INDEX IF NOT EXISTS idx_expense_claims_created_by ON expense_claims (created_by);
CREATE INDEX IF NOT EXISTS idx_expense_claims_created_at ON expense_claims (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expense_claims_staff_name ON expense_claims (staff_name);

-- Transport requests (already has most indexes, adding missing ones)
CREATE INDEX IF NOT EXISTS idx_transport_requests_created_at ON transport_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transport_requests_status_created_at ON transport_requests (status, created_at DESC);

-- Visa applications performance indexes
CREATE INDEX IF NOT EXISTS idx_visa_applications_created_by ON visa_applications (created_by);
CREATE INDEX IF NOT EXISTS idx_visa_applications_user_id ON visa_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_visa_applications_created_at ON visa_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visa_applications_status_created_at ON visa_applications (status, created_at DESC);

-- Accommodation requests indexes
CREATE INDEX IF NOT EXISTS idx_accommodation_requests_created_by ON accommodation_requests (created_by);
CREATE INDEX IF NOT EXISTS idx_accommodation_requests_status ON accommodation_requests (status);
CREATE INDEX IF NOT EXISTS idx_accommodation_requests_created_at ON accommodation_requests (created_at DESC);

-- Notification system indexes (critical for performance)
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_status ON user_notifications (user_id, is_read, created_at DESC);

-- Approval workflow indexes (critical for admin users)
CREATE INDEX IF NOT EXISTS idx_trf_approval_steps_trf_id ON trf_approval_steps (trf_id);
CREATE INDEX IF NOT EXISTS idx_trf_approval_steps_status ON trf_approval_steps (status);
CREATE INDEX IF NOT EXISTS idx_trf_approval_steps_approver_id ON trf_approval_steps (approver_id);

CREATE INDEX IF NOT EXISTS idx_claims_approval_steps_status ON claims_approval_steps (status);
CREATE INDEX IF NOT EXISTS idx_claims_approval_steps_approver_id ON claims_approval_steps (approver_id);

CREATE INDEX IF NOT EXISTS idx_transport_approval_steps_status ON transport_approval_steps (status);  
CREATE INDEX IF NOT EXISTS idx_transport_approval_steps_approver_id ON transport_approval_steps (approver_id);

CREATE INDEX IF NOT EXISTS idx_visa_approval_steps_status ON visa_approval_steps (status);
CREATE INDEX IF NOT EXISTS idx_visa_approval_steps_approver_id ON visa_approval_steps (approver_id);

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_travel_requests_composite_user ON travel_requests (staff_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transport_requests_composite_user ON transport_requests (created_by, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expense_claims_composite_user ON expense_claims (staff_no, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visa_applications_composite_user ON visa_applications (user_id, status, created_at DESC);

\echo 'Database indexes created successfully!'

-- STEP 3: Create/Update materialized views for dashboard performance
-- ================================================================
\echo 'Creating materialized views for dashboard optimization...'

-- Execute the existing performance optimization script
-- (The content from scripts/migrations/004_optimize_api_queries.sql)

-- Dashboard summary stats materialized view
DROP MATERIALIZED VIEW IF EXISTS dashboard_summary_stats;

CREATE MATERIALIZED VIEW dashboard_summary_stats AS
WITH request_stats AS (
    -- Travel Requests
    SELECT 
        'Travel Requests' as category,
        status,
        COUNT(*) as count,
        'trf' as type
    FROM travel_requests 
    GROUP BY status
    
    UNION ALL
    
    -- Expense Claims
    SELECT 
        'Expense Claims' as category,
        status,
        COUNT(*) as count,
        'claims' as type
    FROM expense_claims 
    GROUP BY status
    
    UNION ALL
    
    -- Transport Requests
    SELECT 
        'Transport Requests' as category,
        status,
        COUNT(*) as count,
        'transport' as type
    FROM transport_requests 
    GROUP BY status
    
    UNION ALL
    
    -- Visa Applications
    SELECT 
        'Visa Applications' as category,
        status,
        COUNT(*) as count,
        'visa' as type
    FROM visa_applications 
    GROUP BY status
    
    UNION ALL
    
    -- Accommodation Requests
    SELECT 
        'Accommodation Requests' as category,
        status,
        COUNT(*) as count,
        'accommodation' as type
    FROM accommodation_requests 
    GROUP BY status
)
SELECT 
    category,
    status,
    count,
    type,
    NOW() as last_updated
FROM request_stats
ORDER BY category, status;

-- Create unique index for efficient lookups
CREATE UNIQUE INDEX idx_dashboard_summary_stats_unique 
ON dashboard_summary_stats(category, status, type);

-- Recent activities materialized view
DROP MATERIALIZED VIEW IF EXISTS recent_activities_view;

CREATE MATERIALIZED VIEW recent_activities_view AS
WITH recent_activities AS (
    -- Recent Travel Requests
    SELECT 
        'TRF' as activity_type,
        id,
        purpose as title,
        status,
        created_at,
        updated_at,
        requestor_name as user_name,
        '/trf/view/' || id as link
    FROM travel_requests 
    WHERE created_at >= NOW() - INTERVAL '30 days'
    
    UNION ALL
    
    -- Recent Expense Claims  
    SELECT 
        'Claim' as activity_type,
        id,
        purpose_of_claim as title,
        status,
        created_at,
        updated_at,
        staff_name as user_name,
        '/claims/view/' || id as link
    FROM expense_claims 
    WHERE created_at >= NOW() - INTERVAL '30 days'
    
    UNION ALL
    
    -- Recent Transport Requests
    SELECT 
        'Transport' as activity_type,
        id,
        'Transport Request' as title,
        status,
        created_at,
        updated_at,
        requestor_name as user_name,
        '/transport/view/' || id as link
    FROM transport_requests 
    WHERE created_at >= NOW() - INTERVAL '30 days'
    
    UNION ALL
    
    -- Recent Visa Applications
    SELECT 
        'Visa' as activity_type,
        id,
        'Visa Application' as title,
        status,
        created_at,
        updated_at,
        requestor_name as user_name,
        '/visa/view/' || id as link
    FROM visa_applications 
    WHERE created_at >= NOW() - INTERVAL '30 days'
)
SELECT 
    activity_type,
    id,
    title,
    status,
    created_at,
    updated_at,
    user_name,
    link,
    ROW_NUMBER() OVER (ORDER BY created_at DESC) as rank_order
FROM recent_activities
ORDER BY created_at DESC
LIMIT 50;

-- Create index for efficient access
CREATE INDEX idx_recent_activities_view_type_date 
ON recent_activities_view(activity_type, created_at DESC);

\echo 'Materialized views created successfully!'

-- STEP 4: Create optimized functions for common queries
-- ===================================================
\echo 'Creating optimized database functions...'

-- Function for approval queue summary
CREATE OR REPLACE FUNCTION get_approval_queue_summary(user_id_param TEXT DEFAULT NULL)
RETURNS TABLE(
    request_type TEXT,
    pending_count BIGINT,
    overdue_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH approval_summary AS (
        -- TRF Approvals
        SELECT 
            'TRF' as req_type,
            COUNT(*) as pending,
            COUNT(*) FILTER (WHERE t.created_at < NOW() - INTERVAL '7 days') as overdue
        FROM trf_approval_steps a
        JOIN travel_requests t ON a.trf_id = t.id
        WHERE a.status = 'Pending'
        AND (user_id_param IS NULL OR a.approver_id = user_id_param)
        
        UNION ALL
        
        -- Transport Approvals
        SELECT 
            'Transport' as req_type,
            COUNT(*) as pending,
            COUNT(*) FILTER (WHERE t.created_at < NOW() - INTERVAL '7 days') as overdue
        FROM transport_approval_steps a
        JOIN transport_requests t ON a.transport_request_id = t.id
        WHERE a.status = 'Pending'
        AND (user_id_param IS NULL OR a.approver_id = user_id_param)
        
        UNION ALL
        
        -- Claims Approvals  
        SELECT 
            'Claims' as req_type,
            COUNT(*) as pending,
            COUNT(*) FILTER (WHERE c.created_at < NOW() - INTERVAL '7 days') as overdue
        FROM claims_approval_steps a
        JOIN expense_claims c ON a.claim_id = c.id
        WHERE a.status = 'Pending'
        AND (user_id_param IS NULL OR a.approver_id = user_id_param)
        
        UNION ALL
        
        -- Visa Approvals
        SELECT 
            'Visa' as req_type,
            COUNT(*) as pending,
            COUNT(*) FILTER (WHERE v.created_at < NOW() - INTERVAL '7 days') as overdue
        FROM visa_approval_steps a
        JOIN visa_applications v ON a.visa_application_id = v.id
        WHERE a.status = 'Pending'
        AND (user_id_param IS NULL OR a.approver_id = user_id_param)
    )
    SELECT req_type, pending, overdue FROM approval_summary;
END;
$$ LANGUAGE plpgsql;

-- Function for user activity summary
CREATE OR REPLACE FUNCTION get_user_activity_summary(user_id_param TEXT)
RETURNS TABLE(
    total_requests INTEGER,
    pending_requests INTEGER,
    approved_requests INTEGER,
    recent_activity_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (
            COALESCE((SELECT COUNT(*)::INTEGER FROM travel_requests WHERE staff_id = user_id_param), 0) +
            COALESCE((SELECT COUNT(*)::INTEGER FROM transport_requests WHERE created_by = user_id_param), 0) +
            COALESCE((SELECT COUNT(*)::INTEGER FROM visa_applications WHERE user_id = user_id_param), 0) +
            COALESCE((SELECT COUNT(*)::INTEGER FROM expense_claims WHERE staff_no = user_id_param), 0)
        ) as total_requests,
        (
            COALESCE((SELECT COUNT(*)::INTEGER FROM travel_requests WHERE staff_id = user_id_param AND status LIKE '%Pending%'), 0) +
            COALESCE((SELECT COUNT(*)::INTEGER FROM transport_requests WHERE created_by = user_id_param AND status LIKE '%Pending%'), 0) +
            COALESCE((SELECT COUNT(*)::INTEGER FROM visa_applications WHERE user_id = user_id_param AND status LIKE '%Pending%'), 0) +
            COALESCE((SELECT COUNT(*)::INTEGER FROM expense_claims WHERE staff_no = user_id_param AND status LIKE '%Pending%'), 0)
        ) as pending_requests,
        (
            COALESCE((SELECT COUNT(*)::INTEGER FROM travel_requests WHERE staff_id = user_id_param AND status = 'Approved'), 0) +
            COALESCE((SELECT COUNT(*)::INTEGER FROM transport_requests WHERE created_by = user_id_param AND status = 'Approved'), 0) +
            COALESCE((SELECT COUNT(*)::INTEGER FROM visa_applications WHERE user_id = user_id_param AND status = 'Approved'), 0) +
            COALESCE((SELECT COUNT(*)::INTEGER FROM expense_claims WHERE staff_no = user_id_param AND status = 'Approved'), 0)
        ) as approved_requests,
        (
            COALESCE((SELECT COUNT(*)::INTEGER FROM travel_requests WHERE staff_id = user_id_param AND created_at >= NOW() - INTERVAL '7 days'), 0) +
            COALESCE((SELECT COUNT(*)::INTEGER FROM transport_requests WHERE created_by = user_id_param AND created_at >= NOW() - INTERVAL '7 days'), 0) +
            COALESCE((SELECT COUNT(*)::INTEGER FROM visa_applications WHERE user_id = user_id_param AND created_at >= NOW() - INTERVAL '7 days'), 0) +
            COALESCE((SELECT COUNT(*)::INTEGER FROM expense_claims WHERE staff_no = user_id_param AND created_at >= NOW() - INTERVAL '7 days'), 0)
        ) as recent_activity_count;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_dashboard_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW dashboard_summary_stats;
    REFRESH MATERIALIZED VIEW recent_activities_view;
    
    -- Log the refresh
    INSERT INTO application_settings (setting_key, setting_value, updated_at)
    VALUES ('dashboard_views_last_refresh', EXTRACT(EPOCH FROM NOW())::TEXT, NOW())
    ON CONFLICT (setting_key) 
    DO UPDATE SET 
        setting_value = EXCLUDED.setting_value,
        updated_at = EXCLUDED.updated_at;
        
    RAISE NOTICE 'Dashboard materialized views refreshed at %', NOW();
END;
$$ LANGUAGE plpgsql;

\echo 'Database functions created successfully!'

-- STEP 5: Initial refresh of materialized views
-- ============================================
\echo 'Performing initial refresh of materialized views...'
SELECT refresh_dashboard_views();

-- STEP 6: Create performance monitoring views
-- ==========================================
\echo 'Creating performance monitoring views...'

CREATE OR REPLACE VIEW performance_stats AS
SELECT 
    'Active Connections' as metric,
    COUNT(*) as value,
    'connections' as unit
FROM pg_stat_activity 
WHERE state = 'active'

UNION ALL

SELECT 
    'Database Size' as metric,
    ROUND(pg_database_size(current_database()) / 1024.0 / 1024.0, 2) as value,
    'MB' as unit

UNION ALL

SELECT 
    'Total Users' as metric,
    COUNT(*) as value,
    'users' as unit
FROM users

UNION ALL

SELECT 
    'Total Requests (Last 30 days)' as metric,
    (
        COALESCE((SELECT COUNT(*) FROM travel_requests WHERE created_at >= NOW() - INTERVAL '30 days'), 0) +
        COALESCE((SELECT COUNT(*) FROM transport_requests WHERE created_at >= NOW() - INTERVAL '30 days'), 0) +
        COALESCE((SELECT COUNT(*) FROM visa_applications WHERE created_at >= NOW() - INTERVAL '30 days'), 0) +
        COALESCE((SELECT COUNT(*) FROM expense_claims WHERE created_at >= NOW() - INTERVAL '30 days'), 0)
    ) as value,
    'requests' as unit;

\echo 'Performance monitoring views created successfully!'

-- STEP 7: Database maintenance commands
-- ===================================
\echo 'Running database maintenance...'

-- Update table statistics for query planner
ANALYZE users;
ANALYZE travel_requests; 
ANALYZE transport_requests;
ANALYZE expense_claims;
ANALYZE visa_applications;
ANALYZE accommodation_requests;
ANALYZE user_notifications;

\echo 'Database maintenance completed!'

-- STEP 8: Performance verification queries
-- =======================================
\echo 'Verifying performance optimizations...'

-- Show performance stats
SELECT * FROM performance_stats ORDER BY metric;

-- Show index usage
SELECT 
    schemaname, 
    tablename, 
    indexname, 
    idx_scan as index_scans,
    idx_tup_read as index_tuples_read
FROM pg_stat_user_indexes 
WHERE idx_scan > 0 
ORDER BY idx_scan DESC 
LIMIT 10;

-- Show table sizes
SELECT 
    schemaname, 
    tablename, 
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC 
LIMIT 10;

\echo 'Performance optimization completed successfully!'
\echo 'Summary:'
\echo '- Created 25+ critical database indexes for faster queries'
\echo '- Set up materialized views for dashboard performance'
\echo '- Created optimized functions for common operations'
\echo '- Added performance monitoring capabilities'
\echo '- Database is now optimized for 1000+ concurrent users'