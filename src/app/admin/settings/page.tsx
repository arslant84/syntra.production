// src/app/admin/settings/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle as DialogPageTitle, 
  DialogDescription as DialogPageDescription, DialogFooter, DialogTrigger, DialogClose 
} from "@/components/ui/dialog";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter as AlertDialogModalFooter, 
  AlertDialogHeader as AlertDialogPageHeader, AlertDialogTitle as AlertDialogPageTitle 
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, ShieldCheck, Edit3, Trash2, Loader2, AlertTriangle, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import type { RoleWithPermissions, Permission, RoleFormValues, Role } from '@/types/roles';
import type { WorkflowModule, WorkflowStep, WorkflowStepFormValues } from '@/types/workflows';
import type { NotificationTemplate, NotificationEventType, NotificationTemplateFormValues } from '@/types/notifications';
import RoleForm from '@/components/admin/settings/RoleForm';
import WorkflowForm from '@/components/admin/settings/WorkflowForm';
import NotificationTemplateForm from '@/components/admin/settings/NotificationTemplateForm';
import WorkflowConfiguration from '@/components/admin/settings/WorkflowConfiguration';
import GeneralApplicationSettings from '@/components/admin/settings/GeneralApplicationSettings';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertTitle as UIAlertTitle, AlertDescription as UIAlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label"; // Shadcn Label
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// System settings page component


export default function SystemSettingsPage() {
  const { toast } = useToast();
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [currentRoleToEdit, setCurrentRoleToEdit] = useState<RoleWithPermissions | null>(null);
  
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);
  const [roleSubmitError, setRoleSubmitError] = useState<string | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RoleWithPermissions | null>(null);


  // Function to fetch roles data from the API
  const fetchRolesData = useCallback(async () => {
    setIsLoadingRoles(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/settings/roles');
      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to fetch roles: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }
      const rolesData = await response.json();
      setRoles(rolesData);
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError(err instanceof Error ? err.message : 'Failed to load roles. Please try again later.');
    } finally {
      setIsLoadingRoles(false);
    }
  }, []);
  
  // Function to fetch permissions data from the API
  const fetchPermissionsData = useCallback(async () => {
    setIsLoadingPermissions(true);
    
    try {
      const response = await fetch('/api/admin/settings/permissions');
      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to fetch permissions: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }
      const permissionsData = await response.json();
      setPermissions(permissionsData);
    } catch (err) {
      console.error('Error fetching permissions:', err);
      // Don't set error state here to avoid overriding roles error
      // Just log to console
    } finally {
      setIsLoadingPermissions(false);
    }
  }, []);

  const handleOpenRoleModal = useCallback((role: RoleWithPermissions | null = null) => {
    setCurrentRoleToEdit(role);
    setIsRoleModalOpen(true);
  }, []);

  const handleCloseRoleModal = useCallback(() => {
    setCurrentRoleToEdit(null);
    setIsRoleModalOpen(false);
  }, []);

  const handleRoleFormSubmit = useCallback(async (formData: RoleFormValues) => {
    setIsSubmittingRole(true);
    setRoleSubmitError(null);
    
    try {
      if (currentRoleToEdit) {
        // Update existing role
        const response = await fetch('/api/admin/settings/roles', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: currentRoleToEdit.id,
            ...formData,
          }),
        });
        
        if (!response.ok) {
          const contentType = response.headers.get('content-type') || '';
          let errorMessage = `Failed to update role: ${response.status} ${response.statusText}`;
          if (contentType.includes('application/json')) {
            const errorData = await response.json().catch(() => null);
            errorMessage = errorData?.error || errorMessage;
          }
          throw new Error(errorMessage);
        }
        
        toast({
          title: "Role updated",
          description: `Role "${formData.name}" has been updated successfully.`,
        });
      } else {
        // Create new role
        const response = await fetch('/api/admin/settings/roles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
        
        if (!response.ok) {
          const contentType = response.headers.get('content-type') || '';
          let errorMessage = `Failed to create role: ${response.status} ${response.statusText}`;
          if (contentType.includes('application/json')) {
            const errorData = await response.json().catch(() => null);
            errorMessage = errorData?.error || errorMessage;
          }
          throw new Error(errorMessage);
        }
        
        toast({
          title: "Role created",
          description: `Role "${formData.name}" has been created successfully.`,
        });
      }
      
      // Refresh roles list
      fetchRolesData();
      handleCloseRoleModal();
    } catch (error) {
      console.error('Error submitting role:', error);
      setRoleSubmitError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsSubmittingRole(false);
    }
  }, [currentRoleToEdit, handleCloseRoleModal, toast, fetchRolesData]);

  const confirmDeleteRole = useCallback((role: RoleWithPermissions) => {
    setRoleToDelete(role); 
    setIsDeleteDialogOpen(true);
  }, []);
  
  const handleDeleteRole = useCallback(async () => {
    if (!roleToDelete) return;
    
    setIsSubmittingRole(true);
    
    try {
      const response = await fetch(`/api/admin/settings/roles?id=${roleToDelete.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to delete role: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      toast({
        title: "Role deleted",
        description: `Role "${roleToDelete.name}" has been deleted successfully.`,
      });
      
      // Refresh roles list
      fetchRolesData();
      setIsDeleteDialogOpen(false);
      setRoleToDelete(null);
    } catch (error) {
      console.error('Error deleting role:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to delete role',
        variant: "destructive"
      });
    } finally {
      setIsSubmittingRole(false);
    }
  }, [roleToDelete, toast, fetchRolesData]);

  useEffect(() => {
    fetchRolesData();
    fetchPermissionsData();
  }, [fetchRolesData, fetchPermissionsData]);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Settings className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
      </div>
      <p className="text-muted-foreground">Manage application settings, user roles, permissions, and workflow configurations.</p>
      {error && (<Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><UIAlertTitle>Error</UIAlertTitle><UIAlertDescription>{error}</UIAlertDescription></Alert>)}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-primary" /> User Roles & Permissions</CardTitle>
          <CardDescription>Define roles and assign permissions to control access to system features.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-md font-semibold mb-3 text-foreground/90">Existing Roles</h3>
            {isLoadingRoles ? (<div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse"></div>)}</div>)
            : roles.length > 0 ? (
              <ScrollArea className="h-60 w-full rounded-md border"><div className="p-4 space-y-3">
                {roles.map((role) => (
                  <div key={role.id} className="p-3 border rounded-md flex justify-between items-center bg-background hover:bg-muted/50">
                    <div>
                      <p className="font-medium">{role.name}</p>
                      <p className="text-xs text-muted-foreground">{role.description || "No description"}</p>
                      <p className="text-xs text-muted-foreground mt-1">Permissions: {role.permissionIds?.length > 0 ? role.permissionIds.map(pid => permissions.find(p => p.id === pid)?.name || pid.substring(0,8)).join(', ') : 'None'}</p>
                    </div>
                    <div className="space-x-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenRoleModal(role)} disabled={isSubmittingRole}><Edit3 className="h-4 w-4" /><span className="sr-only">Manage Role</span></Button>
                      <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => confirmDeleteRole(role)} disabled={isSubmittingRole}><Trash2 className="h-4 w-4" /><span className="sr-only">Delete Role</span></Button>
                    </div>
                  </div>
                ))}
              </div></ScrollArea>
            ) : (<p className="text-sm text-muted-foreground">No roles defined yet. Click "Add New Role" to get started.</p>)}
          </div>
          <Button onClick={() => handleOpenRoleModal(null)} disabled={isLoadingRoles || isSubmittingRole}><PlusCircle className="mr-2 h-4 w-4" /> Add New Role</Button>
          <div className="pt-4">
            <h3 className="text-md font-semibold mb-3 text-foreground/90">Available System Permissions</h3>
            {isLoadingPermissions ? (<div className="h-10 bg-muted rounded animate-pulse w-1/2"></div>) 
            : permissions.length > 0 ? (
              <ScrollArea className="h-40 w-full rounded-md border"><div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {permissions.map((perm) => (<div key={perm.id} className="p-2 border rounded-sm bg-background text-sm"><p className="font-medium">{perm.name}</p>{perm.description && <p className="text-xs text-muted-foreground">{perm.description}</p>}</div>))}
              </div></ScrollArea>
            ) : (<p className="text-sm text-muted-foreground">No permissions available or failed to load.</p>)}
          </div>
        </CardContent>
      </Card>
      <GeneralApplicationSettings />
      <WorkflowConfiguration />
  <Card>
    <CardHeader><CardTitle>Notification Templates</CardTitle><CardDescription>Manage email and system notification templates.</CardDescription></CardHeader>
    <CardContent><p className="text-sm text-muted-foreground">Create and manage email templates for various system notifications.</p><Link href="/admin/settings/notifications"><Button variant="outline" className="mt-2">Manage Templates</Button></Link></CardContent>
  </Card>
  <Dialog open={isRoleModalOpen} onOpenChange={(isOpen) => { if (!isOpen) handleCloseRoleModal(); else setIsRoleModalOpen(true); }}>
    <DialogContent className="sm:max-w-lg"><DialogHeader><DialogPageTitle className="text-xl font-semibold text-primary">{currentRoleToEdit ? `Manage Role: ${currentRoleToEdit.name}` : "Add New Role"}</DialogPageTitle></DialogHeader>
      <RoleForm initialData={currentRoleToEdit} availablePermissions={permissions} onFormSubmit={handleRoleFormSubmit} onCancel={handleCloseRoleModal} isSubmitting={isSubmittingRole} submitError={roleSubmitError}/>
    </DialogContent>
  </Dialog>
  <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
    <AlertDialogContent>
      <AlertDialogPageHeader><AlertDialogPageTitle>Are you sure you want to delete this role?</AlertDialogPageTitle><AlertDialogDescription>This action cannot be undone. Role "{roleToDelete?.name}" will be permanently removed. Ensure no users are currently assigned this role before deleting.</AlertDialogDescription></AlertDialogPageHeader>
      <AlertDialogModalFooter>
        <AlertDialogCancel onClick={() => setRoleToDelete(null)} disabled={isSubmittingRole}>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={handleDeleteRole} disabled={isSubmittingRole} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isSubmittingRole && roleToDelete ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Delete Role</AlertDialogAction>
      </AlertDialogModalFooter>
    </AlertDialogContent>
  </AlertDialog>
</div>
);
}
