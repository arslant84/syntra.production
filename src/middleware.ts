// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PUBLIC_PATHS = ['/login', '/api/auth', '/_next', '/favicon.ico'];

// Role-based access control configuration
const ROLE_ACCESS_RULES = {
  // Admin-only routes
  adminOnly: ['/admin/users', '/admin/settings'],
  
  // Approver routes (Department Focal, Line Manager, HOD, Admin)
  approverRoutes: ['/admin/approvals'],
  
  // Specialist admin routes
  flightsAdmin: ['/admin/flights'],
  accommodationAdmin: ['/admin/accommodation'], 
  visaAdmin: ['/admin/visa'],
  claimsAdmin: ['/admin/claims'],
  transportAdmin: ['/admin/transport'],
  
  // Reports access
  reportsAccess: ['/reports'],
  
  // Role definitions - Updated to match database roles exactly
  roles: {
    admin: ['System Administrator', 'Admin'],
    approver: ['Department Focal', 'Line Manager', 'HOD', 'System Administrator', 'Admin'],
    flightsAdmin: ['Ticketing Admin', 'Flight Admin', 'System Administrator', 'Admin'],
    accommodationAdmin: ['Accommodation Admin', 'System Administrator', 'Admin'],
    visaAdmin: ['Visa Clerk', 'System Administrator', 'Admin'],
    claimsAdmin: ['Finance Clerk', 'System Administrator', 'Admin'],
    transportAdmin: ['Transport Admin', 'System Administrator', 'Admin'],
    reportsAccess: ['HOD', 'System Administrator', 'Admin', 'Requestor'],
  }
};

function hasRoleAccess(userRole: string, allowedRoles: string[]): boolean {
  return allowedRoles.includes(userRole);
}

function checkRouteAccess(pathname: string, userRole: string): boolean {
  // Check admin-only routes
  if (ROLE_ACCESS_RULES.adminOnly.some(route => pathname.startsWith(route))) {
    return hasRoleAccess(userRole, ROLE_ACCESS_RULES.roles.admin);
  }
  
  // Check approver routes
  if (ROLE_ACCESS_RULES.approverRoutes.some(route => pathname.startsWith(route))) {
    return hasRoleAccess(userRole, ROLE_ACCESS_RULES.roles.approver);
  }
  
  // Check specialist admin routes
  if (ROLE_ACCESS_RULES.flightsAdmin.some(route => pathname.startsWith(route))) {
    return hasRoleAccess(userRole, ROLE_ACCESS_RULES.roles.flightsAdmin);
  }
  
  if (ROLE_ACCESS_RULES.accommodationAdmin.some(route => pathname.startsWith(route))) {
    return hasRoleAccess(userRole, ROLE_ACCESS_RULES.roles.accommodationAdmin);
  }
  
  if (ROLE_ACCESS_RULES.visaAdmin.some(route => pathname.startsWith(route))) {
    return hasRoleAccess(userRole, ROLE_ACCESS_RULES.roles.visaAdmin);
  }
  
  if (ROLE_ACCESS_RULES.claimsAdmin.some(route => pathname.startsWith(route))) {
    return hasRoleAccess(userRole, ROLE_ACCESS_RULES.roles.claimsAdmin);
  }
  
  if (ROLE_ACCESS_RULES.transportAdmin.some(route => pathname.startsWith(route))) {
    return hasRoleAccess(userRole, ROLE_ACCESS_RULES.roles.transportAdmin);
  }
  
  // Check reports access
  if (ROLE_ACCESS_RULES.reportsAccess.some(route => pathname.startsWith(route))) {
    return hasRoleAccess(userRole, ROLE_ACCESS_RULES.roles.reportsAccess);
  }
  
  // All other routes are accessible to authenticated users
  return true;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for valid JWT token
  try {
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    });
    
    // Redirect to login if no valid token
    if (!token) {
      console.log(`Middleware: No valid token for path ${pathname}, redirecting to login`);
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Check if token is expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (token.exp && typeof token.exp === 'number' && currentTime > token.exp) {
      console.log(`Middleware: Token expired for path ${pathname}, redirecting to login`);
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Role-based route protection
    const userRole = token.role as string;
    console.log(`Middleware: Checking access to ${pathname} for user ${token.email} with role ${userRole}`);
    
    if (!checkRouteAccess(pathname, userRole)) {
      console.log(`Middleware: Access denied to ${pathname} for role ${userRole}`);
      // Redirect to home page with error message
      const homeUrl = new URL('/', request.url);
      homeUrl.searchParams.set('error', 'access_denied');
      return NextResponse.redirect(homeUrl);
    }

    // Add user info to headers for downstream use
    const response = NextResponse.next();
    response.headers.set('x-user-id', token.uid as string || token.sub as string);
    response.headers.set('x-user-email', token.email as string);
    response.headers.set('x-user-role', userRole);
    
    console.log(`Middleware: Access granted to ${pathname} for role ${userRole}`);
    return response;
    
  } catch (error) {
    console.error('Middleware: Error validating token:', error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    // Match all routes except:
    // - /login
    // - /api/auth/*
    // - /_next/*
    // - /favicon.ico
    '/((?!login|api/auth|_next|favicon.ico).*)',
  ],
};
