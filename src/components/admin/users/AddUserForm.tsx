
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
import type { User } from '@/types'; // Assuming User type includes role_id
import type { RoleWithPermissions } from '@/types/roles';

// Schema for both add and edit
const userFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  staff_id: z.string().nullable().optional(),
  role_id: z.string().uuid("Invalid Role ID format.").nullable().optional(),
  department: z.string().nullable().optional(),
  status: z.enum(['Active', 'Inactive']).default('Active'),
});

export type UserFormValues = z.infer<typeof userFormSchema>;

interface UserFormProps {
  onFormSubmit: (data: UserFormValues) => Promise<any>; // Can return error details
  onCancel: () => void;
  editingUser?: User | null;
  availableRoles: RoleWithPermissions[];
}

export const NULL_ROLE_VALUE = "__NULL_ROLE__"; // Special value for "No Role" option

export default function AddUserForm({ onFormSubmit, onCancel, editingUser, availableRoles }: UserFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: '',
      email: '',
      staff_id: null,
      role_id: null,
      department: null,
      status: 'Active',
    },
  });

  React.useEffect(() => {
    if (editingUser) {
      form.reset({
        name: editingUser.name || '',
        email: editingUser.email || '',
        staff_id: editingUser.staff_id || null,
        role_id: editingUser.role_id || null,
        department: editingUser.department || null,
        status: (editingUser.status === 'Active' || editingUser.status === 'Inactive') ? editingUser.status : 'Active',
      });
    } else {
      form.reset({ // Reset to default "add mode" values
        name: '',
        email: '',
        staff_id: null,
        role_id: null,
        department: null,
        status: 'Active',
      });
    }
    setSubmitError(null); // Clear previous submission errors when form mode changes
  }, [editingUser, form]);


  const handleSubmit = async (values: UserFormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onFormSubmit(values);
      // Success is handled by the parent closing the modal and showing a toast
    } catch (error: any) {
      let errorMessage = "An unknown error occurred.";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && (error.details || error.error || error.message)) {
        // Prioritize specific error messages from our API structure
        errorMessage = error.details || error.error || error.message;
      }
      setSubmitError(errorMessage);
      console.error("Form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

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
                value={field.value === null ? NULL_ROLE_VALUE : (field.value ?? NULL_ROLE_VALUE)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NULL_ROLE_VALUE}>No Role</SelectItem>
                  {availableRoles.map((roleOption) => (
                    <SelectItem key={roleOption.id} value={roleOption.id!}>
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
