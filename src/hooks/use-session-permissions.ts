"use client";

import { useSession } from "next-auth/react";

/**
 * Client-side hook to get user session and permissions
 * This replaces server-side permission functions for client components
 */
export function useSessionPermissions() {
  const { data: session, status } = useSession();
  
  const user = session?.user;
  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";
  
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    
    // Admin roles have all permissions
    if (user.role === 'System Administrator' || user.role === 'Admin') {
      return true;
    }
    
    return user.permissions?.includes(permission) || false;
  };
  
  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!user) return false;
    
    // Admin roles have all permissions
    if (user.role === 'System Administrator' || user.role === 'Admin') {
      return true;
    }
    
    return permissions.some(permission => user.permissions?.includes(permission) || false);
  };
  
  const hasRole = (role: string): boolean => {
    return user?.role === role;
  };
  
  const hasAnyRole = (roles: string[]): boolean => {
    return user?.role ? roles.includes(user.role) : false;
  };
  
  // Role-based checks
  const isSystemAdmin = hasRole('System Administrator') || hasRole('Admin');
  const isApprover = hasAnyRole(['Department Focal', 'Line Manager', 'HOD', 'System Administrator', 'Admin']);
  
  return {
    user,
    isLoading,
    isAuthenticated,
    hasPermission,
    hasAnyPermission,
    hasRole,
    hasAnyRole,
    isSystemAdmin,
    isApprover,
    role: user?.role || null,
    permissions: user?.permissions || [],
    userId: user?.id || null,
    email: user?.email || null,
    name: user?.name || null
  };
}