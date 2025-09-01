import { NextRequest, NextResponse } from 'next/server';
import { TransportService } from '@/lib/transport-service';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';

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
    
    // If specific statuses are requested, use the by-statuses method
    if (statuses) {
      const statusArray = statuses.split(',');
      
      if (fullDetails) {
        // For processing page - fetch full transport request details
        const transportRequests = await TransportService.getTransportRequestsByStatuses(statusArray);
        
        // Fetch full details for each request
        const fullTransportRequests = await Promise.all(
          transportRequests.map(async (req) => {
            return await TransportService.getTransportRequestById(req.id);
          })
        );
        
        return NextResponse.json(fullTransportRequests.filter(req => req !== null));
      } else {
        // For admin listing - fetch summary data
        const transportRequests = await TransportService.getTransportRequestsByStatuses(statusArray);
        return NextResponse.json(transportRequests);
      }
    }
    
    // Default behavior - return all transport requests summary
    const transportRequests = await TransportService.getAllTransportRequests();
    
    return NextResponse.json(transportRequests);
  } catch (error) {
    console.error('Error fetching admin transport requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transport requests' },
      { status: 500 }
    );
  }
}); 