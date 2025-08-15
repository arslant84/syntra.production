# Database Optimization Execution Guide

## 🚀 Quick Start

This guide provides step-by-step instructions for implementing the database optimizations identified in the comprehensive analysis.

## ⚠️ Prerequisites

1. **Database backup**: Create a full backup before running any migrations
2. **Maintenance window**: Schedule during low-traffic periods
3. **Monitor resources**: Ensure sufficient disk space and CPU capacity
4. **Test environment**: Run on staging first if available

## 📋 Execution Checklist

### Phase 1: Critical Performance Fixes (Run Immediately)

**Estimated Time**: 15-30 minutes
**Risk Level**: Low
**Impact**: High (60-80% performance improvement)

```bash
# 1. Create database backup
pg_dump syntra > syntra_backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Run critical index migration
psql -d syntra -f scripts/migrations/001_add_missing_foreign_key_indexes.sql

# 3. Verify indexes were created
psql -d syntra -c "\di+ idx_accommodation_bookings_staff_house_id"
```

**Success Criteria**: All indexes created without errors, query performance improves immediately

### Phase 2: Composite Indexes (Next Day)

**Estimated Time**: 10-20 minutes
**Risk Level**: Low
**Impact**: Medium (40-60% improvement for filtered queries)

```bash
# Run composite index migration
psql -d syntra -f scripts/migrations/002_add_composite_indexes.sql

# Test query performance
psql -d syntra -c "EXPLAIN ANALYZE SELECT * FROM travel_requests WHERE status = 'Pending' ORDER BY created_at DESC LIMIT 10;"
```

### Phase 3: Database Maintenance (Weekend)

**Estimated Time**: 30-60 minutes
**Risk Level**: Medium (resource intensive)
**Impact**: Medium (20-30% space reduction, improved stability)

```bash
# Run during low-traffic period
psql -d syntra -f scripts/migrations/003_database_maintenance.sql

# Monitor progress with:
# SELECT * FROM pg_stat_activity WHERE query LIKE '%VACUUM%';
```

### Phase 4: API Optimization Views (Following Week)

**Estimated Time**: 10-15 minutes
**Risk Level**: Low
**Impact**: High (50-70% dashboard performance improvement)

```bash
# Create optimized views and functions
psql -d syntra -f scripts/migrations/004_optimize_api_queries.sql

# Test dashboard performance
curl -X GET "http://localhost:3000/api/dashboard/summary"
```

## 🔧 Manual Verification Steps

### 1. Verify Index Creation
```sql
-- Check all new indexes exist
SELECT 
    schemaname, 
    tablename, 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE indexname LIKE 'idx_%' 
    AND schemaname = 'public'
ORDER BY tablename;
```

### 2. Check Query Performance
```sql
-- Test a complex join that should be faster
EXPLAIN (ANALYZE, BUFFERS) 
SELECT 
    t.id,
    t.purpose,
    t.status,
    a.accommodation_type
FROM travel_requests t
LEFT JOIN trf_accommodation_details a ON t.id = a.trf_id
WHERE t.status = 'Pending'
ORDER BY t.created_at DESC
LIMIT 10;
```

### 3. Verify Materialized Views
```sql
-- Check view data
SELECT * FROM dashboard_summary_stats LIMIT 5;
SELECT * FROM recent_activities_view LIMIT 5;
```

## 📊 Performance Monitoring

### Before Migration Baseline
```sql
-- Record baseline metrics
SELECT 
    relname as table_name,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    pg_size_pretty(pg_total_relation_size(relname)) as size
FROM pg_stat_user_tables 
WHERE n_live_tup > 0
ORDER BY pg_total_relation_size(relname) DESC;
```

### After Migration Verification
```sql
-- Compare metrics after optimization
SELECT 
    relname as table_name,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    pg_size_pretty(pg_total_relation_size(relname)) as size,
    CASE 
        WHEN n_live_tup > 0 THEN round((n_dead_tup::numeric / n_live_tup::numeric) * 100, 2)
        ELSE 0
    END as dead_tuple_percentage
FROM pg_stat_user_tables 
WHERE n_live_tup > 0
ORDER BY dead_tuple_percentage DESC;
```

## 🚨 Rollback Procedures

### If Index Creation Fails
```sql
-- Drop problematic index
DROP INDEX CONCURRENTLY IF EXISTS idx_problematic_index_name;

-- Check for invalid indexes
SELECT * FROM pg_indexes WHERE indexdef LIKE '%INVALID%';
```

### If Materialized Views Cause Issues
```sql
-- Drop materialized views
DROP MATERIALIZED VIEW IF EXISTS dashboard_summary_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS recent_activities_view CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS get_approval_queue_summary(TEXT);
DROP FUNCTION IF EXISTS get_user_activity_summary(TEXT);
DROP FUNCTION IF EXISTS refresh_dashboard_views();
```

### Full Rollback from Backup
```bash
# If major issues occur, restore from backup
dropdb syntra_backup_restore
createdb syntra_backup_restore
psql -d syntra_backup_restore < syntra_backup_YYYYMMDD_HHMMSS.sql
```

## 📈 Expected Results

### Performance Improvements
- **Dashboard load time**: 50-70% faster
- **Search queries**: 40-60% faster  
- **JOIN operations**: 60-80% faster
- **Database size**: 20-30% reduction after maintenance

### API Response Times
- `/api/dashboard/summary`: 200ms → 60ms
- `/api/dashboard/activities`: 800ms → 250ms
- `/api/trf` (with filters): 400ms → 150ms

## 🔄 Ongoing Maintenance

### Daily Tasks (Automated)
```sql
-- Refresh materialized views (add to cron)
SELECT refresh_dashboard_views();
```

### Weekly Tasks
```sql
-- Update table statistics
ANALYZE;

-- Check for index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE idx_tup_read = 0 
ORDER BY schemaname, tablename;
```

### Monthly Tasks
```sql
-- Check table bloat
SELECT 
    relname,
    n_dead_tup,
    n_live_tup,
    CASE 
        WHEN n_live_tup > 0 THEN round((n_dead_tup::numeric / n_live_tup::numeric) * 100, 2)
        ELSE 0
    END as bloat_percentage
FROM pg_stat_user_tables 
WHERE n_dead_tup > 100
ORDER BY bloat_percentage DESC;
```

## 🆘 Troubleshooting

### Common Issues

1. **"Index already exists" error**
   - Solution: The migration scripts use `IF NOT EXISTS`, this is normal

2. **"Cannot create index concurrently in transaction block"**
   - Solution: Run index creation outside of transaction or remove CONCURRENTLY

3. **High CPU during VACUUM**
   - Solution: Normal behavior, monitor and consider reducing concurrent operations

4. **Materialized view refresh taking too long**
   - Solution: Reduce data range or refresh during off-peak hours

### Contact for Support
- Check PostgreSQL logs: `/var/log/postgresql/`
- Monitor with: `SELECT * FROM pg_stat_activity;`
- Review migration logs in the database output

## ✅ Success Validation

Run this final validation script to confirm all optimizations are working:

```sql
-- Comprehensive validation query
WITH optimization_check AS (
    SELECT 
        'Indexes Created' as check_type,
        COUNT(*) as count
    FROM pg_indexes 
    WHERE indexname LIKE 'idx_%' AND schemaname = 'public'
    
    UNION ALL
    
    SELECT 
        'Materialized Views',
        COUNT(*)
    FROM pg_matviews 
    WHERE schemaname = 'public'
    
    UNION ALL
    
    SELECT 
        'Custom Functions',
        COUNT(*)
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname IN ('get_approval_queue_summary', 'get_user_activity_summary', 'refresh_dashboard_views')
)
SELECT 
    check_type,
    count,
    CASE 
        WHEN check_type = 'Indexes Created' AND count >= 19 THEN '✅ PASS'
        WHEN check_type = 'Materialized Views' AND count >= 2 THEN '✅ PASS'
        WHEN check_type = 'Custom Functions' AND count >= 3 THEN '✅ PASS'
        ELSE '❌ FAIL'
    END as status
FROM optimization_check;
```

Expected output:
```
     check_type      | count | status
--------------------+-------+--------
 Indexes Created    |    19 | ✅ PASS
 Materialized Views |     2 | ✅ PASS
 Custom Functions   |     3 | ✅ PASS
```

**Congratulations!** 🎉 Your database is now optimized for peak performance.