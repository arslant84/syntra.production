// src/types/notifications.ts

/**
 * Represents a notification template
 */
export interface NotificationTemplate {
  id: string;
  name: string;
  description?: string | null;
  subject: string;
  body: string;
  type: 'email' | 'system' | 'both';
  eventType: string;
  created_at?: string | Date;
  updated_at?: string | Date;
}

/**
 * Represents a notification event type
 */
export interface NotificationEventType {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string | Date;
  updated_at?: string | Date;
}

/**
 * Form values for creating or updating a notification template
 */
export interface NotificationTemplateFormValues {
  name: string;
  description?: string | null;
  subject: string;
  body: string;
  type: 'email' | 'system' | 'both';
  eventType: string;
}
