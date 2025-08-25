import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/session-utils';

export const GET = withAuth(async function(request: NextRequest) {
  const session = (request as any).user;
  
  console.log('Debug - Session:', JSON.stringify(session, null, 2));
  
  const permissions = {
    approve_accommodation_requests: hasPermission(session, 'approve_accommodation_requests'),
    manage_accommodation_bookings: hasPermission(session, 'manage_accommodation_bookings'),
    manage_accommodation_locations: hasPermission(session, 'manage_accommodation_locations'),
  };
  
  console.log('Debug - Permissions:', permissions);
  
  return NextResponse.json({ 
    message: 'Session debug endpoint working',
    session: { 
      email: session.email, 
      role: session.role,
      name: session.name,
      permissions: session.permissions 
    }, 
    permissions,
    timestamp: new Date().toISOString()
  });
});