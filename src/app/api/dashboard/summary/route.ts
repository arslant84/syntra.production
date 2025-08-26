import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { requireAuth, createAuthError } from '@/lib/auth-utils';
import { hasPermission } from '@/lib/permissions';
import { withAuth, getUserIdentifier } from '@/lib/api-protection';

export const GET = withAuth(async function(request: NextRequest) {
  console.log('DASHBOARD_SUMMARY_API_CALLED: Dashboard summary API endpoint hit');
  try {
    const session = (request as any).user;
    console.log('DASHBOARD_SUMMARY_SESSION: Session data:', session);
    const userIdentifier = await getUserIdentifier(session);
    console.log('DASHBOARD_SUMMARY_USER_ID: Got user identifier:', userIdentifier);
    
    console.log(`Dashboard summary for user ${session.role} (${userIdentifier.userId})`);
    console.log('DASHBOARD_SUMMARY_DEBUG: User identifier:', userIdentifier);
    console.log('DASHBOARD_SUMMARY_DEBUG: Session data:', { 
      id: session.id, 
      name: session.name, 
      email: session.email, 
      staffId: session.staffId 
    });
    
    // Build user filter condition for SQL queries
    const staffIdCondition = userIdentifier.staffId 
      ? `staff_id = '${userIdentifier.staffId}' OR ` 
      : '';
    const userFilter = `(${staffIdCondition}staff_id = '${userIdentifier.userId}' OR requestor_name ILIKE '%${userIdentifier.email}%')`;
    console.log('DASHBOARD_SUMMARY_DEBUG: Generated user filter:', userFilter);

    // Get user's pending TRF count
    let pendingTRFs = 0;
    try {
      console.log('Fetching user\'s pending TRFs...');
      const sqlQuery = `
        SELECT COUNT(*) AS count FROM travel_requests
        WHERE (status LIKE 'Pending%' OR status = 'Draft')
          AND travel_type != 'Accommodation'
          AND ${userFilter}
      `;
      console.log('DASHBOARD_SUMMARY_DEBUG: TRF SQL Query:', sqlQuery);
      const trfQuery = await sql.unsafe(sqlQuery);
      pendingTRFs = parseInt(trfQuery[0]?.count || '0');
      console.log(`DASHBOARD_SUMMARY_DEBUG: Found ${pendingTRFs} pending TRFs for user ${userIdentifier.userId}`);
    } catch (err) {
      console.error('Error fetching user\'s travel requests:', err);
    }

    // Get user's visa application updates count  
    let visaUpdates = 0;
    try {
      console.log('Querying user\'s visa_applications...');
      const visaUserFilter = userIdentifier.staffId 
        ? `(user_id = '${userIdentifier.userId}' OR staff_id = '${userIdentifier.staffId}' OR email = '${userIdentifier.email}')` 
        : `(user_id = '${userIdentifier.userId}' OR email = '${userIdentifier.email}')`;
        
      const visaQuery = await sql.unsafe(`
        SELECT COUNT(*) AS count FROM visa_applications
        WHERE status LIKE 'Pending%'
          AND ${visaUserFilter}
      `);
      visaUpdates = parseInt(visaQuery[0]?.count || '0');
      console.log(`Found ${visaUpdates} pending visa applications for user ${userIdentifier.userId}`);
    } catch (err) {
      console.error('Error fetching user\'s visa applications:', err);
    }

    // Get user's draft/pending claims count
    let draftClaims = 0;
    try {
      console.log('Checking user\'s claims...');
      // Check if expense_claims table exists
      const tableCheck = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'expense_claims'
        ) as exists
      `;
      
      const claimsUserFilter = userIdentifier.staffId 
        ? `(staff_no = '${userIdentifier.staffId}' OR staff_no = '${userIdentifier.userId}' OR staff_name ILIKE '%${userIdentifier.email}%')` 
        : `(staff_no = '${userIdentifier.userId}' OR staff_name ILIKE '%${userIdentifier.email}%')`;
      
      if (tableCheck[0]?.exists) {
        console.log('expense_claims table exists, fetching user\'s claims...');
        const claimsQuery = await sql.unsafe(`
          SELECT COUNT(*) AS count FROM expense_claims
          WHERE (status = 'Draft' OR status = 'Pending Verification' OR status IS NULL)
            AND ${claimsUserFilter}
        `);
        draftClaims = parseInt(claimsQuery[0]?.count || '0');
        console.log(`Found ${draftClaims} pending claims for user ${userIdentifier.userId}`);
      } else {
        // Fallback to older claims table if it exists
        const oldTableCheck = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'claims'
          ) as exists
        `;
        
        if (oldTableCheck[0]?.exists) {
          const draftClaimsQuery = await sql.unsafe(`
            SELECT COUNT(*) as count FROM claims 
            WHERE (status = 'Draft' OR status = 'Pending Verification' OR status IS NULL)
              AND ${claimsUserFilter}
          `);
          draftClaims = parseInt(draftClaimsQuery[0]?.count || '0');
          console.log(`Found ${draftClaims} pending claims for user in claims table`);
        }
      }
    } catch (err) {
      console.error('Error checking user\'s claims:', err);
    }

    // Get user's accommodation requests count
    let accommodationBookings = 0;
    try {
      console.log('Checking user\'s accommodation requests...');
      
      const accommodationQuery = await sql.unsafe(`
        SELECT COUNT(DISTINCT tr.id) AS count 
        FROM travel_requests tr
        INNER JOIN trf_accommodation_details tad ON tad.trf_id = tr.id
        WHERE (tr.status LIKE 'Pending%' OR tr.status = 'Draft')
          AND ${userFilter}
      `);
      accommodationBookings = parseInt(accommodationQuery[0]?.count || '0');
      console.log(`Found ${accommodationBookings} accommodation requests for user ${userIdentifier.userId}`);
      
    } catch (err) {
      console.error('Error fetching user\'s accommodation requests:', err);
    }

    // Get user's pending transport requests count
    let pendingTransport = 0;
    try {
      console.log('Fetching user\'s transport requests...');
      const transportUserFilter = userIdentifier.staffId 
        ? `(staff_id = '${userIdentifier.staffId}' OR staff_id = '${userIdentifier.userId}' OR created_by = '${userIdentifier.userId}')` 
        : `(staff_id = '${userIdentifier.userId}' OR created_by = '${userIdentifier.userId}')`;
        
      const transportQuery = await sql.unsafe(`
        SELECT COUNT(*) AS count FROM transport_requests
        WHERE status LIKE 'Pending%'
          AND ${transportUserFilter}
      `);
      pendingTransport = parseInt(transportQuery[0]?.count || '0');
      console.log(`Found ${pendingTransport} transport requests for user ${userIdentifier.userId}`);
    } catch (err) {
      console.error('Error fetching user\'s transport requests:', err);
    }

    return NextResponse.json({
      pendingTrfs: pendingTRFs,
      visaUpdates,
      draftClaims,
      pendingAccommodation: accommodationBookings,
      pendingTransport
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60', // Shorter cache for user-specific data
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
});
