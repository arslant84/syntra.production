// API endpoints for application settings management
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db';

// Validation schema for application settings
const settingUpdateSchema = z.object({
  setting_key: z.string().min(1, 'Setting key is required'),
  setting_value: z.string(),
  setting_type: z.enum(['string', 'boolean', 'number', 'json']).optional(),
  description: z.string().optional()
});

const bulkUpdateSchema = z.array(settingUpdateSchema);

// GET /api/admin/settings/application - Get all application settings
export async function GET(request: NextRequest) {
  try {
    // TEMPORARILY DISABLED: Authentication for testing
    console.log('Application Settings API: Authentication bypassed for testing');
    
    const url = new URL(request.url);
    const publicOnly = url.searchParams.get('public') === 'true';
    
    let settings;
    
    if (publicOnly) {
      // Get only public settings (for non-admin users)
      settings = await sql`
        SELECT setting_key, setting_value, setting_type, description, is_public
        FROM application_settings 
        WHERE is_public = true
        ORDER BY setting_key
      `;
    } else {
      // Get all settings (for admin users)
      settings = await sql`
        SELECT setting_key, setting_value, setting_type, description, is_public, created_at, updated_at
        FROM application_settings 
        ORDER BY setting_key
      `;
    }
    
    // Convert values to appropriate types
    const formattedSettings = settings.map(setting => ({
      ...setting,
      setting_value: convertSettingValue(setting.setting_value, setting.setting_type)
    }));
    
    console.log(`Fetched ${formattedSettings.length} application settings (public only: ${publicOnly})`);
    
    return NextResponse.json({
      success: true,
      data: formattedSettings
    });
  } catch (error: any) {
    console.error('Error fetching application settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch application settings',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// PUT /api/admin/settings/application - Update application settings
export async function PUT(request: NextRequest) {
  try {
    // TEMPORARILY DISABLED: Authentication for testing
    console.log('Update Application Settings: Authentication bypassed for testing');
    
    const body = await request.json();
    console.log('Updating application settings with data:', body);
    
    // Validate if it's a single setting or bulk update
    let settingsToUpdate: any[] = [];
    
    if (Array.isArray(body)) {
      const validationResult = bulkUpdateSchema.safeParse(body);
      if (!validationResult.success) {
        console.error('Bulk validation error:', validationResult.error.flatten());
        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            details: validationResult.error.flatten()
          },
          { status: 400 }
        );
      }
      settingsToUpdate = validationResult.data;
    } else {
      const validationResult = settingUpdateSchema.safeParse(body);
      if (!validationResult.success) {
        console.error('Single validation error:', validationResult.error.flatten());
        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            details: validationResult.error.flatten()
          },
          { status: 400 }
        );
      }
      settingsToUpdate = [validationResult.data];
    }
    
    // Update each setting
    const updatedSettings = [];
    for (const setting of settingsToUpdate) {
      const { setting_key, setting_value, setting_type, description } = setting;
      
      // Convert value to string for storage (database stores all as TEXT)
      const valueToStore = typeof setting_value === 'string' ? setting_value : String(setting_value);
      
      const updateFields = ['setting_value = $2'];
      const updateValues = [setting_key, valueToStore];
      let paramCount = 2;
      
      if (setting_type) {
        updateFields.push(`setting_type = $${++paramCount}`);
        updateValues.push(setting_type);
      }
      
      if (description !== undefined) {
        updateFields.push(`description = $${++paramCount}`);
        updateValues.push(description);
      }
      
      updateFields.push(`updated_at = NOW()`);
      
      const updateQuery = `
        UPDATE application_settings 
        SET ${updateFields.join(', ')}
        WHERE setting_key = $1
        RETURNING *
      `;
      
      const result = await sql.unsafe(updateQuery, updateValues);
      
      if (result.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Setting '${setting_key}' not found`
          },
          { status: 404 }
        );
      }
      
      updatedSettings.push({
        ...result[0],
        setting_value: convertSettingValue(result[0].setting_value, result[0].setting_type)
      });
    }
    
    console.log(`Updated ${updatedSettings.length} application settings`);
    
    return NextResponse.json({
      success: true,
      data: settingsToUpdate.length === 1 ? updatedSettings[0] : updatedSettings,
      message: `Application settings updated successfully`
    });
    
  } catch (error: any) {
    console.error('Error updating application settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update application settings',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// POST /api/admin/settings/application - Create new application setting
export async function POST(request: NextRequest) {
  try {
    // TEMPORARILY DISABLED: Authentication for testing
    console.log('Create Application Setting: Authentication bypassed for testing');
    
    const body = await request.json();
    console.log('Creating application setting with data:', body);
    
    const createSchema = settingUpdateSchema.extend({
      is_public: z.boolean().default(false)
    });
    
    // Validate input
    const validationResult = createSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error.flatten());
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validationResult.error.flatten()
        },
        { status: 400 }
      );
    }
    
    const { setting_key, setting_value, setting_type, description, is_public } = validationResult.data;
    
    // Convert value to string for storage
    const valueToStore = typeof setting_value === 'string' ? setting_value : String(setting_value);
    
    // Create new setting
    const newSetting = await sql`
      INSERT INTO application_settings (setting_key, setting_value, setting_type, description, is_public)
      VALUES (${setting_key}, ${valueToStore}, ${setting_type || 'string'}, ${description || null}, ${is_public})
      RETURNING *
    `;
    
    console.log('Created application setting:', setting_key);
    
    return NextResponse.json({
      success: true,
      data: {
        ...newSetting[0],
        setting_value: convertSettingValue(newSetting[0].setting_value, newSetting[0].setting_type)
      },
      message: 'Application setting created successfully'
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('Error creating application setting:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return NextResponse.json(
        {
          success: false,
          error: 'Setting key already exists'
        },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create application setting',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// Helper function to convert setting values to appropriate types
function convertSettingValue(value: string, type: string): any {
  switch (type) {
    case 'boolean':
      return value.toLowerCase() === 'true';
    case 'number':
      return Number(value);
    case 'json':
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    case 'string':
    default:
      return value;
  }
}