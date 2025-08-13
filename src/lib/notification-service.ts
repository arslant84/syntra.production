// Notification Service for SynTra Application
// Handles creating, managing, and retrieving user notifications

import { sql } from '@/lib/db';
import { WebSocketService } from './websocket-service';

export interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: 'approval_request' | 'status_update' | 'system';
  category: 'workflow_approval' | 'personal_status' | 'system_alert';
  priority?: 'high' | 'normal' | 'low';
  relatedEntityType?: 'trf' | 'claim' | 'visa' | 'transport' | 'accommodation';
  relatedEntityId?: string;
  actionRequired?: boolean;
  actionUrl?: string;
  expiresAt?: Date;
}

export interface UserNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  category: string;
  priority: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  actionRequired: boolean;
  actionUrl?: string;
  isRead: boolean;
  isDismissed: boolean;
  readAt?: Date;
  dismissedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface NotificationCounts {
  total: number;
  unread: number;
  pendingActions: number;
  approvalRequests: number;
  statusUpdates: number;
}

export class NotificationService {
  /**
   * Create a new notification for a user
   */
  static async createNotification(params: CreateNotificationParams): Promise<string> {
    try {
      const result = await sql`
        INSERT INTO user_notifications (
          user_id, title, message, type, category, priority,
          related_entity_type, related_entity_id, action_required, action_url, expires_at
        ) VALUES (
          ${params.userId}, ${params.title}, ${params.message}, ${params.type}, ${params.category},
          ${params.priority || 'normal'}, ${params.relatedEntityType || null}, ${params.relatedEntityId || null},
          ${params.actionRequired || false}, ${params.actionUrl || null}, ${params.expiresAt || null}
        )
        RETURNING id
      `;
      
      const notificationId = result[0].id;
      console.log(`Created notification ${notificationId} for user ${params.userId}: ${params.title}`);
      
      // Broadcast to WebSocket connections for real-time updates
      try {
        const wsService = WebSocketService.getInstance();
        const notification = {
          id: notificationId,
          title: params.title,
          message: params.message,
          type: params.type,
          category: params.category,
          createdAt: new Date().toISOString()
        };
        wsService.broadcastToUser(params.userId, notification);
        
        // Also send updated counts
        const counts = await this.getNotificationCounts(params.userId);
        wsService.broadcastCountUpdate(params.userId, counts);
      } catch (wsError) {
        console.error('WebSocket broadcast error:', wsError);
        // Don't fail notification creation due to WebSocket errors
      }
      
      return notificationId;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user with filtering options
   */
  static async getUserNotifications(
    userId: string, 
    options: {
      unreadOnly?: boolean;
      category?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<UserNotification[]> {
    try {
      let query = sql`
        SELECT 
          id, user_id as "userId", title, message, type, category, priority,
          related_entity_type as "relatedEntityType", related_entity_id as "relatedEntityId",
          action_required as "actionRequired", action_url as "actionUrl",
          is_read as "isRead", is_dismissed as "isDismissed",
          read_at as "readAt", dismissed_at as "dismissedAt",
          created_at as "createdAt", updated_at as "updatedAt", expires_at as "expiresAt"
        FROM user_notifications
        WHERE user_id = ${userId}
          AND is_dismissed = FALSE
          AND (expires_at IS NULL OR expires_at > NOW())
      `;

      if (options.unreadOnly) {
        query = sql`${query} AND is_read = FALSE`;
      }

      if (options.category) {
        query = sql`${query} AND category = ${options.category}`;
      }

      query = sql`${query} ORDER BY created_at DESC`;

      if (options.limit) {
        query = sql`${query} LIMIT ${options.limit}`;
      }

      if (options.offset) {
        query = sql`${query} OFFSET ${options.offset}`;
      }

      const result = await query;
      return result as UserNotification[];
    } catch (error) {
      console.error('Error fetching user notifications:', error);
      throw error;
    }
  }

  /**
   * Get notification counts for a user
   */
  static async getNotificationCounts(userId: string): Promise<NotificationCounts> {
    try {
      const result = await sql`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_read = FALSE) as unread,
          COUNT(*) FILTER (WHERE action_required = TRUE AND is_read = FALSE) as pending_actions,
          COUNT(*) FILTER (WHERE category = 'workflow_approval' AND is_read = FALSE) as approval_requests,
          COUNT(*) FILTER (WHERE category = 'personal_status' AND is_read = FALSE) as status_updates
        FROM user_notifications
        WHERE user_id = ${userId}
          AND is_dismissed = FALSE
          AND (expires_at IS NULL OR expires_at > NOW())
      `;

      return {
        total: parseInt(result[0].total || '0'),
        unread: parseInt(result[0].unread || '0'),
        pendingActions: parseInt(result[0].pending_actions || '0'),
        approvalRequests: parseInt(result[0].approval_requests || '0'),
        statusUpdates: parseInt(result[0].status_updates || '0')
      };
    } catch (error) {
      console.error('Error fetching notification counts:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      await sql`
        UPDATE user_notifications 
        SET is_read = TRUE, read_at = NOW(), updated_at = NOW()
        WHERE id = ${notificationId} AND user_id = ${userId}
      `;
      
      console.log(`Marked notification ${notificationId} as read for user ${userId}`);
      
      // Broadcast updated counts to WebSocket connections
      try {
        const wsService = WebSocketService.getInstance();
        const counts = await this.getNotificationCounts(userId);
        wsService.broadcastCountUpdate(userId, counts);
      } catch (wsError) {
        console.error('WebSocket broadcast error:', wsError);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark multiple notifications as read
   */
  static async markMultipleAsRead(notificationIds: string[], userId: string): Promise<void> {
    try {
      await sql`
        UPDATE user_notifications 
        SET is_read = TRUE, read_at = NOW(), updated_at = NOW()
        WHERE id = ANY(${notificationIds}) AND user_id = ${userId}
      `;
      
      console.log(`Marked ${notificationIds.length} notifications as read for user ${userId}`);
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string): Promise<void> {
    try {
      await sql`
        UPDATE user_notifications 
        SET is_read = TRUE, read_at = NOW(), updated_at = NOW()
        WHERE user_id = ${userId} AND is_read = FALSE
      `;
      
      console.log(`Marked all notifications as read for user ${userId}`);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Dismiss a notification
   */
  static async dismissNotification(notificationId: string, userId: string): Promise<void> {
    try {
      await sql`
        UPDATE user_notifications 
        SET is_dismissed = TRUE, dismissed_at = NOW(), updated_at = NOW()
        WHERE id = ${notificationId} AND user_id = ${userId}
      `;
      
      console.log(`Dismissed notification ${notificationId} for user ${userId}`);
    } catch (error) {
      console.error('Error dismissing notification:', error);
      throw error;
    }
  }

  // Workflow-specific notification creators
  
  /**
   * Create notification for new approval request
   */
  static async createApprovalRequest(params: {
    approverId: string;
    requestorName: string;
    entityType: 'trf' | 'claim' | 'visa' | 'transport';
    entityId: string;
    entityTitle?: string;
  }): Promise<string> {
    const entityTypeMap = {
      trf: 'Travel Request',
      claim: 'Expense Claim', 
      visa: 'Visa Application',
      transport: 'Transport Request'
    };

    return this.createNotification({
      userId: params.approverId,
      title: `New ${entityTypeMap[params.entityType]} Approval Required`,
      message: `${params.requestorName} submitted ${params.entityTitle || `${entityTypeMap[params.entityType]} ${params.entityId}`} for your approval`,
      type: 'approval_request',
      category: 'workflow_approval',
      priority: 'high',
      relatedEntityType: params.entityType,
      relatedEntityId: params.entityId,
      actionRequired: true,
      actionUrl: `/${params.entityType}/view/${params.entityId}`
    });
  }

  /**
   * Create notification for status update on user's own request
   */
  static async createStatusUpdate(params: {
    requestorId: string;
    status: string;
    entityType: 'trf' | 'claim' | 'visa' | 'transport';
    entityId: string;
    approverName?: string;
    comments?: string;
  }): Promise<string> {
    const statusMessages = {
      approved: 'has been approved',
      rejected: 'has been rejected', 
      processing: 'is now being processed',
      completed: 'has been completed'
    };

    const message = `Your ${params.entityType.toUpperCase()} ${params.entityId} ${statusMessages[params.status.toLowerCase()] || `status updated to ${params.status}`}${params.approverName ? ` by ${params.approverName}` : ''}${params.comments ? `. Comments: ${params.comments}` : ''}`;

    return this.createNotification({
      userId: params.requestorId,
      title: `${params.entityType.toUpperCase()} Status Update`,
      message,
      type: 'status_update',
      category: 'personal_status',
      priority: 'normal',
      relatedEntityType: params.entityType,
      relatedEntityId: params.entityId,
      actionRequired: false,
      actionUrl: `/${params.entityType}/view/${params.entityId}`
    });
  }
}