import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { hasPermission } from '@/lib/permissions';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ 
        error: 'Not authenticated',
        session: null
      }, { status: 401 });
    }
    
    // Check specific visa permissions
    const canProcessVisa = await hasPermission('process_visa_applications');
    const canViewVisa = await hasPermission('view_visa_applications');
    
    return NextResponse.json({
      debug: {
        sessionExists: !!session,
        userId: session.user.id,
        userRole: session.user.role,
        userName: session.user.name,
        userEmail: session.user.email,
        staffId: session.user.staff_id,
        permissions: session.user.permissions || [],
        canProcessVisa,
        canViewVisa,
        sessionData: JSON.stringify(session.user, null, 2)
      }
    });
  } catch (error) {
    console.error('Debug permissions error:', error);
    return NextResponse.json({ 
      error: 'Debug failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}