import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { TransportService } from '@/lib/transport-service';
import { hasPermission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to manage transport requests (admin view)
    if (!await hasPermission('manage_transport_requests') && !await hasPermission('view_all_transport')) {
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    }

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
    console.error('Error fetching all transport requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transport requests' },
      { status: 500 }
    );
  }
} 