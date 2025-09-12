import { NextRequest, NextResponse } from 'next/server';
import { TransportService } from '@/lib/transport-service';
import { withAuth, getUserIdentifier } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';
import { shouldBypassUserFilter } from '@/lib/universal-user-matching';

export const GET = withAuth(async function(request: NextRequest) {
  const session = (request as any).user;
  
  // Check if user has permission to manage transport requests
  if (!hasPermission(session, 'manage_transport_requests') && !hasPermission(session, 'admin_all')) {
    return NextResponse.json({ error: 'Unauthorized - insufficient permissions for transport admin' }, { status: 403 });
  }

  console.log(`API_ADMIN_TRANSPORT_GET: Admin ${session.role} (${session.email}) accessing transport data`);

  try {
    const url = new URL(request.url);
    const statuses = url.searchParams.get('statuses');
    const fullDetails = url.searchParams.get('fullDetails') === 'true';
    
    // Apply universal user filtering - same pattern as main transport route
    const userIdentifier = await getUserIdentifier(session);
    let userId = userIdentifier.userId; // Default: filter by user
    
    console.log(`API_ADMIN_TRANSPORT_GET: Session details - role: ${session.role}, userId: ${userId}, email: ${session.email}`);
    console.log(`API_ADMIN_TRANSPORT_GET: User identifier details - staffId: ${userIdentifier.staffId}, name: ${session.name}, department: ${session.department}`);
    
    // Use the same shouldBypassUserFilter logic as main transport route for consistency
    if (shouldBypassUserFilter(session, statuses)) {
      console.log(`API_ADMIN_TRANSPORT_GET: Admin ${session.role} viewing approval queue - no user filter`);
      userId = null; // Admins viewing approval queue see all requests
    } else {
      console.log(`API_ADMIN_TRANSPORT_GET: User ${session.role} viewing own transport requests with strict filtering (${userId})`);
      // ALL users (including Transport Admins) see only their own requests on personal pages
      // Personal pages should never bypass user filtering regardless of role
    }
    
    // If specific statuses are requested, use the by-statuses method
    if (statuses) {
      const statusArray = statuses.split(',');
      
      if (fullDetails) {
        // For processing page - fetch full transport request details with user filtering
        const transportRequests = await TransportService.getTransportRequestsByStatuses(statusArray, undefined, userId);
        
        // Fetch full details for each request
        const fullTransportRequests = await Promise.all(
          transportRequests.map(async (req) => {
            return await TransportService.getTransportRequestById(req.id);
          })
        );
        
        return NextResponse.json(fullTransportRequests.filter(req => req !== null));
      } else {
        // For admin listing - fetch summary data with user filtering
        const transportRequests = await TransportService.getTransportRequestsByStatuses(statusArray, undefined, userId);
        return NextResponse.json(transportRequests);
      }
    }
    
    // Default behavior - return transport requests with proper user filtering
    console.log(`API_ADMIN_TRANSPORT_GET: Calling TransportService.getAllTransportRequests with userId: ${userId}`);
    const transportRequests = await TransportService.getAllTransportRequests(userId, session);
    
    return NextResponse.json(transportRequests);
  } catch (error) {
    console.error('Error fetching admin transport requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transport requests' },
      { status: 500 }
    );
  }
}); 