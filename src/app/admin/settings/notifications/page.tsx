'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import NotificationTemplateForm from '@/components/admin/settings/NotificationTemplateForm';

import { NotificationTemplate, NotificationTemplateFormValues } from '@/types/notifications';

export default function NotificationTemplatesPage() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<NotificationTemplateFormValues | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSetupLoading, setIsSetupLoading] = useState(false);
  const { toast } = useToast();

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/admin/notification-templates');
      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to fetch notification templates: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch notification templates.',
        variant: 'destructive',
      });
    }
  };

  const fetchEventTypes = async () => {
    try {
      const response = await fetch('/api/admin/notification-events');
      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to fetch event types: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setEventTypes(data.eventTypes || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch event types.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchTemplates(), fetchEventTypes()]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleOpenModal = async (template: NotificationTemplate | null = null) => {
    if (template) {
      setEditingTemplateId(template.id);
      // Fetch the full template data to get the most up-to-date version
      try {
        const response = await fetch(`/api/admin/notification-templates/${template.id}`);
        if (!response.ok) {
          const contentType = response.headers.get('content-type') || '';
          let errorMessage = `Failed to fetch template details: ${response.status} ${response.statusText}`;
          if (contentType.includes('application/json')) {
            const errorData = await response.json().catch(() => null);
            errorMessage = errorData?.error || errorMessage;
          }
          throw new Error(errorMessage);
        }
        const fullTemplate: NotificationTemplate = await response.json();
        setCurrentTemplate({
          name: fullTemplate.name,
          description: fullTemplate.description,
          subject: fullTemplate.subject,
          body: fullTemplate.body,
          type: fullTemplate.type,
          eventType: fullTemplate.eventType,
        });
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to fetch template details for editing.',
          variant: 'destructive',
        });
        return;
      }
    } else {
      setEditingTemplateId(null);
      setCurrentTemplate(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setCurrentTemplate(null);
    setEditingTemplateId(null);
    setIsModalOpen(false);
    setSubmitError(null);
  };

  const handleFormSubmit = async (formData: any) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const method = editingTemplateId ? 'PUT' : 'POST';
      const url = editingTemplateId ? `/api/admin/notification-templates/${editingTemplateId}` : '/api/admin/notification-templates';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to save template: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }

      toast({
        title: 'Success',
        description: `Template ${editingTemplateId ? 'updated' : 'created'} successfully.`,
      });
      handleCloseModal();
      fetchTemplates();
    } catch (error: any) {
      setSubmitError(error.message);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save template.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/notification-templates/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to delete notification template: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.error || errorMessage;
        }
        throw new Error(errorMessage);
      }

      setTemplates(templates.filter((template) => template.id !== templateId));
      toast({
        title: 'Success',
        description: 'Notification template deleted successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete notification template.',
        variant: 'destructive',
      });
    }
  };

  const handleSetupDefaultTemplates = async () => {
    setIsSetupLoading(true);
    try {
      const response = await fetch('/api/admin/setup-notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to setup default templates: ${response.status} ${response.statusText}`;
        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => null);
          errorMessage = errorData?.details || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      toast({
        title: 'Success',
        description: `Successfully setup ${result.templateCount} notification templates!`,
      });
      
      // Refresh templates list
      await fetchTemplates();
      
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to setup default templates.',
        variant: 'destructive',
      });
    } finally {
      setIsSetupLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notification Templates</h1>
          <p className="text-muted-foreground">Manage notification templates for system events.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleSetupDefaultTemplates}
            disabled={isSetupLoading}
          >
            {isSetupLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Setup Default Templates
          </Button>
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenModal(null)}>
                <PlusCircle className="mr-2 h-5 w-5" />
                Create New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{currentTemplate ? 'Edit Notification Template' : 'Create New Notification Template'}</DialogTitle>
              </DialogHeader>
              <NotificationTemplateForm
                initialData={currentTemplate}
                eventTypes={eventTypes}
                onFormSubmit={handleFormSubmit}
                onCancel={handleCloseModal}
                isSubmitting={isSubmitting}
                submitError={submitError}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Notification Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                    Loading...
                  </TableCell>
                </TableRow>
              ) : templates.length > 0 ? (
                templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>{template.name}</TableCell>
                    <TableCell>{template.subject}</TableCell>
                    <TableCell>{new Date(template.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => handleOpenModal(template)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDelete(template.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    No notification templates found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
