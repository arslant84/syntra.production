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
    // Return basic navigation items without session dependency for now
    const basicNavigation = [
      { label: 'Dashboard', href: '/', icon: 'LayoutDashboard' },
      { label: 'Travel Requests', href: '/trf', icon: 'FileText' },
      { label: 'Transport Requests', href: '/transport', icon: 'Truck' },
      { label: 'Visa Applications', href: '/visa', icon: 'FileText' },
      { label: 'Accommodation Requests', href: '/accommodation', icon: 'BedDouble' },
      { label: 'Expense Claims', href: '/claims', icon: 'FileText' }
    ];

    console.log('Navigation API: Returning basic navigation items');
    return NextResponse.json(basicNavigation);
  } catch (error) {
    console.error('Navigation API error:', error);
    return NextResponse.json([], { status: 500 });
  }
}