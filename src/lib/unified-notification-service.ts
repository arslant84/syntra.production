/**
 * Unified Notification Service
 * Complete workflow notification system using database templates
 * Handles all email and in-app notifications for workflow steps
 */

import { sql } from '@/lib/db';
import { emailService } from './email-service';
import { NotificationService } from './notification-service';

export interface WorkflowNotificationParams {
  // Core identification
  eventType: string; // e.g., 'trf_submitted', 'visa_approved_focal', 'claim_rejected'
  entityType: 'trf' | 'visa' | 'claims' | 'transport' | 'accommodation';
  entityId: string;
  
  // Current state
  currentStatus: string;
  previousStatus?: string;
  
  // Requestor information
  requestorId?: string;
  requestorName: string;
  requestorEmail?: string;
  department?: string;
  staffId?: string;
  
  // Approver information (for approvals)
  approverName?: string;
  approverRole?: string;
  approverEmail?: string;
  previousApprover?: string;
  nextApprover?: string;
  
  // Entity-specific data
  entityTitle?: string; // e.g., travel purpose, claim purpose
  entityAmount?: string;
  entityDates?: string; // formatted date range
  travelPurpose?: string;
  claimPurpose?: string;
  transportPurpose?: string;
  accommodationPurpose?: string;
  
  // Action data
  comments?: string;
  rejectionReason?: string;
  
  // System URLs
  baseUrl?: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  recipientType: 'approver' | 'requestor' | 'both';
  variablesAvailable?: string[];
}

export interface NotificationRecipient {
  userId: string;
  name: string;
  email: string;
  role?: string;
  department?: string;
  permissions?: string[];
}

export class UnifiedNotificationService {
  private static readonly DEFAULT_BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3001';

  /**
   * Main entry point for sending workflow notifications
   */
  static async sendWorkflowNotification(params: WorkflowNotificationParams): Promise<void> {
    try {
      console.log(`🔔 Sending workflow notification: ${params.eventType} for ${params.entityType} ${params.entityId}`);

      // Determine which templates to send based on event type
      const templateNames = this.getTemplateNamesForEvent(params.eventType, params.currentStatus);
      
      for (const templateName of templateNames) {
        await this.sendNotificationByTemplate(templateName, params);
      }

    } catch (error) {
      console.error('❌ Error in sendWorkflowNotification:', error);
      throw error;
    }
  }

  /**
   * Send notification using a specific template
   */
  private static async sendNotificationByTemplate(
    templateName: string, 
    params: WorkflowNotificationParams
  ): Promise<void> {
    try {
      // Get template from database
      const template = await this.getNotificationTemplate(templateName);
      if (!template) {
        console.warn(`⚠️  No template found for: ${templateName}`);
        return;
      }

      console.log(`📧 Sending notification using template: ${templateName} (recipient: ${template.recipientType})`);

      // Get recipients based on template type
      const recipients = await this.getRecipientsForTemplate(template, params);
      
      if (recipients.length === 0) {
        console.warn(`⚠️  No recipients found for template: ${templateName}`);
        return;
      }

      console.log(`👥 Found ${recipients.length} recipients for ${templateName}`);

      // Send email and in-app notifications to each recipient
      for (const recipient of recipients) {
        await this.sendToRecipient(recipient, template, params);
      }

    } catch (error) {
      console.error(`❌ Error sending template ${templateName}:`, error);
    }
  }

  /**
   * Send notification to a specific recipient
   */
  private static async sendToRecipient(
    recipient: NotificationRecipient,
    template: NotificationTemplate,
    params: WorkflowNotificationParams
  ): Promise<void> {
    try {
      // Build template variables
      const variables = this.buildTemplateVariables(recipient, params);

      // Process template subject and body
      const subject = this.processTemplate(template.subject, variables);
      const body = this.processTemplate(template.body, variables);

      console.log(`📨 Sending to ${recipient.name} (${recipient.email}): ${subject}`);

      // Send email notification
      if (recipient.email) {
        await emailService.sendEmail({
          to: recipient.email,
          subject,
          html: body,
          from: process.env.DEFAULT_FROM_EMAIL || 'VMS System <noreplyvmspctsb@gmail.com>'
        });
      }

      // Create in-app notification
      await NotificationService.createNotification({
        userId: recipient.userId,
        title: subject,
        message: this.stripHtml(body).substring(0, 500) + '...',
        type: this.getNotificationType(params.eventType),
        category: 'workflow_approval',
        priority: this.getNotificationPriority(params.eventType),
        relatedEntityType: params.entityType,
        relatedEntityId: params.entityId,
        actionRequired: template.recipientType === 'approver',
        actionUrl: variables.approvalUrl || variables.viewUrl
      });

      console.log(`✅ Successfully sent notification to ${recipient.name}`);

    } catch (error) {
      console.error(`❌ Error sending to ${recipient.name}:`, error);
    }
  }

  /**
   * Get notification template from database
   */
  private static async getNotificationTemplate(templateName: string): Promise<NotificationTemplate | null> {
    try {
      const result = await sql`
        SELECT 
          id, name, subject, body,
          recipient_type as "recipientType",
          variables_available as "variablesAvailable"
        FROM notification_templates 
        WHERE name = ${templateName} 
          AND is_active = true
      `;

      return result[0] || null;
    } catch (error) {
      console.error(`Error fetching template ${templateName}:`, error);
      return null;
    }
  }

  /**
   * Get recipients based on template type and workflow context
   */
  private static async getRecipientsForTemplate(
    template: NotificationTemplate,
    params: WorkflowNotificationParams
  ): Promise<NotificationRecipient[]> {
    const recipients: NotificationRecipient[] = [];

    try {
      // Handle requestor notifications
      if (template.recipientType === 'requestor' || template.recipientType === 'both') {
        if (params.requestorId && params.requestorName) {
          recipients.push({
            userId: params.requestorId,
            name: params.requestorName,
            email: params.requestorEmail || '',
            role: 'Requestor',
            department: params.department
          });
        }
      }

      // Handle approver notifications
      if (template.recipientType === 'approver' || template.recipientType === 'both') {
        const approvers = await this.getApproversForWorkflowStep(params);
        recipients.push(...approvers);
      }

    } catch (error) {
      console.error('Error getting recipients:', error);
    }

    return recipients;
  }

  /**
   * Get appropriate approvers for the current workflow step
   */
  private static async getApproversForWorkflowStep(
    params: WorkflowNotificationParams
  ): Promise<NotificationRecipient[]> {
    const approvers: NotificationRecipient[] = [];

    try {
      // Determine required permission based on entity type and status
      const permission = this.getRequiredPermissionForStatus(params.entityType, params.currentStatus);
      
      if (!permission) {
        console.warn(`No permission mapping for ${params.entityType} status: ${params.currentStatus}`);
        return approvers;
      }

      console.log(`🔍 Looking for users with permission: ${permission} in department: ${params.department}`);

      // Get users with required permission
      let query = `
        SELECT DISTINCT 
          u.id, u.name, u.email, u.role, u.department
        FROM users u
        INNER JOIN role_permissions rp ON u.role_id = rp.role_id  
        INNER JOIN permissions p ON rp.permission_id = p.id
        WHERE p.name = $1
          AND u.status = 'Active'
      `;

      const queryParams = [permission];

      // Add department filtering for focal approvals
      if (params.department && permission.includes('focal')) {
        query += ` AND u.department = $2`;
        queryParams.push(params.department);
      }

      const result = await sql.unsafe(query, queryParams);

      for (const user of result) {
        approvers.push({
          userId: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department
        });
      }

      console.log(`👥 Found ${approvers.length} approvers with permission ${permission}`);

    } catch (error) {
      console.error('Error getting approvers:', error);
    }

    return approvers;
  }

  /**
   * Build template variables for processing
   */
  private static buildTemplateVariables(
    recipient: NotificationRecipient,
    params: WorkflowNotificationParams
  ): Record<string, string> {
    const baseUrl = params.baseUrl || this.DEFAULT_BASE_URL;
    
    return {
      // Entity information
      entityId: params.entityId,
      entityType: params.entityType,
      entityTitle: params.entityTitle || '',
      entityAmount: params.entityAmount || '',
      entityDates: params.entityDates || '',
      
      // Requestor information
      requestorName: params.requestorName,
      requestorEmail: params.requestorEmail || '',
      department: params.department || 'Unknown',
      staffId: params.staffId || '',
      
      // Recipient information  
      approverName: recipient.name,
      recipientName: recipient.name,
      
      // Status information
      currentStatus: params.currentStatus,
      previousStatus: params.previousStatus || '',
      
      // Action information
      comments: params.comments || '',
      rejectionReason: params.rejectionReason || '',
      approverRole: params.approverRole || recipient.role || '',
      previousApprover: params.previousApprover || '',
      nextApprover: params.nextApprover || '',
      
      // Entity-specific fields
      travelPurpose: params.travelPurpose || '',
      travelDates: params.entityDates || '',
      claimPurpose: params.claimPurpose || '',
      claimAmount: params.entityAmount || '',
      transportPurpose: params.transportPurpose || '',
      accommodationPurpose: params.accommodationPurpose || '',
      
      // URLs
      approvalUrl: `${baseUrl}/${params.entityType}/approve/${params.entityId}`,
      viewUrl: `${baseUrl}/${params.entityType}/view/${params.entityId}`,
      newRequestUrl: `${baseUrl}/${params.entityType}/new`,
      bookingUrl: `${baseUrl}/${params.entityType}/booking/${params.entityId}`,
      processingUrl: `${baseUrl}/${params.entityType}/process/${params.entityId}`
    };
  }

  /**
   * Process template with variable substitution
   */
  private static processTemplate(template: string, variables: Record<string, string>): string {
    let processed = template;

    // Replace all {variable} placeholders
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      processed = processed.replace(regex, value || '');
    }

    // Handle conditional blocks like {comments && <p><strong>Comments:</strong> {comments}</p>}
    processed = processed.replace(/\{(\w+)\s*&&\s*([^}]+)\}/g, (match, condition, content) => {
      return variables[condition] ? content.replace(/\{(\w+)\}/g, (m, v) => variables[v] || '') : '';
    });

    return processed;
  }

  /**
   * Determine which templates to send based on event type
   */
  private static getTemplateNamesForEvent(eventType: string, currentStatus: string): string[] {
    const templates: string[] = [];

    // Handle submission events - send to both approver and requestor
    if (eventType.includes('submitted')) {
      templates.push(`${eventType}_approver`);
      templates.push(`${eventType}_requestor`);
    }
    // Handle approval events - send progress to requestor and next step to next approver
    else if (eventType.includes('approved_focal')) {
      templates.push(`${eventType}_requestor`);
      templates.push(`${eventType}_next_approver`);
    }
    else if (eventType.includes('approved_manager')) {
      templates.push(`${eventType}_requestor`);
      templates.push(`${eventType}_next_approver`);
    }
    // Handle final approval
    else if (eventType.includes('fully_approved') || currentStatus === 'Approved') {
      templates.push(`${eventType.replace('approved', 'fully_approved')}_requestor`);
    }
    // Handle rejections
    else if (eventType.includes('rejected')) {
      templates.push(`${eventType}_requestor`);
    }
    // Default - try to find exact template name
    else {
      templates.push(eventType);
    }

    return templates;
  }

  /**
   * Get required permission for workflow status
   */
  private static getRequiredPermissionForStatus(entityType: string, status: string): string | null {
    const permissionMap: Record<string, Record<string, string>> = {
      'trf': {
        'Pending Department Focal': 'approve_trf_focal',
        'Pending Line Manager': 'approve_trf_manager', 
        'Pending HOD': 'approve_trf_hod'
      },
      'visa': {
        'Pending Department Focal': 'approve_visa_focal',
        'Pending Line Manager/HOD': 'approve_visa_manager',
        'Pending Visa Clerk': 'process_visa_applications'
      },
      'claims': {
        'Pending Department Focal': 'approve_claims_focal',
        'Pending Line Manager': 'approve_claims_manager',
        'Pending HOD': 'approve_claims_hod',
        'Pending HOD Approval': 'approve_claims_hod',
        'Pending Finance Approval': 'approve_claims_finance'
      },
      'transport': {
        'Pending Department Focal': 'approve_transport_focal',
        'Pending Line Manager': 'approve_transport_manager',
        'Pending HOD': 'approve_transport_hod'
      },
      'accommodation': {
        'Pending Department Focal': 'approve_accommodation_focal',
        'Pending Line Manager': 'approve_accommodation_manager',
        'Pending HOD': 'approve_accommodation_hod'
      }
    };

    return permissionMap[entityType]?.[status] || null;
  }

  /**
   * Helper functions
   */
  private static getNotificationType(eventType: string): 'approval_request' | 'status_update' | 'system' {
    if (eventType.includes('submitted')) return 'approval_request';
    if (eventType.includes('approved') || eventType.includes('rejected')) return 'status_update';
    return 'system';
  }

  private static getNotificationPriority(eventType: string): 'high' | 'normal' | 'low' {
    if (eventType.includes('submitted') || eventType.includes('reminder')) return 'high';
    return 'normal';
  }

  private static stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Convenience methods for common workflow events
   */

  static async notifySubmission(params: {
    entityType: 'trf' | 'visa' | 'claims' | 'transport' | 'accommodation';
    entityId: string;
    requestorId: string;
    requestorName: string;
    requestorEmail?: string;
    department: string;
    entityTitle: string;
    entityAmount?: string;
    entityDates?: string;
  }): Promise<void> {
    await this.sendWorkflowNotification({
      eventType: `${params.entityType}_submitted`,
      entityType: params.entityType,
      entityId: params.entityId,
      currentStatus: 'Pending Department Focal',
      requestorId: params.requestorId,
      requestorName: params.requestorName,
      requestorEmail: params.requestorEmail,
      department: params.department,
      entityTitle: params.entityTitle,
      entityAmount: params.entityAmount,
      entityDates: params.entityDates,
      nextApprover: 'Department Focal'
    });
  }

  static async notifyApproval(params: {
    entityType: 'trf' | 'visa' | 'claims' | 'transport' | 'accommodation';
    entityId: string;
    requestorId: string;
    requestorName: string;
    requestorEmail?: string;
    currentStatus: string;
    previousStatus: string;
    approverName: string;
    approverRole: string;
    nextApprover?: string;
    entityTitle: string;
    comments?: string;
  }): Promise<void> {
    const eventType = this.getApprovalEventType(params.entityType, params.previousStatus);
    
    await this.sendWorkflowNotification({
      eventType,
      entityType: params.entityType,
      entityId: params.entityId,
      currentStatus: params.currentStatus,
      previousStatus: params.previousStatus,
      requestorId: params.requestorId,
      requestorName: params.requestorName,
      requestorEmail: params.requestorEmail,
      approverName: params.approverName,
      approverRole: params.approverRole,
      nextApprover: params.nextApprover,
      entityTitle: params.entityTitle,
      comments: params.comments
    });
  }

  static async notifyRejection(params: {
    entityType: 'trf' | 'visa' | 'claims' | 'transport' | 'accommodation';
    entityId: string;
    requestorId: string;
    requestorName: string;
    requestorEmail?: string;
    approverName: string;
    approverRole: string;
    rejectionReason: string;
    entityTitle: string;
  }): Promise<void> {
    await this.sendWorkflowNotification({
      eventType: `${params.entityType}_rejected`,
      entityType: params.entityType,
      entityId: params.entityId,
      currentStatus: 'Rejected',
      requestorId: params.requestorId,
      requestorName: params.requestorName,
      requestorEmail: params.requestorEmail,
      approverName: params.approverName,
      approverRole: params.approverRole,
      rejectionReason: params.rejectionReason,
      entityTitle: params.entityTitle
    });
  }

  private static getApprovalEventType(entityType: string, previousStatus: string): string {
    if (previousStatus.includes('Department Focal')) {
      return `${entityType}_approved_focal`;
    } else if (previousStatus.includes('Line Manager') || previousStatus.includes('Manager')) {
      return `${entityType}_approved_manager`;
    } else if (previousStatus.includes('HOD')) {
      return `${entityType}_fully_approved`;
    }
    return `${entityType}_approved`;
  }
}

export default UnifiedNotificationService;