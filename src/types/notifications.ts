// TypeScript types for notification system

export interface UserNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'approval_request' | 'status_update' | 'system';
  category: 'workflow_approval' | 'personal_status' | 'system_alert';
  priority: 'high' | 'normal' | 'low';
  relatedEntityType?: 'trf' | 'claim' | 'visa' | 'transport' | 'accommodation';
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

export interface NotificationPreferences {
  id: string;
  userId: string;
  emailEnabled: boolean;
  inappEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SSENotificationEvent {
  type: 'connected' | 'notification_update' | 'counts' | 'heartbeat';
  data?: any;
  message?: string;
  timestamp: string;
}