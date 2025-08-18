import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { sql } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    console.log('User details API - Session:', session);
    
    if (!session?.user?.email) {
      console.log('User details API - No session or email');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Users can always view their own profile, admins can view any profile
    if (!await hasPermission('manage_own_profile') && !await hasPermission('view_profiles')) {
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    }

    console.log('User details API - Looking for user with email:', session.user.email);

    // Get user details from database
    const users = await sql`
      SELECT 
        users.id, users.name, users.email, users.department, users.staff_id, 
        users.role_id, roles.name AS role_name
      FROM users
      LEFT JOIN roles ON users.role_id = roles.id
      WHERE users.email = ${session.user.email}
      LIMIT 1
    `;

    console.log('User details API - Users found:', users);

    if (users.length === 0) {
      console.log('User details API - No user found with email:', session.user.email);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[0];
    
    const response = {
      requestorName: user.name,
      staffId: user.staff_id,
      department: user.department,
      // Position is not available in users table, will be left empty for manual entry if needed
      position: user.role_name || null
    };

    console.log('User details API - Returning response:', response);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching user details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user details', details: error.message },
      { status: 500 }
    );
  }
}