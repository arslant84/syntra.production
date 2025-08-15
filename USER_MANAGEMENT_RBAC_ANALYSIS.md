# User Management & RBAC Analysis Report

## Executive Summary
Based on comprehensive analysis of the database schema, frontend/backend code, and user management system, several critical issues prevent proper role-based access control implementation. This report outlines key findings and provides a detailed mitigation plan.

## Current Database Structure Analysis

### ✅ Well-Structured Components
- **Users table**: Properly designed with role assignments
- **Roles table**: 11 roles defined with clear descriptions  
- **Permissions table**: 33 fine-grained permissions
- **Role-Permissions mapping**: Properly normalized relationship

### 🔴 Critical Issues Identified

#### 1. **No Menu/Navigation Role-Based Filtering**
**Issue**: All users see identical navigation menus regardless of role
- Sidebar shows all admin links (Flights Admin, Claims Admin, etc.) to all users
- Header navigation shows all sections to all users
- Requestor users can navigate to admin-only pages

**Current Code Location**: 
- `src/components/layout/Sidebar.tsx:26-35` - Static navigation items
- `src/components/layout/Header.tsx:14-22` - Static header navigation

#### 2. **No Request Visibility Filtering**
**Issue**: Users see all requests instead of only their own
- All listing pages (`/trf`, `/claims`, `/visa`, etc.) show all records
- No user-specific filtering in API endpoints
- Violates data privacy and role separation

**Current Code Location**:
- All listing page API routes lack user filtering
- Frontend components don't implement role-based data access

#### 3. **Missing RBAC Middleware**  
**Issue**: API endpoints lack proper role-based access control
- No middleware to check permissions before route execution
- Authentication exists but authorization is missing
- Users can potentially access any API endpoint

#### 4. **Inactive Permission System**
**Issue**: Permissions exist in database but not enforced in code
- 33 permissions defined but not used in frontend/backend
- `src/lib/rbac-utils.ts` exists but not integrated
- No permission checks in components or API routes

#### 5. **Session Management Issues**
**Issue**: Role information not properly propagated to frontend
- NextAuth session contains role data but components don't use it
- No client-side role checking utilities
- Components hardcoded for admin access

## Database Roles & Permissions Mapping

### Current User Distribution:
```sql
-- System Administrator: 3 users (full access)
-- Requestor: 1 user (should see limited interface)  
-- Department Focal: 1 user (approval interface only)
```

### Permission Matrix Analysis:
| Role | Key Permissions | Current UI Access | Should Have |
|------|----------------|------------------|-------------|
| **Requestor** | create_trf, create_claims, create_transport_requests | Full admin UI ❌ | Request forms only ✅ |
| **Department Focal** | approve_trf_focal, approve_claims_focal | Full admin UI ❌ | Approvals queue only ✅ |
| **Line Manager** | approve_trf_manager, approve_claims_manager | Full admin UI ❌ | Approvals queue only ✅ |
| **HOD** | approve_trf_hod, approve_claims_hod, view_all_* | Full admin UI ❌ | Approvals + Reports ✅ |
| **System Admin** | All permissions | Full admin UI ✅ | Full admin UI ✅ |

## Security Vulnerabilities

### 🚨 High Risk Issues:
1. **Data Exposure**: Requestors can view all users' requests
2. **Privilege Escalation**: Non-admin users can access admin functions  
3. **Information Leakage**: Sensitive admin data visible to all roles
4. **Unauthorized Actions**: API endpoints accessible without permission checks

### 🔶 Medium Risk Issues:
1. **UI Confusion**: Users see interfaces they cannot/should not use
2. **Performance Impact**: Loading unnecessary data for users
3. **Audit Trail**: No tracking of unauthorized access attempts

## Detailed Implementation Plan

### Phase 1: Core RBAC Infrastructure (Day 1-2)

#### 1.1 Update Session Management
```typescript
// src/lib/auth.ts - Enhanced session utilities
export async function getServerSession(): Promise<SessionData | null>
export async function requireRole(allowedRoles: string[]): Promise<SessionData>
export async function requirePermission(permissions: string[]): Promise<SessionData>
```

#### 1.2 Create Route Protection Middleware
```typescript
// src/middleware.ts - Route-level protection
export function middleware(request: NextRequest) {
  // Check routes against user roles
  // Redirect unauthorized users
}
```

#### 1.3 API Route Protection
```typescript
// src/lib/api-auth.ts - API endpoint protection
export function withAuth(handler: NextApiHandler, options: AuthOptions)
export function withPermissions(handler: NextApiHandler, permissions: string[])
```

### Phase 2: Navigation & Menu Control (Day 2-3)

#### 2.1 Dynamic Sidebar Implementation
**File**: `src/components/layout/Sidebar.tsx`
```typescript
// Replace static navigation with role-based menu
const navItems = await getRoleBasedNavigation();

// Role-specific menu mapping:
// Requestor: Dashboard, TSR, Claims, Visa, Accommodation, Transport
// Department Focal: Dashboard, Approvals
// Line Manager: Dashboard, Approvals  
// HOD: Dashboard, Approvals, Reports, User Management
// Admin: All menus
```

#### 2.2 Dynamic Header Navigation  
**File**: `src/components/layout/Header.tsx`
```typescript
// Filter header navigation based on role
const allowedNavItems = filterNavigationByRole(navItems, userRole);
```

### Phase 3: Data Access Control (Day 3-4)

#### 3.1 API Route Filtering
**Files**: All `/api/*` routes

**Example for TRF listing**:
```typescript
// src/app/api/trf/route.ts
export async function GET(request: NextRequest) {
  const user = await requireAuth();
  
  let query = 'SELECT * FROM trf WHERE 1=1';
  
  if (!hasPermission(user, 'view_all_trf')) {
    // Requestors see only their own
    query += ' AND requestor_id = $1';
    params = [user.id];
  }
  
  return sql`${query}`;
}
```

#### 3.2 Frontend Component Protection
```typescript
// src/components/ProtectedComponent.tsx
export function ProtectedComponent({ 
  requiredPermissions = [],
  requiredRoles = [],
  fallback = null,
  children 
}) {
  const session = useSession();
  const hasAccess = checkPermissions(session, requiredPermissions, requiredRoles);
  
  return hasAccess ? children : fallback;
}
```

### Phase 4: Permission-Based Features (Day 4-5)

#### 4.1 Conditional UI Elements
```tsx
// Example: Approval buttons only for approvers
<ProtectedComponent requiredPermissions={['approve_trf_hod']}>
  <ApprovalButtons />
</ProtectedComponent>

// Example: Admin-only user management link
<ProtectedComponent requiredPermissions={['manage_users']}>
  <Link href="/admin/users">User Management</Link>
</ProtectedComponent>
```

#### 4.2 Role-Specific Dashboards
```tsx
// src/app/page.tsx - Dynamic dashboard based on role
export default function Dashboard() {
  const session = useSession();
  
  if (hasPermission(session, 'view_all_trf')) {
    return <AdminDashboard />;
  } else if (hasPermission(session, 'approve_trf_focal')) {
    return <ApproverDashboard />;
  } else {
    return <RequestorDashboard />;
  }
}
```

## Role-Specific UI Requirements

### 🎯 Requestor Interface
**Should See**:
- Dashboard (own requests summary)
- Create TSR, Claims, Visa, Accommodation, Transport
- View own requests only
- Profile management

**Should NOT See**:
- Admin menus (Flights Admin, Claims Admin, etc.)
- Other users' requests  
- Approval interfaces
- User management
- System settings

### 🎯 Department Focal Interface  
**Should See**:
- Dashboard (pending approvals summary)
- Unified Approval Queue
- Own requests (if they are also requestors)
- Profile management

**Should NOT See**:
- Admin processing interfaces
- Other departments' requests (unless department-wide permission)
- User management
- System settings

### 🎯 HOD Interface
**Should See**:
- Dashboard (department overview)
- Unified Approval Queue  
- Reports section
- All department requests
- Profile management

**Should NOT See**:
- Processing interfaces (Flights Admin, etc.)
- User management (unless has permission)

### 🎯 System Administrator Interface
**Should See**: Everything (current interface is correct)

## Implementation Priority Matrix

| Priority | Component | Effort | Impact | Security Risk |
|----------|-----------|---------|--------|---------------|
| **P0** | API Route Protection | High | High | Critical |
| **P0** | Navigation Filtering | Medium | High | High |
| **P0** | Data Access Control | High | High | Critical |
| **P1** | Permission Components | Medium | Medium | Medium |
| **P1** | Role-based Dashboards | Low | Medium | Low |
| **P2** | UI/UX Improvements | Low | Low | Low |

## Testing Strategy

### Unit Tests Required:
- Permission checking utilities
- Role-based navigation filters
- Session management functions

### Integration Tests Required:
- API route protection with different roles
- Navigation rendering for each role
- Data filtering for different user types

### User Acceptance Testing:
1. **Requestor User**: Can only see own requests, cannot access admin functions
2. **Department Focal**: Can see approval queue, cannot see other departments
3. **HOD**: Can see reports and department-wide data
4. **System Admin**: Full access maintained

## Security Considerations

### Authentication vs Authorization:
- ✅ Authentication: Working (NextAuth + database)
- ❌ Authorization: Missing (needs implementation)

### Data Protection:
- Implement row-level security for sensitive data
- Add audit logging for permission changes
- Rate limiting on API endpoints
- Input validation on all user inputs

## Performance Considerations

### Database Optimization:
- Add indexes on frequently queried role/permission fields
- Cache user permissions to reduce database hits
- Implement session-based permission caching

### Frontend Optimization:
- Lazy load role-specific components
- Minimize re-renders when checking permissions
- Pre-fetch allowed navigation items

## Migration Strategy

### Backward Compatibility:
- Phase rollout to avoid breaking current functionality
- Feature flags for gradual enablement
- Fallback to current behavior if RBAC fails

### Deployment Plan:
1. Deploy infrastructure changes (middleware, utilities)
2. Enable navigation filtering
3. Enable API protection
4. Enable data filtering
5. Full RBAC enforcement

---

**Next Steps**: Review this analysis, approve the implementation plan, and begin Phase 1 development.

**Estimated Total Effort**: 5-7 developer days
**Risk Level**: Medium (well-planned rollout)
**Business Impact**: High (proper security and user experience)