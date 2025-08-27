import { NextResponse, type NextRequest } from 'next/server';
import { getAccommodationRequests } from '@/lib/accommodation-service';
import { 
  getServerStaffHouses, 
  getServerStaffGuests, 
  getServerAccommodationBookings
} from '@/lib/server-db';
import { withAuth, canViewAllData, canViewDomainData, canViewApprovalData, getUserIdentifier } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';
import { withCache, userCacheKey, CACHE_TTL } from '@/lib/cache';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';

// API route handler for fetching accommodation data
export const GET = withRateLimit(RATE_LIMITS.API_READ)(withAuth(async function(request: NextRequest) {
  console.log("API_ACCOMMODATION_GET_START: Fetching accommodation data.");
  
  const session = (request as any).user;
  
  // Role-based access control - authenticated users can access accommodation data (they'll see filtered data based on role)
  console.log(`API_ACCOMMODATION_GET: User ${session.role} (${session.email}) accessing accommodation data`);

  try {
    // Parse URL to get query parameters
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const dataType = searchParams.get('dataType');
    
    // Validate required parameters
    if (dataType === 'bookings' && (!year || !month)) {
      return NextResponse.json(
        { error: 'Year and month are required for bookings' }, 
        { status: 400 }
      );
    }

    // Fetch the requested data
    switch (dataType) {
      case 'staffHouses':
        const staffHouses = await getServerStaffHouses();
        return NextResponse.json({ staffHouses });
      
      case 'staffGuests':
        const staffGuests = await getServerStaffGuests();
        return NextResponse.json({ staffGuests });
      
      case 'bookings':
        const bookings = await getServerAccommodationBookings(
          parseInt(year as string), 
          parseInt(month as string)
        );
        return NextResponse.json({ bookings });
      
      case 'requests':
        let userId = searchParams.get('userId');
        
        // Role-based data filtering for requests
        const canViewAll = canViewAllData(session);
        const canViewDomain = canViewDomainData(session, 'accommodation');
        const canViewApprovals = canViewApprovalData(session, 'accommodation');
        
        if (canViewAll || canViewDomain) {
          // Even admins should respect explicit userId filtering (for personal request pages)
          if (!userId) {
            console.log(`API_ACCOMMODATION_GET: Admin/domain admin ${session.role} can view all requests`);
          } else {
            console.log(`API_ACCOMMODATION_GET: Admin/domain admin ${session.role} filtering by userId: ${userId}`);
          }
        } else if (canViewApprovals) {
          // Users with approval rights see their own requests + requests pending their approval
          const userIdentifier = getUserIdentifier(session);
          const statusesParam = searchParams.get('statuses');
          
          if (statusesParam) {
            // For approval queue - don't filter by user, show all requests with specified statuses
            console.log(`API_ACCOMMODATION_GET: User ${session.role} viewing approval queue with statuses: ${statusesParam}`);
          } else {
            // For regular listing - show only user's own requests
            userId = userIdentifier.userId;
            console.log(`API_ACCOMMODATION_GET: User ${session.role} viewing own requests (${userId})`);
          }
        } else {
          // Regular users can only see their own requests
          const userIdentifier = getUserIdentifier(session);
          userId = userIdentifier.userId;
          console.log(`API_ACCOMMODATION_GET: Regular user ${session.role} can only view their own requests (${userId})`);
        }
        
        // Parse statuses parameter if provided
        let statuses: string[] | undefined;
        const statusesParam = searchParams.get('statuses');
        if (statusesParam) {
          statuses = statusesParam.split(',').map(s => s.trim()).filter(Boolean);
          console.log(`API_ACCOMMODATION_GET: Filtering by statuses: ${statuses.join(', ')}`);
        }
        
        const requests = await getAccommodationRequests(userId || undefined, statuses);
        return NextResponse.json({ requests });
      
      default:
        return NextResponse.json(
          { error: 'Invalid data type requested' }, 
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in accommodation API route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accommodation data' }, 
      { status: 500 }
    );
  }
}));
