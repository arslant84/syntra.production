// Workflow Service - Core business logic for workflow management
import { sql } from '@/lib/db';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  module: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  steps?: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  workflow_template_id: string;
  step_number: number;
  step_name: string;
  required_role: string;
  description?: string;
  is_mandatory: boolean;
  can_delegate: boolean;
  timeout_days?: number;
  escalation_role?: string;
  conditions?: any;
  created_at: string;
  updated_at: string;
}

export interface WorkflowInstance {
  id: string;
  workflow_template_id: string;
  entity_id: string;
  entity_type: string;
  current_step_id?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  initiated_by?: string;
  initiated_at: string;
  completed_at?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStepExecution {
  id: string;
  workflow_instance_id: string;
  workflow_step_id: string;
  assigned_to_role: string;
  assigned_to_user?: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'escalated';
  action_taken_by?: string;
  action_taken_at?: string;
  comments?: string;
  attachments?: any;
  escalated_from?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get all workflow templates
 */
export async function getAllWorkflowTemplates(): Promise<WorkflowTemplate[]> {
  try {
    const result = await sql`
      SELECT wt.*, 
             COALESCE(json_agg(
               json_build_object(
                 'id', ws.id,
                 'step_number', ws.step_number,
                 'step_name', ws.step_name,
                 'required_role', ws.required_role,
                 'description', ws.description,
                 'is_mandatory', ws.is_mandatory,
                 'can_delegate', ws.can_delegate,
                 'timeout_days', ws.timeout_days,
                 'escalation_role', ws.escalation_role
               ) ORDER BY ws.step_number
             ) FILTER (WHERE ws.id IS NOT NULL), '[]') as steps
      FROM workflow_templates wt
      LEFT JOIN workflow_steps ws ON wt.id = ws.workflow_template_id
      WHERE wt.is_active = true
      GROUP BY wt.id
      ORDER BY wt.name
    `;
    
    return result.map(row => ({
      ...row,
      steps: row.steps || []
    }));
  } catch (error) {
    console.error('Error fetching workflow templates:', error);
    throw new Error('Failed to fetch workflow templates');
  }
}

/**
 * Get workflow template by ID
 */
export async function getWorkflowTemplateById(id: string): Promise<WorkflowTemplate | null> {
  try {
    const result = await sql`
      SELECT wt.*, 
             COALESCE(json_agg(
               json_build_object(
                 'id', ws.id,
                 'step_number', ws.step_number,
                 'step_name', ws.step_name,
                 'required_role', ws.required_role,
                 'description', ws.description,
                 'is_mandatory', ws.is_mandatory,
                 'can_delegate', ws.can_delegate,
                 'timeout_days', ws.timeout_days,
                 'escalation_role', ws.escalation_role
               ) ORDER BY ws.step_number
             ) FILTER (WHERE ws.id IS NOT NULL), '[]') as steps
      FROM workflow_templates wt
      LEFT JOIN workflow_steps ws ON wt.id = ws.workflow_template_id
      WHERE wt.id = ${id}
      GROUP BY wt.id
    `;
    
    if (result.length === 0) return null;
    
    return {
      ...result[0],
      steps: result[0].steps || []
    };
  } catch (error) {
    console.error('Error fetching workflow template by ID:', error);
    throw new Error('Failed to fetch workflow template');
  }
}

/**
 * Get workflow templates by module
 */
export async function getWorkflowTemplatesByModule(module: string): Promise<WorkflowTemplate[]> {
  try {
    const result = await sql`
      SELECT wt.*, 
             COALESCE(json_agg(
               json_build_object(
                 'id', ws.id,
                 'step_number', ws.step_number,
                 'step_name', ws.step_name,
                 'required_role', ws.required_role,
                 'description', ws.description,
                 'is_mandatory', ws.is_mandatory,
                 'can_delegate', ws.can_delegate,
                 'timeout_days', ws.timeout_days,
                 'escalation_role', ws.escalation_role
               ) ORDER BY ws.step_number
             ) FILTER (WHERE ws.id IS NOT NULL), '[]') as steps
      FROM workflow_templates wt
      LEFT JOIN workflow_steps ws ON wt.id = ws.workflow_template_id
      WHERE wt.module = ${module} AND wt.is_active = true
      GROUP BY wt.id
      ORDER BY wt.name
    `;
    
    return result.map(row => ({
      ...row,
      steps: row.steps || []
    }));
  } catch (error) {
    console.error('Error fetching workflow templates by module:', error);
    throw new Error('Failed to fetch workflow templates for module');
  }
}

/**
 * Create new workflow template
 */
export async function createWorkflowTemplate(
  template: Omit<WorkflowTemplate, 'id' | 'created_at' | 'updated_at'>,
  steps: Omit<WorkflowStep, 'id' | 'workflow_template_id' | 'created_at' | 'updated_at'>[]
): Promise<WorkflowTemplate> {
  try {
    const result = await sql.begin(async sql => {
      // Create the template
      const [newTemplate] = await sql`
        INSERT INTO workflow_templates (name, description, module, is_active, created_by)
        VALUES (${template.name}, ${template.description || null}, ${template.module}, ${template.is_active}, ${template.created_by || null})
        RETURNING *
      `;
      
      // Create the steps
      if (steps.length > 0) {
        const stepValues = steps.map(step => [
          newTemplate.id,
          step.step_number,
          step.step_name,
          step.required_role,
          step.description || null,
          step.is_mandatory,
          step.can_delegate,
          step.timeout_days || null,
          step.escalation_role || null,
          step.conditions ? JSON.stringify(step.conditions) : null
        ]);
        
        await sql`
          INSERT INTO workflow_steps (
            workflow_template_id, step_number, step_name, required_role, description,
            is_mandatory, can_delegate, timeout_days, escalation_role, conditions
          )
          VALUES ${sql(stepValues)}
        `;
      }
      
      return newTemplate;
    });
    
    // Return the complete template with steps
    return await getWorkflowTemplateById(result.id) as WorkflowTemplate;
  } catch (error) {
    console.error('Error creating workflow template:', error);
    throw new Error('Failed to create workflow template');
  }
}

/**
 * Update workflow template
 */
export async function updateWorkflowTemplate(
  id: string,
  template: Partial<WorkflowTemplate>,
  steps?: Omit<WorkflowStep, 'id' | 'workflow_template_id' | 'created_at' | 'updated_at'>[]
): Promise<WorkflowTemplate> {
  try {
    const result = await sql.begin(async sql => {
      // Update the template
      const [updatedTemplate] = await sql`
        UPDATE workflow_templates 
        SET 
          name = ${template.name || sql`name`},
          description = ${template.description !== undefined ? template.description : sql`description`},
          module = ${template.module || sql`module`},
          is_active = ${template.is_active !== undefined ? template.is_active : sql`is_active`},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      
      // Update steps if provided
      if (steps) {
        // Delete existing steps
        await sql`DELETE FROM workflow_steps WHERE workflow_template_id = ${id}`;
        
        // Insert new steps
        if (steps.length > 0) {
          const stepValues = steps.map(step => [
            id,
            step.step_number,
            step.step_name,
            step.required_role,
            step.description || null,
            step.is_mandatory,
            step.can_delegate,
            step.timeout_days || null,
            step.escalation_role || null,
            step.conditions ? JSON.stringify(step.conditions) : null
          ]);
          
          await sql`
            INSERT INTO workflow_steps (
              workflow_template_id, step_number, step_name, required_role, description,
              is_mandatory, can_delegate, timeout_days, escalation_role, conditions
            )
            VALUES ${sql(stepValues)}
          `;
        }
      }
      
      return updatedTemplate;
    });
    
    // Return the complete template with steps
    return await getWorkflowTemplateById(id) as WorkflowTemplate;
  } catch (error) {
    console.error('Error updating workflow template:', error);
    throw new Error('Failed to update workflow template');
  }
}

/**
 * Delete workflow template
 */
export async function deleteWorkflowTemplate(id: string): Promise<void> {
  try {
    await sql`
      UPDATE workflow_templates 
      SET is_active = false, updated_at = NOW()
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error('Error deleting workflow template:', error);
    throw new Error('Failed to delete workflow template');
  }
}

/**
 * Start a new workflow instance
 */
export async function startWorkflowInstance(
  templateId: string,
  entityId: string,
  entityType: string,
  initiatedBy: string,
  metadata?: any
): Promise<WorkflowInstance> {
  try {
    const result = await sql.begin(async sql => {
      // Get the first step of the workflow
      const [firstStep] = await sql`
        SELECT id FROM workflow_steps 
        WHERE workflow_template_id = ${templateId} 
        ORDER BY step_number ASC 
        LIMIT 1
      `;
      
      if (!firstStep) {
        throw new Error('No steps found for workflow template');
      }
      
      // Create workflow instance
      const [instance] = await sql`
        INSERT INTO workflow_instances (
          workflow_template_id, entity_id, entity_type, current_step_id, 
          initiated_by, metadata
        )
        VALUES (${templateId}, ${entityId}, ${entityType}, ${firstStep.id}, ${initiatedBy}, ${JSON.stringify(metadata || {})})
        RETURNING *
      `;
      
      // Create first step execution
      const firstStepDetail = await sql`
        SELECT required_role, timeout_days FROM workflow_steps 
        WHERE id = ${firstStep.id}
      `;
      
      const dueDate = firstStepDetail[0].timeout_days 
        ? new Date(Date.now() + firstStepDetail[0].timeout_days * 24 * 60 * 60 * 1000)
        : null;
      
      await sql`
        INSERT INTO workflow_step_executions (
          workflow_instance_id, workflow_step_id, assigned_to_role, due_date
        )
        VALUES (${instance.id}, ${firstStep.id}, ${firstStepDetail[0].required_role}, ${dueDate})
      `;
      
      return instance;
    });
    
    return result;
  } catch (error) {
    console.error('Error starting workflow instance:', error);
    throw new Error('Failed to start workflow instance');
  }
}

/**
 * Get workflow instances for a user/role
 */
export async function getWorkflowInstancesForUser(
  userRole: string,
  status?: string
): Promise<any[]> {
  try {
    const result = await sql`
      SELECT 
        wi.id as instance_id,
        wi.entity_id,
        wi.entity_type,
        wi.status as instance_status,
        wi.initiated_at,
        wt.name as workflow_name,
        ws.step_name,
        wse.id as execution_id,
        wse.status as step_status,
        wse.due_date,
        wse.comments
      FROM workflow_instances wi
      JOIN workflow_templates wt ON wi.workflow_template_id = wt.id
      JOIN workflow_step_executions wse ON wi.id = wse.workflow_instance_id
      JOIN workflow_steps ws ON wse.workflow_step_id = ws.id
      WHERE wse.assigned_to_role = ${userRole}
      AND wse.status = 'pending'
      ${status ? sql`AND wi.status = ${status}` : sql``}
      ORDER BY wse.due_date ASC, wi.initiated_at DESC
    `;
    
    return result;
  } catch (error) {
    console.error('Error fetching workflow instances for user:', error);
    throw new Error('Failed to fetch workflow instances');
  }
}

/**
 * Process workflow step (approve/reject)
 */
export async function processWorkflowStep(
  executionId: string,
  action: 'approve' | 'reject',
  actionTakenBy: string,
  comments?: string
): Promise<void> {
  try {
    await sql.begin(async sql => {
      // Update the step execution
      await sql`
        UPDATE workflow_step_executions 
        SET 
          status = ${action === 'approve' ? 'approved' : 'rejected'},
          action_taken_by = ${actionTakenBy},
          action_taken_at = NOW(),
          comments = ${comments || null},
          updated_at = NOW()
        WHERE id = ${executionId}
      `;
      
      // Get the workflow instance and current step info
      const [stepInfo] = await sql`
        SELECT 
          wse.workflow_instance_id,
          wi.workflow_template_id,
          ws.step_number,
          wi.entity_id,
          wi.entity_type
        FROM workflow_step_executions wse
        JOIN workflow_instances wi ON wse.workflow_instance_id = wi.id
        JOIN workflow_steps ws ON wse.workflow_step_id = ws.id
        WHERE wse.id = ${executionId}
      `;
      
      if (action === 'approve') {
        // Find next step
        const [nextStep] = await sql`
          SELECT id, required_role, timeout_days
          FROM workflow_steps 
          WHERE workflow_template_id = ${stepInfo.workflow_template_id}
          AND step_number > ${stepInfo.step_number}
          ORDER BY step_number ASC
          LIMIT 1
        `;
        
        if (nextStep) {
          // Update workflow instance to next step
          await sql`
            UPDATE workflow_instances 
            SET current_step_id = ${nextStep.id}, updated_at = NOW()
            WHERE id = ${stepInfo.workflow_instance_id}
          `;
          
          // Create next step execution
          const dueDate = nextStep.timeout_days 
            ? new Date(Date.now() + nextStep.timeout_days * 24 * 60 * 60 * 1000)
            : null;
          
          await sql`
            INSERT INTO workflow_step_executions (
              workflow_instance_id, workflow_step_id, assigned_to_role, due_date
            )
            VALUES (${stepInfo.workflow_instance_id}, ${nextStep.id}, ${nextStep.required_role}, ${dueDate})
          `;
        } else {
          // No more steps - workflow is complete
          await sql`
            UPDATE workflow_instances 
            SET status = 'approved', completed_at = NOW(), updated_at = NOW()
            WHERE id = ${stepInfo.workflow_instance_id}
          `;
          
          // Update the original entity status if needed
          await updateEntityStatus(stepInfo.entity_type, stepInfo.entity_id, 'Approved');
        }
      } else {
        // Rejected - complete workflow as rejected
        await sql`
          UPDATE workflow_instances 
          SET status = 'rejected', completed_at = NOW(), updated_at = NOW()
          WHERE id = ${stepInfo.workflow_instance_id}
        `;
        
        // Update the original entity status if needed
        await updateEntityStatus(stepInfo.entity_type, stepInfo.entity_id, 'Rejected');
      }
    });
  } catch (error) {
    console.error('Error processing workflow step:', error);
    throw new Error('Failed to process workflow step');
  }
}

/**
 * Update entity status based on workflow outcome
 */
async function updateEntityStatus(entityType: string, entityId: string, status: string): Promise<void> {
  try {
    switch (entityType) {
      case 'trf':
        await sql`UPDATE travel_requests SET status = ${status}, updated_at = NOW() WHERE id = ${entityId}`;
        break;
      case 'visa':
        await sql`UPDATE visa_applications SET status = ${status}, updated_at = NOW() WHERE id = ${entityId}`;
        break;
      case 'transport':
        await sql`UPDATE transport_requests SET status = ${status}, updated_at = NOW() WHERE id = ${entityId}`;
        break;
      case 'accommodation':
        await sql`UPDATE travel_requests SET status = ${status}, updated_at = NOW() WHERE id = ${entityId} AND travel_type = 'Accommodation'`;
        break;
      default:
        console.warn(`Unknown entity type: ${entityType}`);
    }
  } catch (error) {
    console.error('Error updating entity status:', error);
    // Don't throw here as the workflow should still complete
  }
}