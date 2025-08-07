import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { TransportService } from '@/lib/transport-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statuses = searchParams.get('statuses');
    const limit = searchParams.get('limit');
    
    // If statuses are specified, fetch all transport requests with those statuses (for approval queue)
    if (statuses) {
      const statusArray = statuses.split(',').map(s => s.trim());
      const transportRequests = await TransportService.getTransportRequestsByStatuses(statusArray, limit ? parseInt(limit) : undefined);
      return NextResponse.json({ transportRequests });
    }

    // Get user ID from session or user lookup
    const userId = session.user.id || session.user.email;
    const transportRequests = await TransportService.getTransportRequestsByUser(userId);
    
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

    const body = await request.json();
    const userId = session.user.id || session.user.email;
    const requestData = { ...body, userId };
    
    const transportRequest = await TransportService.createTransportRequest(requestData);
    
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