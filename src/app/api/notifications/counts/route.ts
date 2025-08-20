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

    // Check if user has permission to view notification counts
    // Temporarily disabled to debug HOD notification issue
    // if (!await hasPermission('view_sidebar_counts')) {
    //   return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    // }

    const counts = await NotificationService.getNotificationCounts(session.user.id);
    
    return NextResponse.json(counts);
  } catch (error) {
    console.error('Error fetching notification counts:', error);
    return NextResponse.json({ error: 'Failed to fetch notification counts' }, { status: 500 });
  }
}