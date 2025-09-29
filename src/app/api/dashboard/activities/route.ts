import { NextResponse, type NextRequest } from 'next/server';
import { cookies, headers } from 'next/headers';
import { format } from 'date-fns';
import { sql } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { withAuth, getUserIdentifier } from '@/lib/api-protection';

// Define types for our data
type TravelRequest = {
  id: string;
  purpose: string;
  status: string;
  created_at: string;
  updated_at: string;
  staff_id: string;
};

type Claim = {
  id: string;
  purpose: string;
  status: string;
  created_at: string;
  updated_at: string;
  staff_id: string;
};

type VisaApplication = {
  id: string;
  purpose: string;
  status: string;
  created_at: string;
  updated_at: string;
  requestor_name: string;
};

type ActivityItem = {
  id: string;
  type: string;
  title: string;
  status: string;
  dateInfo: string;
  link: string;
  statusVariant: string;
  icon: string;
  staff_id?: string;
};

type DateInfoInput = {
  status: string;
  created_at?: string;
  updated_at?: string;
  submitted_date?: string;
};

// Helper function to get status variant for badges
function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('approved') || statusLower.includes('completed') || statusLower.includes('confirmed')) {
    return 'default';
  } else if (statusLower.includes('pending') || statusLower.includes('draft')) {
    return 'secondary';
  } else if (statusLower.includes('rejected') || statusLower.includes('cancelled') || statusLower.includes('blocked')) {
    return 'destructive';
  }
  return 'outline';
}

// Helper function to format dates
function formatDate(dateString: string): string {
  try {
    return format(new Date(dateString), 'MMM dd, yyyy');
  } catch (error) {
    console.error('Error formatting date:', dateString, error);
    return 'Invalid date';
  }
}

// Helper function to get date info for display
function getDateInfo(item: { status: string; created_at?: string; updated_at?: string; submitted_date?: string }): string {
  const { status, created_at, updated_at, submitted_date } = item;
  
  if (status.toLowerCase().includes('draft')) {
    return `Created: ${formatDate(created_at || '')}`;
  } else if (status.toLowerCase().includes('submitted') || status.toLowerCase().includes('pending')) {
    return `Submitted: ${formatDate(submitted_date || updated_at || created_at || '')}`;
  } else {
    return `Updated: ${formatDate(updated_at || '')}`;
  }
}

// Optimized function to validate all entities in batch queries (eliminates N+1 problem)
async function validateAllEntities(trfIds: string[], claimIds: string[], visaIds: string[]): Promise<{
  validTrfs: Set<string>;
  validClaims: Set<string>;
  validVisas: Set<string>;
}> {
  const validTrfs = new Set<string>();
  const validClaims = new Set<string>();
  const validVisas = new Set<string>();

  try {
    // Single query to validate all TRFs
    if (trfIds.length > 0) {
      const trfResults = await sql`
        SELECT id FROM travel_requests WHERE id = ANY(${trfIds})
      `;
      trfResults.forEach((row: any) => validTrfs.add(row.id));
    }

    // Single query to validate all claims (check both tables)
    if (claimIds.length > 0) {
      const expenseClaimsResults = await sql`
        SELECT id FROM expense_claims WHERE id = ANY(${claimIds})
      `;
      expenseClaimsResults.forEach((row: any) => validClaims.add(row.id));
      
      // Check claims table for any remaining IDs
      const remainingClaimIds = claimIds.filter(id => !validClaims.has(id));
      if (remainingClaimIds.length > 0) {
        const claimsResults = await sql`
          SELECT id FROM claims WHERE id = ANY(${remainingClaimIds})
        `;
        claimsResults.forEach((row: any) => validClaims.add(row.id));
      }
    }

    // Single query to validate all visa applications
    if (visaIds.length > 0) {
      const visaResults = await sql`
        SELECT id FROM visa_applications WHERE id = ANY(${visaIds})
      `;
      visaResults.forEach((row: any) => validVisas.add(row.id));
    }

  } catch (error) {
    console.error('Error validating entities in batch:', error);
  }

  console.log(`Batch validation results: ${validTrfs.size} valid TRFs, ${validClaims.size} valid claims, ${validVisas.size} valid visas`);
  return { validTrfs, validClaims, validVisas };
}

// Helper function to validate if an accommodation request exists
async function validateAccommodationExists(accommodationId: string): Promise<boolean> {
  try {
    // Check if this is a travel request with accommodation details
    const result = await sql`
      SELECT tr.id 
      FROM travel_requests tr
      INNER JOIN trf_accommodation_details tad ON tad.trf_id = tr.id
      WHERE tr.id = ${accommodationId}
    `;
    return result && result.length > 0;
  } catch (error) {
    console.error('Error validating accommodation request:', error);
    return false;
  }
}

export const GET = withAuth(async function(request: NextRequest) {
  console.log('Activities API: Starting user-specific activities request');
  
  try {
    const session = (request as any).user;
    const userIdentifier = await getUserIdentifier(session);
    
    console.log(`Loading activities for user ${session.role} (${userIdentifier.userId})`);
    
    // Build user filter conditions for different tables
    const trfUserFilter = userIdentifier.staffId 
      ? `(staff_id = '${userIdentifier.staffId}' OR staff_id = '${userIdentifier.userId}' OR requestor_name ILIKE '%${userIdentifier.email}%')` 
      : `(staff_id = '${userIdentifier.userId}' OR requestor_name ILIKE '%${userIdentifier.email}%')`;
    
    const claimsUserFilter = userIdentifier.staffId 
      ? `(staff_no = '${userIdentifier.staffId}' OR staff_no = '${userIdentifier.userId}' OR staff_name ILIKE '%${userIdentifier.email}%')` 
      : `(staff_no = '${userIdentifier.userId}' OR staff_name ILIKE '%${userIdentifier.email}%')`;
    
    const visaUserFilter = userIdentifier.staffId 
      ? `(user_id = '${userIdentifier.userId}' OR staff_id = '${userIdentifier.staffId}' OR email = '${userIdentifier.email}')` 
      : `(user_id = '${userIdentifier.userId}' OR email = '${userIdentifier.email}')`;
    
    const transportUserFilter = userIdentifier.staffId 
      ? `(staff_id = '${userIdentifier.staffId}' OR staff_id = '${userIdentifier.userId}' OR created_by = '${userIdentifier.userId}')` 
      : `(staff_id = '${userIdentifier.userId}' OR created_by = '${userIdentifier.userId}')`;

    // Initialize arrays to store activities
    let trfs: ActivityItem[] = [];
    let claims: ActivityItem[] = [];
    let visas: ActivityItem[] = [];
    let accommodationBookings: ActivityItem[] = [];

    console.log('Fetching activity data with optimized single query...');
    const startTime = performance.now();
    
    // Pre-calculate user identifiers for optimized queries  
    const userIds = [userIdentifier.userId];
    if (userIdentifier.staffId && userIdentifier.staffId !== userIdentifier.userId) {
      userIds.push(userIdentifier.staffId);
    }

    console.log('ACTIVITIES_DEBUG: User identifier:', userIdentifier);
    console.log('ACTIVITIES_DEBUG: User IDs for query:', userIds);
    console.log('ACTIVITIES_DEBUG: User email:', userIdentifier.email);
    
    // Quick check for ANY data in database (debugging)
    try {
      const totalCountsResult = await sql`
        SELECT 
          (SELECT COUNT(*) FROM travel_requests) as trf_count,
          (SELECT COUNT(*) FROM expense_claims) as claims_count,
          (SELECT COUNT(*) FROM visa_applications) as visa_count
      `;
      console.log('ACTIVITIES_DEBUG: Database totals:', totalCountsResult[0]);
    } catch (countError) {
      console.error('ACTIVITIES_DEBUG: Error checking database totals:', countError);
    }
    
    let trfData: any[] = [];
    let claimData: any[] = [];
    let visaData: any[] = [];
    let accommodationData: any[] = [];
    
    try {
      // Direct queries without CTEs to avoid array issues  
      const [trfActivities, claimActivities, visaActivities, accommodationActivities] = await Promise.all([
        // TRF activities
        sql`
          SELECT 
            tr.id,
            tr.purpose,
            tr.status,
            tr.created_at,
            tr.updated_at,
            tr.staff_id,
            'TRF' as activity_type
          FROM travel_requests tr
          WHERE (
            tr.staff_id = ${userIdentifier.userId}
            ${userIdentifier.staffId && userIdentifier.staffId !== userIdentifier.userId ? 
              sql` OR tr.staff_id = ${userIdentifier.staffId}` : sql``}
            OR tr.requestor_name ILIKE ${`%${userIdentifier.email}%`}
          )
            AND (tr.travel_type != 'Accommodation' OR tr.travel_type IS NULL)
          ORDER BY tr.updated_at DESC
          LIMIT 10
        `,
        // Claims activities 
        sql`
          SELECT 
            ec.id,
            ec.purpose_of_claim as purpose,
            ec.status,
            ec.created_at,
            ec.updated_at,
            ec.staff_no as staff_id,
            'Claims' as activity_type
          FROM expense_claims ec
          WHERE (
            ec.staff_no = ${userIdentifier.userId}
            ${userIdentifier.staffId && userIdentifier.staffId !== userIdentifier.userId ? 
              sql` OR ec.staff_no = ${userIdentifier.staffId}` : sql``}
            OR ec.staff_name ILIKE ${`%${userIdentifier.email}%`}
          )
          ORDER BY ec.updated_at DESC
          LIMIT 10
        `,
        // Visa activities
        sql`
          SELECT 
            va.id,
            va.travel_purpose as purpose,
            va.status,
            va.created_at,
            va.updated_at,
            va.user_id as staff_id,
            'Visa' as activity_type
          FROM visa_applications va
          WHERE (
            va.staff_id = ${userIdentifier.userId}
            OR va.user_id = ${userIdentifier.userId}
            ${userIdentifier.staffId && userIdentifier.staffId !== userIdentifier.userId ? 
              sql` OR va.staff_id = ${userIdentifier.staffId} OR va.user_id = ${userIdentifier.staffId}` : sql``}
            OR va.email = ${userIdentifier.email}
          )
          ORDER BY va.updated_at DESC
          LIMIT 10
        `,
        // Accommodation activities
        sql`
          SELECT DISTINCT
            tr.id,
            tr.purpose,
            tr.status,
            tr.created_at,
            tr.updated_at,
            tr.staff_id,
            'Accommodation' as activity_type
          FROM travel_requests tr
          INNER JOIN trf_accommodation_details tad ON tad.trf_id = tr.id
          WHERE (
            tr.staff_id = ${userIdentifier.userId}
            ${userIdentifier.staffId && userIdentifier.staffId !== userIdentifier.userId ? 
              sql` OR tr.staff_id = ${userIdentifier.staffId}` : sql``}
            OR tr.requestor_name ILIKE ${`%${userIdentifier.email}%`}
          )
          ORDER BY tr.updated_at DESC
          LIMIT 10
        `
      ]);
      
      // Combine all activities and sort by updated_at
      const activitiesResult = [
        ...trfActivities,
        ...claimActivities,  
        ...visaActivities,
        ...accommodationActivities
      ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
       .slice(0, 15);

      const endTime = performance.now();
      console.log(`Activities batch query completed in ${Math.round(endTime - startTime)}ms`);
      console.log('ACTIVITIES_DEBUG: Raw query result count:', activitiesResult.length);
      console.log('ACTIVITIES_DEBUG: Sample results:', JSON.stringify(activitiesResult.slice(0, 3), null, 2));

      // Separate results by type (no validation needed since query already ensures existence)
      trfData = activitiesResult.filter(item => item.activity_type === 'TRF');
      claimData = activitiesResult.filter(item => item.activity_type === 'Claims');
      visaData = activitiesResult.filter(item => item.activity_type === 'Visa');
      accommodationData = activitiesResult.filter(item => item.activity_type === 'Accommodation');

      console.log(`Fetched ${trfData.length} TRFs, ${claimData.length} claims, ${visaData.length} visas, ${accommodationData.length} accommodations`);
    } catch (err) {
      console.error('Error fetching optimized activity data:', err);
      // Fallback to empty arrays if query fails
    }

    // Build TRF activities directly (no validation needed since query ensures existence)
    trfs = trfData.map(trf => {
      const dateInfo = getDateInfo({
        status: trf.status,
        created_at: trf.created_at,
        updated_at: trf.updated_at
      });
      
      return {
        id: trf.id,
        type: 'TRF',
        title: `TRF: ${trf.purpose || 'Travel Request'}`,
        status: trf.status,
        dateInfo,
        link: `/trf/view/${trf.id}`,
        statusVariant: getStatusVariant(trf.status),
        icon: 'FileText',
        staff_id: trf.staff_id
      };
    });

    // Build Claims activities directly
    claims = claimData.map(claim => {
      const dateInfo = getDateInfo({
        status: claim.status,
        created_at: claim.created_at,
        updated_at: claim.updated_at
      });
      
      return {
        id: claim.id,
        type: 'Claim',
        title: `Claim: ${claim.purpose || 'Expense Claim'}`,
        status: claim.status,
        dateInfo,
        link: `/claims/view/${claim.id}`,
        statusVariant: getStatusVariant(claim.status),
        icon: 'ReceiptText',
        staff_id: claim.staff_id
      };
    });

    // Build Visa activities directly
    visas = visaData.map(visa => {
      const dateInfo = getDateInfo({
        status: visa.status,
        created_at: visa.created_at,
        updated_at: visa.updated_at
      });
      
      return {
        id: visa.id,
        type: 'Visa',
        title: `Visa: ${visa.purpose || 'Visa Application'}`,
        status: visa.status,
        dateInfo,
        link: `/visa/view/${visa.id}`,
        statusVariant: getStatusVariant(visa.status),
        icon: 'StickyNote',
        staff_id: visa.staff_id
      };
    });

    // Build Accommodation activities directly (no separate query needed)
    accommodationBookings = accommodationData.map(accommodation => {
      const dateInfo = getDateInfo({
        status: accommodation.status,
        created_at: accommodation.created_at,
        updated_at: accommodation.updated_at
      });
      
      return {
        id: accommodation.id,
        type: 'Accommodation',
        title: `Accommodation: ${accommodation.purpose || 'Booking Request'}`,
        status: accommodation.status,
        dateInfo,
        link: `/accommodation/view/${accommodation.id}`,
        statusVariant: getStatusVariant(accommodation.status),
        icon: 'BedDouble',
        staff_id: accommodation.staff_id
      };
    });

    let allActivities = [...trfs, ...claims, ...visas, ...accommodationBookings];
    
    // Sort by date (most recent first)
    allActivities.sort((a, b) => {
      // Extract date from dateInfo string if possible
      const getDateFromInfo = (info: string) => {
        const dateMatch = info.match(/\w+:\s(.+)/);
        if (dateMatch && dateMatch[1]) {
          try {
            return new Date(dateMatch[1]).getTime();
          } catch (e) {
            console.error('Error parsing date from info:', info, e);
            return 0;
          }
        }
        return 0;
      };
      
      const dateA = getDateFromInfo(a.dateInfo);
      const dateB = getDateFromInfo(b.dateInfo);
      
      return dateB - dateA;
    });
    
    // Return the top 10 most recent activities
    const result = allActivities.slice(0, 10);
    console.log(`Returning ${result.length} user-specific activities for ${userIdentifier.userId}`);
    
    if (result.length === 0) {
      console.log('ACTIVITIES_DEBUG: No activities found for user');
      console.log('ACTIVITIES_DEBUG: Possible reasons:');
      console.log('ACTIVITIES_DEBUG: 1. No data in database for this user');
      console.log('ACTIVITIES_DEBUG: 2. User ID mismatch between session and database');
      console.log('ACTIVITIES_DEBUG: 3. Query filters too restrictive');
    } else {
      console.log('ACTIVITIES_DEBUG: Sample activity titles:', result.slice(0, 3).map(a => a.title));
    }
    
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, max-age=60', // Shorter cache for user-specific data
        'X-User-Filtered': 'true'
      }
    });
  } catch (error) {
    console.error('Error in activities API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});
