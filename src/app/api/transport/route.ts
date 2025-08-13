import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { TransportService } from '@/lib/transport-service';
import { hasPermission } from '@/lib/permissions';
import { sql } from '@/lib/db';
import { NotificationService } from '@/lib/notification-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to view transport requests
    if (!await hasPermission('create_transport_requests') && !await hasPermission('manage_transport_requests') && !await hasPermission('view_all_transport')) {
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statuses = searchParams.get('statuses');
    const limit = searchParams.get('limit');
    const summary = searchParams.get('summary');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    if (summary === 'true') {
      let allTransportRequests;
      if (fromDate && toDate) {
        allTransportRequests = await TransportService.getTransportRequestsByDateRange(new Date(fromDate), new Date(toDate));
      } else {
        allTransportRequests = await TransportService.getAllTransportRequests();
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
    
    // If statuses are specified, fetch all transport requests with those statuses (for approval queue)
    if (statuses) {
      const statusArray = statuses.split(',').map(s => s.trim());
      const transportRequests = await TransportService.getTransportRequestsByStatuses(statusArray, limit ? parseInt(limit) : undefined);
      return NextResponse.json({ transportRequests });
    }

    // For transport listing page, show all transport requests
    // In the future, this could be filtered based on user role/permissions
    const transportRequests = await TransportService.getAllTransportRequests();
    
    return NextResponse.json(transportRequests);
  } catch (error) {
    console.error('Error fetching transport requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transport requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to create transport requests
    if (!await hasPermission('create_transport_requests')) {
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
} 