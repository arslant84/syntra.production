// Workflow Execution Engine
// Processes requests according to saved workflow configurations

import { sql } from '@/lib/db';
import { WorkflowTemplate, WorkflowStep } from './workflow-validation';
import { NotificationService } from './notification-service';

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  requestId: string;
  requestType: 'trf' | 'claims' | 'visa' | 'transport' | 'accommodation';
  currentStepNumber: number;
  status: 'active' | 'completed' | 'cancelled' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  createdBy: string;
}

export interface StepExecution {
  id: string;
  executionId: string;
  stepNumber: number;
  assignedUserId?: string;
  assignedRole?: string;
  status: 'pending' | 'approved' | 'rejected' | 'delegated' | 'escalated' | 'timeout';
  startedAt: Date;
  completedAt?: Date;
  actionTakenBy?: string;
  comments?: string;
  delegatedTo?: string;
  escalatedTo?: string;
}

export interface WorkflowExecutionContext {
  requestId: string;
  requestType: 'trf' | 'claims' | 'visa' | 'transport' | 'accommodation';
  requestData: any;
  userId: string;
  userRole: string;
  department?: string;
}

export class WorkflowEngine {
  /**
   * Start a new workflow execution for a request
   */
  static async startWorkflow(context: WorkflowExecutionContext): Promise<string> {
    try {
      // Get active workflow for the request type
      const workflow = await this.getActiveWorkflow(context.requestType);
      if (!workflow) {
        throw new Error(`No active workflow found for ${context.requestType}`);
      }

      // Create workflow execution record
      const executionResult = await sql`
        INSERT INTO workflow_executions (
          workflow_id, request_id, request_type, current_step_number,
          status, started_at, created_by
        ) VALUES (
          ${workflow.id}, ${context.requestId}, ${context.requestType}, 1,
          'active', NOW(), ${context.userId}
        ) RETURNING id
      `;

      const executionId = executionResult[0].id;

      // Start first step
      await this.startStep(executionId, workflow.steps[0], context);

      // Send notification for first step
      await this.notifyStepAssignee(executionId, workflow.steps[0], context);

      return executionId;

    } catch (error) {
      console.error('Error starting workflow:', error);
      throw new Error('Failed to start workflow execution');
    }
  }

  /**
   * Process a step action (approve/reject/delegate)
   */
  static async processStepAction(
    executionId: string,
    stepNumber: number,
    action: 'approve' | 'reject' | 'delegate',
    actionData: {
      userId: string;
      comments?: string;
      delegatedTo?: string;
    }
  ): Promise<void> {
    try {
      // Get execution and workflow details
      const execution = await this.getExecution(executionId);
      if (!execution) {
        throw new Error('Workflow execution not found');
      }

      const workflow = await this.getWorkflow(execution.workflowId);
      if (!workflow) {
        throw new Error('Workflow template not found');
      }

      // Validate user has permission to act on this step
      await this.validateStepPermission(executionId, stepNumber, actionData.userId);

      // Update step execution
      const stepStatus = action === 'delegate' ? 'delegated' : action === 'approve' ? 'approved' : 'rejected';
      
      await sql`
        UPDATE step_executions 
        SET status = ${stepStatus}, completed_at = NOW(), 
            action_taken_by = ${actionData.userId}, comments = ${actionData.comments || ''},
            delegated_to = ${actionData.delegatedTo || null}
        WHERE execution_id = ${executionId} AND step_number = ${stepNumber}
      `;

      if (action === 'approve') {
        await this.handleStepApproval(execution, workflow, stepNumber);
      } else if (action === 'reject') {
        await this.handleStepRejection(execution, workflow, stepNumber, actionData);
      } else if (action === 'delegate') {
        await this.handleStepDelegation(execution, workflow, stepNumber, actionData);
      }

    } catch (error) {
      console.error('Error processing step action:', error);
      throw new Error('Failed to process step action');
    }
  }

  /**
   * Handle step approval - move to next step or complete workflow
   */
  private static async handleStepApproval(
    execution: WorkflowExecution,
    workflow: WorkflowTemplate,
    stepNumber: number
  ): Promise<void> {
    const nextStep = workflow.steps.find(s => s.stepNumber === stepNumber + 1);

    if (nextStep) {
      // Move to next step
      await sql`
        UPDATE workflow_executions 
        SET current_step_number = ${stepNumber + 1}
        WHERE id = ${execution.id}
      `;

      // Start next step
      const context: WorkflowExecutionContext = {
        requestId: execution.requestId,
        requestType: execution.requestType,
        requestData: {},
        userId: execution.createdBy,
        userRole: ''
      };

      await this.startStep(execution.id, nextStep, context);
      await this.notifyStepAssignee(execution.id, nextStep, context);

    } else {
      // Complete workflow
      await sql`
        UPDATE workflow_executions 
        SET status = 'completed', completed_at = NOW()
        WHERE id = ${execution.id}
      `;

      // Update request status to approved
      await this.updateRequestStatus(execution.requestId, execution.requestType, 'Approved');

      // Send completion notification
      await this.notifyWorkflowCompletion(execution, 'approved');
    }
  }

  /**
   * Handle step rejection - cancel workflow
   */
  private static async handleStepRejection(
    execution: WorkflowExecution,
    workflow: WorkflowTemplate,
    stepNumber: number,
    actionData: any
  ): Promise<void> {
    // Cancel workflow
    await sql`
      UPDATE workflow_executions 
      SET status = 'cancelled', completed_at = NOW()
      WHERE id = ${execution.id}
    `;

    // Update request status to rejected
    await this.updateRequestStatus(execution.requestId, execution.requestType, 'Rejected');

    // Send rejection notification
    await this.notifyWorkflowCompletion(execution, 'rejected', actionData.comments);
  }

  /**
   * Handle step delegation
   */
  private static async handleStepDelegation(
    execution: WorkflowExecution,
    workflow: WorkflowTemplate,
    stepNumber: number,
    actionData: any
  ): Promise<void> {
    if (!actionData.delegatedTo) {
      throw new Error('Delegation target not specified');
    }

    // Update step execution with delegation
    await sql`
      UPDATE step_executions 
      SET assigned_user_id = ${actionData.delegatedTo}, delegated_to = ${actionData.delegatedTo}
      WHERE execution_id = ${execution.id} AND step_number = ${stepNumber}
    `;

    // Notify delegated user
    const step = workflow.steps.find(s => s.stepNumber === stepNumber);
    if (step) {
      const context: WorkflowExecutionContext = {
        requestId: execution.requestId,
        requestType: execution.requestType,
        requestData: {},
        userId: execution.createdBy,
        userRole: ''
      };

      await this.notifyStepAssignee(execution.id, { ...step, assignedUserId: actionData.delegatedTo }, context);
    }
  }

  /**
   * Start a workflow step
   */
  private static async startStep(
    executionId: string,
    step: WorkflowStep,
    context: WorkflowExecutionContext
  ): Promise<void> {
    // Determine assignee
    let assignedUserId = step.assignedUserId;
    
    if (!assignedUserId && step.requiredRole) {
      // Find user with required role
      assignedUserId = await this.findUserByRole(step.requiredRole, context.department);
    }

    // Create step execution record
    await sql`
      INSERT INTO step_executions (
        execution_id, step_number, assigned_user_id, assigned_role,
        status, started_at
      ) VALUES (
        ${executionId}, ${step.stepNumber}, ${assignedUserId}, ${step.requiredRole || null},
        'pending', NOW()
      )
    `;

    // Set timeout if specified
    if (step.timeoutDays) {
      await this.scheduleStepTimeout(executionId, step.stepNumber, step.timeoutDays);
    }
  }

  /**
   * Schedule step timeout
   */
  private static async scheduleStepTimeout(
    executionId: string,
    stepNumber: number,
    timeoutDays: number
  ): Promise<void> {
    // This would integrate with a job scheduler or cron system
    // For now, we'll store the timeout information for manual processing
    await sql`
      INSERT INTO step_timeouts (
        execution_id, step_number, timeout_at, created_at
      ) VALUES (
        ${executionId}, ${stepNumber}, 
        NOW() + INTERVAL '${timeoutDays} days', NOW()
      )
    `;
  }

  /**
   * Process step timeouts (would be called by scheduled job)
   */
  static async processTimeouts(): Promise<void> {
    try {
      const timeouts = await sql`
        SELECT st.*, se.*, we.*, wt.steps
        FROM step_timeouts st
        JOIN step_executions se ON st.execution_id = se.execution_id AND st.step_number = se.step_number
        JOIN workflow_executions we ON st.execution_id = we.id
        JOIN workflow_templates wt ON we.workflow_id = wt.id
        WHERE st.timeout_at <= NOW() AND se.status = 'pending' AND st.processed_at IS NULL
      `;

      for (const timeout of timeouts) {
        const workflow: WorkflowTemplate = {
          id: timeout.workflow_id,
          name: timeout.name,
          module: timeout.module,
          isActive: timeout.is_active,
          steps: JSON.parse(timeout.steps)
        };

        const step = workflow.steps.find(s => s.stepNumber === timeout.step_number);
        if (step && step.escalationRole) {
          // Escalate to escalation role
          await this.escalateStep(timeout.execution_id, timeout.step_number, step.escalationRole);
        } else {
          // Auto-approve if no escalation defined
          await this.autoApproveStep(timeout.execution_id, timeout.step_number);
        }

        // Mark timeout as processed
        await sql`
          UPDATE step_timeouts 
          SET processed_at = NOW()
          WHERE id = ${timeout.id}
        `;
      }

    } catch (error) {
      console.error('Error processing timeouts:', error);
    }
  }

  /**
   * Escalate step to another role
   */
  private static async escalateStep(
    executionId: string,
    stepNumber: number,
    escalationRole: string
  ): Promise<void> {
    const escalationUser = await this.findUserByRole(escalationRole);
    
    await sql`
      UPDATE step_executions 
      SET status = 'escalated', escalated_to = ${escalationUser}, assigned_user_id = ${escalationUser}
      WHERE execution_id = ${executionId} AND step_number = ${stepNumber}
    `;

    // Send escalation notification
    // Implementation would depend on notification service
  }

  /**
   * Auto-approve step on timeout
   */
  private static async autoApproveStep(
    executionId: string,
    stepNumber: number
  ): Promise<void> {
    await sql`
      UPDATE step_executions 
      SET status = 'approved', completed_at = NOW(), comments = 'Auto-approved due to timeout'
      WHERE execution_id = ${executionId} AND step_number = ${stepNumber}
    `;

    const execution = await this.getExecution(executionId);
    const workflow = await this.getWorkflow(execution!.workflowId);
    
    if (execution && workflow) {
      await this.handleStepApproval(execution, workflow, stepNumber);
    }
  }

  /**
   * Send notifications for step assignment
   */
  private static async notifyStepAssignee(
    executionId: string,
    step: WorkflowStep,
    context: WorkflowExecutionContext
  ): Promise<void> {
    try {
      const assignedUserId = step.assignedUserId || await this.findUserByRole(step.requiredRole!, context.department);
      
      if (assignedUserId) {
        await NotificationService.createNotification({
          userId: assignedUserId,
          title: `Approval Required: ${context.requestType.toUpperCase()}`,
          message: `${step.stepName} approval required for request ${context.requestId}`,
          type: 'approval_request',
          entityType: context.requestType,
          entityId: context.requestId,
          actionRequired: true,
          metadata: {
            executionId,
            stepNumber: step.stepNumber,
            stepName: step.stepName
          }
        });
      }

    } catch (error) {
      console.error('Error sending step notification:', error);
    }
  }

  /**
   * Send workflow completion notifications
   */
  private static async notifyWorkflowCompletion(
    execution: WorkflowExecution,
    result: 'approved' | 'rejected',
    comments?: string
  ): Promise<void> {
    try {
      const title = result === 'approved' 
        ? `Request Approved: ${execution.requestType.toUpperCase()}`
        : `Request Rejected: ${execution.requestType.toUpperCase()}`;

      const message = result === 'approved'
        ? `Your ${execution.requestType} request ${execution.requestId} has been fully approved`
        : `Your ${execution.requestType} request ${execution.requestId} has been rejected${comments ? ': ' + comments : ''}`;

      await NotificationService.createNotification({
        userId: execution.createdBy,
        title,
        message,
        type: result === 'approved' ? 'approval_completed' : 'approval_rejected',
        entityType: execution.requestType,
        entityId: execution.requestId,
        actionRequired: false,
        metadata: {
          executionId: execution.id,
          finalResult: result,
          comments
        }
      });

    } catch (error) {
      console.error('Error sending completion notification:', error);
    }
  }

  /**
   * Helper methods
   */
  private static async getActiveWorkflow(requestType: string): Promise<WorkflowTemplate | null> {
    try {
      const result = await sql`
        SELECT * FROM workflow_templates 
        WHERE module = ${requestType} AND is_active = true
        ORDER BY created_at DESC LIMIT 1
      `;

      if (result.length === 0) return null;

      const row = result[0];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        module: row.module,
        isActive: row.is_active,
        steps: JSON.parse(row.steps),
        createdBy: row.created_by
      };

    } catch (error) {
      console.error('Error getting active workflow:', error);
      return null;
    }
  }

  private static async getWorkflow(workflowId: string): Promise<WorkflowTemplate | null> {
    try {
      const result = await sql`
        SELECT * FROM workflow_templates WHERE id = ${workflowId}
      `;

      if (result.length === 0) return null;

      const row = result[0];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        module: row.module,
        isActive: row.is_active,
        steps: JSON.parse(row.steps),
        createdBy: row.created_by
      };

    } catch (error) {
      console.error('Error getting workflow:', error);
      return null;
    }
  }

  private static async getExecution(executionId: string): Promise<WorkflowExecution | null> {
    try {
      const result = await sql`
        SELECT * FROM workflow_executions WHERE id = ${executionId}
      `;

      if (result.length === 0) return null;

      const row = result[0];
      return {
        id: row.id,
        workflowId: row.workflow_id,
        requestId: row.request_id,
        requestType: row.request_type,
        currentStepNumber: row.current_step_number,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        createdBy: row.created_by
      };

    } catch (error) {
      console.error('Error getting execution:', error);
      return null;
    }
  }

  private static async findUserByRole(role: string, department?: string): Promise<string | null> {
    try {
      let query;
      
      if (role === 'HOD' || role === 'Head of Department') {
        // HODs are department-agnostic for approvals
        query = sql`
          SELECT u.id FROM users u
          JOIN roles r ON u.role_id = r.id
          WHERE r.name = ${role} AND u.status = 'Active'
          ORDER BY u.created_at ASC LIMIT 1
        `;
      } else if (department) {
        // Department-specific roles
        query = sql`
          SELECT u.id FROM users u
          JOIN roles r ON u.role_id = r.id
          WHERE r.name = ${role} AND u.department = ${department} AND u.status = 'Active'
          ORDER BY u.created_at ASC LIMIT 1
        `;
      } else {
        // Any user with the role
        query = sql`
          SELECT u.id FROM users u
          JOIN roles r ON u.role_id = r.id
          WHERE r.name = ${role} AND u.status = 'Active'
          ORDER BY u.created_at ASC LIMIT 1
        `;
      }

      const result = await query;
      return result.length > 0 ? result[0].id : null;

    } catch (error) {
      console.error('Error finding user by role:', error);
      return null;
    }
  }

  private static async validateStepPermission(
    executionId: string,
    stepNumber: number,
    userId: string
  ): Promise<void> {
    const result = await sql`
      SELECT assigned_user_id, delegated_to FROM step_executions
      WHERE execution_id = ${executionId} AND step_number = ${stepNumber}
    `;

    if (result.length === 0) {
      throw new Error('Step execution not found');
    }

    const step = result[0];
    const allowedUsers = [step.assigned_user_id, step.delegated_to].filter(Boolean);

    if (!allowedUsers.includes(userId)) {
      throw new Error('User not authorized to act on this step');
    }
  }

  private static async updateRequestStatus(
    requestId: string,
    requestType: string,
    status: string
  ): Promise<void> {
    const tableMap = {
      'trf': 'travel_requests',
      'claims': 'expense_claims',
      'visa': 'visa_applications',
      'transport': 'transport_requests',
      'accommodation': 'accommodation_requests'
    };

    const tableName = tableMap[requestType as keyof typeof tableMap];
    if (!tableName) {
      throw new Error('Invalid request type');
    }

    await sql`
      UPDATE ${sql(tableName)} 
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${requestId}
    `;
  }

  /**
   * Get workflow execution status for a request
   */
  static async getExecutionStatus(requestId: string, requestType: string): Promise<any> {
    try {
      const result = await sql`
        SELECT we.*, se.step_number, se.status as step_status, se.assigned_user_id,
               se.started_at as step_started_at, se.completed_at as step_completed_at,
               se.comments, u.name as assigned_user_name, wt.steps
        FROM workflow_executions we
        LEFT JOIN step_executions se ON we.id = se.execution_id
        LEFT JOIN users u ON se.assigned_user_id = u.id
        LEFT JOIN workflow_templates wt ON we.workflow_id = wt.id
        WHERE we.request_id = ${requestId} AND we.request_type = ${requestType}
        ORDER BY se.step_number
      `;

      if (result.length === 0) {
        return null;
      }

      const execution = {
        id: result[0].id,
        workflowId: result[0].workflow_id,
        requestId: result[0].request_id,
        requestType: result[0].request_type,
        currentStepNumber: result[0].current_step_number,
        status: result[0].status,
        startedAt: result[0].started_at,
        completedAt: result[0].completed_at,
        steps: result.map(row => ({
          stepNumber: row.step_number,
          status: row.step_status,
          assignedUserId: row.assigned_user_id,
          assignedUserName: row.assigned_user_name,
          startedAt: row.step_started_at,
          completedAt: row.step_completed_at,
          comments: row.comments
        })).filter(step => step.stepNumber !== null)
      };

      return execution;

    } catch (error) {
      console.error('Error getting execution status:', error);
      return null;
    }
  }
}