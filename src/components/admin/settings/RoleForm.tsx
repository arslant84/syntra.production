
"use client";

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { RoleFormValues, Permission, RoleWithPermissions } from '@/types/roles';
import { Loader2 } from 'lucide-react';

const roleFormSchema = z.object({
  name: z.string().min(2, { message: "Role name must be at least 2 characters." }),
  description: z.string().optional().nullable(),
  permissionIds: z.array(z.string()).min(1, { message: "At least one permission must be selected." }),
});

interface RoleFormProps {
  initialData?: RoleWithPermissions | null;
  availablePermissions: Permission[];
  onFormSubmit: (data: RoleFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitError?: string | null;
}

export default function RoleForm({ 
  initialData, 
  availablePermissions, 
  onFormSubmit, 
  onCancel,
  isSubmitting = false,
  submitError = null
}: RoleFormProps) {
  
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      permissionIds: initialData?.permissionIds || [],
    },
  });

  React.useEffect(() => {
    form.reset({
      name: initialData?.name || '',
      description: initialData?.description || '',
      permissionIds: initialData?.permissionIds || [],
    });
  }, [initialData, form]);

  const handleSubmit = async (values: RoleFormValues) => {
    await onFormSubmit(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter role name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Describe the role" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="permissionIds"
          render={() => (
            <FormItem>
              <FormLabel>Assign Permissions</FormLabel>
              <ScrollArea className="h-48 w-full rounded-md border p-4">
                {availablePermissions.map((permission) => (
                  <FormField
                    key={permission.id}
                    control={form.control}
                    name="permissionIds"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={permission.id}
                          className="flex flex-row items-start space-x-3 space-y-0 mb-3"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(permission.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...(field.value || []), permission.id])
                                  : field.onChange(
                                      (field.value || []).filter(
                                        (value) => value !== permission.id
                                      )
                                    )
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal text-sm">
                            {permission.name}
                            {permission.description && <span className="block text-xs text-muted-foreground">{permission.description}</span>}
                          </FormLabel>
                        </FormItem>
                      )
                    }}
                  />
                ))}
              </ScrollArea>
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
            {initialData ? "Update Role" : "Create Role"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
