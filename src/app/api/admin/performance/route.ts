import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';
import { cache } from '@/lib/cache';
import { getRateLimiterStats } from '@/lib/rate-limiter';
import { sql } from '@/lib/db';

export const GET = withAuth(async function(request: NextRequest) {
  try {
    const session = (request as any).user;
    
    // Only system admins can access performance data
    if (!hasPermission(session, 'system_admin')) {
      return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 403 });
    }

    // Get performance metrics
    const performanceData = {
      timestamp: new Date().toISOString(),
      cache: {
        stats: cache.getStats(),
        hitRate: 'N/A' // Would need to implement hit/miss tracking
      },
      rateLimit: getRateLimiterStats(),
      database: {
        connectionPool: 'Available via db library',
        activeQueries: 'N/A' // Would need query tracking
      },
      system: {
        memory: {
          used: process.memoryUsage().heapUsed / 1024 / 1024, // MB
          total: process.memoryUsage().heapTotal / 1024 / 1024, // MB
          rss: process.memoryUsage().rss / 1024 / 1024 // MB
        },
        uptime: process.uptime(), // seconds
        version: process.version
      }
    };

    // Get database stats if available
    try {
      const dbStats = await sql`
        SELECT 
          'Active Connections' as metric,
          COUNT(*) as value,
          'connections' as unit
        FROM pg_stat_activity 
        WHERE state = 'active'
        AND application_name = 'syntra_vms'
        
        UNION ALL
        
        SELECT 
          'Total Connections' as metric,
          COUNT(*) as value,
          'connections' as unit
        FROM pg_stat_activity 
        WHERE application_name = 'syntra_vms'
        
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
        
        ORDER BY metric;
      `;

      performanceData.database = {
        ...performanceData.database,
        stats: dbStats
      };
    } catch (dbError) {
      console.error('Error fetching database stats:', dbError);
      performanceData.database = {
        ...performanceData.database,
        error: 'Could not fetch database statistics'
      };
    }

    return NextResponse.json(performanceData);
  } catch (error) {
    console.error('Error fetching performance data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance data' },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async function(request: NextRequest) {
  try {
    const session = (request as any).user;
    
    // Only system admins can clear caches
    if (!hasPermission(session, 'system_admin')) {
      return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'clear-cache':
        cache.clear();
        return NextResponse.json({ 
          message: 'Cache cleared successfully',
          timestamp: new Date().toISOString()
        });
        
      case 'refresh-views':
        try {
          await sql`SELECT refresh_dashboard_views()`;
          return NextResponse.json({ 
            message: 'Materialized views refreshed successfully',
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          return NextResponse.json(
            { error: 'Failed to refresh materialized views', details: error.message },
            { status: 500 }
          );
        }
        
      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: clear-cache, refresh-views' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error performing admin action:', error);
    return NextResponse.json(
      { error: 'Failed to perform admin action' },
      { status: 500 }
    );
  }
});