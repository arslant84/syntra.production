// src/lib/system-settings-service.ts
import { sql } from '@/lib/db'; // Use the shared database client
import { Role, Permission, RoleWithPermissions, RoleFormValues } from '@/types/roles';
import { WorkflowModule, WorkflowStep, WorkflowModuleWithSteps, WorkflowStepFormValues } from '@/types/workflows';
import { NotificationTemplate, NotificationEventType, NotificationTemplateFormValues } from '@/types/notifications';

/**
 * Fetches all roles with their associated permissions
 */
export async function getAllRolesWithPermissions(): Promise<RoleWithPermissions[]> {
  try {
    // Get all roles
    const rolesResult = await sql`
      SELECT id, name, description, created_at, updated_at
      FROM roles
      ORDER BY name ASC
    `;

    const roles: RoleWithPermissions[] = rolesResult.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at,
      permissionIds: [],
      permissions: []
    }));

    // Get role-permission mappings for all roles
    const roleMappings = await sql`
      SELECT rp.role_id, rp.permission_id, p.name, p.description
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
    `;

    // Map permissions to their respective roles
    for (const mapping of roleMappings) {
      const role = roles.find(r => r.id === mapping.role_id);
      if (role) {
        role.permissionIds.push(mapping.permission_id);
        if (!role.permissions) role.permissions = [];
        role.permissions.push({
          id: mapping.permission_id,
          name: mapping.name,
          description: mapping.description
        });
      }
    }

    return roles;
  } catch (error) {
    console.error('Error fetching roles with permissions:', error);
    throw new Error('Failed to fetch roles with permissions');
  }
}

/**
 * Fetches a single role with its permissions by ID
 */
export async function getRoleById(roleId: string): Promise<RoleWithPermissions | null> {
  try {
    const roleResult = await sql`
      SELECT id, name, description, created_at, updated_at
      FROM roles
      WHERE id = ${roleId}
    `;

    if (roleResult.length === 0) {
      return null;
    }

    const role = roleResult[0];
    
    // Get permissions for this role
    const permissionsResult = await sql`
      SELECT p.id, p.name, p.description
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ${roleId}
    `;

    const permissionIds = permissionsResult.map((p: any) => p.id);
    const permissions = permissionsResult.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description
    }));

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      created_at: role.created_at,
      updated_at: role.updated_at,
      permissionIds,
      permissions
    };
  } catch (error) {
    console.error(`Error fetching role ${roleId}:`, error);
    throw new Error(`Failed to fetch role ${roleId}`);
  }
}

/**
 * Creates a new role with permissions
 */
export async function createRole(roleData: RoleFormValues): Promise<RoleWithPermissions> {
  try {
    // Start a transaction
    await sql`BEGIN`;

    try {
      // Create the role
      const roleResult = await sql`
        INSERT INTO roles (name, description)
        VALUES (${roleData.name}, ${roleData.description || null})
        RETURNING id, name, description, created_at, updated_at
      `;

      const newRole = roleResult[0];
      const roleId = newRole.id;

      // Add permissions to the role
      if (roleData.permissionIds && roleData.permissionIds.length > 0) {
        for (const permissionId of roleData.permissionIds) {
          await sql`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (${roleId}, ${permissionId})
          `;
        }
      }

      // Commit the transaction
      await sql`COMMIT`;

      // Fetch the complete role with permissions
      const roleWithPermissions = await getRoleById(roleId);
      if (!roleWithPermissions) {
        throw new Error('Failed to retrieve created role');
      }

      return roleWithPermissions;
    } catch (error) {
      // Rollback the transaction on error
      await sql`ROLLBACK`;
      throw error;
    }
  } catch (error) {
    console.error('Error creating role:', error);
    throw new Error('Failed to create role');
  }
}

/**
 * Updates an existing role and its permissions
 */
export async function updateRole(roleId: string, roleData: RoleFormValues): Promise<RoleWithPermissions> {
  try {
    // Start a transaction
    await sql`BEGIN`;

    try {
      // Update the role
      await sql`
        UPDATE roles
        SET name = ${roleData.name}, 
            description = ${roleData.description || null}
        WHERE id = ${roleId}
      `;

      // Delete existing role-permission mappings
      await sql`
        DELETE FROM role_permissions
        WHERE role_id = ${roleId}
      `;

      // Add new role-permission mappings
      if (roleData.permissionIds && roleData.permissionIds.length > 0) {
        for (const permissionId of roleData.permissionIds) {
          await sql`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (${roleId}, ${permissionId})
          `;
        }
      }

      // Commit the transaction
      await sql`COMMIT`;

      // Fetch the updated role with permissions
      const updatedRole = await getRoleById(roleId);
      if (!updatedRole) {
        throw new Error('Failed to retrieve updated role');
      }

      return updatedRole;
    } catch (error) {
      // Rollback the transaction on error
      await sql`ROLLBACK`;
      throw error;
    }
  } catch (error) {
    console.error(`Error updating role ${roleId}:`, error);
    throw new Error(`Failed to update role ${roleId}`);
  }
}

/**
 * Deletes a role
 */
export async function deleteRole(roleId: string): Promise<boolean> {
  try {
    // Check if any users are assigned this role
    const usersWithRole = await sql`
      SELECT COUNT(*) as count
      FROM users
      WHERE role_id = ${roleId}
    `;

    if (parseInt(usersWithRole[0].count) > 0) {
      throw new Error('Cannot delete role: it is assigned to one or more users');
    }

    // Start a transaction
    await sql`BEGIN`;

    try {
      // Delete role-permission mappings
      await sql`
        DELETE FROM role_permissions
        WHERE role_id = ${roleId}
      `;

      // Delete the role
      await sql`
        DELETE FROM roles
        WHERE id = ${roleId}
      `;

      // Commit the transaction
      await sql`COMMIT`;
      
      return true;
    } catch (error) {
      // Rollback the transaction on error
      await sql`ROLLBACK`;
      throw error;
    }
  } catch (error) {
    console.error(`Error deleting role ${roleId}:`, error);
    throw error;
  }
}

/**
 * Fetches all permissions
 */
export async function getAllPermissions(): Promise<Permission[]> {
  try {
    const result = await sql`
      SELECT id, name, description, created_at, updated_at
      FROM permissions
      ORDER BY name ASC
    `;

    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  } catch (error) {
    console.error('Error fetching permissions:', error);
    throw new Error('Failed to fetch permissions');
  }
}

/**
 * Gets system settings
 */
export async function getSystemSettings() {
  // This is a placeholder for future system settings
  // You can expand this to fetch from a system_settings table
  return {
    applicationName: 'SynTra',
    maintenanceMode: false,
    // Add more system settings as needed
  };
}

/**
 * Fetches all workflow modules with their steps
 */
export async function getAllWorkflowModules(): Promise<WorkflowModuleWithSteps[]> {
  try {
    // Get all workflow modules
    const modulesResult = await sql`
      SELECT id, name, description, created_at, updated_at
      FROM workflow_modules
      ORDER BY name ASC
    `;

    const modules: WorkflowModuleWithSteps[] = modulesResult.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at,
      steps: []
    }));

    // Get all workflow steps for these modules
    const stepsResult = await sql`
      SELECT ws.id, ws.name, ws.approver_role_id, r1.name as approver_role,
             ws.escalation_role_id, r2.name as escalation_role,
             ws.escalation_hours, ws.order, ws.module_id
      FROM workflow_steps ws
      JOIN roles r1 ON ws.approver_role_id = r1.id
      LEFT JOIN roles r2 ON ws.escalation_role_id = r2.id
      ORDER BY ws.module_id, ws.order ASC
    `;

    // Map steps to their respective modules
    for (const step of stepsResult) {
      const module = modules.find(m => m.id === step.module_id);
      if (module) {
        module.steps.push({
          id: step.id,
          name: step.name,
          approverRoleId: step.approver_role_id,
          approverRole: step.approver_role,
          escalationRoleId: step.escalation_role_id,
          escalationRole: step.escalation_role,
          escalationHours: step.escalation_hours,
          order: step.order,
          moduleId: step.module_id
        });
      }
    }

    return modules;
  } catch (error) {
    console.error('Error fetching workflow modules:', error);
    throw new Error('Failed to fetch workflow modules');
  }
}

/**
 * Creates a new workflow step
 */
export async function createWorkflowStep(
  moduleId: string,
  stepData: WorkflowStepFormValues
): Promise<WorkflowStep> {
  try {
    // Start a transaction
    await sql`BEGIN`;

    try {
      // Get the highest order for this module
      const orderResult = await sql`
        SELECT COALESCE(MAX("order"), 0) as max_order
        FROM workflow_steps
        WHERE module_id = ${moduleId}
      `;
      
      const nextOrder = parseInt(orderResult[0].max_order) + 1;
      
      // Create the workflow step
      const stepResult = await sql`
        INSERT INTO workflow_steps (
          name, approver_role_id, escalation_role_id, escalation_hours, "order", module_id
        )
        VALUES (
          ${stepData.name},
          ${stepData.approverRoleId},
          ${stepData.escalationRoleId || null},
          ${stepData.escalationHours || null},
          ${stepData.order || nextOrder},
          ${moduleId}
        )
        RETURNING id, name, approver_role_id, escalation_role_id, escalation_hours, "order", module_id
      `;

      // Commit the transaction
      await sql`COMMIT`;

      const newStep = stepResult[0];
      
      // Get role names
      const approverRoleResult = await sql`
        SELECT name FROM roles WHERE id = ${newStep.approver_role_id}
      `;
      
      let escalationRole = null;
      if (newStep.escalation_role_id) {
        const escalationRoleResult = await sql`
          SELECT name FROM roles WHERE id = ${newStep.escalation_role_id}
        `;
        escalationRole = escalationRoleResult[0]?.name;
      }

      return {
        id: newStep.id,
        name: newStep.name,
        approverRoleId: newStep.approver_role_id,
        approverRole: approverRoleResult[0]?.name,
        escalationRoleId: newStep.escalation_role_id,
        escalationRole,
        escalationHours: newStep.escalation_hours,
        order: newStep.order,
        moduleId: newStep.module_id
      };
    } catch (error) {
      // Rollback the transaction on error
      await sql`ROLLBACK`;
      throw error;
    }
  } catch (error) {
    console.error('Error creating workflow step:', error);
    throw new Error('Failed to create workflow step');
  }
}

/**
 * Updates a workflow step
 */
export async function updateWorkflowStep(
  stepId: string,
  stepData: WorkflowStepFormValues
): Promise<WorkflowStep> {
  try {
    // Start a transaction
    await sql`BEGIN`;

    try {
      // Update the workflow step
      const stepResult = await sql`
        UPDATE workflow_steps
        SET name = ${stepData.name},
            approver_role_id = ${stepData.approverRoleId},
            escalation_role_id = ${stepData.escalationRoleId || null},
            escalation_hours = ${stepData.escalationHours || null},
            "order" = ${stepData.order || null}
        WHERE id = ${stepId}
        RETURNING id, name, approver_role_id, escalation_role_id, escalation_hours, "order", module_id
      `;

      // Commit the transaction
      await sql`COMMIT`;

      const updatedStep = stepResult[0];
      
      // Get role names
      const approverRoleResult = await sql`
        SELECT name FROM roles WHERE id = ${updatedStep.approver_role_id}
      `;
      
      let escalationRole = null;
      if (updatedStep.escalation_role_id) {
        const escalationRoleResult = await sql`
          SELECT name FROM roles WHERE id = ${updatedStep.escalation_role_id}
        `;
        escalationRole = escalationRoleResult[0]?.name;
      }

      return {
        id: updatedStep.id,
        name: updatedStep.name,
        approverRoleId: updatedStep.approver_role_id,
        approverRole: approverRoleResult[0]?.name,
        escalationRoleId: updatedStep.escalation_role_id,
        escalationRole,
        escalationHours: updatedStep.escalation_hours,
        order: updatedStep.order,
        moduleId: updatedStep.module_id
      };
    } catch (error) {
      // Rollback the transaction on error
      await sql`ROLLBACK`;
      throw error;
    }
  } catch (error) {
    console.error(`Error updating workflow step ${stepId}:`, error);
    throw new Error(`Failed to update workflow step ${stepId}`);
  }
}

/**
 * Deletes a workflow step
 */
export async function deleteWorkflowStep(stepId: string): Promise<boolean> {
  try {
    // Start a transaction
    await sql`BEGIN`;

    try {
      // Get the step to be deleted
      const stepResult = await sql`
        SELECT module_id, "order"
        FROM workflow_steps
        WHERE id = ${stepId}
      `;
      
      if (stepResult.length === 0) {
        throw new Error('Workflow step not found');
      }
      
      const { module_id, order } = stepResult[0];
      
      // Delete the step
      await sql`
        DELETE FROM workflow_steps
        WHERE id = ${stepId}
      `;
      
      // Reorder remaining steps
      await sql`
        UPDATE workflow_steps
        SET "order" = "order" - 1
        WHERE module_id = ${module_id}
        AND "order" > ${order}
      `;

      // Commit the transaction
      await sql`COMMIT`;
      
      return true;
    } catch (error) {
      // Rollback the transaction on error
      await sql`ROLLBACK`;
      throw error;
    }
  } catch (error) {
    console.error(`Error deleting workflow step ${stepId}:`, error);
    throw new Error(`Failed to delete workflow step ${stepId}`);
  }
}

/**
 * Fetches all notification templates
 */
export async function getAllNotificationTemplates(): Promise<NotificationTemplate[]> {
  try {
    const result = await sql`
      SELECT id, name, description, subject, body, type, event_type, created_at, updated_at
      FROM notification_templates
      ORDER BY name ASC
    `;

    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      subject: row.subject,
      body: row.body,
      type: row.type,
      eventType: row.event_type,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  } catch (error) {
    console.error('Error fetching notification templates:', error);
    throw new Error('Failed to fetch notification templates');
  }
}

/**
 * Fetches all notification event types
 */
export async function getAllNotificationEventTypes(): Promise<NotificationEventType[]> {
  try {
    const result = await sql`
      SELECT id, name, description, created_at, updated_at
      FROM notification_event_types
      ORDER BY name ASC
    `;

    return result.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  } catch (error) {
    console.error('Error fetching notification event types:', error);
    throw new Error('Failed to fetch notification event types');
  }
}

/**
 * Creates a new notification template
 */
export async function createNotificationTemplate(
  templateData: NotificationTemplateFormValues
): Promise<NotificationTemplate> {
  try {
    const result = await sql`
      INSERT INTO notification_templates (
        name, description, subject, body, type, event_type
      )
      VALUES (
        ${templateData.name},
        ${templateData.description || null},
        ${templateData.subject},
        ${templateData.body},
        ${templateData.type},
        ${templateData.eventType}
      )
      RETURNING id, name, description, subject, body, type, event_type, created_at, updated_at
    `;

    const newTemplate = result[0];
    return {
      id: newTemplate.id,
      name: newTemplate.name,
      description: newTemplate.description,
      subject: newTemplate.subject,
      body: newTemplate.body,
      type: newTemplate.type,
      eventType: newTemplate.event_type,
      created_at: newTemplate.created_at,
      updated_at: newTemplate.updated_at
    };
  } catch (error) {
    console.error('Error creating notification template:', error);
    throw new Error('Failed to create notification template');
  }
}

/**
 * Updates a notification template
 */
export async function updateNotificationTemplate(
  templateId: string,
  templateData: NotificationTemplateFormValues
): Promise<NotificationTemplate> {
  try {
    const result = await sql`
      UPDATE notification_templates
      SET name = ${templateData.name},
          description = ${templateData.description || null},
          subject = ${templateData.subject},
          body = ${templateData.body},
          type = ${templateData.type},
          event_type = ${templateData.eventType}
      WHERE id = ${templateId}
      RETURNING id, name, description, subject, body, type, event_type, created_at, updated_at
    `;

    if (result.length === 0) {
      throw new Error('Notification template not found');
    }

    const updatedTemplate = result[0];
    return {
      id: updatedTemplate.id,
      name: updatedTemplate.name,
      description: updatedTemplate.description,
      subject: updatedTemplate.subject,
      body: updatedTemplate.body,
      type: updatedTemplate.type,
      eventType: updatedTemplate.event_type,
      created_at: updatedTemplate.created_at,
      updated_at: updatedTemplate.updated_at
    };
  } catch (error) {
    console.error(`Error updating notification template ${templateId}:`, error);
    throw new Error(`Failed to update notification template ${templateId}`);
  }
}

/**
 * Deletes a notification template
 */
export async function deleteNotificationTemplate(templateId: string): Promise<boolean> {
  try {
    const result = await sql`
      DELETE FROM notification_templates
      WHERE id = ${templateId}
      RETURNING id
    `;

    if (result.length === 0) {
      throw new Error('Notification template not found');
    }

    return true;
  } catch (error) {
    console.error(`Error deleting notification template ${templateId}:`, error);
    throw new Error(`Failed to delete notification template ${templateId}`);
  }
}
