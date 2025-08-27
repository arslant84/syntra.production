import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserSession, getNavigationPermissions } from '@/lib/session-utils';
import { withCache, userCacheKey, CACHE_TTL } from '@/lib/cache';
import { rateLimit, RATE_LIMITS, getRateLimitIdentifier } from '@/lib/rate-limiter';

// Extract navigation generation logic for caching
function generateNavigationItems(session: any) {
  const permissions = getNavigationPermissions(session);
  const items = [];

  // Dashboard - Everyone gets this
  items.push({ 
    label: 'Dashboard', 
    href: '/', 
    icon: 'LayoutDashboard' 
  });

  // Main request modules - All authenticated users can create their own requests
  items.push({ 
    label: 'Travel Requests', 
    href: '/trf', 
    icon: 'FileText' 
  });
  items.push({ 
    label: 'Transport Requests', 
    href: '/transport', 
    icon: 'Truck' 
  });
  items.push({ 
    label: 'Visa Applications', 
    href: '/visa', 
    icon: 'FileText' 
  });
  items.push({ 
    label: 'Accommodation Requests', 
    href: '/accommodation', 
    icon: 'BedDouble' 
  });
  items.push({ 
    label: 'Expense Claims', 
    href: '/claims', 
    icon: 'FileText' 
  });

  // Reports - For users who can view reports
  if (permissions.canViewReports) {
    items.push({ 
      label: 'Reports', 
      href: '/reports', 
      icon: 'BarChart2' 
    });
  }

  // Role-specific admin menus
  if (permissions.canViewFlightsAdmin) {
    items.push({ 
      label: 'Flights Admin', 
      href: '/admin/flights', 
      icon: 'Plane' 
    });
  }

  if (permissions.canViewAccommodationAdmin) {
    items.push({ 
      label: 'Accommodation Admin', 
      href: '/admin/accommodation', 
      icon: 'BedDouble' 
    });
  }

  if (permissions.canViewVisaAdmin) {
    items.push({ 
      label: 'Visa Admin', 
      href: '/admin/visa', 
      icon: 'FileText' 
    });
  }

  if (permissions.canViewClaimsAdmin) {
    items.push({ 
      label: 'Claims Admin', 
      href: '/admin/claims', 
      icon: 'FileText' 
    });
  }

  if (permissions.canViewTransportAdmin) {
    items.push({ 
      label: 'Transport Admin', 
      href: '/admin/transport', 
      icon: 'Truck' 
    });
  }

  // Approvals - For approver roles
  if (permissions.canViewApprovals) {
    items.push({ 
      label: 'Approvals', 
      href: '/admin/approvals', 
      icon: 'CheckSquare' 
    });
  }

  // User Management - Admin only
  if (permissions.canViewUserManagement) {
    items.push({ 
      label: 'User Management', 
      href: '/admin/users', 
      icon: 'Users' 
    });
  }

  // System Settings - Admin only
  if (permissions.canViewSystemSettings) {
    items.push({ 
      label: 'System Settings', 
      href: '/admin/settings', 
      icon: 'Settings' 
    });
  }

  return items;
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = rateLimit(
      getRateLimitIdentifier(request),
      RATE_LIMITS.API_READ
    );
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', resetTime: rateLimitResult.resetTime },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
          }
        }
      );
    }

    const session = await getCurrentUserSession();
    if (!session) {
      // Return empty navigation for unauthenticated users
      return NextResponse.json([], {
        headers: {
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
        }
      });
    }

    // Cache navigation items per user
    const cacheKey = userCacheKey(session.id, 'navigation');
    const items = await withCache(
      cacheKey,
      () => generateNavigationItems(session),
      CACHE_TTL.USER_PERMISSIONS // 30 minutes cache
    );

    console.log(`Navigation items for role ${session.role}:`, items);
    return NextResponse.json(items, {
      headers: {
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
      }
    });
  } catch (error) {
    console.error('Navigation API error:', error);
    return NextResponse.json([], { status: 500 });
  }
}