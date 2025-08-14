-- Migration: Database Maintenance and Cleanup
-- Priority: HIGH
-- Estimated improvement: 20-30% space reduction, improved query performance
-- Safe to run: Yes, but should be run during low-traffic periods

-- Description: This script performs essential database maintenance including
-- VACUUM, ANALYZE, and cleanup of dead tuples that are causing table bloat.

-- WARNING: This script should be run during a maintenance window as VACUUM can be resource intensive.

DO $$
DECLARE
    table_name text;
    dead_tuples bigint;
    live_tuples bigint;
    bloat_ratio numeric;
BEGIN
    RAISE NOTICE 'Starting database maintenance at %', NOW();
    
    -- Get tables with high dead tuple ratios
    FOR table_name, dead_tuples, live_tuples IN
        SELECT 
            relname,
            n_dead_tup,
            n_live_tup
        FROM pg_stat_user_tables 
        WHERE n_dead_tup > 0 
        AND (n_live_tup = 0 OR n_dead_tup::float / n_live_tup::float > 0.1)
        ORDER BY n_dead_tup DESC
    LOOP
        IF live_tuples > 0 THEN
            bloat_ratio := round((dead_tuples::numeric / live_tuples::numeric) * 100, 2);
        ELSE
            bloat_ratio := 100.0;
        END IF;
        
        RAISE NOTICE 'Processing table: % (% dead tuples, % live tuples, %% bloat)', 
                     table_name, dead_tuples, live_tuples, bloat_ratio;
        
        -- Perform VACUUM ANALYZE on tables with significant dead tuples
        EXECUTE format('VACUUM ANALYZE %I', table_name);
        
        RAISE NOTICE 'Completed VACUUM ANALYZE for table: %', table_name;
    END LOOP;
    
    RAISE NOTICE 'Database maintenance completed at %', NOW();
END $$;

-- Update all table statistics to ensure optimal query planning
ANALYZE;

-- Reindex any indexes that might be bloated (this is more aggressive, run if needed)
-- Uncomment the following block if you need to rebuild indexes
/*
DO $$
DECLARE
    index_record record;
BEGIN
    RAISE NOTICE 'Starting index maintenance at %', NOW();
    
    -- Find indexes on tables with high dead tuple ratios
    FOR index_record IN
        SELECT 
            i.indexname,
            i.tablename
        FROM pg_indexes i
        JOIN pg_stat_user_tables s ON i.tablename = s.relname
        WHERE s.n_dead_tup > 100
        AND i.schemaname = 'public'
        AND i.indexname NOT LIKE '%_pkey'  -- Skip primary keys for safety
    LOOP
        RAISE NOTICE 'Reindexing: % on table %', index_record.indexname, index_record.tablename;
        EXECUTE format('REINDEX INDEX CONCURRENTLY %I', index_record.indexname);
    END LOOP;
    
    RAISE NOTICE 'Index maintenance completed at %', NOW();
END $$;
*/

-- Clean up any orphaned workflow executions (data cleanup)
DELETE FROM workflow_step_executions 
WHERE workflow_instance_id NOT IN (SELECT id FROM workflow_instances);

-- Clean up old notifications (older than 90 days and read)
DELETE FROM user_notifications 
WHERE is_read = true 
AND read_at < NOW() - INTERVAL '90 days';

-- Update sequences to correct values (in case of inconsistencies)
DO $$
DECLARE
    seq_record record;
    max_val bigint;
BEGIN
    FOR seq_record IN
        SELECT 
            schemaname,
            sequencename,
            tablename,
            columnname
        FROM pg_sequences s
        JOIN information_schema.columns c ON c.column_default LIKE '%' || s.sequencename || '%'
        WHERE s.schemaname = 'public'
    LOOP
        -- Get maximum value from the table
        EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I.%I', 
                      seq_record.columnname, 
                      seq_record.schemaname, 
                      seq_record.tablename) INTO max_val;
        
        -- Reset sequence to correct value
        EXECUTE format('SELECT setval(%L, %s)', 
                      seq_record.schemaname || '.' || seq_record.sequencename, 
                      GREATEST(max_val, 1));
                      
        RAISE NOTICE 'Updated sequence % to %', seq_record.sequencename, GREATEST(max_val, 1);
    END LOOP;
END $$;

-- Final statistics update
ANALYZE;

-- Report final table sizes and statistics
DO $$
DECLARE
    size_info record;
BEGIN
    RAISE NOTICE '=== POST-MAINTENANCE TABLE STATISTICS ===';
    
    FOR size_info IN
        SELECT 
            relname as table_name,
            n_live_tup as live_rows,
            n_dead_tup as dead_rows,
            pg_size_pretty(pg_total_relation_size(relname)) as total_size
        FROM pg_stat_user_tables 
        WHERE n_live_tup > 0 OR n_dead_tup > 0
        ORDER BY pg_total_relation_size(relname) DESC
        LIMIT 10
    LOOP
        RAISE NOTICE 'Table: % | Live: % | Dead: % | Size: %', 
                     size_info.table_name, 
                     size_info.live_rows, 
                     size_info.dead_rows, 
                     size_info.total_size;
    END LOOP;
END $$;