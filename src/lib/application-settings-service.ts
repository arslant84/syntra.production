// Application Settings Service
// Handles all application settings related operations

export interface ApplicationSetting {
  id: string;
  setting_key: string;
  setting_value: any;
  setting_type: 'string' | 'boolean' | 'number' | 'json';
  description?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApplicationSettingUpdate {
  setting_key: string;
  setting_value: any;
  setting_type?: 'string' | 'boolean' | 'number' | 'json';
  description?: string;
}

/**
 * Get all application settings
 * @param publicOnly - If true, returns only public settings
 */
export async function getApplicationSettings(publicOnly = false): Promise<ApplicationSetting[]> {
  try {
    const url = publicOnly ? '/api/admin/settings/application?public=true' : '/api/admin/settings/application';
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch application settings: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch application settings');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error fetching application settings:', error);
    throw error;
  }
}

/**
 * Get a specific application setting by key
 * @param key - The setting key to retrieve
 * @param publicOnly - If true, only returns if the setting is public
 */
export async function getApplicationSetting(key: string, publicOnly = false): Promise<ApplicationSetting | null> {
  try {
    const settings = await getApplicationSettings(publicOnly);
    return settings.find(setting => setting.setting_key === key) || null;
  } catch (error) {
    console.error(`Error fetching application setting '${key}':`, error);
    throw error;
  }
}

/**
 * Update a single application setting
 * @param settingUpdate - The setting update data
 */
export async function updateApplicationSetting(settingUpdate: ApplicationSettingUpdate): Promise<ApplicationSetting> {
  try {
    const response = await fetch('/api/admin/settings/application', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settingUpdate),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update application setting: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to update application setting');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error updating application setting:', error);
    throw error;
  }
}

/**
 * Update multiple application settings at once
 * @param settingUpdates - Array of setting updates
 */
export async function updateApplicationSettings(settingUpdates: ApplicationSettingUpdate[]): Promise<ApplicationSetting[]> {
  try {
    const response = await fetch('/api/admin/settings/application', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settingUpdates),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update application settings: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to update application settings');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error updating application settings:', error);
    throw error;
  }
}

/**
 * Create a new application setting
 * @param settingData - The setting data to create
 */
export async function createApplicationSetting(settingData: ApplicationSettingUpdate & { is_public?: boolean }): Promise<ApplicationSetting> {
  try {
    const response = await fetch('/api/admin/settings/application', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settingData),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create application setting: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create application setting');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error creating application setting:', error);
    throw error;
  }
}

/**
 * Helper function to get settings as a key-value object
 * @param publicOnly - If true, returns only public settings
 */
export async function getApplicationSettingsObject(publicOnly = false): Promise<Record<string, any>> {
  try {
    const settings = await getApplicationSettings(publicOnly);
    return settings.reduce((acc, setting) => {
      acc[setting.setting_key] = setting.setting_value;
      return acc;
    }, {} as Record<string, any>);
  } catch (error) {
    console.error('Error fetching application settings object:', error);
    throw error;
  }
}