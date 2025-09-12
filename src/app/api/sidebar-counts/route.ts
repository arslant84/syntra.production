import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { requireAuth, createAuthError } from '@/lib/auth-utils';
import { hasPermission } from '@/lib/permissions';
import { withAuth, canViewAllData, canViewDomainData, getUserIdentifier } from '@/lib/api-protection';
import { withCache, userCacheKey, globalCacheKey, CACHE_TTL } from '@/lib/cache';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';

export const GET = withRateLimit(RATE_LIMITS.API_READ)(withAuth(async function(request: NextRequest) {
  try {
    const session = (request as any).user;
    console.log(`API_SIDEBAR_COUNTS: User ${session.role} (${session.email}) accessing sidebar counts`);
    
    // Get status parameter to determine context (personal dashboard vs approval queue)
    const url = new URL(request.url);
    const statusParam = url.searchParams.get('statuses');
    
    // Role-based access control with context awareness
    const userIdentifier = await getUserIdentifier(session);
    
    // ALWAYS filter by user for personal dashboard (no status param)
    // Only allow admin bypass for approval queues (with status param)
    const shouldBypassFilter = statusParam ? canViewAllData(session) : false;
    
    console.log(`API_SIDEBAR_COUNTS: Context - statusParam: ${statusParam}, shouldBypassFilter: ${shouldBypassFilter}`);

    // Cache sidebar counts per user role and permissions
    const cacheKey = shouldBypassFilter 
      ? globalCacheKey('sidebar-counts', 'admin', statusParam || 'default')
      : userCacheKey(userIdentifier.userId, 'sidebar-counts');
      
    const counts = await withCache(
      cacheKey,
      () => fetchSidebarCounts(session, shouldBypassFilter, userIdentifier),
      CACHE_TTL.NOTIFICATION_COUNT // 1 minute cache for real-time feel
    );

    return NextResponse.json(counts);
  } catch (error) {
    console.error('Error fetching sidebar counts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sidebar counts' },
      { status: 500 }
    );
  }
}));

// Extract sidebar counts fetching logic for caching
async function fetchSidebarCounts(session: any, shouldBypassFilter: boolean, userIdentifier: any) {
  
    // Object to store all counts
    const counts = {
      approvals: 0,
      claims: 0,
      visas: 0,
      flights: 0,
      accommodation: 0,
    };

    // Get total approvals count (sum of TRFs, Claims, Visas, and Accommodation)
    try {
      // Count pending TRFs - filter by user if not admin
      let trfQuery;
      if (shouldBypassFilter) {
        trfQuery = await sql`
          SELECT COUNT(*) AS count FROM travel_requests
          WHERE status LIKE 'Pending%' OR status = 'Pending'
        `;
      } else {
        // Handle undefined staffId gracefully
        const staffIdCondition = userIdentifier.staffId 
          ? `staff_id = '${userIdentifier.staffId}' OR` 
          : '';
        
        trfQuery = await sql.unsafe(`
          SELECT COUNT(*) AS count FROM travel_requests
          WHERE (status LIKE 'Pending%' OR status = 'Pending')
            AND (${staffIdCondition}
                 staff_id = '${userIdentifier.userId}' OR
                 requestor_name ILIKE '%${userIdentifier.email}%')
        `);
      }
      const pendingTRFs = parseInt(trfQuery[0]?.count || '0');
      
      // Count pending claims
      let pendingClaims = 0;
      // Check if expense_claims table exists
      const claimsTableCheck = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'expense_claims'
        ) as exists
      `;
      
      if (claimsTableCheck[0]?.exists) {
        let claimsQuery;
        if (shouldBypassFilter) {
          claimsQuery = await sql`
            SELECT COUNT(*) AS count FROM expense_claims
            WHERE status = 'Pending Verification' OR status = 'Pending Approval'
          `;
        } else {
          // Handle undefined staffId gracefully
          const staffIdCondition = userIdentifier.staffId 
            ? `staff_no = '${userIdentifier.staffId}' OR` 
            : '';
          
          claimsQuery = await sql.unsafe(`
            SELECT COUNT(*) AS count FROM expense_claims
            WHERE (status = 'Pending Verification' OR status = 'Pending Approval')
              AND (${staffIdCondition}
                   staff_no = '${userIdentifier.userId}' OR
                   staff_name ILIKE '%${userIdentifier.email}%')
          `);
        }
        pendingClaims = parseInt(claimsQuery[0]?.count || '0');
      } else {
        // Fallback to older claims table if it exists
        const oldTableCheck = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'claims'
          ) as exists
        `;
        
        if (oldTableCheck[0]?.exists) {
          let claimsQuery;
          if (shouldBypassFilter) {
            claimsQuery = await sql`
              SELECT COUNT(*) as count FROM claims 
              WHERE status = 'Pending Verification' OR status = 'Pending Approval'
            `;
          } else {
            // Handle undefined staffId gracefully
            const staffIdCondition = userIdentifier.staffId 
              ? `staff_no = '${userIdentifier.staffId}' OR` 
              : '';
            
            claimsQuery = await sql.unsafe(`
              SELECT COUNT(*) as count FROM claims 
              WHERE (status = 'Pending Verification' OR status = 'Pending Approval')
                AND (${staffIdCondition}
                     staff_no = '${userIdentifier.userId}' OR
                     staff_name ILIKE '%${userIdentifier.email}%')
            `);
          }
          pendingClaims = parseInt(claimsQuery[0]?.count || '0');
        }
      }
      
      // Count pending visa applications - filter by user if not admin
      let pendingVisas = 0;
      let visaQuery;
      if (shouldBypassFilter) {
        visaQuery = await sql`
          SELECT COUNT(*) AS count FROM visa_applications
          WHERE status LIKE 'Pending%'
        `;
      } else {
        // Handle undefined staffId gracefully
        const staffIdCondition = userIdentifier.staffId 
          ? `staff_id = '${userIdentifier.staffId}' OR` 
          : '';
        
        visaQuery = await sql.unsafe(`
          SELECT COUNT(*) AS count FROM visa_applications
          WHERE status LIKE 'Pending%'
            AND (user_id = '${userIdentifier.userId}' OR 
                 ${staffIdCondition}
                 email = '${userIdentifier.email}')
        `);
      }
      pendingVisas = parseInt(visaQuery[0]?.count || '0');
      
      // Count pending accommodation requests - filter by user if not admin
      let pendingAccommodation = 0;
      let accommodationQuery;
      if (shouldBypassFilter) {
        accommodationQuery = await sql`
          SELECT COUNT(DISTINCT tr.id) AS count 
          FROM travel_requests tr
          INNER JOIN trf_accommodation_details tad ON tad.trf_id = tr.id
          WHERE tr.status = 'Pending Department Focal' 
             OR tr.status = 'Pending Line Manager'
             OR tr.status = 'Pending HOD'
             OR tr.status = 'Pending Approval'
        `;
      } else {
        // Handle undefined staffId gracefully
        const staffIdCondition = userIdentifier.staffId 
          ? `tr.staff_id = '${userIdentifier.staffId}' OR` 
          : '';
        
        accommodationQuery = await sql.unsafe(`
          SELECT COUNT(DISTINCT tr.id) AS count 
          FROM travel_requests tr
          INNER JOIN trf_accommodation_details tad ON tad.trf_id = tr.id
          WHERE (tr.status = 'Pending Department Focal' 
             OR tr.status = 'Pending Line Manager'
             OR tr.status = 'Pending HOD'
             OR tr.status = 'Pending Approval')
            AND (${staffIdCondition}
                 tr.staff_id = '${userIdentifier.userId}' OR
                 tr.requestor_name ILIKE '%${userIdentifier.email}%')
        `);
      }
      pendingAccommodation = parseInt(accommodationQuery[0]?.count || '0');
      
      // Store individual counts
      counts.claims = pendingClaims;
      counts.visas = pendingVisas;
      counts.accommodation = pendingAccommodation;
      
      // Calculate total approvals count
      counts.approvals = pendingTRFs + pendingClaims + pendingVisas + pendingAccommodation;
      
      // Count pending flights (if applicable)
      try {
        const flightsTableCheck = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'flight_bookings'
          ) as exists
        `;
        
        if (flightsTableCheck[0]?.exists) {
          let flightsQuery;
          if (shouldBypassFilter) {
            flightsQuery = await sql`
              SELECT COUNT(*) AS count FROM flight_bookings
              WHERE status = 'Pending'
            `;
          } else {
            // For flight bookings, we'd need to check the relationship to user
            // Handle undefined staffId gracefully
            const staffIdCondition = userIdentifier.staffId 
              ? `staff_id = '${userIdentifier.staffId}' OR` 
              : '';
            
            flightsQuery = await sql.unsafe(`
              SELECT COUNT(*) AS count FROM flight_bookings
              WHERE status = 'Pending'
                AND (user_id = '${userIdentifier.userId}' OR 
                     ${staffIdCondition}
                     1=0)
            `);
          }
          counts.flights = parseInt(flightsQuery[0]?.count || '0');
        }
      } catch (err) {
        console.error('Error fetching flight bookings:', err);
      }
      
    } catch (err) {
      console.error('Error calculating approval counts:', err);
    }

    console.log(`API_SIDEBAR_COUNTS: Returning counts for user ${session.role}:`, counts);
    return counts;
}
