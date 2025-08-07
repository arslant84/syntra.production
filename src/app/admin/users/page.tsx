// src/app/admin/users/page.tsx
"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader as AlertDialogPageHeader, AlertDialogTitle as AlertDialogPageTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"; 
import { Users, PlusCircle, ShieldCheck, Edit3, UserX, UserCheckIcon, Loader2, AlertTriangle, Trash2, ListFilter, X, ArrowUpDown } from "lucide-react";
import type { User } from '@/types';
import type { RoleWithPermissions } from '@/types/roles';
import { format, isValid, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import AddUserForm, { type UserFormValues, NULL_ROLE_VALUE } from '@/components/admin/users/AddUserForm';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useDebounce } from '@/hooks/use-debounce';

const ALL_ROLES_VALUE = "__ALL_ROLES__";
const ALL_STATUSES_VALUE = "__ALL_STATUSES__";

const formatDateSafe = (dateInput: string | Date | null | undefined, includeTimeVal = false) => {
  if (!dateInput) return 'N/A';
  const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
  if (!isValid(date)) {
    return 'N/A';
  }
  try {
    return includeTimeVal ? format(date, 'yyyy-MM-dd hh:mm a') : format(date, 'yyyy-MM-dd');
  } catch (error) {
    return 'N/A (Format Error)';
  }
};

type SortConfig = {
  key: keyof User | 'roleName' | 'lastLogin' | null;
  direction: 'ascending' | 'descending' | null;
};

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [isUpdating, startUpdateTransition] = useTransition();

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const [availableRoles, setAvailableRoles] = useState<RoleWithPermissions[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const usersPerPage = 10;

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [roleFilter, setRoleFilter] = useState<string>(ALL_ROLES_VALUE);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES_VALUE);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });
  
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  // Function to implement retry logic for API calls
  const fetchWithRetry = async (url: string, options = {}, retries = 3, delay = 1000) => {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (err) {
      if (retries <= 1) throw err;
      
      // Wait for the specified delay
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Retry with one less retry attempt and increased delay (exponential backoff)
      console.log(`Retrying fetch to ${url}, ${retries-1} attempts left`);
      return fetchWithRetry(url, options, retries - 1, delay * 1.5);
    }
  };

  const fetchAvailableRoles = useCallback(async () => {
    console.log("CLIENT_FETCH_ROLES: Fetching available roles...");
    try {
      // Use the retry-enabled fetch function
      const response = await fetchWithRetry('/api/roles');
      
      if (!response.ok) {
        let errorDetails = `Failed to fetch roles: ${response.status}`;
        try {
            const errorData = await response.json();
            errorDetails = errorData.details || errorData.error || errorDetails;
        } catch (e) { /* Ignore if parsing fails, use status */ }
        throw new Error(errorDetails);
      }
      
      const data = await response.json();
      console.log("CLIENT_FETCH_ROLES: Fetched roles:", data.roles);
      setAvailableRoles(data.roles || []);
    } catch (err: any) {
      console.error("CLIENT_FETCH_ROLES: Error fetching available roles:", err);
      toast({ 
        title: "Error Fetching Roles", 
        description: "Network error occurred. Please try again later.", 
        variant: "destructive" 
      });
      setAvailableRoles([]);
    }
  }, [toast]);

  const fetchUsers = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(usersPerPage),
    });
    if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
    if (roleFilter !== ALL_ROLES_VALUE) params.append('role', roleFilter);
    if (statusFilter !== ALL_STATUSES_VALUE) params.append('status', statusFilter);
    if (sortConfig.key && sortConfig.direction) {
      params.append('sortBy', String(sortConfig.key));
      params.append('sortOrder', sortConfig.direction);
    }
    console.log(`CLIENT_FETCH_USERS: Fetching users with params: ${params.toString()}`);
    try {
      const response = await fetch(`/api/users?${params.toString()}`);
      if (!response.ok) {
        const responseText = await response.text();
        let message = `Server error ${response.status}: ${response.statusText || 'Status text not available'}.`;
        try {
            const errorJson = JSON.parse(responseText);
            message = errorJson.details || errorJson.error || errorJson.message || message;
        } catch (e) {
            message += ` Raw response: ${responseText.substring(0,200)}...`;
        }
        throw new Error(message);
      }
      const data = await response.json();
      console.log("CLIENT_FETCH_USERS: Fetched data:", data);
      setUsers(data.users || []);
      setTotalUsers(data.totalCount || 0);
      setTotalPages(data.totalPages || 1);
      setCurrentPage(data.currentPage || 1);
    } catch (err: any) {
      console.error("CLIENT_FETCH_USERS: Error fetching users:", err);
      setError(err.message || "An unknown error occurred while fetching users.");
      setUsers([]); setTotalUsers(0); setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearchTerm, roleFilter, statusFilter, sortConfig, usersPerPage]);

  useEffect(() => { fetchAvailableRoles(); }, [fetchAvailableRoles]);
  useEffect(() => { fetchUsers(currentPage); }, [currentPage, fetchUsers]); // fetchUsers as dependency
  useEffect(() => {
    if (currentPage !== 1) setCurrentPage(1);
    else fetchUsers(1); 
  }, [debouncedSearchTerm, roleFilter, statusFilter, sortConfig]); // Removed fetchUsers from here

  const handleOpenAddModal = () => { setEditingUser(null); setIsUserModalOpen(true); };
  const handleOpenEditModal = (user: User) => {
    console.log("User passed to edit modal:", user);
    if (!availableRoles || availableRoles.length === 0) {
      alert("Roles are still loading. Please wait and try again.");
      return;
    }
    setEditingUser(user);
    setIsUserModalOpen(true);
  };
  const handleCloseUserModal = () => { setIsUserModalOpen(false); setEditingUser(null); };

  const handleUserFormSubmit = useCallback(async (formData: UserFormValues): Promise<void> => {
    const isEditMode = !!editingUser;
    const endpoint = isEditMode ? `/api/users/${editingUser!.id}` : '/api/users';
    const method = isEditMode ? 'PATCH' : 'POST';
    console.log(`CLIENT_SUBMIT_USER (UserManagementPage / ${isEditMode ? 'edit' : 'add'}): Submitting to ${endpoint} with method ${method}. Data:`, formData);
    try {
        const response = await fetch(endpoint, {
            method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData),
            credentials: 'include',
        });
        if (!response.ok) {
            let errorMessage = `Server error ${response.status}`;
            let errorDetails = undefined;
            try {
                const data = await response.json();
                errorMessage = data?.error || data?.message || data?.details || errorMessage;
                errorDetails = data?.details;
            } catch (e) {
                try {
                    const text = await response.text();
                    if (text) errorMessage += `: ${text}`;
                } catch {}
            }
            // Pass both message and details
            throw { message: errorMessage, details: errorDetails };
        }
        let result;
        try {
            result = await response.json();
        } catch {
            throw new Error("Server error: Invalid response from server.");
        }
        toast({ title: `User ${isEditMode ? 'Updated' : 'Created'}!`, description: `User "${result.user?.name || formData.name}" ${isEditMode ? 'updated' : 'created'}.` });
        fetchUsers(isEditMode ? currentPage : 1); // Refresh current page on edit, go to first on add
        handleCloseUserModal();
    } catch (error) {
        console.error(`Error in handleUserFormSubmit (UserManagementPage / ${isEditMode ? 'edit' : 'add'}) before re-throw:`, error);
        let errorToThrow = error;
        if (error && typeof error === 'object' && !Object.keys(error).length && error.constructor === Object) {
             errorToThrow = new Error("An unspecified error occurred. Server may be down or sent an empty error response.");
        } else if (!(error instanceof Error) && !(error && ((error as any).details || (error as any).error || (error as any).message))) {
            const originalErrorStr = typeof error === 'string' ? error : JSON.stringify(error);
            errorToThrow = new Error(`An unexpected error occurred: ${originalErrorStr.substring(0, 100)}`);
        }
        throw errorToThrow; // This will be caught by AddUserForm's handleSubmit
    }
  }, [editingUser, fetchUsers, toast, currentPage]);

  const handleRoleChange = async (userId: string, newRoleId: string | null) => {
    startUpdateTransition(async () => {
      try {
        const response = await fetch(`/api/users/${userId}/role`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role_id: newRoleId }),
          credentials: 'include',
        });
        if (!response.ok) {
          const responseText = await response.text(); let errorDetails = `Failed to update role: ${response.status}.`;
          try { const errorJson = JSON.parse(responseText); errorDetails = errorJson.details || errorJson.error || errorDetails; } catch (e) { errorDetails += ` Server: ${responseText.substring(0,100)}...`;}
          throw new Error(errorDetails);
        }
        const updatedUserResponse = await response.json();
        setUsers(prevUsers => prevUsers.map(u => u.id === userId ? { ...u, role_id: updatedUserResponse.user.role_id, roleName: updatedUserResponse.user.roleName } : u));
        toast({ title: "User Role Updated", description: `Role for user ${updatedUserResponse.user.name} changed to ${updatedUserResponse.user.roleName || 'No Role'}.` });
      } catch (err: any) {
        toast({ title: "Error Updating Role", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleToggleUserStatus = async (user: User) => {
    startUpdateTransition(async () => {
      const newStatus = user.status === "Active" ? "Inactive" : "Active";
      try {
        const response = await fetch(`/api/users/${user.id}/status`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }),
          credentials: 'include',
        });
        if (!response.ok) {
          const responseText = await response.text(); let errorDetails = `Failed to update status: ${response.status}.`;
          try { const errorJson = JSON.parse(responseText); errorDetails = errorJson.details || errorJson.error || errorDetails; } catch (e) { errorDetails += ` Server: ${responseText.substring(0,100)}...`;}
          throw new Error(errorDetails);
        }
        const updatedUserResponse = await response.json();
        setUsers(prevUsers => prevUsers.map(u => u.id === user.id ? { ...u, status: updatedUserResponse.user.status } : u));
        toast({ title: "User Status Updated", description: `${user.name}'s status changed to ${newStatus}.` });
      } catch (err: any) {
        toast({ title: "Error Updating Status", description: err.message, variant: "destructive" });
      }
    });
  };

  const confirmDeleteUser = (user: User) => { setUserToDelete(user); setIsDeleteDialogOpen(true); };
  const handleDeleteUser = async () => {
    if (!userToDelete || !userToDelete.id) return;
    startUpdateTransition(async () => {
      try {
        const response = await fetch(`/api/users/${userToDelete.id!}`, { method: 'DELETE', credentials: 'include' });
        if (!response.ok) {
          const responseText = await response.text(); let errorDetails = `Failed to delete user: ${response.status}.`;
          try { const errorJson = JSON.parse(responseText); errorDetails = errorJson.details || errorJson.error || errorDetails; } catch (e) { errorDetails += ` Server: ${responseText.substring(0,100)}...`;}
          throw new Error(errorDetails);
        }
        toast({ title: "User Deleted", description: `User ${userToDelete.name} has been deleted.` });
        fetchUsers(currentPage); // Re-fetch to update list and pagination
      } catch (err: any) {
        toast({ title: "Error Deleting User", description: err.message, variant: "destructive" });
      } finally {
        setIsDeleteDialogOpen(false); setUserToDelete(null);
      }
    });
  };
  
  const handleSort = (key: SortConfig['key']) => {
    if (!key) return;
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') { direction = 'descending'; }
    if (currentPage !== 1) setCurrentPage(1);
    setSortConfig({ key, direction });
  };

  const SortableHeader: React.FC<{ columnKey: SortConfig['key']; label: string; className?: string }> = ({ columnKey, label, className }) => (
    <TableHead className={className}>
      <Button variant="ghost" onClick={() => handleSort(columnKey)} className="px-1 hover:bg-muted/80">
        {label}
        {sortConfig.key === columnKey && (<ArrowUpDown className={`ml-2 h-3 w-3 ${sortConfig.direction === 'descending' ? 'rotate-180' : ''}`} />)}
      </Button>
    </TableHead>
  );
  
  const handleClearFilters = () => {
    setSearchTerm(""); setRoleFilter(ALL_ROLES_VALUE); setStatusFilter(ALL_STATUSES_VALUE);
    setSortConfig({ key: 'name', direction: 'ascending' });
    if (currentPage !== 1) setCurrentPage(1); else fetchUsers(1);
  };
  const hasActiveFilters = searchTerm !== "" || roleFilter !== ALL_ROLES_VALUE || statusFilter !== ALL_STATUSES_VALUE;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Users className="w-8 h-8 text-primary" />User Management</h1>
          <p className="text-muted-foreground">Manage system users. Add, Edit, Delete, Role, and Status operations.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={handleOpenAddModal} disabled={isUpdating} className="w-full sm:w-auto"><PlusCircle className="mr-2 h-4 w-4" /> Add New User</Button>
          <Button variant="outline" asChild className="w-full sm:w-auto"><Link href="/admin/settings"><ShieldCheck className="mr-2 h-4 w-4" /> Manage Roles</Link></Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Filter & Search Users</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <Input placeholder="Search by Name, Email, Staff ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="lg:col-span-2"/>
            <Select value={roleFilter} onValueChange={setRoleFilter} disabled={availableRoles.length === 0 && roleFilter === ALL_ROLES_VALUE}>
                <SelectTrigger className="text-left"><ListFilter className="mr-2 h-4 w-4" /> <SelectValue placeholder="Filter by Role" /></SelectTrigger>
                <SelectContent><SelectItem value={ALL_ROLES_VALUE}>All Roles</SelectItem>{availableRoles.map(role => (<SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>))}</SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><ListFilter className="mr-2 h-4 w-4" /> <SelectValue placeholder="Filter by Status" /></SelectTrigger>
                <SelectContent><SelectItem value={ALL_STATUSES_VALUE}>All Statuses</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent>
            </Select>
        </CardContent>
        {hasActiveFilters && (<CardContent className="pt-0"><Button variant="outline" size="sm" onClick={handleClearFilters} className="text-xs"><X className="mr-1.5 h-3 w-3"/> Clear All Filters</Button></CardContent>)}
      </Card>
      <Card>
        <CardHeader><CardTitle>User List</CardTitle><CardDescription>Displaying {users.length} of {totalUsers} users.{isLoading && <Loader2 className="h-4 w-4 animate-spin inline-block ml-2" />}</CardDescription></CardHeader>
        <CardContent>
          {isLoading && users.length === 0 && (<div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading users...</p></div>)}
          {error && !isLoading && (<Alert variant="destructive" className="mb-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error Fetching Users</AlertTitle><AlertDescription>{error}</AlertDescription><Button onClick={() => { fetchUsers(); fetchAvailableRoles(); }} className="mt-2" size="sm" disabled={isLoading}>Try Again</Button></Alert>)}
          {!isLoading && !error && users.length === 0 && (<div className="flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-lg"><Users className="w-12 h-12 text-muted-foreground mb-3" /><p className="text-muted-foreground">{totalUsers === 0 ? "No users found in the database." : "No users found matching your criteria."}</p>{hasActiveFilters && <Button variant="link" onClick={handleClearFilters} className="mt-2">Clear Filters</Button>}</div>)}
          {!isLoading && !error && users.length > 0 && (<div className="overflow-x-auto"><Table>
              <TableHeader><TableRow>
                  <SortableHeader columnKey="staff_id" label="Staff ID" /><SortableHeader columnKey="name" label="Name" /><SortableHeader columnKey="email" label="Email" />
                  <SortableHeader columnKey="roleName" label="Role (Assigned)" /><SortableHeader columnKey="department" label="Department" />
                  <SortableHeader columnKey="status" label="Status" /><SortableHeader columnKey="lastLogin" label="Last Login" />
                  <TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>{users.map((user) => (<TableRow key={user.id} className={isUpdating ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{user.staff_id || 'N/A'}</TableCell><TableCell>{user.name}</TableCell><TableCell>{user.email || 'N/A'}</TableCell>
                    <TableCell>
                       <Select value={user.role_id ?? NULL_ROLE_VALUE} onValueChange={(newRoleId) => handleRoleChange(user.id!, newRoleId === NULL_ROLE_VALUE ? null : newRoleId)} disabled={isUpdating || availableRoles.length === 0} >
                        <SelectTrigger className="h-8 text-xs w-[150px] text-left">
                            <SelectValue placeholder="Select role">
                               {user.roleName || (user.role_id && availableRoles.find(r => r.id === user.role_id)?.name) || "No Role"}
                               {user.role_id && !availableRoles.find(r => r.id === user.role_id) && user.roleName && (<span className="italic text-muted-foreground">({user.roleName} - Not in list)</span>)}
                               {user.role_id && !availableRoles.find(r => r.id === user.role_id) && !user.roleName && (<span className="italic text-muted-foreground">(ID: {user.role_id.substring(0,8)}...)</span>)}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent><SelectItem value={NULL_ROLE_VALUE}>No Role</SelectItem>{availableRoles.map((roleOption) => (<SelectItem key={roleOption.id} value={roleOption.id!}>{roleOption.name}</SelectItem>))}</SelectContent>
                       </Select>
                    </TableCell>
                    <TableCell>{user.department || 'N/A'}</TableCell>
                    <TableCell><span className={`px-2 py-1 text-xs rounded-full ${user.status === "Active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{user.status}</span></TableCell>
                    <TableCell>{isClient ? formatDateSafe(user.lastLogin, true) : 'N/A'}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditModal(user)} disabled={isUpdating}><Edit3 className="h-4 w-4" /><span className="sr-only">Edit User</span></Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleToggleUserStatus(user)} disabled={isUpdating}>{user.status === "Active" ? <UserX className="h-4 w-4 text-destructive" /> : <UserCheckIcon className="h-4 w-4 text-green-600" />}<span className="sr-only">{user.status === "Active" ? "Deactivate" : "Activate"} User</span></Button>
                       <AlertDialog open={isDeleteDialogOpen && userToDelete?.id === user.id} onOpenChange={(open) => { if(!open) { setIsDeleteDialogOpen(false); setUserToDelete(null); }}}>
                        <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => confirmDeleteUser(user)} disabled={isUpdating}><Trash2 className="h-4 w-4" /><span className="sr-only">Delete User</span></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogPageHeader><AlertDialogPageTitle>Are you sure you want to delete this user?</AlertDialogPageTitle><AlertDialogDescription>This action cannot be undone. User "{userToDelete?.name}" will be removed.</AlertDialogDescription></AlertDialogPageHeader>
                          <AlertDialogFooter><AlertDialogCancel onClick={() => {setIsDeleteDialogOpen(false); setUserToDelete(null);}} disabled={isUpdating}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteUser} disabled={isUpdating} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isUpdating && userToDelete?.id === user.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Delete User</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                       </AlertDialog>
                    </TableCell>
                  </TableRow>))}</TableBody>
            </Table></div>)}
          {!isLoading && !error && users.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-end space-x-2 py-4">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage <= 1 || isLoading}>Previous</Button>
              <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages || isLoading}>Next</Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={isUserModalOpen} onOpenChange={handleCloseUserModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>{editingUser ? `Edit User: ${editingUser.name}` : "Add New User"}</DialogTitle><DialogDescription>{editingUser ? `Update the details for ${editingUser.name}.` : "Fill in the details below to add a new user."}</DialogDescription></DialogHeader>
          <AddUserForm onFormSubmit={handleUserFormSubmit} onCancel={handleCloseUserModal} editingUser={editingUser} availableRoles={availableRoles} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
