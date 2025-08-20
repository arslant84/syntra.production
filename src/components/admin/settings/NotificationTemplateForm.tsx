import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Loader2, Info } from 'lucide-react';
import { NotificationTemplate, NotificationTemplateFormValues } from '@/types/notifications';

interface NotificationEventType {
  id: string;
  name: string;
  description?: string;
  category: string;
  module: string;
}

interface NotificationTemplateFormProps {
  initialData?: NotificationTemplateFormValues | null;
  eventTypes?: NotificationEventType[];
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
  submitError,
}: NotificationTemplateFormProps) {
  const [formData, setFormData] = useState<NotificationTemplateFormValues>(initialData || {
    name: '',
    description: '',
    subject: '',
    body: '',
    type: 'email',
    eventType: ''
  });
  
  const [selectedEventType, setSelectedEventType] = useState<NotificationEventType | null>(null);

  useEffect(() => {
    if (initialData) {
      console.log('Form receiving initial data:', initialData);
      console.log('Initial data eventType:', initialData.eventType);
      console.log('Initial data description:', initialData.description);
      console.log('Available eventTypes:', eventTypes);
      const eventTypeValue = initialData.eventType || '';
      
      setFormData({
        name: initialData.name || '',
        description: initialData.description || '',
        subject: initialData.subject || '',
        body: initialData.body || '',
        type: initialData.type || 'email',
        eventType: eventTypeValue
      });
      
      // Set selected event type for display - only if we have eventTypes loaded
      if (eventTypeValue && eventTypes?.length > 0) {
        const eventType = eventTypes.find(et => et.id === eventTypeValue);
        setSelectedEventType(eventType || null);
      } else {
        setSelectedEventType(null);
      }
    } else {
      setFormData({
        name: '',
        description: '',
        subject: '',
        body: '',
        type: 'email',
        eventType: ''
      });
      setSelectedEventType(null);
    }
  }, [initialData, eventTypes]);

  const handleChange = (field: keyof NotificationTemplateFormValues, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Update selected event type when eventType changes
    if (field === 'eventType' && eventTypes) {
      const eventType = eventTypes.find(et => et.id === value);
      setSelectedEventType(eventType || null);
    }
  };
  
  // Available template variables based on event type and general variables
  const getAvailableVariables = () => {
    const generalVars = ['userName', 'date', 'requestId'];
    const eventSpecificVars: Record<string, string[]> = {
      'trf': ['requestorName', 'approverName', 'comments', 'entityType'],
      'visa': ['requestorName', 'approverName', 'comments', 'entityType'],
      'claims': ['requestorName', 'approverName', 'comments', 'entityType'],
      'transport': ['requestorName', 'approverName', 'comments', 'entityType'],
      'accommodation': ['requestorName', 'approverName', 'comments', 'entityType'],
    };
    
    if (selectedEventType) {
      const moduleVars = eventSpecificVars[selectedEventType.module] || [];
      return [...generalVars, ...moduleVars];
    }
    
    return generalVars;
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
          value={formData.description ?? ''}
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
          value={formData.eventType || undefined}
          onValueChange={(value) => handleChange('eventType', value)}
          disabled={isSubmitting}
          required
        >
          <SelectTrigger id="eventType">
            <SelectValue placeholder="Select event type" />
          </SelectTrigger>
          <SelectContent>
            {eventTypes?.length > 0 ? (
              eventTypes.map((eventType) => (
                <SelectItem key={eventType.id} value={eventType.id}>
                  <div className="flex items-center gap-2">
                    <span>{eventType.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {eventType.module}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {eventType.category}
                    </Badge>
                  </div>
                </SelectItem>
              ))
            ) : (
              <SelectItem value="no-types" disabled>No event types available</SelectItem>
            )}
          </SelectContent>
        </Select>
        {selectedEventType && (
          <div className="p-3 bg-blue-50 rounded-md">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <div className="font-medium">{selectedEventType.name}</div>
                {selectedEventType.description && (
                  <div className="text-blue-600 mt-1">{selectedEventType.description}</div>
                )}
              </div>
            </div>
          </div>
        )}
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
        <div className="text-xs text-muted-foreground space-y-2">
          <p>Available template variables:</p>
          <div className="flex flex-wrap gap-1">
            {getAvailableVariables().map((variable) => (
              <Badge key={variable} variant="outline" className="text-xs font-mono">
                {'{'}
                {variable}
                {'}'}
              </Badge>
            ))}
          </div>
          <p>These placeholders will be replaced with actual values when notifications are sent.</p>
        </div>
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