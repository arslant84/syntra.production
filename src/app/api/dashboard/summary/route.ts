import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { requireAuth, createAuthError } from '@/lib/auth-utils';
import { hasPermission } from '@/lib/permissions';
import { withAuth, getUserIdentifier } from '@/lib/api-protection';
import { withCache, userCacheKey, CACHE_TTL } from '@/lib/cache';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';

export const GET = withRateLimit(RATE_LIMITS.DASHBOARD)(withAuth(async function(request: NextRequest) {
  console.log('DASHBOARD_SUMMARY_API_CALLED: Dashboard summary API endpoint hit');
  try {
    const session = (request as any).user;
    console.log('DASHBOARD_SUMMARY_SESSION: Session data:', session);
    const userIdentifier = await getUserIdentifier(session);
    console.log('DASHBOARD_SUMMARY_USER_ID: Got user identifier:', userIdentifier);

    // Cache dashboard data per user
    const cacheKey = userCacheKey(userIdentifier.userId, 'dashboard-summary');
    const dashboardData = await withCache(
      cacheKey,
      async () => {
        return await fetchDashboardData(userIdentifier, session);
      },
      CACHE_TTL.DASHBOARD_STATS
    );

    return NextResponse.json(dashboardData, {
      headers: {
        'X-User-Filtered': 'true'
      }
    });
  } catch (error: any) {
    console.error('Error in dashboard summary API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard summary' },
      { status: 500 }
    );
  }
}));

// Extract dashboard data fetching logic for caching
async function fetchDashboardData(userIdentifier: any, session: any) {
    console.log(`Dashboard summary for user ${session.role} (${userIdentifier.userId})`);
    console.log('SUMMARY_DEBUG: User identifier:', userIdentifier);
    console.log('SUMMARY_DEBUG: Session:', session);
    
    // Pre-calculate user identifiers for optimized queries
    const userIds = [userIdentifier.userId];
    if (userIdentifier.staffId && userIdentifier.staffId !== userIdentifier.userId) {
      userIds.push(userIdentifier.staffId);
    }
    
    console.log('SUMMARY_DEBUG: User IDs for query:', userIds);
    console.log('SUMMARY_DEBUG: User email:', userIdentifier.email);
    
    // Build user filter conditions for different tables
    const userFilterCondition = userIds.length > 1 
      ? `(staff_id = ${userIds[0]} OR staff_id = ${userIds[1]} OR requestor_name ILIKE '%${userIdentifier.email}%')` 
      : `(staff_id = ${userIds[0]} OR requestor_name ILIKE '%${userIdentifier.email}%')`;
    
    // Quick check for ANY data in database (debugging)
    try {
      const totalCountsResult = await sql`
        SELECT 
          (SELECT COUNT(*) FROM travel_requests) as total_trfs,
          (SELECT COUNT(*) FROM expense_claims) as total_claims,
          (SELECT COUNT(*) FROM visa_applications) as total_visas,
          (SELECT COUNT(*) FROM transport_requests) as total_transport
      `;
      console.log('SUMMARY_DEBUG: Database totals:', totalCountsResult[0]);
    } catch (countError) {
      console.error('SUMMARY_DEBUG: Error checking database totals:', countError);
    }
    
    const startTime = performance.now();
    
    try {
      // Simple direct queries without CTEs to avoid array issues
      const [trfResult, visaResult, claimsResult, accommodationResult, transportResult] = await Promise.all([
        // TRF count
        sql`
          SELECT COUNT(*) as pending_trfs
          FROM travel_requests tr
          WHERE (tr.status LIKE 'Pending%' OR tr.status = 'Draft' OR tr.status IS NULL)
            AND (tr.travel_type != 'Accommodation' OR tr.travel_type IS NULL)
            AND (
              tr.staff_id = ${userIdentifier.userId}
              ${userIdentifier.staffId && userIdentifier.staffId !== userIdentifier.userId ? 
                sql` OR tr.staff_id = ${userIdentifier.staffId}` : sql``}
              OR tr.requestor_name ILIKE ${`%${userIdentifier.email}%`}
            )
        `,
        // Visa count
        sql`
          SELECT COALESCE(COUNT(*), 0) as visa_updates
          FROM visa_applications va
          WHERE (va.status LIKE 'Pending%' OR va.status LIKE 'Processing%' OR va.status = 'Draft' OR va.status IS NULL)
            AND (
              va.staff_id = ${userIdentifier.userId}
              OR va.user_id = ${userIdentifier.userId}
              ${userIdentifier.staffId && userIdentifier.staffId !== userIdentifier.userId ? 
                sql` OR va.staff_id = ${userIdentifier.staffId} OR va.user_id = ${userIdentifier.staffId}` : sql``}
              OR va.email = ${userIdentifier.email}
            )
        `,
        // Claims count (check both tables)
        sql`
          SELECT 
            COALESCE(
              (SELECT COUNT(*) FROM expense_claims ec 
               WHERE (ec.status = 'Draft' OR ec.status = 'Pending Verification' OR ec.status LIKE 'Pending%' OR ec.status IS NULL)
                 AND (
                   ec.staff_no = ${userIdentifier.userId}
                   ${userIdentifier.staffId && userIdentifier.staffId !== userIdentifier.userId ? 
                     sql` OR ec.staff_no = ${userIdentifier.staffId}` : sql``}
                   OR ec.staff_name ILIKE ${`%${userIdentifier.email}%`}
                 )),
              0
            ) as draft_claims
        `,
        // Accommodation count
        sql`
          SELECT COUNT(DISTINCT tr.id) as accommodation_bookings
          FROM travel_requests tr
          INNER JOIN trf_accommodation_details tad ON tad.trf_id = tr.id
          WHERE (tr.status LIKE 'Pending%' OR tr.status = 'Draft' OR tr.status IS NULL)
            AND (
              tr.staff_id = ${userIdentifier.userId}
              ${userIdentifier.staffId && userIdentifier.staffId !== userIdentifier.userId ? 
                sql` OR tr.staff_id = ${userIdentifier.staffId}` : sql``}
              OR tr.requestor_name ILIKE ${`%${userIdentifier.email}%`}
            )
        `,
        // Transport count
        sql`
          SELECT COALESCE(COUNT(*), 0) as pending_transport
          FROM transport_requests trt
          WHERE (trt.status LIKE 'Pending%' OR trt.status = 'Draft' OR trt.status IS NULL)
            AND (
              trt.staff_id = ${userIdentifier.userId}
              OR trt.created_by = ${userIdentifier.userId}
              ${userIdentifier.staffId && userIdentifier.staffId !== userIdentifier.userId ? 
                sql` OR trt.staff_id = ${userIdentifier.staffId} OR trt.created_by = ${userIdentifier.staffId}` : sql``}
            )
        `
      ]);

      const result = [{
        pending_trfs: Number(trfResult[0]?.pending_trfs || 0),
        visa_updates: Number(visaResult[0]?.visa_updates || 0),
        draft_claims: Number(claimsResult[0]?.draft_claims || 0),
        accommodation_bookings: Number(accommodationResult[0]?.accommodation_bookings || 0),
        pending_transport: Number(transportResult[0]?.pending_transport || 0)
      }];

      const endTime = performance.now();
      console.log(`Dashboard summary batch query completed in ${Math.round(endTime - startTime)}ms`);
      console.log('SUMMARY_DEBUG: Raw query result:', JSON.stringify(result[0], null, 2));

      const counts = result[0] || {
        pending_trfs: 0,
        visa_updates: 0,
        draft_claims: 0,
        accommodation_bookings: 0,
        pending_transport: 0
      };
      
      console.log('SUMMARY_DEBUG: Final counts:', counts);

      return {
        pendingTsrs: parseInt(counts.pending_trfs?.toString() || '0'),
        visaUpdates: parseInt(counts.visa_updates?.toString() || '0'),
        draftClaims: parseInt(counts.draft_claims?.toString() || '0'),
        pendingAccommodation: parseInt(counts.accommodation_bookings?.toString() || '0'),
        pendingTransport: parseInt(counts.pending_transport?.toString() || '0')
      };
      
    } catch (error) {
      console.error('Error in optimized dashboard summary query:', error);
      
      // Fallback to minimal counts if optimized query fails
      return {
        pendingTsrs: 0,
        visaUpdates: 0,  
        draftClaims: 0,
        pendingAccommodation: 0,
        pendingTransport: 0
      };
    }
}
