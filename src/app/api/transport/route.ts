import { NextRequest, NextResponse } from 'next/server';
import { withAuth, canViewAllData, canViewDomainData } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { generateRequestFingerprint, checkAndMarkRequest, markRequestCompleted } from '@/lib/request-deduplication';
import { withCache, userCacheKey, CACHE_TTL } from '@/lib/cache';
import { TransportService } from '@/lib/transport-service';
import { shouldBypassUserFilter } from '@/lib/universal-user-matching';

export const GET = withAuth(async function(request: NextRequest) {
  try {
    const session = (request as any).user;
    const { searchParams } = new URL(request.url);
    const summary = searchParams.get('summary');
    const statusesToFetch = searchParams.get('statuses')?.split(',').map(s => s.trim()).filter(Boolean);

    // Use the same universal user filtering approach as TRF
    // Only bypass user filter if user has permission AND is viewing approval queue with specific statuses
    const shouldShowAllData = shouldBypassUserFilter(session, statusesToFetch ? statusesToFetch.join(',') : null);
    const userId = shouldShowAllData ? undefined : session.id;

    console.log('API_TRANSPORT_GET: shouldShowAllData:', shouldShowAllData, 'userId:', userId, 'role:', session.role);

    // Handle summary request for reports
    if (summary === 'true') {
      console.log('API_TRANSPORT_GET: Fetching transport summary data for reports');

      const year = searchParams.get('year') || new Date().getFullYear().toString();
      const fromDate = searchParams.get('fromDate');
      const toDate = searchParams.get('toDate');

      // Fetch transport requests
      let transportRequests;
      if (fromDate && toDate) {
        transportRequests = await TransportService.getTransportRequestsByDateRange(
          new Date(fromDate),
          new Date(toDate),
          userId,
          session
        );
      } else {
        transportRequests = await TransportService.getAllTransportRequests(
          userId,
          session
        );
      }

      // Group by month and count by status
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const statusByMonth = months.map((monthName, index) => ({
        month: monthName,
        pending: 0,
        approved: 0,
        rejected: 0
      }));

      transportRequests.forEach((request: any) => {
        const date = new Date(request.submittedAt);
        const monthIndex = date.getMonth();

        if (request.status.includes('Pending')) {
          statusByMonth[monthIndex].pending++;
        } else if (request.status.includes('Approved') || request.status === 'Completed') {
          statusByMonth[monthIndex].approved++;
        } else if (request.status.includes('Rejected')) {
          statusByMonth[monthIndex].rejected++;
        }
      });

      return NextResponse.json({ statusByMonth });
    }

    // Handle regular transport requests fetch
    console.log('API_TRANSPORT_GET: Fetching transport requests for user:', userId || 'all users');
    const transportRequests = await TransportService.getAllTransportRequests(
      userId,
      session
    );

    return NextResponse.json(transportRequests);
  } catch (error) {
    console.error('Error in transport API GET:', error);
    return NextResponse.json({ error: 'Failed to fetch transport data' }, { status: 500 });
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