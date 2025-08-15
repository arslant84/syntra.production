# Role-Based Access Control (RBAC) Implementation Completion Guide

## Overview
This document outlines the remaining tasks needed to complete the comprehensive RBAC implementation for the SynTra system. The foundation has been established with role definitions, permission utilities, and approval queue filtering.

## Current Status
✅ **Completed:**
- Role definitions and constants in `src/lib/rbac-utils.ts`
- User permission utilities in `src/lib/permissions.ts` and `src/lib/auth-utils.ts`
- Approval queue role-based filtering in `src/app/admin/approvals/page.tsx`
- Claims approval workflow fixes

## Remaining Implementation Tasks

### 1. Complete Sidebar Menu Role-Based Filtering
**Status:** Pending  
**Location:** Main navigation components

**Task:** Implement role-based sidebar menu visibility using `getRoleBasedNavigation()` function.

**Files to update:**
- `src/components/ui/sidebar.tsx` or main navigation component
- Apply `ROLE_SIDEBAR_ACCESS` mapping from `rbac-utils.ts`

**Code pattern:**
```typescript
import { getRoleBasedNavigation } from '@/lib/rbac-utils';

// In navigation component
const { leftSidebar } = await getRoleBasedNavigation();
const showAdminMenus = leftSidebar.includes('All menus');
const showApprovals = leftSidebar.includes('Approvals menu');
```

### 2. Implement Own-Request-Only Visibility
**Status:** Pending  
**Location:** All listing pages

**Files to update:**
- `src/app/trf/page.tsx`
- `src/app/claims/page.tsx` 
- `src/app/visa/page.tsx`
- `src/app/accommodation/page.tsx`
- `src/app/transport/page.tsx`

**Implementation:** Use `filterRequestsByUserRole()` function to filter results based on user role.

**Code pattern:**
```typescript
import { filterRequestsByUserRole } from '@/lib/rbac-utils';

// In API routes or server components
const requests = await sql`SELECT * FROM table_name`;
const filteredRequests = await filterRequestsByUserRole(requests);
```

### 3. Role-Specific Notification Filtering
**Status:** Pending  
**Location:** Notification system

**Files to update:**
- `src/lib/notification-service.ts` (if exists)
- Notification-related API endpoints
- Main notification display component

**Implementation:** Use `shouldReceiveNotification()` function to determine notification visibility.

**Code pattern:**
```typescript
import { shouldReceiveNotification } from '@/lib/rbac-utils';

const shouldNotify = await shouldReceiveNotification(
  entityType, 
  entityId, 
  'approval_needed', 
  entityOwnerId
);
```

### 4. Role-Based Action Permissions
**Status:** Pending  
**Location:** Action buttons and form submissions

**Implementation:** Use `canPerformAction()` function to control button visibility and API access.

**Files to update:**
- All view pages with action buttons
- API routes with role-specific actions

**Code pattern:**
```typescript
import { canPerformAction } from '@/lib/rbac-utils';

const canProcess = await canPerformAction('process_claims', 'claim');
const canApprove = await canPerformAction('approve_tsr', 'trf');
```

### 5. Update Top Navigation Role Access
**Status:** Pending  
**Location:** Main navigation header

**Implementation:** Use `getRoleBasedNavigation()` to filter top navigation items.

**Code pattern:**
```typescript
const { topNavbar, hasReports } = await getRoleBasernaalNavigationone();
// Show/hide Reports menu based on hasReports
// Filter topNavbar items
```

## Role Definitions Reference

### Roles and Their Access:
```typescript
ACCOMMODATION_ADMIN: 'Accomodation Admin' -> Accommodation admin sidebar
TICKETING_ADMIN: 'Ticketing Admin' -> Flights admin sidebar  
TRANSPORT_ADMIN: 'Transport Admin' -> Transport admin sidebar
VISA_CLERK: 'Visa Clerk' -> Visa admin sidebar
FINANCE_CLERK: 'Finance Clerk' -> Claims admin sidebar
DEPARTMENT_FOCAL: 'Department Focal' -> Approvals menu sidebar
LINE_MANAGER: 'Line Manager' -> Approvals menu sidebar
HOD: 'HOD' -> Approvals menu sidebar + Reports access
REQUESTOR: 'Requestor' -> Basic access + Reports access
ADMIN: 'Admin' -> All menus + All permissions
SYSTEM_ADMINISTRATOR: 'System Administrator' -> All menus + All permissions
```

### Approval Queue Status Filtering:
- **Department Focal:** 'Pending Department Focal'
- **Line Manager:** 'Pending Line Manager', 'Pending Line Manager/HOD'
- **HOD:** 'Pending HOD', 'Pending HOD Approval', 'Pending Line Manager/HOD'
- **Finance Clerk:** 'Pending Finance Approval'
- **Visa Clerk:** 'Pending Visa Clerk'
- **Admin/System Admin:** All pending statuses

## Testing Checklist

### Role-Based Visibility Testing:
- [ ] Regular users see only their own requests
- [ ] Admin roles see all requests
- [ ] Sidebar menus appear correctly for each role
- [ ] Action buttons are hidden/shown based on permissions
- [ ] Approval queues show correct items for each role
- [ ] Notifications are filtered by role relevance

### Integration Testing:
- [ ] Database queries respect role filtering
- [ ] API endpoints check role permissions
- [ ] UI components handle missing permissions gracefully
- [ ] Session management works with role changes

## Deployment Considerations

### Database Updates:
- Ensure user roles are properly set in the database
- Verify role-permission mappings are correctly established
- Test with sample users for each role type

### Environment Variables:
- No additional environment variables required
- RBAC functions use existing session management

### Performance Impact:
- Role checks add minimal overhead
- Database queries remain efficient with proper indexing
- Consider caching role information for frequently accessed users

## Security Notes

- All role checks are server-side for security
- Client-side role checks are for UI only, not security
- API endpoints must validate permissions independently
- Session tampering protection remains important

## Completion Timeline

**Estimated effort:** 2-3 days
1. **Day 1:** Implement sidebar filtering and own-request visibility
2. **Day 2:** Add notification filtering and action permissions  
3. **Day 3:** Testing, bug fixes, and final integration

## Support Files Available

- `src/lib/rbac-utils.ts` - Complete role and permission utilities
- `src/lib/permissions.ts` - User session permission checks
- `src/lib/auth-utils.ts` - Authentication helpers
- This guide provides all necessary implementation patterns

---

*Generated as part of RBAC implementation completion for SynTra system*