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
  nextApprover?: string;
  
  // Entity-specific data
  entityTitle?: string; // e.g., travel purpose, claim purpose
  entityAmount?: string;
  entityDates?: string; // formatted date range
  travelPurpose?: string;
  travelType?: string; // e.g., 'Overseas', 'Home Leave Passage', 'Local'
  claimPurpose?: string;
  transportPurpose?: string;
  accommodationPurpose?: string;
  
  // Action data
  comments?: string;
  rejectionReason?: string;
  previousApprover?: string;
  
  // System URLs
  baseUrl?: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  notificationType: 'email' | 'system' | 'both';
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

      // Send single consolidated email with proper TO/CC structure
      await this.sendWorkflowEmail(recipients, template, params);

    } catch (error) {
      console.error(`❌ Error sending template ${templateName}:`, error);
    }
  }

  /**
   * Send workflow email with proper TO/CC structure
   * TO: Primary action recipient (approver for approval stages, requestor for completion)
   * CC: Requestor (for transparency on all approval stages)
   */
  private static async sendWorkflowEmail(
    recipients: NotificationRecipient[],
    template: NotificationTemplate,
    params: WorkflowNotificationParams
  ): Promise<void> {
    try {
      // Separate recipients by type
      const approvers = recipients.filter(r => r.role !== 'Requestor');
      const requestors = recipients.filter(r => r.role === 'Requestor');
      
      console.log(`🔍 EMAIL_DEBUG: Total recipients=${recipients.length}, Approvers=${approvers.length}, Requestors=${requestors.length}`);
      console.log(`📋 APPROVERS: ${approvers.map(a => `${a.name}(${a.role})`).join(', ')}`);
      console.log(`📋 REQUESTORS: ${requestors.map(r => `${r.name}(${r.role})`).join(', ')}`);
      
      let toRecipients: string[] = [];
      let ccRecipients: string[] = [];
      
      // Determine TO/CC based on template type and workflow stage
      if (template.recipientType === 'approver' && approvers.length > 0) {
        // Approval stage: TO = Approvers, CC = Requestor
        toRecipients = approvers.map(a => a.email).filter(email => email && email.trim() !== '');
        ccRecipients = requestors.map(r => r.email).filter(email => email && email.trim() !== '');
        
        console.log(`📧 APPROVAL STAGE - Template: ${template.name}`);
        console.log(`   📧 TO Recipients: ${toRecipients.length > 0 ? toRecipients.join(', ') : '[NONE]'}`);
        console.log(`   📧 CC Recipients: ${ccRecipients.length > 0 ? ccRecipients.join(', ') : '[NONE - MISSING REQUESTOR CC!]'}`);
        
        if (ccRecipients.length === 0) {
          console.error(`❌ CRITICAL: No CC recipients found! Requestor should be CC'd on approval emails.`);
          console.error(`   🔍 Available requestors: ${requestors.map(r => `${r.name}(${r.email})`).join(', ')}`);
        }
        
      } else if (template.recipientType === 'requestor' && requestors.length > 0) {
        // Completion/rejection stage: TO = Requestor only
        toRecipients = requestors.map(r => r.email).filter(email => email && email.trim() !== '');
        ccRecipients = []; // No CC needed for final notifications
        console.log(`📧 COMPLETION STAGE: TO=${toRecipients.join(', ')}`);
        
      } else {
        console.warn(`⚠️  No valid recipients for template ${template.name}`);
        return;
      }
      
      if (toRecipients.length === 0) {
        console.warn(`⚠️  No TO recipients found for ${template.name}`);
        return;
      }
      
      // Build template variables (use first recipient for context)
      const primaryRecipient = [...approvers, ...requestors][0];
      const variables = this.buildTemplateVariables(primaryRecipient, params);
      
      // Process template
      const subject = this.processTemplate(template.subject, variables);
      const body = this.processTemplate(template.body, variables);
      
      // Send single consolidated email
      await emailService.sendEmail({
        to: toRecipients.join(', '),
        cc: ccRecipients.length > 0 ? ccRecipients.join(', ') : undefined,
        subject,
        html: body,
        from: process.env.DEFAULT_FROM_EMAIL || 'TMS System <noreplyvmspctsb@gmail.com>'
      });
      
      console.log(`✅ WORKFLOW EMAIL SENT: ${template.name}`);
      console.log(`   📧 TO: ${toRecipients.join(', ')}`);
      if (ccRecipients.length > 0) {
        console.log(`   📧 CC: ${ccRecipients.join(', ')}`);
      }
      
      // Also create in-app notifications for all recipients
      for (const recipient of recipients) {
        if (template.notificationType === 'system' || template.notificationType === 'both') {
          await NotificationService.createNotification({
            userId: recipient.userId,
            title: subject,
            message: this.stripHtml(body).substring(0, 500) + '...',
            type: this.getNotificationType(params.eventType),
            category: 'workflow_approval',
            priority: this.getNotificationPriority(params.eventType),
            relatedEntityType: params.entityType,
            relatedEntityId: params.entityId,
            actionRequired: recipient.role !== 'Requestor',
            actionUrl: variables.approvalUrl || variables.viewUrl
          });
        }
      }
      
    } catch (error) {
      console.error(`❌ Error sending workflow email for ${template.name}:`, error);
      throw error;
    }
  }

  /**
   * Send notification to a specific recipient (DEPRECATED - kept for backward compatibility)
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

      console.log(`📨 Sending to ${recipient.name} (${recipient.email}): ${subject} (type: ${template.notificationType})`);

      // Send email notification if template includes email
      if ((template.notificationType === 'email' || template.notificationType === 'both') && recipient.email) {
        await emailService.sendEmail({
          to: recipient.email,
          subject,
          html: body,
          from: process.env.DEFAULT_FROM_EMAIL || 'TMS System <noreplyvmspctsb@gmail.com>'
        });
        console.log(`📧 Email sent to ${recipient.email}`);
      }

      // Create in-app notification if template includes system notifications
      if (template.notificationType === 'system' || template.notificationType === 'both') {
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
        console.log(`🔔 In-app notification created for ${recipient.name}`);
      }

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
          notification_type as "notificationType",
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
        
        // For approval stages, ALWAYS include the original requestor as CC
        if (template.recipientType === 'approver' && params.requestorId && params.requestorName) {
          // Add requestor if not already included
          const requestorExists = recipients.some(r => r.userId === params.requestorId);
          console.log(`🔍 CC_DEBUG: Entity=${params.entityType}, Template=${template.name}`);
          console.log(`   👤 Requestor ID: ${params.requestorId}, Name: ${params.requestorName}, Email: ${params.requestorEmail}`);
          console.log(`   ✅ Requestor already in list: ${requestorExists}`);
          
          if (!requestorExists) {
            const requestorRecipient = {
              userId: params.requestorId,
              name: params.requestorName,
              email: params.requestorEmail || '',
              role: 'Requestor',
              department: params.department
            };
            recipients.push(requestorRecipient);
            console.log(`   ➕ Added requestor to recipients: ${requestorRecipient.name} (${requestorRecipient.email})`);
          }
        } else {
          console.log(`🚫 CC_DEBUG: Requestor NOT added - Template=${template.recipientType}, RequestorID=${params.requestorId}, RequestorName=${params.requestorName}`);
        }
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
      const permission = await this.getRequiredPermissionForStatus(params.entityType, params.currentStatus, params.travelType, params.entityId);
      
      if (!permission) {
        console.warn(`No permission mapping for ${params.entityType} status: ${params.currentStatus}`);
        return approvers;
      }

      console.log(`🔍 Looking for users with permission: ${permission} in department: ${params.department}`);
      console.log(`🎯 WORKFLOW_CONTEXT: Entity=${params.entityType}, Status=${params.currentStatus}, EventType=${params.eventType}`);
      
      if (params.entityType === 'claims') {
        console.log(`🧪 CLAIMS_DEBUG: Current=${params.currentStatus}, Previous=${params.previousStatus}, Permission=${permission}`);
      }
      
      if (params.entityType === 'trf') {
        console.log(`🧪 TRF_DEBUG: Current=${params.currentStatus}, Previous=${params.previousStatus}, Permission=${permission}`);
        console.log(`🧪 TRF_CONTEXT: EntityId=${params.entityId}, RequestorName=${params.requestorName}`);
      }
      
      if (params.entityType === 'transport') {
        console.log(`🧪 TRANSPORT_DEBUG: Current=${params.currentStatus}, Previous=${params.previousStatus}, Permission=${permission}`);
        console.log(`🧪 TRANSPORT_CONTEXT: EntityId=${params.entityId}, RequestorName=${params.requestorName}`);
      }

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

      // Filter to prioritize specific roles over admin roles for workflow notifications
      const filteredUsers = this.filterApproversForWorkflow(result, permission, params.currentStatus);

      for (const user of filteredUsers) {
        approvers.push({
          userId: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department
        });
        console.log(`👤 APPROVER FOUND: ${user.name} (${user.role}) - ${user.email}`);
      }

      console.log(`👥 Found ${approvers.length} approvers with permission ${permission} (after filtering)`);

    } catch (error) {
      console.error('Error getting approvers:', error);
    }

    return approvers;
  }

  /**
   * Filter approvers to prioritize specific roles over admin roles for workflow notifications
   */
  private static filterApproversForWorkflow(users: any[], permission: string, currentStatus?: string): any[] {
    if (users.length <= 1) return users;

    // Define role priorities for different permissions
    const rolePriorities: Record<string, string[]> = {
      'approve_trf_focal': ['Department Focal'],
      'approve_trf_manager': ['Line Manager'],
      'approve_trf_hod': ['HOD'],
      'approve_visa_focal': ['Department Focal'],
      'approve_visa_manager': ['Line Manager'], 
      'approve_visa_hod': ['HOD'],
      'approve_claims_focal': ['Department Focal'],
      'approve_claims_manager': ['Line Manager'],
      'approve_claims_hod': ['HOD'],
      'approve_accommodation_focal': ['Department Focal'],
      'approve_accommodation_manager': ['Line Manager'],
      'approve_accommodation_hod': ['HOD'],
      'process_visa_applications': ['Visa Clerk'],
      'process_flights': ['Ticketing Admin'],
      'manage_transport_requests': ['Transport Admin'],
      'process_claims': ['Finance Clerk', 'Claims Admin', 'Finance Admin']
    };

    // Handle transport requests differently - they use same permission but different roles per stage
    if (permission === 'approve_transport_requests' && currentStatus) {
      if (currentStatus === 'Pending Department Focal') {
        rolePriorities[permission] = ['Department Focal'];
      } else if (currentStatus === 'Pending Line Manager') {
        rolePriorities[permission] = ['Line Manager'];
      } else if (currentStatus === 'Pending HOD') {
        rolePriorities[permission] = ['HOD'];
      } else {
        rolePriorities[permission] = ['Transport Admin']; // Fallback
      }
    }


    const preferredRoles = rolePriorities[permission] || [];
    
    // First, try to find users with preferred roles
    for (const preferredRole of preferredRoles) {
      const preferredUsers = users.filter(u => u.role === preferredRole);
      if (preferredUsers.length > 0) {
        console.log(`🎯 FILTERED: Using ${preferredUsers.length} users with role '${preferredRole}' instead of all ${users.length} users with permission`);
        return preferredUsers;
      }
    }

    // If no preferred roles found, return all users (fallback)
    console.log(`⚠️  FALLBACK: No preferred role found for permission '${permission}', using all ${users.length} users`);
    return users;
  }

  /**
   * Build template variables for processing
   */
  private static buildTemplateVariables(
    recipient: NotificationRecipient,
    params: WorkflowNotificationParams
  ): Record<string, string> {
    const baseUrl = params.baseUrl || this.DEFAULT_BASE_URL;
    
    // Helper function to provide meaningful fallback values
    const getDisplayValue = (value: string | undefined | null, fallback: string = 'N/A'): string => {
      return (value && value.trim() !== '') ? value.trim() : fallback;
    };

    // Helper function for currency amounts
    const getAmountDisplay = (value: string | undefined | null): string => {
      if (!value || value.trim() === '' || value === '0') return 'Not specified';
      return value.trim();
    };

    // Helper function for dates
    const getDateDisplay = (value: string | undefined | null): string => {
      if (!value || value.trim() === '') return 'Not specified';
      return value.trim();
    };
    
    return {
      // Entity information
      entityId: params.entityId,
      entityType: params.entityType,
      entityTitle: getDisplayValue(params.entityTitle, 'Request'),
      entityAmount: getAmountDisplay(params.entityAmount),
      entityDates: getDateDisplay(params.entityDates),
      
      // Department information
      department: getDisplayValue(params.department, 'Not specified'),
      
      // Requestor information
      requestorName: params.requestorName,
      requestorEmail: getDisplayValue(params.requestorEmail, 'Not provided'),
      staffId: getDisplayValue(params.staffId, 'Not provided'),
      employeeId: getDisplayValue((params as any).employeeId || params.staffId, 'Not provided'),
      
      // Recipient information  
      approverName: recipient.name,
      recipientName: recipient.name,
      completedBy: params.approverName || recipient.name,
      
      // Status information
      currentStatus: params.currentStatus,
      previousStatus: getDisplayValue(params.previousStatus, 'N/A'),
      
      // Action information
      comments: getDisplayValue(params.comments, 'No comments provided'),
      rejectionReason: getDisplayValue(params.rejectionReason, 'No reason provided'),
      approverRole: getDisplayValue(params.approverRole || recipient.role, 'Approver'),
      nextApprover: getDisplayValue(params.nextApprover, 'To be determined'),
      previousApprover: getDisplayValue(params.previousApprover || params.approverName, 'N/A'),
      
      // Entity-specific fields with meaningful fallbacks
      travelPurpose: getDisplayValue(params.travelPurpose, 'Business travel'),
      travelDates: getDateDisplay(params.entityDates || params.travelDates),
      claimPurpose: getDisplayValue(params.claimPurpose, 'Business expenses'),
      claimAmount: getAmountDisplay(params.entityAmount),
      transportPurpose: getDisplayValue(params.transportPurpose, 'Official transport'),
      accommodationPurpose: getDisplayValue(params.accommodationPurpose, 'Official accommodation'),
      
      // Generic purpose field that maps to the appropriate entity-specific purpose
      purpose: getDisplayValue(
        params.transportPurpose || params.travelPurpose || params.claimPurpose || params.accommodationPurpose,
        'Official business'
      ),
      amount: getAmountDisplay(params.entityAmount),
      
      // Visa-specific fields
      destination: getDisplayValue((params as any).destination, 'Not specified'),
      travelType: getDisplayValue(params.travelType, 'Not specified'),
      
      // Transport-specific fields
      travelDate: getDateDisplay((params as any).travelDate),
      route: getDisplayValue((params as any).route, 'To be confirmed'),
      
      // Accommodation-specific fields
      checkinDate: getDateDisplay((params as any).checkinDate),
      checkoutDate: getDateDisplay((params as any).checkoutDate),
      location: getDisplayValue((params as any).location, 'To be confirmed'),
      
      // System metadata
      currentDate: new Date().toLocaleDateString(),
      
      // URLs
      approvalUrl: `${baseUrl}/${params.entityType === 'claims' ? 'claims' : params.entityType}/approve/${params.entityId}`,
      viewUrl: `${baseUrl}/${params.entityType === 'claims' ? 'claims' : params.entityType}/view/${params.entityId}`,
      newRequestUrl: `${baseUrl}/${params.entityType === 'claims' ? 'claims' : params.entityType}/new`,
      bookingUrl: `${baseUrl}/${params.entityType === 'claims' ? 'claims' : params.entityType}/booking/${params.entityId}`,
      processingUrl: `${baseUrl}/${params.entityType === 'claims' ? 'claims' : params.entityType}/process/${params.entityId}`
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
    
    // Extract entity type from event (e.g., 'trf_submitted' -> 'trf')
    const entityType = eventType.split('_')[0];

    // Map workflow stages to specific template names
    // Each stage sends exactly ONE email to the appropriate recipient
    
    if (eventType.includes('submitted')) {
      // Stage 1: Request submitted → Department Focal (TO: Focal, CC: Requestor)
      templates.push(`${entityType}_submitted_to_focal`);
      
    } else if (currentStatus === 'Pending Line Manager' || currentStatus === 'Pending Line Manager/HOD') {
      // Stage 2: Focal approved → Line Manager (TO: Manager, CC: Requestor)
      templates.push(`${entityType}_focal_approved_to_manager`);
      
    } else if (currentStatus === 'Pending HOD') {
      // Stage 3: Manager approved → HOD (TO: HOD, CC: Requestor)
      templates.push(`${entityType}_manager_approved_to_hod`);
      
    } else if (currentStatus === 'Approved' || currentStatus === 'Processing with Transport Admin' || currentStatus === 'Processing with Claims Admin' || currentStatus === 'Processing with Visa Admin') {
      // Stage 4: HOD approved → Admin Processing (TO: Admin, CC: Requestor)
      templates.push(`${entityType}_hod_approved_to_admin`);
      
    } else if (currentStatus === 'Completed' || currentStatus === 'Processed' || eventType.includes('completed') || eventType.includes('admin_completed_to_requestor')) {
      // Stage 5: Admin completed → Requestor (TO: Requestor)
      templates.push(`${entityType}_admin_completed_to_requestor`);
      
    } else if (eventType.includes('rejected')) {
      // Rejection → Requestor (TO: Requestor)
      templates.push(`${entityType}_rejected_requestor`);
      
    } else {
      // Fallback: try exact template name for backward compatibility
      templates.push(eventType);
    }

    console.log(`🎯 TEMPLATE_ROUTING: Event '${eventType}', Status '${currentStatus}' → Templates: [${templates.join(', ')}]`);
    return templates;
  }

  /**
   * Get required permission for workflow status
   */
  private static async getRequiredPermissionForStatus(entityType: string, status: string, travelType?: string, entityId?: string): Promise<string | null> {
    const permissionMap: Record<string, Record<string, string>> = {
      'trf': {
        'Pending Department Focal': 'approve_trf_focal',
        'Pending Line Manager': 'approve_trf_manager', 
        'Pending HOD': 'approve_trf_hod',
        'Approved': null // Will be handled specially in the method
      },
      'visa': {
        'Pending Department Focal': 'approve_visa_focal',
        'Pending Line Manager': 'approve_visa_manager',
        'Pending HOD': 'approve_visa_hod',
        'Processing with Visa Admin': 'process_visa_applications'
      },
      'claims': {
        'Pending Department Focal': 'approve_claims_focal',
        'Pending Line Manager': 'approve_claims_manager',
        'Pending HOD': 'approve_claims_hod',
        'Pending HOD Approval': 'approve_claims_hod',
        'Processing with Claims Admin': 'process_claims', // Claims Admin processing like transport workflow
        'Approved': 'process_claims', // Legacy fallback - redirect to Claims Admin
        'Pending Finance Approval': 'process_claims' // Legacy - redirect to Claims Admin
      },
      'transport': {
        'Pending Department Focal': 'approve_transport_requests',
        'Pending Line Manager': 'approve_transport_requests',
        'Pending HOD': 'approve_transport_requests',
        'Processing with Transport Admin': 'manage_transport_requests'
      },
      'accommodation': {
        'Pending Department Focal': 'approve_accommodation_focal',
        'Pending Line Manager': 'approve_accommodation_manager',
        'Pending HOD': 'approve_accommodation_hod'
      }
    };

    const permission = permissionMap[entityType]?.[status];
    
    // Handle TRF 'Approved' status specially (needs async flight check)
    if (entityType === 'trf' && status === 'Approved' && entityId) {
      return await this.getApprovedTrfPermission(entityId, travelType);
    }
    
    return permission || null;
  }

  /**
   * Get appropriate permission for approved TRF based on travel type and flight requirements
   */
  private static async getApprovedTrfPermission(trfId: string, travelType?: string): Promise<string | null> {
    // Check if TSR has flights by travel type
    if (travelType && ['Overseas', 'Home Leave Passage'].includes(travelType)) {
      return 'process_flights';
    }
    
    // Also check if TSR has flight numbers in itinerary segments (for Domestic/External with flights)
    try {
      const { sql } = await import('./db');
      const flightSegments = await sql`
        SELECT COUNT(*) as flight_count
        FROM trf_itinerary_segments 
        WHERE trf_id = ${trfId} 
        AND flight_number IS NOT NULL 
        AND flight_number <> ''
      `;
      
      if (flightSegments[0]?.flight_count > 0) {
        console.log(`TSR ${trfId} has ${flightSegments[0].flight_count} flight segments - routing to flights admin`);
        return 'process_flights';
      }
    } catch (error) {
      console.error(`Error checking flight segments for TSR ${trfId}:`, error);
      // Fallback to travel_type only if DB check fails
    }
    
    // For other travel types without flights, don't send to flights admin
    return null;
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
    purpose?: string; // Generic purpose field for all entity types
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
      nextApprover: 'Department Focal',
      // Map purpose to entity-specific fields
      claimPurpose: params.entityType === 'claims' ? params.purpose : undefined,
      travelPurpose: params.entityType === 'trf' ? params.purpose : undefined,
      transportPurpose: params.entityType === 'transport' ? params.purpose : undefined,
      accommodationPurpose: params.entityType === 'accommodation' ? params.purpose : undefined
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
    approverId?: string;
    approverEmail?: string;
    nextApprover?: string;
    entityTitle: string;
    entityAmount?: string;
    travelType?: string;
    claimPurpose?: string;
    transportPurpose?: string;
    travelPurpose?: string;
    accommodationPurpose?: string;
    comments?: string;
    department?: string;
  }): Promise<void> {
    const eventType = this.getApprovalEventType(params.entityType, params.previousStatus);
    
    // Send notification to requestor and next approver (existing logic)
    await this.sendWorkflowNotification({
      eventType,
      entityType: params.entityType,
      entityId: params.entityId,
      currentStatus: params.currentStatus,
      previousStatus: params.previousStatus,
      requestorId: params.requestorId,
      requestorName: params.requestorName,
      requestorEmail: params.requestorEmail,
      department: params.department,
      approverName: params.approverName,
      approverRole: params.approverRole,
      nextApprover: params.nextApprover,
      entityTitle: params.entityTitle,
      entityAmount: params.entityAmount,
      travelType: params.travelType,
      claimPurpose: params.claimPurpose,
      transportPurpose: params.transportPurpose,
      travelPurpose: params.travelPurpose,
      accommodationPurpose: params.accommodationPurpose,
      comments: params.comments
    });

    // NEW: Send confirmation notification to the approver who just approved
    if (params.approverId || params.approverEmail) {
      await this.notifyApproverConfirmation({
        entityType: params.entityType,
        entityId: params.entityId,
        approverId: params.approverId,
        approverName: params.approverName,
        approverEmail: params.approverEmail,
        approverRole: params.approverRole,
        entityTitle: params.entityTitle,
        currentStatus: params.currentStatus,
        nextApprover: params.nextApprover,
        comments: params.comments
      });
    }
  }

  /**
   * Send confirmation notification to approver after they approve a request
   */
  static async notifyApproverConfirmation(params: {
    entityType: 'trf' | 'visa' | 'claims' | 'transport' | 'accommodation';
    entityId: string;
    approverId?: string;
    approverName: string;
    approverEmail?: string;
    approverRole: string;
    entityTitle: string;
    currentStatus: string;
    nextApprover?: string;
    comments?: string;
  }): Promise<void> {
    try {
      const entityTypeNames = {
        trf: 'Travel Request',
        visa: 'Visa Application', 
        claims: 'Expense Claim',
        transport: 'Transport Request',
        accommodation: 'Accommodation Request'
      };

      const entityName = entityTypeNames[params.entityType];
      
      // Create a friendly confirmation message
      let confirmationMessage: string;
      let nextStepMessage: string = '';
      
      if (params.nextApprover && params.nextApprover !== 'Completed') {
        nextStepMessage = ` and has been forwarded to ${params.nextApprover} for the next approval`;
      } else if (params.currentStatus.includes('Approved') || params.currentStatus.includes('Completed')) {
        nextStepMessage = ' and is now fully approved';
      } else {
        nextStepMessage = ' and is now processing';
      }

      confirmationMessage = `You have successfully approved ${entityName} "${params.entityTitle}"${nextStepMessage}.`;

      if (params.comments) {
        confirmationMessage += ` Your comments: "${params.comments}"`;
      }

      // Send in-app notification
      if (params.approverId) {
        await NotificationService.createNotification({
          userId: params.approverId,
          title: `✅ Approval Confirmed - ${entityName}`,
          message: confirmationMessage,
          type: 'approval_confirmation',
          category: 'workflow_status',
          priority: 'medium',
          relatedEntityType: params.entityType,
          relatedEntityId: params.entityId,
          actionRequired: false,
          actionUrl: `/${params.entityType === 'claims' ? 'claims' : params.entityType}/view/${params.entityId}`
        });
      }

      // Send email notification (optional - can be configured)
      if (params.approverEmail && process.env.SEND_APPROVAL_CONFIRMATIONS !== 'false') {
        await emailService.sendEmail({
          to: params.approverEmail,
          subject: `✅ Approval Confirmed: ${entityName} - ${params.entityTitle}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #28a745; margin: 0;">✅ Approval Confirmed</h2>
              </div>
              
              <p>Dear ${params.approverName},</p>
              
              <p>${confirmationMessage}</p>
              
              <div style="background: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Request Details:</strong></p>
                <p style="margin: 5px 0;">• ${entityName}: ${params.entityTitle}</p>
                <p style="margin: 5px 0;">• Status: ${params.currentStatus}</p>
                <p style="margin: 5px 0;">• Your Role: ${params.approverRole}</p>
                ${params.nextApprover ? `<p style="margin: 5px 0;">• Next Step: ${params.nextApprover}</p>` : ''}
              </div>
              
              <p>Thank you for your timely approval!</p>
              
              <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
              <p style="font-size: 12px; color: #6c757d;">
                This is an automated confirmation from the TMS System. You do not need to take any further action for this request.
              </p>
            </div>
          `,
          from: process.env.DEFAULT_FROM_EMAIL || 'TMS System <noreplyvmspctsb@gmail.com>'
        });
      }

      console.log(`✅ Approval confirmation sent to ${params.approverName} for ${entityName} ${params.entityId}`);
    } catch (error) {
      console.error('Error sending approval confirmation:', error);
      // Don't throw - this is a nice-to-have feature
    }
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
    transportPurpose?: string;
    travelPurpose?: string;
    claimPurpose?: string;
    accommodationPurpose?: string;
    department?: string;
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
      entityTitle: params.entityTitle,
      transportPurpose: params.transportPurpose,
      travelPurpose: params.travelPurpose,
      claimPurpose: params.claimPurpose,
      accommodationPurpose: params.accommodationPurpose,
      department: params.department
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

  /**
   * Send admin completion notification to the original requestor
   */
  static async notifyAdminCompletion(params: {
    entityType: 'trf' | 'visa' | 'claims' | 'transport' | 'accommodation';
    entityId: string;
    requestorId: string;
    requestorName: string;
    requestorEmail?: string;
    adminName: string;
    entityTitle: string;
    completionDetails?: string;
    transportPurpose?: string;
    travelPurpose?: string;
    claimPurpose?: string;
    accommodationPurpose?: string;
  }): Promise<void> {
    try {
      console.log(`🎯 ADMIN_COMPLETION: Sending completion notification for ${params.entityType} ${params.entityId} to requestor ${params.requestorName}`);
      
      await this.sendWorkflowNotification({
        eventType: `${params.entityType}_admin_completed_to_requestor`,
        entityType: params.entityType,
        entityId: params.entityId,
        currentStatus: 'Completed',
        requestorId: params.requestorId,
        requestorName: params.requestorName,
        requestorEmail: params.requestorEmail,
        approverName: params.adminName,
        approverRole: 'Admin',
        entityTitle: params.entityTitle,
        comments: params.completionDetails,
        transportPurpose: params.transportPurpose,
        travelPurpose: params.travelPurpose,
        claimPurpose: params.claimPurpose,
        accommodationPurpose: params.accommodationPurpose
      });

      console.log(`✅ ADMIN_COMPLETION: Successfully sent completion notification for ${params.entityType} ${params.entityId}`);
    } catch (error) {
      console.error(`❌ ADMIN_COMPLETION: Error sending completion notification for ${params.entityType} ${params.entityId}:`, error);
      throw error;
    }
  }

  /**
   * Send status update notification for workflow changes
   */
  static async notifyStatusUpdate(params: {
    entityType: 'trf' | 'visa' | 'claims' | 'transport' | 'accommodation';
    entityId: string;
    requestorId: string;
    requestorName: string;
    requestorEmail?: string;
    newStatus: string;
    previousStatus: string;
    updateReason: string;
    entityTitle: string;
    transportPurpose?: string;
    travelPurpose?: string;
    claimPurpose?: string;
    accommodationPurpose?: string;
  }): Promise<void> {
    try {
      console.log(`🔄 STATUS_UPDATE: Sending status update notification for ${params.entityType} ${params.entityId}: ${params.previousStatus} → ${params.newStatus}`);
      
      await this.sendWorkflowNotification({
        eventType: `${params.entityType}_status_update`,
        entityType: params.entityType,
        entityId: params.entityId,
        currentStatus: params.newStatus,
        previousStatus: params.previousStatus,
        requestorId: params.requestorId,
        requestorName: params.requestorName,
        requestorEmail: params.requestorEmail,
        entityTitle: params.entityTitle,
        comments: params.updateReason,
        transportPurpose: params.transportPurpose,
        travelPurpose: params.travelPurpose,
        claimPurpose: params.claimPurpose,
        accommodationPurpose: params.accommodationPurpose
      });

      console.log(`✅ STATUS_UPDATE: Successfully sent status update notification for ${params.entityType} ${params.entityId}`);
    } catch (error) {
      console.error(`❌ STATUS_UPDATE: Error sending status update notification for ${params.entityType} ${params.entityId}:`, error);
      // Don't throw - status updates are informational
    }
  }
}

export default UnifiedNotificationService;