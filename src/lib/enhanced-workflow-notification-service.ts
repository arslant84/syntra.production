// Enhanced Workflow Notification Service
// Implements proper approval workflow with stage-by-stage notifications and requestor CC

import { emailService } from './email-service';
import { sql } from './db';

export interface WorkflowNotificationParams {
  entityType: 'trf' | 'claim' | 'visa' | 'transport' | 'accommodation';
  entityId: string;
  requestorName: string;
  requestorEmail?: string;
  requestorId?: string;
  department?: string;
  purpose?: string;
  currentStatus?: string;
}

export interface ApprovalNotificationParams extends WorkflowNotificationParams {
  newStatus: string;
  approverName: string;
  approverEmail?: string;
  comments?: string;
}

interface EmailRecipient {
  email: string;
  name: string;
  role: string;
  userId?: string;
  type: 'primary' | 'cc'; // primary = action required, cc = information only
}

export class EnhancedWorkflowNotificationService {
  private static readonly BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  
  // Email settings from user configuration
  private static readonly EMAIL_SETTINGS = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: 'noreplyvmspctsb@gmail.com',
    pass: 'efftvmcddjcetvnn',
    from: 'VMS System <noreplyvmspctsb@gmail.com>'
  };

  /**
   * Send notification when a new request is submitted
   * This should only notify the initial approver (Department Focal) + CC requestor
   */
  static async sendSubmissionNotification(params: WorkflowNotificationParams): Promise<void> {
    try {
      console.log(`🔔 ENHANCED_WORKFLOW: Starting sendSubmissionNotification for ${params.entityType} ${params.entityId}`);
      console.log(`🔔 ENHANCED_WORKFLOW: Input parameters:`, {
        entityType: params.entityType,
        entityId: params.entityId,
        requestorName: params.requestorName,
        department: params.department,
        requestorId: params.requestorId,
        requestorEmail: params.requestorEmail
      });
      
      // Get the initial approver (Department Focal only)
      console.log(`🔔 ENHANCED_WORKFLOW: Calling getInitialApprover...`);
      const recipients = await this.getInitialApprover(params);
      console.log(`🔔 ENHANCED_WORKFLOW: getInitialApprover returned ${recipients.length} recipients`);
      
      if (recipients.length === 0) {
        console.warn(`❌ ENHANCED_WORKFLOW: No Department Focal found for ${params.entityType} ${params.entityId}`);
        return;
      }

      // Always CC the requestor
      const requestorRecipient = await this.getRequestorAsCC(params);
      if (requestorRecipient) {
        recipients.push(requestorRecipient);
      }

      // Send notification emails
      await this.sendWorkflowEmails({
        subject: `New ${this.getEntityDisplayName(params.entityType)} Requires Your Approval - ${params.entityId}`,
        entityType: params.entityType,
        entityId: params.entityId,
        requestorName: params.requestorName,
        recipients,
        templateType: 'submission',
        actionRequired: true,
        newStatus: params.currentStatus || 'Pending Department Focal Approval'
      });

      console.log(`✅ ENHANCED_WORKFLOW: Submission notification sent for ${params.entityType} ${params.entityId}`);
    } catch (error) {
      console.error(`❌ ENHANCED_WORKFLOW: Error sending submission notification:`, error);
      throw error;
    }
  }

  /**
   * Send notification when request status changes (approval/rejection/processing)
   * This notifies the next approver in workflow + CC requestor
   */
  static async sendStatusChangeNotification(params: ApprovalNotificationParams): Promise<void> {
    try {
      console.log(`🔔 ENHANCED_WORKFLOW: Sending status change notification for ${params.entityType} ${params.entityId} - Status: ${params.newStatus}`);

      const recipients: EmailRecipient[] = [];
      let templateType = 'status_update';
      let actionRequired = false;

      // Determine recipients based on new status
      console.log(`🔍 ENHANCED_WORKFLOW: Determining recipients for new status: ${params.newStatus}`);
      
      if (params.newStatus.includes('Pending')) {
        console.log(`🔍 ENHANCED_WORKFLOW: Status includes 'Pending', getting next approvers...`);
        // Request needs further approval - notify next approver
        const nextApprovers = await this.getApproversForStatus(params.newStatus, params);
        console.log(`🔍 ENHANCED_WORKFLOW: Found ${nextApprovers.length} next approver(s):`, nextApprovers.map(a => `${a.name} (${a.email})`));
        recipients.push(...nextApprovers);
        templateType = 'approval_request';
        actionRequired = true;
      } else if (params.newStatus.includes('Approved')) {
        // Final approval - check if processing is needed
        const processors = await this.getProcessorsForApprovedRequest(params);
        recipients.push(...processors);
        templateType = params.newStatus === 'Approved' ? 'approved' : 'processing_required';
        actionRequired = processors.length > 0;
      } else if (params.newStatus.includes('Rejected')) {
        templateType = 'rejected';
        actionRequired = false;
      }

      // Always CC the requestor for status updates
      const requestorRecipient = await this.getRequestorAsCC(params);
      if (requestorRecipient) {
        recipients.push(requestorRecipient);
      }

      if (recipients.length === 0) {
        console.warn(`❌ ENHANCED_WORKFLOW: No recipients found for status change ${params.newStatus}`);
        return;
      }

      // Send notification emails
      await this.sendWorkflowEmails({
        subject: this.generateSubjectForStatus(params.entityType, params.entityId, params.newStatus, actionRequired),
        entityType: params.entityType,
        entityId: params.entityId,
        requestorName: params.requestorName,
        recipients,
        templateType,
        actionRequired,
        approverName: params.approverName,
        comments: params.comments,
        newStatus: params.newStatus
      });

      console.log(`✅ ENHANCED_WORKFLOW: Status change notification sent for ${params.entityType} ${params.entityId}`);
    } catch (error) {
      console.error(`❌ ENHANCED_WORKFLOW: Error sending status change notification:`, error);
      throw error;
    }
  }

  /**
   * Send notification for auto-generated requests (when TSR creates transport/accommodation)
   */
  static async sendAutoGeneratedRequestNotification(params: WorkflowNotificationParams & {
    parentEntityType: string;
    parentEntityId: string;
  }): Promise<void> {
    try {
      console.log(`🔔 ENHANCED_WORKFLOW: Sending auto-generated request notification for ${params.entityType} ${params.entityId} (from ${params.parentEntityType} ${params.parentEntityId})`);
      
      // Same workflow as regular submission but mention it's auto-generated
      const recipients = await this.getInitialApprover(params);
      const requestorRecipient = await this.getRequestorAsCC(params);
      if (requestorRecipient) {
        recipients.push(requestorRecipient);
      }

      await this.sendWorkflowEmails({
        subject: `Auto-Generated ${this.getEntityDisplayName(params.entityType)} Requires Your Approval - ${params.entityId}`,
        entityType: params.entityType,
        entityId: params.entityId,
        requestorName: params.requestorName,
        recipients,
        templateType: 'auto_generated',
        actionRequired: true,
        parentEntityType: params.parentEntityType,
        parentEntityId: params.parentEntityId,
        newStatus: params.currentStatus || 'Pending Department Focal Approval'
      });

      console.log(`✅ ENHANCED_WORKFLOW: Auto-generated request notification sent for ${params.entityType} ${params.entityId}`);
    } catch (error) {
      console.error(`❌ ENHANCED_WORKFLOW: Error sending auto-generated notification:`, error);
      throw error;
    }
  }

  /**
   * Get the correct next approver based on workflow rules
   */
  private static async getCorrectNextApprover(
    entityType: string, 
    currentStatus: string, 
    requestorDepartment?: string,
    requestorId?: string
  ): Promise<EmailRecipient[]> {
    // For initial submission, always start with Department Focal
    if (currentStatus === 'Pending Department Focal' || !currentStatus) {
      return this.getInitialApprover({ 
        entityType, 
        department: requestorDepartment,
        requestorId 
      } as WorkflowNotificationParams);
    }
    
    // For other statuses, use the existing status-based logic
    return this.getApproversForStatus(currentStatus, { 
      entityType, 
      department: requestorDepartment 
    } as WorkflowNotificationParams);
  }

  /**
   * Get the initial approver (Department Focal only)
   */
  private static async getInitialApprover(params: WorkflowNotificationParams): Promise<EmailRecipient[]> {
    const approvers: EmailRecipient[] = [];

    try {
      console.log(`🔍 ENHANCED_WORKFLOW: getInitialApprover called with params:`, params);
      
      // If department is not provided but we have requestorId, try to get it from user record
      let departmentToUse = params.department;
      console.log(`🔍 ENHANCED_WORKFLOW: Initial department: ${departmentToUse}`);
      
      if ((!departmentToUse || departmentToUse === 'Unknown') && params.requestorId) {
        console.log(`🔍 ENHANCED_WORKFLOW: Department not provided, looking up requestor's department from user record`);
        try {
          const userDeptResult = await sql`SELECT department FROM users WHERE id = ${params.requestorId} AND status = 'Active'`;
          console.log(`🔍 ENHANCED_WORKFLOW: User department query result:`, userDeptResult);
          if (userDeptResult.length > 0 && userDeptResult[0].department) {
            departmentToUse = userDeptResult[0].department;
            console.log(`🔍 ENHANCED_WORKFLOW: Found requestor's department: ${departmentToUse}`);
          } else {
            console.log(`🔍 ENHANCED_WORKFLOW: No department found for user ${params.requestorId}`);
          }
        } catch (deptError) {
          console.error(`🔍 ENHANCED_WORKFLOW: Error looking up user department:`, deptError);
        }
      }

      // Always start with Department Focal approval
      const permissionName = this.getDepartmentFocalPermission(params.entityType);
      
      console.log(`🔍 ENHANCED_WORKFLOW: Looking for Department Focal - Permission: ${permissionName}, Department: ${departmentToUse}`);
      
      let query = `
        SELECT u.id, u.name, u.email, r.name as role_name, u.department
        FROM users u
        INNER JOIN roles r ON u.role_id = r.id
        INNER JOIN role_permissions rp ON r.id = rp.role_id
        INNER JOIN permissions p ON rp.permission_id = p.id
        WHERE p.name = $1
          AND u.status = 'Active'
          AND u.email IS NOT NULL
          AND u.email != ''
      `;

      const queryParams = [permissionName];

      // For Department Focal approval, ALWAYS filter by department if available
      if (departmentToUse && departmentToUse !== 'Unknown' && departmentToUse !== null) {
        query += ` AND LOWER(u.department) = LOWER($2)`;
        queryParams.push(departmentToUse);
        console.log(`🔍 ENHANCED_WORKFLOW: Filtering by department: ${departmentToUse}`);
      } else {
        console.log(`🔍 ENHANCED_WORKFLOW: No department specified or department is 'Unknown'`);
        // If no department specified, still try to find appropriate focal
        query += ` AND (r.name LIKE '%Department Focal%' OR r.name LIKE '%Focal%')`;
      }

      // Order by role specificity (prefer Department Focal roles) and remove DISTINCT
      query += ` ORDER BY 
        CASE WHEN r.name LIKE '%Department Focal%' THEN 1 
             WHEN r.name LIKE '%Focal%' THEN 2 
             ELSE 3 END,
        u.name`;

      console.log(`🔍 ENHANCED_WORKFLOW: Final search - Permission: ${permissionName}, Department: ${departmentToUse}`);
      console.log(`🔍 ENHANCED_WORKFLOW: Query: ${query}`);
      console.log(`🔍 ENHANCED_WORKFLOW: Query params:`, queryParams);
      
      let users;
      try {
        console.log(`🔍 ENHANCED_WORKFLOW: Executing database query...`);
        users = await sql.unsafe(query, queryParams);
        console.log(`🔍 ENHANCED_WORKFLOW: Database query successful`);
      } catch (queryError) {
        console.error(`🔍 ENHANCED_WORKFLOW: Database query failed:`, queryError);
        throw queryError;
      }
      
      console.log(`🔍 ENHANCED_WORKFLOW: Query returned ${users.length} users:`, users.map(u => `${u.name} (${u.email}) - Role: ${u.role_name}`));
      
      for (const user of users) {
        approvers.push({
          email: user.email,
          name: user.name,
          role: user.role_name,
          userId: user.id,
          type: 'primary'
        });
      }

      console.log(`✅ ENHANCED_WORKFLOW: Found ${approvers.length} Department Focal(s) - Emails: ${approvers.map(a => a.email).join(', ')}`);
      return approvers;
    } catch (error) {
      console.error('❌ ENHANCED_WORKFLOW: Error getting initial approver:', error);
      return approvers;
    }
  }

  /**
   * Get approvers for a specific status in the workflow
   */
  private static async getApproversForStatus(status: string, params: WorkflowNotificationParams): Promise<EmailRecipient[]> {
    const approvers: EmailRecipient[] = [];

    try {
      console.log(`🔍 ENHANCED_WORKFLOW: getApproversForStatus called - Status: ${status}, EntityType: ${params.entityType}, Department: ${params.department}`);
      
      let permissionName = '';
      
      switch (status) {
        case 'Pending Department Focal':
          permissionName = this.getDepartmentFocalPermission(params.entityType);
          break;
        case 'Pending Line Manager':
          permissionName = this.getLineManagerPermission(params.entityType);
          break;
        case 'Pending HOD':
          permissionName = this.getHODPermission(params.entityType);
          break;
        default:
          console.warn(`❌ ENHANCED_WORKFLOW: Unknown status: ${status}`);
          return approvers;
      }

      console.log(`🔍 ENHANCED_WORKFLOW: Using permission: ${permissionName} for status: ${status}`);

      let query = `
        SELECT DISTINCT u.id, u.name, u.email, r.name as role_name, u.department
        FROM users u
        INNER JOIN roles r ON u.role_id = r.id
        INNER JOIN role_permissions rp ON r.id = rp.role_id
        INNER JOIN permissions p ON rp.permission_id = p.id
        WHERE p.name = $1
          AND u.status = 'Active'
          AND u.email IS NOT NULL
          AND u.email != ''
      `;

      const queryParams = [permissionName];

      // Add department filtering for department-specific approvals
      if (params.department && params.department !== 'Unknown' && status === 'Pending Department Focal') {
        query += ` AND LOWER(u.department) = LOWER($2)`;
        queryParams.push(params.department);
        console.log(`🔍 ENHANCED_WORKFLOW: Adding department filter: ${params.department}`);
      }

      query += ` ORDER BY u.name`;

      console.log(`🔍 ENHANCED_WORKFLOW: Executing query with params:`, queryParams);
      console.log(`🔍 ENHANCED_WORKFLOW: Query: ${query}`);

      const users = await sql.unsafe(query, queryParams);
      
      console.log(`🔍 ENHANCED_WORKFLOW: Query returned ${users.length} users:`, users.map(u => `${u.name} (${u.email}) - Role: ${u.role_name}, Dept: ${u.department}`));
      
      for (const user of users) {
        approvers.push({
          email: user.email,
          name: user.name,
          role: user.role_name,
          userId: user.id,
          type: 'primary'
        });
      }

      console.log(`✅ ENHANCED_WORKFLOW: Found ${approvers.length} approver(s) for status ${status}`);
      return approvers;
    } catch (error) {
      console.error('❌ ENHANCED_WORKFLOW: Error getting approvers for status:', error);
      return approvers;
    }
  }

  /**
   * Get processors for approved requests (e.g., System Admin for flight booking)
   */
  private static async getProcessorsForApprovedRequest(params: ApprovalNotificationParams): Promise<EmailRecipient[]> {
    const processors: EmailRecipient[] = [];

    try {
      // Only TSR approved requests need further processing
      if (params.entityType === 'trf' && params.newStatus === 'Approved') {
        // Get System Admins for flight/accommodation booking
        const systemAdmins = await sql`
          SELECT DISTINCT u.id, u.name, u.email, r.name as role_name
          FROM users u
          INNER JOIN roles r ON u.role_id = r.id
          WHERE r.name IN ('System Admin', 'Admin')
            AND u.status = 'Active'
            AND u.email IS NOT NULL
        `;

        for (const admin of systemAdmins) {
          processors.push({
            email: admin.email,
            name: admin.name,
            role: admin.role_name,
            userId: admin.id,
            type: 'primary'
          });
        }
      }

      return processors;
    } catch (error) {
      console.error('❌ ENHANCED_WORKFLOW: Error getting processors:', error);
      return processors;
    }
  }

  /**
   * Get requestor as CC recipient
   */
  private static async getRequestorAsCC(params: WorkflowNotificationParams): Promise<EmailRecipient | null> {
    try {
      let user = null;
      
      if (params.requestorId) {
        [user] = await sql`SELECT id, name, email FROM users WHERE id = ${params.requestorId} AND status = 'Active'`;
      } else if (params.requestorEmail) {
        [user] = await sql`SELECT id, name, email FROM users WHERE email = ${params.requestorEmail} AND status = 'Active'`;
      }

      if (user && user.email) {
        return {
          email: user.email,
          name: params.requestorName || user.name,
          role: 'requestor',
          userId: user.id,
          type: 'cc'
        };
      }

      return null;
    } catch (error) {
      console.error('❌ ENHANCED_WORKFLOW: Error getting requestor info:', error);
      return null;
    }
  }

  /**
   * Send workflow emails to recipients
   */
  private static async sendWorkflowEmails(emailParams: {
    subject: string;
    entityType: string;
    entityId: string;
    requestorName: string;
    recipients: EmailRecipient[];
    templateType: string;
    actionRequired: boolean;
    approverName?: string;
    comments?: string;
    newStatus?: string;
    parentEntityType?: string;
    parentEntityId?: string;
  }): Promise<void> {
    try {
      // Separate primary and CC recipients
      const primaryRecipients = emailParams.recipients.filter(r => r.type === 'primary');
      const ccRecipients = emailParams.recipients.filter(r => r.type === 'cc');

      if (primaryRecipients.length === 0 && ccRecipients.length === 0) {
        console.warn(`❌ ENHANCED_WORKFLOW: No recipients to send email to`);
        return;
      }

      // Log recipient information for debugging
      if (primaryRecipients.length > 1) {
        console.log(`ℹ️ ENHANCED_WORKFLOW: Multiple primary recipients found for ${emailParams.templateType}:`, primaryRecipients.map(r => `${r.name} (${r.email}) - ${r.role}`));
      }

      // Generate email body
      const body = this.generateEmailBody(emailParams);

      // Prepare email recipients
      const toEmails = primaryRecipients.map(r => r.email);
      const ccEmails = ccRecipients.map(r => r.email);

      console.log(`📧 ENHANCED_WORKFLOW: Sending email - TO: [${toEmails.join(', ')}], CC: [${ccEmails.join(', ')}]`);
      console.log(`📧 ENHANCED_WORKFLOW: Primary recipients:`, primaryRecipients.map(r => `${r.name} (${r.email}) - ${r.role}`));
      console.log(`📧 ENHANCED_WORKFLOW: CC recipients:`, ccRecipients.map(r => `${r.name} (${r.email}) - ${r.role}`));

      // Send email using the configured email service
      try {
        console.log(`📧 ENHANCED_WORKFLOW: Calling emailService.sendEmail...`);
        console.log(`📧 ENHANCED_WORKFLOW: Email config:`, {
          to: toEmails,
          cc: ccEmails,
          subject: emailParams.subject,
          from: this.EMAIL_SETTINGS.from
        });
        
        await emailService.sendEmail({
          to: toEmails,
          cc: ccEmails,
          subject: emailParams.subject,
          html: body,
          from: this.EMAIL_SETTINGS.from
        });
        
        console.log(`📧 ENHANCED_WORKFLOW: emailService.sendEmail completed successfully`);
      } catch (emailError) {
        console.error(`📧 ENHANCED_WORKFLOW: emailService.sendEmail failed:`, emailError);
        throw emailError;
      }

      console.log(`✅ ENHANCED_WORKFLOW: Email sent to ${toEmails.length} primary recipients, ${ccEmails.length} CC recipients`);
    } catch (error) {
      console.error('❌ ENHANCED_WORKFLOW: Error sending workflow emails:', error);
      throw error;
    }
  }

  /**
   * Generate email body content
   */
  private static generateEmailBody(params: {
    entityType: string;
    entityId: string;
    requestorName: string;
    templateType: string;
    actionRequired: boolean;
    approverName?: string;
    comments?: string;
    newStatus?: string;
    parentEntityType?: string;
    parentEntityId?: string;
  }): string {
    const entityDisplayName = this.getEntityDisplayName(params.entityType);
    const viewUrl = `${this.BASE_URL}/${params.entityType}/view/${params.entityId}`;

    let body = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #0066cc; margin: 0;">${entityDisplayName} Notification</h2>
        </div>
        
        <div style="padding: 20px; background: white; border-radius: 8px; border: 1px solid #e9ecef;">
    `;

    switch (params.templateType) {
      case 'submission':
        body += `
          <h3>New ${entityDisplayName} Requires Your Approval</h3>
          <p><strong>${params.requestorName}</strong> has submitted a new ${entityDisplayName} that requires your approval.</p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0;">
            <strong>Request ID:</strong> ${params.entityId}<br>
            <strong>Requestor:</strong> ${params.requestorName}<br>
            <strong>Status:</strong> ${this.getStatusDisplayText(params.newStatus || 'Pending Department Focal')}
          </div>
        `;
        break;

      case 'auto_generated':
        body += `
          <h3>Auto-Generated ${entityDisplayName} Requires Your Approval</h3>
          <p>A ${entityDisplayName} has been automatically generated from ${params.parentEntityType} ${params.parentEntityId} and requires your approval.</p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0;">
            <strong>Request ID:</strong> ${params.entityId}<br>
            <strong>Requestor:</strong> ${params.requestorName}<br>
            <strong>Parent Request:</strong> ${params.parentEntityType} ${params.parentEntityId}<br>
            <strong>Status:</strong> ${this.getStatusDisplayText(params.newStatus || 'Pending Department Focal')}
          </div>
        `;
        break;

      case 'approval_request':
        body += `
          <h3>${entityDisplayName} Requires Your Approval</h3>
          <p>The following ${entityDisplayName} has been approved at the previous stage and now requires your approval.</p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0;">
            <strong>Request ID:</strong> ${params.entityId}<br>
            <strong>Requestor:</strong> ${params.requestorName}<br>
            <strong>Previous Approver:</strong> ${params.approverName}<br>
            <strong>Current Status:</strong> ${this.getStatusDisplayText(params.newStatus)}
          </div>
        `;
        if (params.comments) {
          body += `<p><strong>Previous Approver Comments:</strong> ${params.comments}</p>`;
        }
        break;

      case 'approved':
        body += `
          <h3>${entityDisplayName} Approved</h3>
          <p>Your ${entityDisplayName} has been approved by <strong>${params.approverName}</strong>.</p>
          <div style="background: #d4edda; padding: 15px; border-radius: 4px; margin: 15px 0; border-left: 4px solid #28a745;">
            <strong>Request ID:</strong> ${params.entityId}<br>
            <strong>Status:</strong> ${this.getStatusDisplayText(params.newStatus)}<br>
            <strong>Approved By:</strong> ${params.approverName}
          </div>
        `;
        if (params.comments) {
          body += `<p><strong>Approver Comments:</strong> ${params.comments}</p>`;
        }
        break;

      case 'rejected':
        body += `
          <h3>${entityDisplayName} Rejected</h3>
          <p>Your ${entityDisplayName} has been rejected by <strong>${params.approverName}</strong>.</p>
          <div style="background: #f8d7da; padding: 15px; border-radius: 4px; margin: 15px 0; border-left: 4px solid #dc3545;">
            <strong>Request ID:</strong> ${params.entityId}<br>
            <strong>Status:</strong> ${this.getStatusDisplayText(params.newStatus)}<br>
            <strong>Rejected By:</strong> ${params.approverName}
          </div>
        `;
        if (params.comments) {
          body += `<p><strong>Rejection Reason:</strong> ${params.comments}</p>`;
        }
        break;

      case 'processing_required':
        body += `
          <h3>${entityDisplayName} Processing Required</h3>
          <p>The following ${entityDisplayName} has been fully approved and requires processing.</p>
          <div style="background: #fff3cd; padding: 15px; border-radius: 4px; margin: 15px 0; border-left: 4px solid #ffc107;">
            <strong>Request ID:</strong> ${params.entityId}<br>
            <strong>Requestor:</strong> ${params.requestorName}<br>
            <strong>Status:</strong> ${this.getStatusDisplayText(params.newStatus)}<br>
            <strong>Final Approver:</strong> ${params.approverName}
          </div>
        `;
        break;
    }

    if (params.actionRequired) {
      body += `
        <div style="text-align: center; margin: 25px 0;">
          <a href="${viewUrl}" style="background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            View & Take Action
          </a>
        </div>
      `;
    } else {
      body += `
        <div style="text-align: center; margin: 25px 0;">
          <a href="${viewUrl}" style="background: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            View Request
          </a>
        </div>
      `;
    }

    body += `
        </div>
        
        <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #6c757d;">
          <p>This is an automated notification from the VMS System. Please do not reply to this email.</p>
        </div>
      </div>
    `;

    return body;
  }

  // Helper methods for permission mapping
  private static getDepartmentFocalPermission(entityType: string): string {
    const permissionMap = {
      'trf': 'approve_trf_focal',
      'transport': 'approve_transport_requests', // Use the actual transport permission  
      'accommodation': 'approve_accommodation_requests', // Department Focals approve accommodation
      'visa': 'process_visa_applications', // Use the actual visa permission
      'claim': 'approve_claims_focal'
    };
    return permissionMap[entityType] || `approve_${entityType}_focal`;
  }

  private static getLineManagerPermission(entityType: string): string {
    const permissionMap = {
      'trf': 'approve_trf_manager',
      'transport': 'approve_transport_requests', 
      'accommodation': 'approve_accommodation_requests',
      'visa': 'process_visa_applications',
      'claim': 'approve_claims_manager'
    };
    return permissionMap[entityType] || `approve_${entityType}_manager`;
  }

  private static getHODPermission(entityType: string): string {
    const permissionMap = {
      'trf': 'approve_trf_hod',
      'transport': 'approve_transport_requests',
      'accommodation': 'approve_accommodation_requests', 
      'visa': 'process_visa_applications',
      'claim': 'approve_claims_hod'
    };
    return permissionMap[entityType] || `approve_${entityType}_hod`;
  }

  private static getEntityDisplayName(entityType: string): string {
    const displayNames = {
      'trf': 'Travel & Service Request (TSR)',
      'transport': 'Transport Request',
      'accommodation': 'Accommodation Request',
      'visa': 'Visa Application',
      'claim': 'Expense Claim'
    };
    return displayNames[entityType] || entityType.toUpperCase();
  }

  private static generateSubjectForStatus(entityType: string, entityId: string, status: string, actionRequired: boolean): string {
    const entityDisplayName = this.getEntityDisplayName(entityType);
    
    if (actionRequired) {
      return `${entityDisplayName} Approval Required - ${entityId} (${status})`;
    } else {
      return `${entityDisplayName} Status Update - ${entityId} (${status})`;
    }
  }

  /**
   * Convert technical status to user-friendly display text
   */
  private static getStatusDisplayText(status: string): string {
    const statusDisplayMap = {
      'Pending Department Focal': 'Pending Department Focal Approval',
      'Pending Line Manager': 'Pending Line Manager Approval', 
      'Pending HOD': 'Pending HOD Approval',
      'Approved': 'Approved',
      'Rejected': 'Rejected',
      'Cancelled': 'Cancelled',
      'Processing Flights': 'Processing Flights',
      'Processing Accommodation': 'Processing Accommodation',
      'Awaiting Visa': 'Awaiting Visa Processing',
      'TRF Processed': 'Processing Complete'
    };
    
    return statusDisplayMap[status] || status;
  }
}