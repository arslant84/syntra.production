import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    console.log('DEBUG LOGIN - Attempting login for:', email);
    
    if (!email || !password) {
      return NextResponse.json({ 
        error: 'Email and password required',
        success: false 
      }, { status: 400 });
    }

    // Fetch user from DB
    const users = await sql`
      SELECT id, name, email, password, role_id, role, status
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `;
    
    console.log('DEBUG LOGIN - User query result:', users.length > 0 ? 'User found' : 'User not found');
    
    if (!users.length) {
      return NextResponse.json({ 
        error: 'User not found',
        success: false,
        debug: { userExists: false }
      });
    }
    
    const user = users[0];
    console.log('DEBUG LOGIN - User data:', {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      hasPassword: !!user.password,
      passwordLength: user.password?.length || 0
    });
    
    // Check if user is active
    if (user.status !== 'Active') {
      return NextResponse.json({ 
        error: 'User account is not active',
        success: false,
        debug: { userStatus: user.status }
      });
    }
    
    // Check password using bcrypt
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('DEBUG LOGIN - Password validation result:', isValidPassword);
    
    return NextResponse.json({
      success: isValidPassword,
      debug: {
        userExists: true,
        userStatus: user.status,
        passwordMatch: isValidPassword,
        userRole: user.role,
        userId: user.id
      }
    });
    
  } catch (error: any) {
    console.error('DEBUG LOGIN - Error:', error);
    return NextResponse.json({ 
      error: 'Login debug failed',
      details: error.message,
      success: false
    }, { status: 500 });
  }
}