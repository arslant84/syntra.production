import { NextRequest, NextResponse } from 'next/server';
import { TransportService } from '@/lib/transport-service';
import { withAuth, canViewAllData, canViewDomainData, getUserIdentifier } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';
import { sql } from '@/lib/db';
import { NotificationService } from '@/lib/notification-service';

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
      
      // Role-based data filtering
      const canViewAll = canViewAllData(session);
      const canViewTransport = canViewDomainData(session, 'transport');
      let userId = null;
      if (!canViewAll && !canViewTransport) {
        // Regular users can only see their own requests
        const userIdentifier = getUserIdentifier(session);
        userId = userIdentifier.userId;
        console.log(`API_TRANSPORT_GET: Regular user ${session.role} filtering for user ${userId}`);
      } else {
        console.log(`API_TRANSPORT_GET: Admin/domain admin ${session.role} can view all transport requests`);
      }
      
      if (fromDate && toDate) {
        allTransportRequests = await TransportService.getTransportRequestsByDateRange(
          new Date(fromDate), 
          new Date(toDate),
          userId
        );
      } else {
        allTransportRequests = await TransportService.getAllTransportRequests(userId);
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
    
    // Role-based data filtering
    const canViewAll = canViewAllData(session);
    const canViewTransport = canViewDomainData(session, 'transport');
    let userId = null;
    if (!canViewAll && !canViewTransport) {
      // Regular users can only see their own requests
      const userIdentifier = getUserIdentifier(session);
      userId = userIdentifier.userId;
      console.log(`API_TRANSPORT_GET: Regular user ${session.role} filtering for user ${userId}`);
    } else {
      console.log(`API_TRANSPORT_GET: Admin/domain admin ${session.role} can view all transport requests`);
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

    // For transport listing page, show transport requests based on role
    const transportRequests = await TransportService.getAllTransportRequests(userId);
    
    return NextResponse.json(transportRequests);
  } catch (error) {
    console.error('Error fetching transport requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transport requests' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async function(request: NextRequest) {
  try {
    const session = (request as any).user;
    
    // Session is already validated by withAuth middleware

    // Check if user has permission to create transport requests
    if (!hasPermission(session, 'create_transport_requests') && !hasPermission(session, 'create_trf')) {
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const userId = session.user.id || session.user.email;
    const requestData = { ...body, userId };
    
    const transportRequest = await TransportService.createTransportRequest(requestData);
    
    // Create notification for transport admin/approvers
    try {
      // Find transport admins and managers who need to approve
      const transportApprovers = await sql`
        SELECT u.id, u.name 
        FROM users u
        INNER JOIN role_permissions rp ON u.role_id = rp.role_id
        INNER JOIN permissions p ON rp.permission_id = p.id
        WHERE p.name IN ('manage_transport_requests', 'approve_transport_requests')
          AND u.status = 'Active'
      `;

      for (const approver of transportApprovers) {
        await NotificationService.createApprovalRequest({
          approverId: approver.id,
          requestorName: session.user.name || 'User',
          entityType: 'transport',
          entityId: transportRequest.id,
          entityTitle: `Transport Request`
        });
      }
      
      console.log(`Created approval notifications for transport request ${transportRequest.id}`);
    } catch (notificationError) {
      console.error(`Failed to create approval notifications for transport request:`, notificationError);
    }
    
    return NextResponse.json(transportRequest, { status: 201 });
  } catch (error) {
    console.error('Error creating transport request:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create transport request',
        details: error.message
      },
      { status: 500 }
    );
  }
}); 