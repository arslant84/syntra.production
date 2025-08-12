// Test authentication endpoint
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth, createAuthError } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    // Test authentication
    const user = await requireAuth();
    
    return NextResponse.json({
      message: 'Authentication successful!',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (error: any) {
    // Handle authentication errors
    if (error.message === 'UNAUTHORIZED') {
      const authError = createAuthError('UNAUTHORIZED');
      return NextResponse.json({ 
        error: authError.message,
        authenticated: false 
      }, { status: authError.status });
    }
    
    return NextResponse.json({ 
      error: 'Authentication test failed',
      authenticated: false 
    }, { status: 500 });
  }
}