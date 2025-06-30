// src/components/admin/settings/NotificationTemplateForm.tsx
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { NotificationTemplate, NotificationTemplateFormValues, NotificationEventType } from '@/types/notifications';

interface NotificationTemplateFormProps {
  initialData?: NotificationTemplate | null;
  eventTypes: NotificationEventType[];
  onFormSubmit: (data: NotificationTemplateFormValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  submitError: string | null;
}

export default function NotificationTemplateForm({
  initialData,
  eventTypes,
  onFormSubmit,
  onCancel,
  isSubmitting,
  submitError
}: NotificationTemplateFormProps) {
  const [formData, setFormData] = useState<NotificationTemplateFormValues>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    subject: initialData?.subject || '',
    body: initialData?.body || '',
    type: initialData?.type || 'email',
    eventType: initialData?.eventType || ''
  });

  const handleChange = (field: keyof NotificationTemplateFormValues, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onFormSubmit(formData);
  };

  const isFormValid = formData.name && formData.subject && formData.body && formData.type && formData.eventType;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Template Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="Enter template name"
          disabled={isSubmitting}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Input
          id="description"
          value={formData.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Enter description"
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Notification Type</Label>
        <Select
          value={formData.type}
          onValueChange={(value) => handleChange('type', value)}
          disabled={isSubmitting}
          required
        >
          <SelectTrigger id="type">
            <SelectValue placeholder="Select notification type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="system">System</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="eventType">Event Type</Label>
        <Select
          value={formData.eventType}
          onValueChange={(value) => handleChange('eventType', value)}
          disabled={isSubmitting}
          required
        >
          <SelectTrigger id="eventType">
            <SelectValue placeholder="Select event type" />
          </SelectTrigger>
          <SelectContent>
            {eventTypes.map((eventType) => (
              <SelectItem key={eventType.id} value={eventType.id}>
                {eventType.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          value={formData.subject}
          onChange={(e) => handleChange('subject', e.target.value)}
          placeholder="Enter email subject"
          disabled={isSubmitting}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Template Body</Label>
        <Textarea
          id="body"
          value={formData.body}
          onChange={(e) => handleChange('body', e.target.value)}
          placeholder="Enter template content"
          rows={6}
          disabled={isSubmitting}
          required
        />
        <p className="text-xs text-muted-foreground">
          You can use placeholders like {'{userName}'}, {'{date}'}, etc. which will be replaced with actual values.
        </p>
      </div>

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
          {initialData ? 'Update Template' : 'Add Template'}
        </Button>
      </div>
    </form>
  );
}
