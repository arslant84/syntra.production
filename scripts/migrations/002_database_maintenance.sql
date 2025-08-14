-- Database Maintenance Script
-- Cleans up high dead tuple ratios and updates table statistics
-- Expected improvement: 20-30% faster queries, reduced storage bloat

-- Critical tables with high dead tuple ratios identified in analysis
-- travel_requests: 90% dead rows (49 dead vs 5 live)
-- trf_approval_steps: 73% dead rows (48 dead vs 18 live)  
-- accommodation_bookings: 46% dead rows (40 dead vs 47 live)

-- Full vacuum and analyze for heavily bloated tables
VACUUM FULL ANALYZE travel_requests;
VACUUM FULL ANALYZE trf_approval_steps;
VACUUM FULL ANALYZE accommodation_bookings;

-- Regular vacuum analyze for other critical tables
VACUUM ANALYZE expense_claims;
VACUUM ANALYZE expense_claim_items;
VACUUM ANALYZE visa_applications;
VACUUM ANALYZE visa_approval_steps;
VACUUM ANALYZE accommodation_staff_houses;
VACUUM ANALYZE accommodation_rooms;
VACUUM ANALYZE transport_requests;
VACUUM ANALYZE transport_approval_steps;
VACUUM ANALYZE users;
VACUUM ANALYZE roles;
VACUUM ANALYZE user_notifications;
VACUUM ANALYZE claims_approval_steps;

-- Update table statistics for query planner optimization
ANALYZE travel_requests;
ANALYZE expense_claims;
ANALYZE visa_applications;
ANALYZE accommodation_bookings;
ANALYZE transport_requests;
ANALYZE users;

-- Reindex critical tables after cleanup (if running during maintenance window)
-- REINDEX TABLE travel_requests;
-- REINDEX TABLE trf_approval_steps;
-- REINDEX TABLE accommodation_bookings;

-- Optional: Set up auto-vacuum parameters for future maintenance
-- These should be added to postgresql.conf for permanent effect
/*
ALTER TABLE travel_requests SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE accommodation_bookings SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE trf_approval_steps SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);
*/