// Enhanced Email Service for Workflow Notifications
// Handles role-based email distribution with approval links

import { emailService } from './email-service';
import { sql } from './db';

export interface WorkflowEmailParams {
  eventType: string;
  entityType: 'trf' | 'claim' | 'visa' | 'transport' | 'accommodation';
  entityId: string;
  requestorName: string;
  requestorEmail?: string;
  requestorId?: string;
  currentStatus: string;
  department?: string;
  approverRole?: string;
  approverName?: string;
  comments?: string;
  templateVariables?: Record<string, string>;
}

interface EmailRecipient {
  email: string;
  name: string;
  role: string;
  userId?: string;
}

export class WorkflowEmailService {
  private static readonly BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  /**
   * Send workflow-based email notifications
   */
  static async sendWorkflowNotification(params: WorkflowEmailParams): Promise<void> {
    try {
      console.log(`📧 WORKFLOW_EMAIL: Sending workflow notification for ${params.eventType}: ${params.entityType} ${params.entityId}`);
      console.log(`📧 WORKFLOW_EMAIL: Current status: ${params.currentStatus}, Department: ${params.department}`);

      // Get email template for this event type
      const template = await this.getEmailTemplate(params.eventType);
      if (!template) {
        console.warn(`❌ WORKFLOW_EMAIL: No email template found for event type: ${params.eventType}`);
        return;
      }
      console.log(`✅ WORKFLOW_EMAIL: Found template for ${params.eventType}`);

      // Get recipients based on event type and current status
      const recipients = await this.getRecipientsForEvent(params);
      if (recipients.length === 0) {
        console.warn(`❌ WORKFLOW_EMAIL: No recipients found for event: ${params.eventType}`);
        return;
      }
      console.log(`✅ WORKFLOW_EMAIL: Found ${recipients.length} recipients:`, recipients.map(r => `${r.name} (${r.email})`));

      // Prepare template variables
      const variables = this.prepareTemplateVariables(params);

      // Process template
      const subject = this.replaceTemplateVariables(template.subject, variables);
      const body = this.replaceTemplateVariables(template.body, variables);

      console.log(`📧 WORKFLOW_EMAIL: Processed template - Subject: ${subject}`);

      // Send emails
      await this.sendToRecipients(recipients, subject, body, params);
      console.log(`✅ WORKFLOW_EMAIL: Email sent successfully for ${params.eventType}`);

    } catch (error) {
      console.error(`❌ WORKFLOW_EMAIL: Error sending workflow notification for ${params.eventType}:`, error);
      console.error(`❌ WORKFLOW_EMAIL: Error stack:`, error.stack);
      throw error;
    }
  }

  /**
   * Get email template for event type
   */
  private static async getEmailTemplate(eventType: string): Promise<{subject: string, body: string} | null> {
    try {
      // First try to get template by event type with join
      let templates = await sql`
        SELECT nt.subject, nt.body
        FROM notification_templates nt
        INNER JOIN notification_event_types net ON nt.event_type_id = net.id
        WHERE net.name = ${eventType}
        LIMIT 1
      `;

      // If no template found with join, try direct name match
      if (templates.length === 0) {
        console.log(`No template found with event type join for ${eventType}, trying direct name match`);
        templates = await sql`
          SELECT subject, body
          FROM notification_templates
          WHERE name = ${eventType}
          LIMIT 1
        `;
      }

      // If still no template found, try pattern matching for approver templates
      if (templates.length === 0) {
        console.log(`No direct template found for ${eventType}, trying pattern matching`);
        templates = await sql`
          SELECT subject, body
          FROM notification_templates
          WHERE name LIKE ${eventType + '_approver%'} OR name LIKE ${eventType + '%'}
          LIMIT 1
        `;
      }

      if (templates.length > 0) {
        console.log(`Found email template for ${eventType}`);
        console.log(`Subject: ${templates[0].subject}`);
        console.log(`Body length: ${templates[0].body?.length || 0} characters`);
        return templates[0];
      }

      console.warn(`No email template found for event type: ${eventType}`);
      return null;
    } catch (error) {
      console.error(`Error fetching email template for ${eventType}:`, error);
      return null;
    }
  }

  /**
   * Get recipients based on event type and workflow stage
   */
  private static async getRecipientsForEvent(params: WorkflowEmailParams): Promise<EmailRecipient[]> {
    const recipients: EmailRecipient[] = [];

    try {
      console.log(`📧 WORKFLOW_EMAIL: Getting recipients for event ${params.eventType}, status: ${params.currentStatus}`);
      
      // ALWAYS add requestor for CC purposes - ensures transparency at all workflow stages
      if (params.requestorEmail || params.requestorId) {
        const requestor = await this.getRequestorInfo(params.requestorId, params.requestorEmail);
        if (requestor) {
          recipients.push({
            email: requestor.email,
            name: params.requestorName || requestor.name,
            role: 'requestor',
            userId: requestor.id
          });
          console.log(`✅ WORKFLOW_EMAIL: Added requestor for CC: ${requestor.name} (${requestor.email})`);
        }
      } else {
        console.warn(`⚠️ WORKFLOW_EMAIL: No requestor email/ID provided for ${params.entityType} ${params.entityId}`);
      }

      // Add approvers based on current status and event type
      if (this.isApprovalEvent(params.eventType)) {
        const approvers = await this.getApproversForStatus(params);
        recipients.push(...approvers);
      }

      // Add processors for post-approval events
      if (this.isProcessingEvent(params.eventType)) {
        const processors = await this.getProcessorsForEvent(params);
        recipients.push(...processors);
      }

      return recipients;
    } catch (error) {
      console.error('Error getting recipients:', error);
      return recipients;
    }
  }

  /**
   * Get requestor information
   */
  private static async getRequestorInfo(userId?: string, email?: string): Promise<{id: string, name: string, email: string} | null> {
    try {
      let user;
      
      if (userId) {
        [user] = await sql`SELECT id, name, email FROM users WHERE id = ${userId} AND status = 'Active'`;
      } else if (email) {
        [user] = await sql`SELECT id, name, email FROM users WHERE email = ${email} AND status = 'Active'`;
      }

      return user || null;
    } catch (error) {
      console.error('Error getting requestor info:', error);
      return null;
    }
  }

  /**
   * Get approvers for current workflow status
   */
  private static async getApproversForStatus(params: WorkflowEmailParams): Promise<EmailRecipient[]> {
    const approvers: EmailRecipient[] = [];

    try {
      let permissionName = '';
      
      // Map status to required permission
      switch (params.currentStatus) {
        case 'Pending Department Focal':
          // Use the actual permission names from the database
          if (params.entityType === 'transport') {
            permissionName = 'approve_transport_requests';
          } else if (params.entityType === 'accommodation') {
            permissionName = 'approve_accommodation_requests';
          } else if (params.entityType === 'visa') {
            permissionName = 'process_visa_applications';
          } else if (params.entityType === 'trf') {
            permissionName = 'approve_trf_focal';
          } else if (params.entityType === 'claim') {
            permissionName = 'approve_claims_focal';
          } else {
            permissionName = `approve_${params.entityType}_focal`;
          }
          break;
        case 'Pending Line Manager':
          // For Line Manager, use similar mapping
          if (params.entityType === 'transport') {
            permissionName = 'approve_transport_requests';
          } else if (params.entityType === 'trf') {
            permissionName = 'approve_trf_manager';
          } else {
            permissionName = `approve_${params.entityType}_manager`;
          }
          break;
        case 'Pending HOD':
          // For HOD, use similar mapping
          if (params.entityType === 'transport') {
            permissionName = 'approve_transport_requests';
          } else if (params.entityType === 'trf') {
            permissionName = 'approve_trf_hod';
          } else {
            permissionName = `approve_${params.entityType}_hod`;
          }
          break;
        default:
          console.warn(`No permission mapping for status: ${params.currentStatus}`);
          return approvers;
      }

      // Get users with the required permission
      let query = `
        SELECT DISTINCT u.id, u.name, u.email, r.name as role_name
        FROM users u
        INNER JOIN roles r ON u.role_id = r.id
        INNER JOIN role_permissions rp ON r.id = rp.role_id
        INNER JOIN permissions p ON rp.permission_id = p.id
        WHERE p.name = $1
          AND u.status = 'Active'
          AND u.email IS NOT NULL
      `;

      const queryParams = [permissionName];

      // Add department filtering for department-specific approvals
      if (params.department && params.department !== 'Unknown' && params.currentStatus === 'Pending Department Focal') {
        query += ` AND u.department = $2`;
        queryParams.push(params.department);
      }

      console.log(`🔍 WORKFLOW_EMAIL: Executing permission query for: ${permissionName}`);
      console.log(`🔍 WORKFLOW_EMAIL: Query: ${query}`);
      console.log(`🔍 WORKFLOW_EMAIL: Params:`, queryParams);
      
      const users = await sql.unsafe(query, queryParams);
      console.log(`🔍 WORKFLOW_EMAIL: Query returned ${users.length} users`);

      for (const user of users) {
        approvers.push({
          email: user.email,
          name: user.name,
          role: user.role_name,
          userId: user.id
        });
        console.log(`✅ WORKFLOW_EMAIL: Added approver: ${user.name} (${user.email}) - Role: ${user.role_name}`);
      }

      console.log(`✅ WORKFLOW_EMAIL: Found ${approvers.length} approvers for ${params.currentStatus}`);
      return approvers;

    } catch (error) {
      console.error('Error getting approvers:', error);
      return approvers;
    }
  }

  /**
   * Get processors for post-approval events
   */
  private static async getProcessorsForEvent(params: WorkflowEmailParams): Promise<EmailRecipient[]> {
    const processors: EmailRecipient[] = [];

    try {
      let permissionName = '';

      // Map event to processing permission
      if (params.eventType === 'trf_needs_booking') {
        permissionName = 'book_flights';
      } else if (params.eventType.includes('_processing')) {
        permissionName = `process_${params.entityType}`;
      }

      if (!permissionName) {
        return processors;
      }

      const users = await sql`
        SELECT DISTINCT u.id, u.name, u.email, r.name as role_name
        FROM users u
        INNER JOIN roles r ON u.role_id = r.id
        INNER JOIN role_permissions rp ON r.id = rp.role_id
        INNER JOIN permissions p ON rp.permission_id = p.id
        WHERE p.name = ${permissionName}
          AND u.status = 'Active'
          AND u.email IS NOT NULL
      `;

      for (const user of users) {
        processors.push({
          email: user.email,
          name: user.name,
          role: user.role_name,
          userId: user.id
        });
      }

      return processors;
    } catch (error) {
      console.error('Error getting processors:', error);
      return processors;
    }
  }

  /**
   * Prepare template variables including approval links
   */
  private static prepareTemplateVariables(params: WorkflowEmailParams): Record<string, string> {
    const baseUrl = this.BASE_URL;
    const approvalUrl = `${baseUrl}/${params.entityType === 'claim' ? 'claims' : params.entityType}/view/${params.entityId}`;
    const dashboardUrl = `${baseUrl}/dashboard`;

    const variables = {
      requestorName: params.requestorName,
      entityType: params.entityType.toUpperCase(),
      entityId: params.entityId,
      currentStatus: params.currentStatus,
      department: params.department || 'Unknown',
      approverName: params.approverName || '',
      comments: params.comments || '',
      approvalUrl,
      dashboardUrl,
      baseUrl,
      // Add formatted entity name
      entityTypeName: this.getEntityTypeName(params.entityType),
      // Add action buttons HTML
      approvalButtons: this.generateApprovalButtons(params.entityType, params.entityId),
      ...params.templateVariables
    };

    return variables;
  }

  /**
   * Get user-friendly entity type name
   */
  private static getEntityTypeName(entityType: string): string {
    const typeMap = {
      trf: 'Travel Request',
      claim: 'Expense Claim',
      visa: 'Visa Application',
      transport: 'Transport Request',
      accommodation: 'Accommodation Request'
    };
    return typeMap[entityType] || entityType;
  }

  /**
   * Generate approval action buttons HTML
   */
  private static generateApprovalButtons(entityType: string, entityId: string): string {
    const baseUrl = this.BASE_URL;
    const viewUrl = `${baseUrl}/${entityType === 'claim' ? 'claims' : entityType}/view/${entityId}`;
    
    return `
      <div style="margin: 20px 0; text-align: center;">
        <a href="${viewUrl}" 
           style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 0 8px; display: inline-block;">
          View & Review Request
        </a>
        <a href="${baseUrl}/dashboard" 
           style="background-color: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 0 8px; display: inline-block;">
          Go to Dashboard
        </a>
      </div>
    `;
  }

  /**
   * Replace template variables in text
   */
  private static replaceTemplateVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    
    console.log('Template variables:', Object.keys(variables));
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      const replacementValue = value || '';
      result = result.replace(regex, replacementValue);
      
      // Log replacement for debugging
      if (template.includes(`{${key}}`)) {
        console.log(`Replaced {${key}} with: "${replacementValue}"`);
      }
    }

    // Check for any unreplaced variables
    const unreplacedMatches = result.match(/\{[^}]+\}/g);
    if (unreplacedMatches) {
      console.warn('Unreplaced template variables found:', unreplacedMatches);
    }

    return result;
  }

  /**
   * Send emails to recipients with proper TO/CC distribution
   * Enhanced workflow: Always CC requestor, TO goes to appropriate approver/processor
   */
  private static async sendToRecipients(
    recipients: EmailRecipient[],
    subject: string,
    body: string,
    params: WorkflowEmailParams
  ): Promise<void> {
    console.log(`📧 WORKFLOW_EMAIL: Processing recipients for workflow stage notification`);
    console.log(`📧 WORKFLOW_EMAIL: Event: ${params.eventType}, Status: ${params.currentStatus}`);
    
    // Always ensure requestor is in CC for all workflow stages
    const requestorEmail = params.requestorEmail;
    const nonRequestorRecipients = recipients.filter(r => r.role !== 'requestor');

    if (nonRequestorRecipients.length === 0 && !requestorEmail) {
      console.warn('❌ WORKFLOW_EMAIL: No recipients to send email to');
      return;
    }

    try {
      // Enhanced workflow-based email routing
      if (this.isWorkflowNotification(params)) {
        await this.sendWorkflowStageEmail(nonRequestorRecipients, requestorEmail, subject, body, params);
      } else {
        await this.sendGeneralNotificationEmail(recipients, subject, body, params);
      }

      console.log(`✅ WORKFLOW_EMAIL: Email sent successfully for ${params.eventType}: ${params.entityId}`);
    } catch (error) {
      console.error('❌ WORKFLOW_EMAIL: Error sending emails:', error);
      throw error;
    }
  }

  /**
   * Send workflow stage-specific emails with proper routing
   */
  private static async sendWorkflowStageEmail(
    approvers: EmailRecipient[],
    requestorEmail: string | undefined,
    subject: string,
    body: string,
    params: WorkflowEmailParams
  ): Promise<void> {
    
    const workflowStage = this.determineWorkflowStage(params.currentStatus);
    console.log(`📧 WORKFLOW_EMAIL: Sending ${workflowStage} stage notification`);
    
    // Always include requestor in CC for transparency
    const ccList: string[] = [];
    if (requestorEmail) {
      ccList.push(requestorEmail);
      console.log(`📧 WORKFLOW_EMAIL: Added requestor to CC: ${requestorEmail}`);
    }

    // Send to appropriate approvers/processors based on workflow stage
    if (approvers.length > 0) {
      const toList = approvers.map(r => r.email);
      
      console.log(`📧 WORKFLOW_EMAIL: TO: ${toList.join(', ')}`);
      console.log(`📧 WORKFLOW_EMAIL: CC: ${ccList.join(', ')}`);
      
      await emailService.sendEmail({
        to: toList.join(', '),
        cc: ccList.length > 0 ? ccList.join(', ') : undefined,
        subject: `[${workflowStage}] ${subject}`,
        html: this.enhanceEmailBody(body, workflowStage, params)
      });
      
      // Log workflow stage for audit trail
      console.log(`✅ WORKFLOW_EMAIL: ${workflowStage} notification sent for ${params.entityType} ${params.entityId}`);
    } else {
      console.warn(`❌ WORKFLOW_EMAIL: No approvers found for ${workflowStage} stage`);
    }
  }

  /**
   * Send general notification emails (confirmations, rejections, etc.)
   */
  private static async sendGeneralNotificationEmail(
    recipients: EmailRecipient[],
    subject: string,
    body: string,
    params: WorkflowEmailParams
  ): Promise<void> {
    const requestor = recipients.find(r => r.role === 'requestor');
    const others = recipients.filter(r => r.role !== 'requestor');

    // Status update or completion: TO = requestor, CC = relevant stakeholders
    if (requestor) {
      const ccList = others.length > 0 ? others.map(r => r.email).join(', ') : undefined;
      
      await emailService.sendEmail({
        to: requestor.email,
        cc: ccList,
        subject,
        html: body
      });
      
      console.log(`✅ WORKFLOW_EMAIL: General notification sent to requestor: ${requestor.email}`);
    }
  }

  /**
   * Determine workflow stage from current status
   */
  private static determineWorkflowStage(currentStatus: string): string {
    switch (currentStatus) {
      case 'Pending Department Focal':
        return 'Department Focal Approval';
      case 'Pending Line Manager':
        return 'Line Manager Approval';
      case 'Pending HOD':
        return 'HOD Approval';
      case 'Approved':
        return 'Processing Required';
      case 'Processed':
        return 'Completion Confirmation';
      default:
        return 'Workflow Notification';
    }
  }

  /**
   * Check if this is a workflow stage notification
   */
  private static isWorkflowNotification(params: WorkflowEmailParams): boolean {
    const workflowStatuses = [
      'Pending Department Focal',
      'Pending Line Manager', 
      'Pending HOD',
      'Approved'
    ];
    return workflowStatuses.includes(params.currentStatus);
  }

  /**
   * Enhance email body with workflow stage information
   */
  private static enhanceEmailBody(body: string, workflowStage: string, params: WorkflowEmailParams): string {
    const stageInfo = `
      <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 12px; margin: 16px 0;">
        <h3 style="margin: 0 0 8px 0; color: #0ea5e9;">📋 ${workflowStage}</h3>
        <p style="margin: 0; color: #374151;">
          <strong>Request Type:</strong> ${params.entityType.toUpperCase()}<br>
          <strong>Request ID:</strong> ${params.entityId}<br>
          <strong>Requestor:</strong> ${params.requestorName}<br>
          <strong>Department:</strong> ${params.department || 'N/A'}
        </p>
      </div>
    `;
    
    return stageInfo + body;
  }

  /**
   * Check if event type requires approval
   */
  private static isApprovalEvent(eventType: string): boolean {
    return eventType.includes('_submitted') || 
           eventType.includes('_needs_') ||
           eventType.includes('_requires_');
  }

  /**
   * Check if event type is for processing
   */
  private static isProcessingEvent(eventType: string): boolean {
    return eventType.includes('_processing') || 
           eventType.includes('_needs_booking') ||
           eventType.includes('_ready');
  }

  /**
   * Quick method for common workflow events
   */
  static async sendSubmissionNotification(params: {
    entityType: 'trf' | 'claim' | 'visa' | 'transport' | 'accommodation';
    entityId: string;
    requestorName: string;
    requestorEmail?: string;
    requestorId?: string;
    department?: string;
  }): Promise<void> {
    await this.sendWorkflowNotification({
      eventType: `${params.entityType}_submitted`,
      entityType: params.entityType,
      entityId: params.entityId,
      requestorName: params.requestorName,
      requestorEmail: params.requestorEmail,
      requestorId: params.requestorId,
      currentStatus: 'Pending Department Focal',
      department: params.department
    });
  }

  /**
   * Quick method for approval notifications
   */
  static async sendApprovalNotification(params: {
    entityType: 'trf' | 'claim' | 'visa' | 'transport' | 'accommodation';
    entityId: string;
    requestorName: string;
    requestorEmail?: string;
    requestorId?: string;
    newStatus: string;
    approverName: string;
    comments?: string;
    department?: string;
  }): Promise<void> {
    const eventType = params.newStatus.toLowerCase().includes('reject') 
      ? `${params.entityType}_rejected`
      : `${params.entityType}_approved`;

    await this.sendWorkflowNotification({
      eventType,
      entityType: params.entityType,
      entityId: params.entityId,
      requestorName: params.requestorName,
      requestorEmail: params.requestorEmail,
      requestorId: params.requestorId,
      currentStatus: params.newStatus,
      approverName: params.approverName,
      comments: params.comments,
      department: params.department
    });
  }

  /**
   * Send status change notification (for workflow progression)
   */
  static async sendStatusChangeNotification(params: {
    entityType: 'trf' | 'claim' | 'visa' | 'transport' | 'accommodation';
    entityId: string;
    requestorName: string;
    requestorEmail?: string;
    requestorId?: string;
    fromStatus: string;
    toStatus: string;
    department?: string;
    changedBy?: string;
    comments?: string;
  }): Promise<void> {
    await this.sendWorkflowNotification({
      eventType: `${params.entityType}_status_changed`,
      entityType: params.entityType,
      entityId: params.entityId,
      requestorName: params.requestorName,
      requestorEmail: params.requestorEmail,
      requestorId: params.requestorId,
      currentStatus: params.toStatus,
      department: params.department,
      approverName: params.changedBy,
      comments: `Status changed from ${params.fromStatus} to ${params.toStatus}${params.comments ? '. ' + params.comments : ''}`
    });
  }

  /**
   * Send processing notification (for admin actions after approval)
   */
  static async sendProcessingNotification(params: {
    entityType: 'trf' | 'claim' | 'visa' | 'transport' | 'accommodation';
    entityId: string;
    requestorName: string;
    requestorEmail?: string;
    requestorId?: string;
    processingAction: string;
    processorName?: string;
    department?: string;
    details?: string;
  }): Promise<void> {
    await this.sendWorkflowNotification({
      eventType: `${params.entityType}_processing`,
      entityType: params.entityType,
      entityId: params.entityId,
      requestorName: params.requestorName,
      requestorEmail: params.requestorEmail,
      requestorId: params.requestorId,
      currentStatus: 'Processing',
      department: params.department,
      approverName: params.processorName,
      comments: `${params.processingAction}${params.details ? ': ' + params.details : ''}`
    });
  }

  /**
   * Send completion notification (final confirmation)
   */
  static async sendCompletionNotification(params: {
    entityType: 'trf' | 'claim' | 'visa' | 'transport' | 'accommodation';
    entityId: string;
    requestorName: string;
    requestorEmail?: string;
    requestorId?: string;
    department?: string;
    completionDetails?: string;
    completedBy?: string;
  }): Promise<void> {
    await this.sendWorkflowNotification({
      eventType: `${params.entityType}_completed`,
      entityType: params.entityType,
      entityId: params.entityId,
      requestorName: params.requestorName,
      requestorEmail: params.requestorEmail,
      requestorId: params.requestorId,
      currentStatus: 'Completed',
      department: params.department,
      approverName: params.completedBy,
      comments: `Your ${params.entityType.toUpperCase()} request has been completed successfully.${params.completionDetails ? ' ' + params.completionDetails : ''}`
    });
  }
}