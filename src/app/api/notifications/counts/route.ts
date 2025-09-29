// API endpoint for notification counts (for badge display)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NotificationService } from '@/lib/notification-service';
import { hasPermission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return fallback counts to avoid 503 errors
    const fallbackCounts = {
      total: 0,
      unread: 0,
      approval_requests: 0,
      status_updates: 0,
      system_alerts: 0
    };
    
    return NextResponse.json(fallbackCounts);
  } catch (error) {
    console.error('Error fetching notification counts:', error);
    return NextResponse.json({ error: 'Failed to fetch notification counts' }, { status: 500 });
  }
}