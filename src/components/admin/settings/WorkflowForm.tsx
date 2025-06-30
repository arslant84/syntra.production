// src/components/admin/settings/WorkflowForm.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { WorkflowStep, WorkflowStepFormValues } from '@/types/workflows';
import { Role } from '@/types/roles';

interface WorkflowFormProps {
  initialData?: WorkflowStep | null;
  moduleId: string;
  availableRoles: Role[];
  onFormSubmit: (moduleId: string, data: WorkflowStepFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  submitError: string | null;
}

export default function WorkflowForm({
  initialData,
  moduleId,
  availableRoles,
  onFormSubmit,
  onCancel,
  isSubmitting,
  submitError
}: WorkflowFormProps) {
  const [formData, setFormData] = useState<WorkflowStepFormValues>({
    name: initialData?.name || '',
    approverRoleId: initialData?.approverRoleId || '',
    escalationRoleId: initialData?.escalationRoleId || '',
    escalationHours: initialData?.escalationHours || 24,
    order: initialData?.order || 0
  });

  const handleChange = (field: keyof WorkflowStepFormValues, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onFormSubmit(moduleId, formData);
  };

  const isFormValid = formData.name && formData.approverRoleId;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Step Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="Enter step name"
          disabled={isSubmitting}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="approverRoleId">Approver Role</Label>
        <Select
          value={formData.approverRoleId}
          onValueChange={(value) => handleChange('approverRoleId', value)}
          disabled={isSubmitting}
          required
        >
          <SelectTrigger id="approverRoleId">
            <SelectValue placeholder="Select approver role" />
          </SelectTrigger>
          <SelectContent>
            {availableRoles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="escalationRoleId">Escalation Role (Optional)</Label>
        <Select
          value={formData.escalationRoleId || ''}
          onValueChange={(value) => handleChange('escalationRoleId', value)}
          disabled={isSubmitting}
        >
          <SelectTrigger id="escalationRoleId">
            <SelectValue placeholder="Select escalation role (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {availableRoles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {formData.escalationRoleId && (
        <div className="space-y-2">
          <Label htmlFor="escalationHours">Escalation Hours</Label>
          <Input
            id="escalationHours"
            type="number"
            min="1"
            value={formData.escalationHours || ''}
            onChange={(e) => handleChange('escalationHours', parseInt(e.target.value) || 24)}
            placeholder="Hours before escalation"
            disabled={isSubmitting}
          />
        </div>
      )}

      {submitError && (
        <div className="text-sm font-medium text-destructive">{submitError}</div>
      )}

      <div className="flex justify-end space-x-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!isFormValid || isSubmitting}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialData ? 'Update Step' : 'Add Step'}
        </Button>
      </div>
    </form>
  );
}
