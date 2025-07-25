
"use client";

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import type { User } from '@/types';
import type { RoleWithPermissions } from '@/types/roles';
import { useToast } from '@/hooks/use-toast';

// Schema for both add and edit
function getUserFormSchema(isEdit: boolean) {
  return z.object({
    name: z.string().min(2, { message: "Name must be at least 2 characters." }),
    email: z.string().email({ message: "Please enter a valid email address." }),
    staff_id: z.string().nullable().optional(),
    role_id: z.string().uuid("Invalid Role ID format.").nullable().optional(),
    department: z.string().nullable().optional(),
    status: z.enum(['Active', 'Inactive']).default('Active'),
    password: isEdit
      ? z.string().min(0).or(z.string().min(15, { message: "Password must be at least 15 characters." })).optional()
      : z.string().min(15, { message: "Password must be at least 15 characters." }),
  });
}

export type UserFormValues = z.infer<ReturnType<typeof getUserFormSchema>>;

interface UserFormProps {
  onFormSubmit: (data: UserFormValues) => Promise<any>;
  onCancel: () => void;
  editingUser?: User | null;
  availableRoles: RoleWithPermissions[];
}

export const NULL_ROLE_VALUE = "__NULL_ROLE__";

export default function AddUserForm({ onFormSubmit, onCancel, editingUser, availableRoles }: UserFormProps) {
  const isEdit = !!editingUser;
  const userFormSchema = React.useMemo(() => getUserFormSchema(isEdit), [isEdit]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: '',
      email: '',
      staff_id: null,
      role_id: null,
      department: null,
      status: 'Active',
      password: '',
    },
  });

  React.useEffect(() => {
    if (editingUser && availableRoles.length > 0) {
      console.log("Editing user in form:", editingUser);
      console.log("Available roles in form:", availableRoles);
      const validRoleId = availableRoles.some(r => String(r.id) === String(editingUser.role_id)) ? String(editingUser.role_id) : null;
      console.log("Form role_id value:", validRoleId);
      form.reset({
        name: editingUser.name || '',
        email: editingUser.email || '',
        staff_id: editingUser.staff_id || null,
        role_id: validRoleId,
        department: editingUser.department || null,
        status: (editingUser.status === 'Active' || editingUser.status === 'Inactive') ? editingUser.status : 'Active',
        password: '',
      });
    } else if (!editingUser) {
      form.reset({
        name: '',
        email: '',
        staff_id: null,
        role_id: null,
        department: null,
        status: 'Active',
        password: '',
      });
    }
    setSubmitError(null);
  }, [editingUser, form, availableRoles]);

  const handleSubmit = async (values: UserFormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const submitValues = { ...values };
      if (editingUser && !values.password) {
        delete submitValues.password;
      }
      await onFormSubmit(submitValues);
      toast({ title: editingUser ? "User Updated!" : "User Created!", description: `User "${values.name}" ${editingUser ? "updated" : "created"}.`, variant: "success" });
    } catch (error: any) {
      let errorMessage = "An unknown error occurred.";
      let fieldErrors = null;
      if (error && typeof error === 'object') {
        if (error.details && error.details.fieldErrors) {
          fieldErrors = error.details.fieldErrors;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        } else if (error.details || error.error || error.message) {
          errorMessage = error.details || error.error || error.message;
        }
      }
      if (fieldErrors) {
        Object.entries(fieldErrors).forEach(([field, messages]) => {
          form.setError(field as keyof UserFormValues, { type: 'server', message: Array.isArray(messages) ? messages[0] : String(messages) });
        });
        setSubmitError(null);
      } else {
        setSubmitError(errorMessage);
      }
      console.error("Form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show/hide password toggle
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter full name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input type="email" placeholder="Enter email address" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="staff_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Staff ID (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Enter staff ID (e.g., PCTSB00XXX)" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(value === NULL_ROLE_VALUE ? null : value)}
                value={field.value === null ? NULL_ROLE_VALUE : String(field.value)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NULL_ROLE_VALUE}>No Role</SelectItem>
                  {availableRoles.map((roleOption) => (
                    <SelectItem key={roleOption.id} value={String(roleOption.id)}>
                      {roleOption.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="department"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Department (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Enter department" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Password field: required for add, optional for edit */}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{editingUser ? "New Password (optional)" : "Password"}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder={editingUser ? "Leave blank to keep current password" : "At least 15 characters"}
                    minLength={editingUser ? 0 : 15}
                    {...field}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </FormControl>
              {/* Only show error if password is filled and too short, or if adding and missing */}
              {form.formState.errors.password && (field.value || !editingUser) && (
                <div className="text-red-600 text-sm mt-1">{form.formState.errors.password.message}</div>
              )}
            </FormItem>
          )}
        />
        {submitError && (
          <p className="text-sm font-medium text-destructive">{submitError}</p>
        )}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {editingUser ? "Update User" : "Add User"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
