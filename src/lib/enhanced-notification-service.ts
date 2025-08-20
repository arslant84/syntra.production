/**
 * Enhanced Event-Based Notification Service
 * Manages notifications based on events with user subscriptions and permissions
 */

import { sql } from '@/lib/db';
import { NotificationService } from './notification-service';

export interface NotificationEventType {
  id: string;
  name: string;
  description?: string;
  category: 'approval' | 'status_update' | 'system' | 'reminder';
  module: 'trf' | 'visa' | 'claims' | 'transport' | 'accommodation' | 'general';
  isActive: boolean;
}

export interface NotificationUserSubscription {
  id: string;
  userId: string;
  eventTypeId: string;
  permissionRequired?: string;
  roleRequired?: string;
  departmentFilter?: string;
  isEnabled: boolean;
  notificationMethod: 'email' | 'in_app' | 'both';
}

export interface EnhancedNotificationTemplate {
  id: string;
  name: string;
  description?: string;
  subject: string;
  body: string;
  eventTypeId?: string;
  notificationType: 'email' | 'in_app' | 'sms';
  isActive: boolean;
  variablesAvailable?: string[];
}

export interface EventNotificationParams {
  eventName: string;
  entityId: string;
  entityType: 'trf' | 'visa' | 'claims' | 'transport' | 'accommodation';
  requestorId?: string;
  requestorName?: string;
  approverName?: string;
  comments?: string;
  department?: string;
  customVariables?: Record<string, any>;
}

export class EnhancedNotificationService {
  /**
   * Trigger notifications based on event name
   */
  static async triggerEventNotification(params: EventNotificationParams): Promise<void> {
    try {
      console.log(`Triggering event notification: ${params.eventName} for ${params.entityType} ${params.entityId}`);

      // Get event type
      const eventType = await this.getEventTypeByName(params.eventName);
      if (!eventType || !eventType.isActive) {
        console.log(`Event type ${params.eventName} not found or inactive`);
        return;
      }

      // Get eligible users for this event
      const eligibleUsers = await this.getEligibleUsersForEvent(eventType.id, params.department);
      
      // Get notification templates for this event
      const templates = await this.getTemplatesForEvent(eventType.id);

      console.log(`Found ${eligibleUsers.length} eligible users and ${templates.length} templates for event ${params.eventName}`);

      // Send notifications to each eligible user
      for (const user of eligibleUsers) {
        for (const template of templates) {
          if (this.shouldSendNotification(user, template, params)) {
            await this.sendEventBasedNotification(user, template, eventType, params);
          }
        }
      }

    } catch (error) {
      console.error('Error triggering event notification:', error);
    }
  }

  /**
   * Get event type by name
   */
  private static async getEventTypeByName(eventName: string): Promise<NotificationEventType | null> {
    try {
      const result = await sql`
        SELECT id, name, description, category, module, is_active as "isActive"
        FROM notification_event_types
        WHERE name = ${eventName} AND is_active = true
      `;
      return result[0] || null;
    } catch (error) {
      console.error('Error fetching event type:', error);
      return null;
    }
  }

  /**
   * Get eligible users for an event based on subscriptions and permissions
   */
  private static async getEligibleUsersForEvent(eventTypeId: string, department?: string): Promise<any[]> {
    try {
      let query = `
        SELECT DISTINCT 
          u.id, u.name, u.email, u.role, u.department,
          nus.notification_method as "notificationMethod",
          nus.permission_required as "permissionRequired"
        FROM users u
        INNER JOIN notification_user_subscriptions nus ON u.id = nus.user_id
        WHERE nus.event_type_id = $1
          AND nus.is_enabled = true
          AND u.status = 'Active'
      `;
      
      const params = [eventTypeId];
      
      // Add department filtering if specified
      if (department && department !== 'Unknown') {
        query += ` AND (nus.department_filter IS NULL OR nus.department_filter = $2 OR u.department = $2)`;
        params.push(department);
      } else {
        query += ` AND nus.department_filter IS NULL`;
      }

      const result = await sql.unsafe(query, params);
      
      // Filter by permissions
      const eligibleUsers = [];
      for (const user of result) {
        if (user.permissionRequired) {
          // Check if user has required permission
          const hasPermission = await this.userHasPermission(user.id, user.permissionRequired);
          if (hasPermission) {
            eligibleUsers.push(user);
          }
        } else {
          eligibleUsers.push(user);
        }
      }

      return eligibleUsers;
    } catch (error) {
      console.error('Error getting eligible users:', error);
      return [];
    }
  }

  /**
   * Get notification templates for an event
   */
  private static async getTemplatesForEvent(eventTypeId: string): Promise<EnhancedNotificationTemplate[]> {
    try {
      const result = await sql`
        SELECT 
          id, name, description, subject, body, 
          event_type_id as "eventTypeId",
          notification_type as "notificationType",
          is_active as "isActive",
          variables_available as "variablesAvailable"
        FROM notification_templates
        WHERE event_type_id = ${eventTypeId} AND is_active = true
      `;
      return result;
    } catch (error) {
      console.error('Error fetching templates for event:', error);
      return [];
    }
  }

  /**
   * Check if user has required permission
   */
  private static async userHasPermission(userId: string, permissionName: string): Promise<boolean> {
    try {
      const result = await sql`
        SELECT COUNT(*) as count
        FROM users u
        INNER JOIN role_permissions rp ON u.role_id = rp.role_id
        INNER JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = ${userId} AND p.name = ${permissionName}
      `;
      return parseInt(result[0].count) > 0;
    } catch (error) {
      console.error('Error checking user permission:', error);
      return false;
    }
  }

  /**
   * Determine if notification should be sent to user
   */
  private static shouldSendNotification(
    user: any, 
    template: EnhancedNotificationTemplate, 
    params: EventNotificationParams
  ): boolean {
    // Don't send approval requests to the requestor themselves
    if (template.name.includes('submitted') && user.id === params.requestorId) {
      return false;
    }

    // Don't send status updates to approvers (only to requestors)
    if (template.name.includes('approved') || template.name.includes('rejected')) {
      return user.id === params.requestorId;
    }

    return true;
  }

  /**
   * Send notification using template with variable substitution
   */
  private static async sendEventBasedNotification(
    user: any,
    template: EnhancedNotificationTemplate,
    eventType: NotificationEventType,
    params: EventNotificationParams
  ): Promise<void> {
    try {
      // Prepare template variables
      const variables = {
        userName: user.name || 'User',
        requestId: params.entityId,
        requestorName: params.requestorName || 'Someone',
        approverName: params.approverName || '',
        comments: params.comments || '',
        entityType: params.entityType.toUpperCase(),
        date: new Date().toLocaleDateString(),
        ...params.customVariables
      };

      // Substitute variables in subject and body
      let subject = this.substituteVariables(template.subject, variables);
      let body = this.substituteVariables(template.body, variables);

      // Determine notification type and category
      const notificationType = eventType.category === 'approval' ? 'approval_request' : 'status_update';
      const category = eventType.category === 'approval' ? 'workflow_approval' : 'personal_status';

      // Send via in-app notification
      if (user.notificationMethod === 'in_app' || user.notificationMethod === 'both') {
        await NotificationService.createNotification({
          userId: user.id,
          title: subject,
          message: body,
          type: notificationType as any,
          category: category as any,
          priority: eventType.category === 'approval' ? 'high' : 'normal',
          relatedEntityType: params.entityType,
          relatedEntityId: params.entityId,
          actionRequired: eventType.category === 'approval',
          actionUrl: `/${params.entityType}/view/${params.entityId}`
        });
      }

      // TODO: Send via email if notificationMethod is 'email' or 'both'
      // This would integrate with your email service

      console.log(`Sent ${template.notificationType} notification to ${user.name} for event ${eventType.name}`);

    } catch (error) {
      console.error('Error sending event-based notification:', error);
    }
  }

  /**
   * Replace template variables with actual values
   */
  private static substituteVariables(template: string, variables: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, String(value || ''));
    }
    return result;
  }

  // Admin management methods

  /**
   * Get all notification event types
   */
  static async getAllEventTypes(): Promise<NotificationEventType[]> {
    try {
      const result = await sql`
        SELECT id, name, description, category, module, is_active as "isActive"
        FROM notification_event_types
        ORDER BY module, category, name
      `;
      return result;
    } catch (error) {
      console.error('Error fetching event types:', error);
      return [];
    }
  }

  /**
   * Create user subscription for event
   */
  static async createUserSubscription(subscription: Partial<NotificationUserSubscription>): Promise<void> {
    try {
      await sql`
        INSERT INTO notification_user_subscriptions (
          user_id, event_type_id, permission_required, role_required,
          department_filter, notification_method, is_enabled
        ) VALUES (
          ${subscription.userId}, ${subscription.eventTypeId}, 
          ${subscription.permissionRequired || null}, ${subscription.roleRequired || null},
          ${subscription.departmentFilter || null}, ${subscription.notificationMethod || 'in_app'},
          ${subscription.isEnabled !== false}
        )
        ON CONFLICT (user_id, event_type_id) DO UPDATE SET
          permission_required = EXCLUDED.permission_required,
          role_required = EXCLUDED.role_required,
          department_filter = EXCLUDED.department_filter,
          notification_method = EXCLUDED.notification_method,
          is_enabled = EXCLUDED.is_enabled,
          updated_at = NOW()
      `;
    } catch (error) {
      console.error('Error creating user subscription:', error);
      throw error;
    }
  }

  /**
   * Get user subscriptions
   */
  static async getUserSubscriptions(userId: string): Promise<NotificationUserSubscription[]> {
    try {
      const result = await sql`
        SELECT 
          id, user_id as "userId", event_type_id as "eventTypeId",
          permission_required as "permissionRequired", role_required as "roleRequired",
          department_filter as "departmentFilter", is_enabled as "isEnabled",
          notification_method as "notificationMethod"
        FROM notification_user_subscriptions
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;
      return result;
    } catch (error) {
      console.error('Error fetching user subscriptions:', error);
      return [];
    }
  }

  // Convenience methods for common events

  /**
   * Trigger TRF submission notification
   */
  static async triggerTRFSubmitted(params: {
    trfId: string;
    requestorId: string;
    requestorName: string;
    department?: string;
  }): Promise<void> {
    return this.triggerEventNotification({
      eventName: 'trf_submitted',
      entityId: params.trfId,
      entityType: 'trf',
      requestorId: params.requestorId,
      requestorName: params.requestorName,
      department: params.department
    });
  }

  /**
   * Trigger approval notification
   */
  static async triggerApprovalEvent(params: {
    eventName: string;
    entityId: string;
    entityType: 'trf' | 'visa' | 'claims' | 'transport' | 'accommodation';
    requestorId: string;
    approverName: string;
    comments?: string;
  }): Promise<void> {
    return this.triggerEventNotification({
      eventName: params.eventName,
      entityId: params.entityId,
      entityType: params.entityType,
      requestorId: params.requestorId,
      approverName: params.approverName,
      comments: params.comments
    });
  }
}