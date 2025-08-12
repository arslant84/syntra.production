"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, Settings, Save, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  getApplicationSettings, 
  updateApplicationSettings, 
  type ApplicationSetting,
  type ApplicationSettingUpdate
} from '@/lib/application-settings-service';

interface SettingsForm {
  application_name: string;
  maintenance_mode: boolean;
  support_email: string;
  default_currency: string;
  timezone: string;
  enable_email_notifications: boolean;
  session_timeout_minutes: number;
  max_file_upload_size: number;
}

export default function GeneralApplicationSettings() {
  const [settings, setSettings] = useState<ApplicationSetting[]>([]);
  const [formData, setFormData] = useState<SettingsForm>({
    application_name: '',
    maintenance_mode: false,
    support_email: '',
    default_currency: '',
    timezone: '',
    enable_email_notifications: true,
    session_timeout_minutes: 480,
    max_file_upload_size: 10485760
  });
  const [originalData, setOriginalData] = useState<SettingsForm>({} as SettingsForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const { toast } = useToast();

  // Load settings from API
  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const settingsData = await getApplicationSettings();
      setSettings(settingsData);
      
      // Convert to form data
      const formDataFromSettings = settingsData.reduce((acc, setting) => {
        acc[setting.setting_key as keyof SettingsForm] = setting.setting_value;
        return acc;
      }, {} as any);
      
      setFormData(formDataFromSettings);
      setOriginalData({ ...formDataFromSettings });
      console.log('Loaded application settings:', formDataFromSettings);
    } catch (error: any) {
      console.error('Error loading settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load application settings',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Check if form has changes
  useEffect(() => {
    const changed = Object.keys(formData).some(key => {
      const currentValue = formData[key as keyof SettingsForm];
      const originalValue = originalData[key as keyof SettingsForm];
      return currentValue !== originalValue;
    });
    setHasChanges(changed);
  }, [formData, originalData]);

  // Handle form field changes
  const handleFieldChange = (field: keyof SettingsForm, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Save settings
  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      
      // Prepare updates for changed fields only
      const updates: ApplicationSettingUpdate[] = [];
      
      Object.keys(formData).forEach(key => {
        const fieldKey = key as keyof SettingsForm;
        const currentValue = formData[fieldKey];
        const originalValue = originalData[fieldKey];
        
        if (currentValue !== originalValue) {
          const setting = settings.find(s => s.setting_key === key);
          if (setting) {
            updates.push({
              setting_key: key,
              setting_value: currentValue,
              setting_type: setting.setting_type
            });
          }
        }
      });
      
      if (updates.length === 0) {
        toast({
          title: 'No Changes',
          description: 'No changes to save'
        });
        return;
      }
      
      console.log('Saving settings updates:', updates);
      
      // Update settings
      await updateApplicationSettings(updates);
      
      // Reload settings to get updated data
      await loadSettings();
      
      toast({
        title: 'Success',
        description: `${updates.length} setting${updates.length > 1 ? 's' : ''} updated successfully`
      });
      
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save application settings',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset form to original values
  const handleReset = () => {
    setFormData({ ...originalData });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            General Application Settings
          </CardTitle>
          <CardDescription>Configure global settings for the application.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          General Application Settings
        </CardTitle>
        <CardDescription>Configure global settings for the application.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Basic Settings */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground/90">Basic Configuration</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appName">Application Name</Label>
              <Input
                id="appName"
                value={formData.application_name}
                onChange={(e) => handleFieldChange('application_name', e.target.value)}
                placeholder="Enter application name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supportEmail">Support Email</Label>
              <Input
                id="supportEmail"
                type="email"
                value={formData.support_email}
                onChange={(e) => handleFieldChange('support_email', e.target.value)}
                placeholder="support@example.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="defaultCurrency">Default Currency</Label>
              <Input
                id="defaultCurrency"
                value={formData.default_currency}
                onChange={(e) => handleFieldChange('default_currency', e.target.value)}
                placeholder="USD"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={formData.timezone}
                onChange={(e) => handleFieldChange('timezone', e.target.value)}
                placeholder="UTC"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* System Settings */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground/90">System Configuration</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Session Timeout (Minutes)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                value={formData.session_timeout_minutes}
                onChange={(e) => handleFieldChange('session_timeout_minutes', parseInt(e.target.value) || 480)}
                min="15"
                max="1440"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxUploadSize">Max File Upload Size (MB)</Label>
              <Input
                id="maxUploadSize"
                type="number"
                value={Math.round(formData.max_file_upload_size / 1048576)} // Convert bytes to MB
                onChange={(e) => handleFieldChange('max_file_upload_size', (parseInt(e.target.value) || 10) * 1048576)}
                min="1"
                max="100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center space-x-3">
              <Switch
                id="maintenanceMode"
                checked={formData.maintenance_mode}
                onCheckedChange={(checked) => handleFieldChange('maintenance_mode', checked)}
              />
              <div className="space-y-1">
                <Label htmlFor="maintenanceMode" className="cursor-pointer">Maintenance Mode</Label>
                <p className="text-xs text-muted-foreground">Prevent user access to the application</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Switch
                id="emailNotifications"
                checked={formData.enable_email_notifications}
                onCheckedChange={(checked) => handleFieldChange('enable_email_notifications', checked)}
              />
              <div className="space-y-1">
                <Label htmlFor="emailNotifications" className="cursor-pointer">Email Notifications</Label>
                <p className="text-xs text-muted-foreground">Enable system-wide email notifications</p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {hasChanges && (
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 bg-amber-500 rounded-full" />
                Unsaved changes
              </span>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!hasChanges || isSaving}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            
            <Button
              onClick={handleSaveSettings}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}