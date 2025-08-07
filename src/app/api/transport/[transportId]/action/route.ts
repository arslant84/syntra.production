import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { TransportService } from '@/lib/transport-service';

interface RouteParams {
  params: Promise<{
    transportId: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transportId } = await params;
    const body = await request.json();
    
    const { action, approverRole, approverName, comments } = body;
    
    // Validate required fields
    if (!action || !approverRole || !approverName) {
      return NextResponse.json(
        { error: 'Missing required fields: action, approverRole, approverName' },
        { status: 400 }
      );
    }
    
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }
    
    // Process the approval action
    const updatedTransportRequest = await TransportService.processApprovalAction(
      transportId,
      action,
      approverRole,
      approverName,
      comments
    );
    
    return NextResponse.json({ 
      transportRequest: updatedTransportRequest,
      message: `Transport request ${action === 'approve' ? 'approved' : 'rejected'} successfully`
    });
    
  } catch (error) {
    console.error('Error processing transport request action:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process approval action',
        details: error.message
      },
      { status: 500 }
    );
  }
}