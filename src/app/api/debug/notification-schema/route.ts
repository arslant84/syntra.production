// Debug endpoint to check notification database schema
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { sql } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can access debug info
    if (!await hasPermission('manage_users')) {
      return NextResponse.json({ error: 'Unauthorized - insufficient permissions' }, { status: 403 });
    }

    const debugInfo: any = {};

    // 1. Check if user_notifications table exists and its structure
    try {
      const notificationTableInfo = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'user_notifications'
        ORDER BY ordinal_position
      `;
      debugInfo.notificationTableSchema = notificationTableInfo;
    } catch (error) {
      debugInfo.notificationTableSchema = { error: error.message };
    }

    // 2. Check if permissions table exists and has focal permission
    try {
      const permissionsTable = await sql`
        SELECT id, name, description 
        FROM permissions 
        WHERE name LIKE '%focal%' OR name LIKE '%approve%'
        ORDER BY name
      `;
      debugInfo.approvalPermissions = permissionsTable;
    } catch (error) {
      debugInfo.approvalPermissions = { error: error.message };
    }

    // 3. Check if roles table has Department Focal role
    try {
      const rolesTable = await sql`
        SELECT id, name, description 
        FROM roles 
        WHERE name LIKE '%focal%' OR name LIKE '%Focal%'
        ORDER BY name
      `;
      debugInfo.focalRoles = rolesTable;
    } catch (error) {
      debugInfo.focalRoles = { error: error.message };
    }

    // 4. Check if role_permissions table has correct mappings
    try {
      const rolePermissionMappings = await sql`
        SELECT 
          r.name as role_name,
          p.name as permission_name
        FROM role_permissions rp
        INNER JOIN roles r ON rp.role_id = r.id
        INNER JOIN permissions p ON rp.permission_id = p.id
        WHERE r.name LIKE '%Focal%' OR p.name LIKE '%focal%'
        ORDER BY r.name, p.name
      `;
      debugInfo.focalRolePermissions = rolePermissionMappings;
    } catch (error) {
      debugInfo.focalRolePermissions = { error: error.message };
    }

    // 5. Sample notification records (latest 5)
    try {
      const sampleNotifications = await sql`
        SELECT 
          id, user_id, title, message, type, category, 
          related_entity_type, related_entity_id, is_read, created_at
        FROM user_notifications 
        ORDER BY created_at DESC 
        LIMIT 5
      `;
      debugInfo.sampleNotifications = sampleNotifications;
    } catch (error) {
      debugInfo.sampleNotifications = { error: error.message };
    }

    // 6. Count total notifications by category
    try {
      const notificationCounts = await sql`
        SELECT 
          category,
          type,
          COUNT(*) as count,
          COUNT(*) FILTER (WHERE is_read = FALSE) as unread_count
        FROM user_notifications 
        GROUP BY category, type
        ORDER BY count DESC
      `;
      debugInfo.notificationCountsByCategory = notificationCounts;
    } catch (error) {
      debugInfo.notificationCountsByCategory = { error: error.message };
    }

    return NextResponse.json(debugInfo);

  } catch (error) {
    console.error('Error in notification schema debug:', error);
    return NextResponse.json({ error: 'Failed to fetch schema debug info', details: error.message }, { status: 500 });
  }
}