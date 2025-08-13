import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    console.log('DEBUG SESSION - Full session object:', JSON.stringify(session, null, 2));
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        error: 'Not authenticated',
        session: null
      }, { status: 401 });
    }

    // Fetch user from database to compare
    let dbUser = null;
    try {
      const users = await sql`
        SELECT 
          id, name, email, role_id, role, department, staff_id, status
        FROM users 
        WHERE id = ${session.user.id}
      `;
      dbUser = users[0] || null;
    } catch (dbError) {
      console.error('Error fetching user from DB:', dbError);
    }

    return NextResponse.json({
      session: {
        user: session.user,
        expires: session.expires
      },
      dbUser: dbUser,
      comparison: {
        sessionRole: session.user.role,
        dbRole: dbUser?.role,
        rolesMatch: session.user.role === dbUser?.role
      }
    });
  } catch (error: any) {
    console.error('Session debug error:', error);
    return NextResponse.json({ 
      error: 'Failed to check session',
      details: error.message 
    }, { status: 500 });
  }
}