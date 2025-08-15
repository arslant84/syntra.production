# RBAC Implementation Plan - Detailed Action Items

## Overview
This document provides step-by-step implementation instructions to transform the current "everyone sees everything" system into a proper role-based access control system where users only see relevant menus and their own requests.

## Implementation Phases

### 🚀 Phase 1: Core Infrastructure (Days 1-2)

#### 1.1 Enhanced Session Management
**File**: `src/lib/session-utils.ts` (Create new)
```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: string;
  roleId: string;
  permissions: string[];
}

export async function getCurrentUserSession(): Promise<UserSession | null> {
  const session = await getServerSession(authOptions);
  return session?.user ? {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    roleId: session.user.roleId,
    permissions: session.user.permissions || []
  } : null;
}

export async function requireAuth(): Promise<UserSession> {
  const session = await getCurrentUserSession();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}

export async function requirePermission(permission: string): Promise<UserSession> {
  const session = await requireAuth();
  if (!session.permissions.includes(permission)) {
    throw new Error('FORBIDDEN');
  }
  return session;
}

export async function requireRole(allowedRoles: string[]): Promise<UserSession> {
  const session = await requireAuth();
  if (!allowedRoles.includes(session.role)) {
    throw new Error('FORBIDDEN');
  }
  return session;
}
```

#### 1.2 Permission Checking Utilities
**File**: `src/lib/permission-utils.ts` (Create new)
```typescript
import { UserSession } from './session-utils';

export function hasPermission(session: UserSession | null, permission: string): boolean {
  if (!session) return false;
  return session.permissions.includes(permission);
}

export function hasAnyPermission(session: UserSession | null, permissions: string[]): boolean {
  if (!session) return false;
  return permissions.some(p => session.permissions.includes(p));
}

export function hasRole(session: UserSession | null, role: string): boolean {
  if (!session) return false;
  return session.role === role;
}

export function hasAnyRole(session: UserSession | null, roles: string[]): boolean {
  if (!session) return false;
  return roles.includes(session.role);
}

// Navigation permissions based on roles
export function getNavigationPermissions(role: string): {
  canViewAdminMenus: boolean;
  canViewApprovals: boolean;
  canViewReports: boolean;
  canViewUserManagement: boolean;
  canViewSystemSettings: boolean;
} {
  const adminRoles = ['System Administrator', 'admin'];
  const approverRoles = ['Department Focal', 'Line Manager', 'HOD', 'System Administrator'];
  const reportRoles = ['HOD', 'System Administrator', 'Requestor'];
  
  return {
    canViewAdminMenus: adminRoles.includes(role),
    canViewApprovals: approverRoles.includes(role),
    canViewReports: reportRoles.includes(role),
    canViewUserManagement: adminRoles.includes(role),
    canViewSystemSettings: adminRoles.includes(role)
  };
}
```

#### 1.3 API Route Protection Middleware
**File**: `src/lib/api-protection.ts` (Create new)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserSession } from './session-utils';

export function withAuth(handler: Function) {
  return async (request: NextRequest, ...args: any[]) => {
    try {
      const session = await getCurrentUserSession();
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      // Add session to request for handler use
      (request as any).user = session;
      return await handler(request, ...args);
    } catch (error) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }
  };
}

export function withPermission(permission: string) {
  return function(handler: Function) {
    return async (request: NextRequest, ...args: any[]) => {
      try {
        const session = await getCurrentUserSession();
        if (!session) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        if (!session.permissions.includes(permission)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        
        (request as any).user = session;
        return await handler(request, ...args);
      } catch (error) {
        return NextResponse.json({ error: 'Authorization failed' }, { status: 403 });
      }
    };
  };
}
```

### 🎯 Phase 2: Navigation Control (Days 2-3)

#### 2.1 Update Sidebar with Role-Based Filtering
**File**: `src/components/layout/Sidebar.tsx` (Modify existing)

Replace the static `initialNavItems` with:
```typescript
import { getCurrentUserSession } from '@/lib/session-utils';
import { getNavigationPermissions } from '@/lib/permission-utils';

// Remove the static initialNavItems array and replace with dynamic function
async function getNavItemsForUser(): Promise<NavItem[]> {
  const session = await getCurrentUserSession();
  if (!session) return [];

  const permissions = getNavigationPermissions(session.role);
  const items: NavItem[] = [];

  // Dashboard - Everyone gets this
  items.push({ label: 'Dashboard', href: '/', icon: LayoutDashboard });

  // Admin-only items
  if (permissions.canViewAdminMenus) {
    items.push(
      { label: 'Flights Admin', href: '/admin/flights', icon: Plane },
      { label: 'Accommodation Admin', href: '/admin/accommodation', icon: BedDouble },
      { label: 'Visa Admin', href: '/admin/visa', icon: FileText },
      { label: 'Claims Admin', href: '/admin/claims', icon: FileText },
    );
  }

  // Approvals - For approver roles
  if (permissions.canViewApprovals) {
    items.push({ label: 'Approvals', href: '/admin/approvals', icon: CheckSquare });
  }

  // User Management - Admin only
  if (permissions.canViewUserManagement) {
    items.push({ label: 'User Management', href: '/admin/users', icon: Users });
  }

  // System Settings - Admin only
  if (permissions.canViewSystemSettings) {
    items.push({ label: 'System Settings', href: '/admin/settings', icon: Settings });
  }

  return items;
}

// Update the component to use dynamic navigation
export default function AppSidebar() {
  const pathname = usePathname();
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [counts, setCounts] = useState<SidebarCounts>(initialCounts);
  const [isLoading, setIsLoading] = useState(true);

  // Load navigation items based on user role
  useEffect(() => {
    async function loadNavigation() {
      try {
        const items = await fetch('/api/navigation').then(r => r.json());
        setNavItems(items);
      } catch (error) {
        console.error('Failed to load navigation:', error);
      }
    }
    loadNavigation();
  }, []);

  // Rest of component remains the same...
}
```

#### 2.2 Create Navigation API Endpoint
**File**: `src/app/api/navigation/route.ts` (Create new)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserSession } from '@/lib/session-utils';
import { getNavigationPermissions } from '@/lib/permission-utils';

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentUserSession();
    if (!session) {
      return NextResponse.json([]);
    }

    const permissions = getNavigationPermissions(session.role);
    const items = [];

    // Dashboard - Everyone
    items.push({ label: 'Dashboard', href: '/', icon: 'LayoutDashboard' });

    // Admin menus
    if (permissions.canViewAdminMenus) {
      items.push(
        { label: 'Flights Admin', href: '/admin/flights', icon: 'Plane' },
        { label: 'Accommodation Admin', href: '/admin/accommodation', icon: 'BedDouble' },
        { label: 'Visa Admin', href: '/admin/visa', icon: 'FileText' },
        { label: 'Claims Admin', href: '/admin/claims', icon: 'FileText' },
      );
    }

    // Approvals
    if (permissions.canViewApprovals) {
      items.push({ label: 'Approvals', href: '/admin/approvals', icon: 'CheckSquare' });
    }

    // User Management
    if (permissions.canViewUserManagement) {
      items.push({ label: 'User Management', href: '/admin/users', icon: 'Users' });
    }

    // System Settings
    if (permissions.canViewSystemSettings) {
      items.push({ label: 'System Settings', href: '/admin/settings', icon: 'Settings' });
    }

    return NextResponse.json(items);
  } catch (error) {
    console.error('Navigation API error:', error);
    return NextResponse.json([], { status: 500 });
  }
}
```

#### 2.3 Update Header Navigation  
**File**: `src/components/layout/Header.tsx` (Modify existing)

Replace static `navItems` with role-based filtering:
```typescript
// Add at top of file
import { useSession } from 'next-auth/react';
import { hasPermission, getNavigationPermissions } from '@/lib/permission-utils';

export default function Header({ showDesktopLogo = true }: HeaderProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Filter navigation items based on user role
  const getFilteredNavItems = () => {
    if (!session?.user) return [];

    const permissions = getNavigationPermissions(session.user.role);
    const allNavItems = [
      { label: 'Home', href: '/', icon: Home },
      { label: 'TSR', href: '/trf', icon: FileText },
      { label: 'Transport', href: '/transport', icon: Truck },
      { label: 'Visa Applications', href: '/visa', icon: StickyNote },
      { label: 'Accommodation', href: '/accommodation', icon: BedDouble },
      { label: 'Claims', href: '/claims', icon: ReceiptText },
      { label: 'Reports', href: '/reports', icon: BarChart2 },
    ];

    // Filter based on permissions
    return allNavItems.filter(item => {
      // Everyone can see Home
      if (item.href === '/') return true;
      
      // Basic request creation - all users can see these
      if (['/trf', '/transport', '/visa', '/accommodation', '/claims'].includes(item.href)) {
        return true; // All users can create requests
      }
      
      // Reports - only certain roles
      if (item.href === '/reports') {
        return permissions.canViewReports;
      }
      
      return true;
    });
  };

  const navItems = getFilteredNavItems();
  
  // Rest of component remains the same but uses filtered navItems...
}
```

### 🔒 Phase 3: Data Access Control (Days 3-4)

#### 3.1 Update TRF API Route
**File**: `src/app/api/trf/route.ts` (Modify existing GET method)
```typescript
import { withAuth } from '@/lib/api-protection';
import { hasPermission } from '@/lib/permission-utils';

export const GET = withAuth(async function(request: NextRequest) {
  const user = (request as any).user;
  const { searchParams } = new URL(request.url);
  
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  // Role-based filtering
  if (!hasPermission(user, 'view_all_trf')) {
    // Regular users see only their own TRFs
    whereClause += ` AND requestor_id = $${paramIndex}`;
    params.push(user.id);
    paramIndex++;
  }

  // Add other filters (status, date range, etc.)
  const status = searchParams.get('status');
  if (status) {
    whereClause += ` AND status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  try {
    const query = `
      SELECT id, requestor_name, purpose, destination, status, 
             submitted_at, travel_type, estimated_cost
      FROM trf 
      ${whereClause}
      ORDER BY submitted_at DESC
    `;
    
    const trfs = await sql.unsafe(query, params);
    return NextResponse.json({ trfs });
  } catch (error) {
    console.error('Error fetching TRFs:', error);
    return NextResponse.json({ error: 'Failed to fetch TRFs' }, { status: 500 });
  }
});
```

#### 3.2 Update Claims API Route  
**File**: `src/app/api/claims/route.ts` (Modify existing)
```typescript
export const GET = withAuth(async function(request: NextRequest) {
  const user = (request as any).user;
  const { searchParams } = new URL(request.url);
  
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  // Role-based filtering - only admins and finance clerks see all claims
  if (!hasPermission(user, 'view_all_claims')) {
    whereClause += ` AND staff_no = $${paramIndex}`;
    params.push(user.staffId || user.id);
    paramIndex++;
  }

  // Rest similar to TRF implementation...
});
```

#### 3.3 Update All Other Listing Routes
Apply similar filtering to:
- `src/app/api/visa/route.ts`
- `src/app/api/accommodation/route.ts` 
- `src/app/api/transport/route.ts`

#### 3.4 Protect Admin Routes
**File**: `src/app/api/admin/users/route.ts` (Modify existing)
```typescript
import { withPermission } from '@/lib/api-protection';

export const GET = withPermission('manage_users')(async function(request: NextRequest) {
  // Only users with manage_users permission can access
  // Implementation remains the same
});
```

### 🛡️ Phase 4: Frontend Component Protection (Days 4-5)

#### 4.1 Create Protected Component Wrapper
**File**: `src/components/ProtectedComponent.tsx` (Create new)
```typescript
'use client';
import { useSession } from 'next-auth/react';
import { hasPermission, hasRole } from '@/lib/permission-utils';

interface ProtectedComponentProps {
  permissions?: string[];
  roles?: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function ProtectedComponent({ 
  permissions = [], 
  roles = [], 
  fallback = null, 
  children 
}: ProtectedComponentProps) {
  const { data: session } = useSession();
  
  if (!session?.user) {
    return <>{fallback}</>;
  }

  // Check permissions
  if (permissions.length > 0) {
    const hasRequiredPermission = permissions.some(permission => 
      hasPermission(session.user, permission)
    );
    if (!hasRequiredPermission) {
      return <>{fallback}</>;
    }
  }

  // Check roles
  if (roles.length > 0) {
    const hasRequiredRole = roles.some(role => 
      hasRole(session.user, role)
    );
    if (!hasRequiredRole) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}

// Specialized components for common use cases
export function AdminOnly({ children, fallback = null }: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode; 
}) {
  return (
    <ProtectedComponent roles={['System Administrator', 'admin']} fallback={fallback}>
      {children}
    </ProtectedComponent>
  );
}

export function ApproverOnly({ children, fallback = null }: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode; 
}) {
  return (
    <ProtectedComponent 
      roles={['Department Focal', 'Line Manager', 'HOD', 'System Administrator']} 
      fallback={fallback}
    >
      {children}
    </ProtectedComponent>
  );
}
```

#### 4.2 Update Listing Pages to Show Filtered Data
**File**: `src/app/trf/page.tsx` (Modify existing)

Add role-based messaging:
```tsx
import { ProtectedComponent } from '@/components/ProtectedComponent';
import { useSession } from 'next-auth/react';

export default function TRFPage() {
  const { data: session } = useSession();
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Travel Requests</h1>
        
        {/* Show role-specific messaging */}
        <ProtectedComponent permissions={['view_all_trf']}>
          <p className="text-sm text-muted-foreground">Viewing all requests</p>
        </ProtectedComponent>
        
        <ProtectedComponent 
          permissions={['view_all_trf']}
          fallback={
            <p className="text-sm text-muted-foreground">Viewing your requests only</p>
          }
        />
      </div>
      
      {/* Rest of component */}
    </div>
  );
}
```

#### 4.3 Create Role-Specific Dashboards
**File**: `src/app/page.tsx` (Modify existing)
```tsx
import { getCurrentUserSession } from '@/lib/session-utils';
import { AdminDashboard } from '@/components/dashboards/AdminDashboard';
import { ApproverDashboard } from '@/components/dashboards/ApproverDashboard';
import { RequestorDashboard } from '@/components/dashboards/RequestorDashboard';

export default async function HomePage() {
  const session = await getCurrentUserSession();
  
  if (!session) {
    return <div>Please log in</div>;
  }

  // Route to appropriate dashboard based on role
  switch (session.role) {
    case 'System Administrator':
    case 'admin':
      return <AdminDashboard />;
      
    case 'Department Focal':
    case 'Line Manager':
    case 'HOD':
      return <ApproverDashboard />;
      
    case 'Requestor':
    default:
      return <RequestorDashboard />;
  }
}
```

### 🚧 Phase 5: Route Protection (Day 5)

#### 5.1 Create Middleware for Route Protection
**File**: `src/middleware.ts` (Create new)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const { pathname } = request.nextUrl;

  // Protected admin routes
  if (pathname.startsWith('/admin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const adminRoles = ['System Administrator', 'admin'];
    const approverRoles = ['Department Focal', 'Line Manager', 'HOD', 'System Administrator'];
    
    // Check specific admin routes
    if (pathname.startsWith('/admin/users') || pathname.startsWith('/admin/settings')) {
      if (!adminRoles.includes(token.role as string)) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
    
    if (pathname.startsWith('/admin/approvals')) {
      if (!approverRoles.includes(token.role as string)) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
};
```

## Testing Plan

### 🧪 Test Scenarios

#### User Role Testing:
1. **Requestor User** (`requestor@syntra.com`):
   - ✅ Can see: Dashboard, TSR, Claims, Visa, Accommodation, Transport
   - ❌ Cannot see: Admin menus, Approvals, User Management, Settings
   - ✅ API access: Own requests only
   - ❌ API blocked: Admin endpoints, all requests

2. **Department Focal** (`focal@syntra.com`):
   - ✅ Can see: Dashboard, Approvals
   - ❌ Cannot see: Admin processing menus, User Management, Settings
   - ✅ API access: Approval queue, own requests
   - ❌ API blocked: Admin endpoints, other users' data

3. **HOD** (`hod@syntra.com`):
   - ✅ Can see: Dashboard, Approvals, Reports
   - ❌ Cannot see: Admin processing menus, User Management, Settings
   - ✅ API access: Department requests, reports
   - ❌ API blocked: User management endpoints

4. **System Administrator** (`admin@syntra.com`):
   - ✅ Can see: Everything (no change to current behavior)

### 🔍 Manual Testing Checklist:

#### Navigation Testing:
- [ ] Requestor sees only basic navigation
- [ ] Department Focal sees approvals menu
- [ ] HOD sees approvals and reports
- [ ] Admin sees all menus

#### Data Access Testing:
- [ ] Requestor API calls return only own data
- [ ] Approver API calls return relevant approval items
- [ ] Admin API calls return all data
- [ ] Unauthorized API calls return 403/401

#### Route Protection Testing:
- [ ] Direct URL access to `/admin/users` blocked for non-admins
- [ ] Direct URL access to `/admin/approvals` blocked for requestors
- [ ] Middleware redirects work correctly

## Deployment Strategy

### 🚀 Rollout Plan:

#### Stage 1: Infrastructure (No User Impact)
- Deploy session utilities
- Deploy permission utilities  
- Deploy API protection (disabled by feature flag)

#### Stage 2: Navigation Changes (Visible Changes)
- Enable role-based sidebar
- Enable role-based header navigation
- Monitor for issues

#### Stage 3: Data Protection (Security Changes)
- Enable API route protection
- Enable data filtering
- Monitor API responses

#### Stage 4: Full RBAC (Complete Implementation)
- Enable route protection middleware
- Enable all permission checks
- Full system testing

### 📊 Monitoring Plan:

#### Metrics to Track:
- API response times (ensure no performance impact)
- 401/403 error rates (track unauthorized access attempts)
- User session duration (ensure UX not impacted)
- Navigation usage patterns

#### Alerts to Set:
- High rate of 403 errors (potential permission issues)
- API failures after RBAC deployment
- User complaints about missing functionality

## Rollback Plan

### 🔄 Quick Rollback Options:

#### Feature Flags:
```typescript
// Environment variables for quick rollback
ENABLE_RBAC_NAVIGATION=true
ENABLE_RBAC_API_PROTECTION=true  
ENABLE_RBAC_DATA_FILTERING=true
ENABLE_RBAC_ROUTE_PROTECTION=true
```

#### Database Rollback:
- Permissions and roles can remain (no schema changes)
- Application falls back to "show all" behavior

#### Code Rollback:
- Keep original components as `*.backup.tsx`
- Quick swap if issues arise

---

## Summary

This implementation plan transforms your system from "everyone sees everything" to proper role-based access control:

- **Requestors** will only see relevant request forms and their own data
- **Approvers** will only see approval queues and relevant dashboards
- **Administrators** maintain full access
- **Security** is enforced at both UI and API levels
- **Performance** is maintained through efficient permission checking

**Total Estimated Effort**: 5-7 developer days
**Risk Level**: Medium (well-planned rollout with rollback options)
**Business Impact**: High (proper security and user experience)