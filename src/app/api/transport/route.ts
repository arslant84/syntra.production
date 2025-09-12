import { NextRequest, NextResponse } from 'next/server';
import { TransportService } from '@/lib/transport-service';
import { withAuth, canViewAllData, canViewDomainData, canViewApprovalData, getUserIdentifier } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';
import { sql } from '@/lib/db';
import { NotificationService } from '@/lib/notification-service';
import { shouldBypassUserFilter } from '@/lib/universal-user-matching';
import { withCache, userCacheKey, CACHE_TTL } from '@/lib/cache';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { generateRequestFingerprint, checkAndMarkRequest, markRequestCompleted } from '@/lib/request-deduplication';

export const GET = withAuth(async function(request: NextRequest) {
  try {
    const session = (request as any).user;

    // Role-based access control - authenticated users can access transport requests (they'll see filtered data based on role)
    console.log(`API_TRANSPORT_GET: User ${session.role} (${session.email}) accessing transport data`);

    const { searchParams } = new URL(request.url);
    const statuses = searchParams.get('statuses');
    const limit = searchParams.get('limit');
    const summary = searchParams.get('summary');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    if (summary === 'true') {
      let allTransportRequests;
      
      // Universal filtering for summary - same as main logic
      const userIdentifier = await getUserIdentifier(session);
      let userId = userIdentifier.userId; // Default: filter by user
      
      // Summary pages are personal views, so never bypass user filtering regardless of role
      console.log(`API_TRANSPORT_GET: User ${session.role} viewing own transport summary with strict filtering`);
      // ALL users (including System Administrators) see only their own requests in summary
      
      if (fromDate && toDate) {
        allTransportRequests = await TransportService.getTransportRequestsByDateRange(
          new Date(fromDate), 
          new Date(toDate),
          userId,
          session
        );
      } else {
        allTransportRequests = await TransportService.getAllTransportRequests(userId, session);
      }

      const statusByMonth: { [key: string]: { month: string; pending: number; approved: number; rejected: number } } = {};

      allTransportRequests.forEach((request) => {
        const month = new Date(request.submittedAt).toLocaleString('default', { month: 'short' });
        if (!statusByMonth[month]) {
          statusByMonth[month] = { month, pending: 0, approved: 0, rejected: 0 };
        }
        if (request.status.includes('Pending')) {
          statusByMonth[month].pending++;
        } else if (request.status.includes('Approved')) {
          statusByMonth[month].approved++;
        } else if (request.status.includes('Rejected')) {
          statusByMonth[month].rejected++;
        }
      });

      const sortedMonths = Object.values(statusByMonth).sort((a, b) => {
        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
      });

      return NextResponse.json({ statusByMonth: sortedMonths });
    }
    
    // Universal user filtering system - same as TSR API
    const userIdentifier = await getUserIdentifier(session);
    let userId = userIdentifier.userId; // Default: always filter by user
    
    console.log(`API_TRANSPORT_GET: Session details - role: ${session.role}, userId: ${userId}, email: ${session.email}`);
    console.log(`API_TRANSPORT_GET: User identifier details - staffId: ${userIdentifier.staffId}, name: ${session.name}, department: ${session.department}`);
    
    // Use the same shouldBypassUserFilter logic as TSR API for consistency
    if (shouldBypassUserFilter(session, statuses)) {
      console.log(`API_TRANSPORT_GET: Admin ${session.role} viewing approval queue - no user filter`);
      userId = null; // Admins viewing approval queue see all requests
    } else {
      console.log(`API_TRANSPORT_GET: User ${session.role} viewing own transport requests with strict filtering (${userId})`);
      // ALL users (including System Administrators) see only their own requests on personal pages
      // Personal pages should never bypass user filtering regardless of role
    }
    
    // If statuses are specified, fetch all transport requests with those statuses (for approval queue)
    if (statuses) {
      const statusArray = statuses.split(',').map(s => s.trim());
      const transportRequests = await TransportService.getTransportRequestsByStatuses(
        statusArray, 
        limit ? parseInt(limit) : undefined,
        userId
      );
      return NextResponse.json({ transportRequests });
    }

    // For transport listing page, show transport requests based on role with caching
    console.log(`API_TRANSPORT_GET: Calling TransportService.getAllTransportRequests with userId: ${userId}`);
    
    // Use different cache keys for personal vs admin views to prevent cross-contamination
    const cacheKey = userId 
      ? userCacheKey(userId, 'transport-requests-personal')
      : userCacheKey('admin', 'transport-requests-admin');
    
    const transportRequests = await withCache(
      cacheKey,
      () => TransportService.getAllTransportRequests(userId, session),
      CACHE_TTL.USER_REQUESTS
    );
    
    return NextResponse.json(transportRequests);
  } catch (error) {
    console.error('Error fetching transport requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transport requests' },
      { status: 500 }
    );
  }
});

export const POST = withRateLimit(RATE_LIMITS.API_WRITE)(withAuth(async function(request: NextRequest) {
  let requestFingerprint: string | undefined;
  
  try {
    const session = (request as any).user;
    
    // Session is already validated by withAuth middleware

    // Check if user has permission to create transport requests
    if (!hasPermission(session, 'create_transport_requests') && !hasPermission(session, 'create_trf')) {
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    
    // Check for duplicate submission using request deduplication
    requestFingerprint = generateRequestFingerprint(
      session.id,
      'transport_submission',
      {
        requestorName: body.requestorName,
        pickupLocation: body.pickupLocation,
        destination: body.destination,
        travelDate: body.travelDate,
        travelTime: body.travelTime
      }
    );

    const deduplicationResult = checkAndMarkRequest(requestFingerprint, 30000); // 30 seconds TTL
    if (deduplicationResult.isDuplicate) {
      console.warn(`API_TRANSPORT_POST_DUPLICATE: Duplicate transport submission detected for user ${session.id}. Time remaining: ${deduplicationResult.timeRemaining}s`);
      return NextResponse.json({ 
        error: 'Duplicate submission detected', 
        message: `Please wait ${deduplicationResult.timeRemaining} seconds before submitting again.`,
        details: 'You recently submitted a similar transport request. To prevent duplicates, please wait before trying again.'
      }, { status: 429 });
    }
    const userId = session.id || session.email;
    
    // Ensure proper user identification - use session data for critical fields
    const requestData = { 
      ...body, 
      userId,
      // Override form data with session data to ensure correct user association
      staffId: session.staffId || session.id || body.staffId,
      requestorName: session.name || body.requestorName,
      department: session.department || body.department
    };
    
    console.log('🚗 TRANSPORT_API: Creating transport request via TransportService...');
    const transportRequest = await TransportService.createTransportRequest(requestData);
    console.log(`✅ TRANSPORT_API: Transport request created with ID: ${transportRequest.id}`);
    
    // Clear relevant caches to ensure fresh data
    const { clearUserCache } = require('@/lib/cache');
    clearUserCache(userId, 'transport-requests-personal');
    clearUserCache(userId, 'sidebar-counts');
    
    // Mark deduplication request as completed (successful submission)
    if (requestFingerprint) {
      markRequestCompleted(requestFingerprint);
    }
    
    // Note: Notifications are handled within TransportService.createTransportRequest
    
    return NextResponse.json(transportRequest, { status: 201 });
  } catch (error) {
    // Clean up deduplication on error
    if (requestFingerprint) {
      markRequestCompleted(requestFingerprint);
    }
    
    console.error('Error creating transport request:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create transport request',
        details: error.message
      },
      { status: 500 }
    );
  }
})); 