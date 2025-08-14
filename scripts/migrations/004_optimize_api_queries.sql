-- Migration: Create Optimized Views and Functions for API Performance
-- Priority: MEDIUM
-- Estimated improvement: 50-70% faster dashboard and summary queries
-- Safe to run: Yes

-- Description: This migration creates materialized views and optimized functions
-- to improve API performance, especially for dashboard and summary endpoints.

BEGIN;

-- Log the start of migration
DO $$
BEGIN
    RAISE NOTICE 'Starting migration: API Query Optimization at %', NOW();
END $$;

-- 1. Create a materialized view for dashboard summary statistics
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
    
    -- Accommodation Bookings
    SELECT 
        'Accommodation Bookings' as category,
        CASE 
            WHEN date >= CURRENT_DATE THEN 'Active'
            ELSE 'Past'
        END as status,
        COUNT(*) as count,
        'accommodation' as type
    FROM accommodation_bookings 
    GROUP BY CASE 
            WHEN date >= CURRENT_DATE THEN 'Active'
            ELSE 'Past'
        END
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

-- 2. Create materialized view for recent activities (dashboard)
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

-- 3. Create function for approval queue summary
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

-- 4. Create function for user activity summary
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
            COALESCE((SELECT COUNT(*)::INTEGER FROM visa_applications WHERE user_id = user_id_param), 0)
        ) as total_requests,
        (
            COALESCE((SELECT COUNT(*)::INTEGER FROM travel_requests WHERE staff_id = user_id_param AND status LIKE '%Pending%'), 0) +
            COALESCE((SELECT COUNT(*)::INTEGER FROM transport_requests WHERE created_by = user_id_param AND status LIKE '%Pending%'), 0) +
            COALESCE((SELECT COUNT(*)::INTEGER FROM visa_applications WHERE user_id = user_id_param AND status LIKE '%Pending%'), 0)
        ) as pending_requests,
        (
            COALESCE((SELECT COUNT(*)::INTEGER FROM travel_requests WHERE staff_id = user_id_param AND status = 'Approved'), 0) +
            COALESCE((SELECT COUNT(*)::INTEGER FROM transport_requests WHERE created_by = user_id_param AND status = 'Approved'), 0) +
            COALESCE((SELECT COUNT(*)::INTEGER FROM visa_applications WHERE user_id = user_id_param AND status = 'Approved'), 0)
        ) as approved_requests,
        (
            COALESCE((SELECT COUNT(*)::INTEGER FROM travel_requests WHERE staff_id = user_id_param AND created_at >= NOW() - INTERVAL '7 days'), 0) +
            COALESCE((SELECT COUNT(*)::INTEGER FROM transport_requests WHERE created_by = user_id_param AND created_at >= NOW() - INTERVAL '7 days'), 0) +
            COALESCE((SELECT COUNT(*)::INTEGER FROM visa_applications WHERE user_id = user_id_param AND created_at >= NOW() - INTERVAL '7 days'), 0)
        ) as recent_activity_count;
END;
$$ LANGUAGE plpgsql;

-- 5. Create refresh function for materialized views
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

-- 6. Set up automatic refresh (every 15 minutes) - Optional
-- Note: This requires pg_cron extension to be installed
-- Uncomment the following if pg_cron is available:
/*
SELECT cron.schedule('refresh-dashboard-views', '*/15 * * * *', 'SELECT refresh_dashboard_views();');
*/

-- Initial refresh of materialized views
SELECT refresh_dashboard_views();

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Completed migration: API Query Optimization at %', NOW();
    RAISE NOTICE 'Created materialized views: dashboard_summary_stats, recent_activities_view';
    RAISE NOTICE 'Created functions: get_approval_queue_summary(), get_user_activity_summary(), refresh_dashboard_views()';
    RAISE NOTICE 'API endpoints can now use these optimized views for better performance';
END $$;

COMMIT;