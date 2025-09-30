import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserSession, getNavigationPermissions } from '@/lib/session-utils';

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
    // Get the current user session to determine navigation permissions
    const session = await getCurrentUserSession();

    if (!session) {
      // Return basic navigation for unauthenticated users
      const basicNavigation = [
        { label: 'Dashboard', href: '/', icon: 'LayoutDashboard' }
      ];
      console.log('Navigation API: No session, returning basic navigation');
      return NextResponse.json(basicNavigation);
    }

    // Generate navigation items based on user permissions
    const navigationItems = generateNavigationItems(session);

    console.log('Navigation API: Returning permission-based navigation for user:', session.email, 'role:', session.role);
    console.log('Navigation API: User permissions:', session.permissions);
    console.log('Navigation API: Generated navigation items:', navigationItems.map(item => item.label));

    return NextResponse.json(navigationItems);
  } catch (error) {
    console.error('Navigation API error:', error);
    // Return basic navigation as fallback
    const fallbackNavigation = [
      { label: 'Dashboard', href: '/', icon: 'LayoutDashboard' },
      { label: 'Travel Requests', href: '/trf', icon: 'FileText' },
      { label: 'Transport Requests', href: '/transport', icon: 'Truck' },
      { label: 'Visa Applications', href: '/visa', icon: 'FileText' },
      { label: 'Accommodation Requests', href: '/accommodation', icon: 'BedDouble' },
      { label: 'Expense Claims', href: '/claims', icon: 'FileText' }
    ];
    return NextResponse.json(fallbackNavigation);
  }
}