import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { TransportService } from '@/lib/transport-service';

interface RouteParams {
  params: {
    transportId: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transportId } = await params;
    const transportRequest = await TransportService.getTransportRequestById(transportId);
    
    if (!transportRequest) {
      return NextResponse.json({ error: 'Transport request not found' }, { status: 404 });
    }
    
    return NextResponse.json(transportRequest);
  } catch (error) {
    console.error('Error fetching transport request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transport request' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transportId } = await params;
    const body = await request.json();
    const userId = session.user.id || session.user.email;
    
    const transportRequest = await TransportService.updateTransportRequest(transportId, body, userId);
    
    return NextResponse.json(transportRequest);
  } catch (error) {
    console.error('Error updating transport request:', error);
    return NextResponse.json(
      { error: 'Failed to update transport request' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transportId } = await params;
    await TransportService.deleteTransportRequest(transportId);
    
    return NextResponse.json({ message: 'Transport request deleted successfully' });
  } catch (error) {
    console.error('Error deleting transport request:', error);
    return NextResponse.json(
      { error: 'Failed to delete transport request' },
      { status: 500 }
    );
  }
} 