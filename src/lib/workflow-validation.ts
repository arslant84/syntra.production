// Enhanced Workflow Validation Engine
// Prevents saving invalid or incomplete workflows

import { sql } from '@/lib/db';

export interface WorkflowStep {
  id?: string;
  stepNumber: number;
  stepName: string;
  requiredRole?: string;
  assignedUserId?: string;
  description?: string;
  isMandatory: boolean;
  canDelegate: boolean;
  timeoutDays?: number;
  escalationRole?: string;
  conditions?: any;
}

export interface WorkflowTemplate {
  id?: string;
  name: string;
  description?: string;
  module: 'trf' | 'claims' | 'visa' | 'transport' | 'accommodation';
  isActive: boolean;
  steps: WorkflowStep[];
  createdBy?: string;
}

export interface ValidationError {
  type: 'error' | 'warning';
  message: string;
  stepIndex?: number;
  field?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export class WorkflowValidator {
  /**
   * Comprehensive workflow validation
   */
  static async validateWorkflow(workflow: WorkflowTemplate): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    try {
      // 1. Basic Template Validation
      this.validateBasicTemplate(workflow, errors);

      // 2. Steps Validation
      await this.validateSteps(workflow.steps, errors, warnings);

      // 3. Workflow Structure Validation
      this.validateWorkflowStructure(workflow.steps, errors);

      // 4. Business Logic Validation
      await this.validateBusinessLogic(workflow, errors, warnings);

      // 5. Role and User Validation
      await this.validateRolesAndUsers(workflow.steps, errors, warnings);

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      console.error('Workflow validation error:', error);
      return {
        isValid: false,
        errors: [{ type: 'error', message: 'Internal validation error occurred' }],
        warnings: []
      };
    }
  }

  /**
   * Real-time step validation for UI
   */
  static async validateStep(step: WorkflowStep, stepIndex: number, allSteps: WorkflowStep[]): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Required fields validation
    if (!step.stepName?.trim()) {
      errors.push({
        type: 'error',
        message: 'Step name is required',
        stepIndex,
        field: 'stepName'
      });
    }

    // Approver validation
    if (!step.requiredRole && !step.assignedUserId) {
      errors.push({
        type: 'error',
        message: 'Either a role or specific user must be assigned',
        stepIndex,
        field: 'approver'
      });
    }

    // Both role and user assigned (warning)
    if (step.requiredRole && step.assignedUserId) {
      errors.push({
        type: 'warning',
        message: 'Both role and user assigned - user will take precedence',
        stepIndex,
        field: 'approver'
      });
    }

    // Step number validation
    if (step.stepNumber <= 0) {
      errors.push({
        type: 'error',
        message: 'Step number must be positive',
        stepIndex,
        field: 'stepNumber'
      });
    }

    // Duplicate step numbers
    const duplicateSteps = allSteps.filter((s, i) => s.stepNumber === step.stepNumber && i !== stepIndex);
    if (duplicateSteps.length > 0) {
      errors.push({
        type: 'error',
        message: `Step number ${step.stepNumber} is used by multiple steps`,
        stepIndex,
        field: 'stepNumber'
      });
    }

    // Escalation validation
    if (step.escalationRole && !step.timeoutDays) {
      errors.push({
        type: 'error',
        message: 'Timeout days required when escalation role is set',
        stepIndex,
        field: 'timeoutDays'
      });
    }

    // Timeout validation
    if (step.timeoutDays && step.timeoutDays <= 0) {
      errors.push({
        type: 'error',
        message: 'Timeout days must be positive',
        stepIndex,
        field: 'timeoutDays'
      });
    }

    // Role validation (check if role exists)
    if (step.requiredRole) {
      const roleExists = await this.validateRoleExists(step.requiredRole);
      if (!roleExists) {
        errors.push({
          type: 'error',
          message: `Role "${step.requiredRole}" does not exist`,
          stepIndex,
          field: 'requiredRole'
        });
      }
    }

    // User validation (check if user exists and is active)
    if (step.assignedUserId) {
      const userValid = await this.validateUserExists(step.assignedUserId);
      if (!userValid) {
        errors.push({
          type: 'error',
          message: `User does not exist or is inactive`,
          stepIndex,
          field: 'assignedUserId'
        });
      }
    }

    return errors;
  }

  /**
   * Basic template validation
   */
  private static validateBasicTemplate(workflow: WorkflowTemplate, errors: ValidationError[]): void {
    // Required fields
    if (!workflow.name?.trim()) {
      errors.push({ type: 'error', message: 'Workflow name is required' });
    }

    if (!workflow.module) {
      errors.push({ type: 'error', message: 'Module selection is required' });
    }

    // Name length validation
    if (workflow.name && workflow.name.length > 100) {
      errors.push({ type: 'error', message: 'Workflow name must be 100 characters or less' });
    }

    // Description length validation
    if (workflow.description && workflow.description.length > 500) {
      errors.push({ type: 'error', message: 'Description must be 500 characters or less' });
    }

    // Valid module
    const validModules = ['trf', 'claims', 'visa', 'transport', 'accommodation'];
    if (workflow.module && !validModules.includes(workflow.module)) {
      errors.push({ type: 'error', message: 'Invalid module selected' });
    }
  }

  /**
   * Steps validation
   */
  private static async validateSteps(steps: WorkflowStep[], errors: ValidationError[], warnings: ValidationError[]): Promise<void> {
    // Must have at least one step
    if (!steps || steps.length === 0) {
      errors.push({ type: 'error', message: 'Workflow must have at least one approval step' });
      return;
    }

    // Maximum steps limit
    if (steps.length > 20) {
      errors.push({ type: 'error', message: 'Workflow cannot have more than 20 steps' });
    }

    // Validate each step
    for (let i = 0; i < steps.length; i++) {
      const stepErrors = await this.validateStep(steps[i], i, steps);
      errors.push(...stepErrors.filter(e => e.type === 'error'));
      warnings.push(...stepErrors.filter(e => e.type === 'warning'));
    }
  }

  /**
   * Workflow structure validation
   */
  private static validateWorkflowStructure(steps: WorkflowStep[], errors: ValidationError[]): void {
    if (steps.length === 0) return;

    // Step numbers must be sequential starting from 1
    const sortedSteps = [...steps].sort((a, b) => a.stepNumber - b.stepNumber);
    
    for (let i = 0; i < sortedSteps.length; i++) {
      const expectedStepNumber = i + 1;
      if (sortedSteps[i].stepNumber !== expectedStepNumber) {
        errors.push({
          type: 'error',
          message: `Step numbers must be sequential starting from 1. Expected step ${expectedStepNumber}, found step ${sortedSteps[i].stepNumber}`
        });
        break;
      }
    }

    // Check for gaps in step sequence
    const stepNumbers = steps.map(s => s.stepNumber).sort((a, b) => a - b);
    for (let i = 1; i < stepNumbers.length; i++) {
      if (stepNumbers[i] - stepNumbers[i-1] > 1) {
        errors.push({
          type: 'error',
          message: `Gap detected in step sequence between step ${stepNumbers[i-1]} and step ${stepNumbers[i]}`
        });
      }
    }

    // All steps must have valid approvers
    const stepsWithoutApprovers = steps.filter(s => !s.requiredRole && !s.assignedUserId);
    if (stepsWithoutApprovers.length > 0) {
      errors.push({
        type: 'error',
        message: `${stepsWithoutApprovers.length} step(s) lack assigned approvers`
      });
    }

    // Check for circular dependencies (if conditions exist)
    this.validateCircularDependencies(steps, errors);
  }

  /**
   * Business logic validation
   */
  private static async validateBusinessLogic(workflow: WorkflowTemplate, errors: ValidationError[], warnings: ValidationError[]): Promise<void> {
    // Check for duplicate workflow names in same module
    if (workflow.name && workflow.module) {
      const duplicateCount = await this.checkDuplicateWorkflowName(workflow.name, workflow.module, workflow.id);
      if (duplicateCount > 0) {
        errors.push({
          type: 'error',
          message: `A workflow named "${workflow.name}" already exists for ${workflow.module} module`
        });
      }
    }

    // Validate mandatory step requirements
    const mandatorySteps = workflow.steps.filter(s => s.isMandatory);
    if (mandatorySteps.length === 0) {
      warnings.push({
        type: 'warning',
        message: 'No mandatory steps defined - all steps can be skipped'
      });
    }

    // Check for reasonable timeout values
    const longTimeouts = workflow.steps.filter(s => s.timeoutDays && s.timeoutDays > 30);
    if (longTimeouts.length > 0) {
      warnings.push({
        type: 'warning',
        message: `${longTimeouts.length} step(s) have timeout periods longer than 30 days`
      });
    }

    // Validate step names are unique
    const stepNames = workflow.steps.map(s => s.stepName.toLowerCase().trim());
    const duplicateNames = stepNames.filter((name, index) => stepNames.indexOf(name) !== index);
    if (duplicateNames.length > 0) {
      warnings.push({
        type: 'warning',
        message: 'Some steps have duplicate names'
      });
    }
  }

  /**
   * Roles and users validation
   */
  private static async validateRolesAndUsers(steps: WorkflowStep[], errors: ValidationError[], warnings: ValidationError[]): Promise<void> {
    // Get all unique roles and users
    const roles = [...new Set(steps.map(s => s.requiredRole).filter(Boolean))];
    const users = [...new Set(steps.map(s => s.assignedUserId).filter(Boolean))];
    const escalationRoles = [...new Set(steps.map(s => s.escalationRole).filter(Boolean))];

    // Validate all roles exist
    for (const role of [...roles, ...escalationRoles]) {
      const exists = await this.validateRoleExists(role);
      if (!exists) {
        errors.push({
          type: 'error',
          message: `Role "${role}" does not exist in the system`
        });
      }
    }

    // Validate all users exist and are active
    for (const userId of users) {
      const valid = await this.validateUserExists(userId);
      if (!valid) {
        errors.push({
          type: 'error',
          message: `User with ID "${userId}" does not exist or is inactive`
        });
      }
    }

    // Check if roles have active users
    for (const role of roles) {
      const hasActiveUsers = await this.checkRoleHasActiveUsers(role);
      if (!hasActiveUsers) {
        warnings.push({
          type: 'warning',
          message: `Role "${role}" has no active users assigned`
        });
      }
    }
  }

  /**
   * Check for circular dependencies in workflow steps
   */
  private static validateCircularDependencies(steps: WorkflowStep[], errors: ValidationError[]): void {
    // For now, basic validation - can be enhanced with complex condition parsing
    // This would involve parsing step conditions and checking for logical loops
    
    // Simple check: if any step has conditions that reference future steps
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.conditions) {
        try {
          // Parse conditions if they exist and validate they don't create loops
          // This is a placeholder for more complex condition validation
          const conditionStr = JSON.stringify(step.conditions);
          
          // Check if conditions reference steps that don't exist or create loops
          for (let j = i + 1; j < steps.length; j++) {
            if (conditionStr.includes(`step_${steps[j].stepNumber}`)) {
              errors.push({
                type: 'error',
                message: `Step ${step.stepNumber} has conditions that reference future step ${steps[j].stepNumber}, which may create circular dependencies`
              });
            }
          }
        } catch (error) {
          errors.push({
            type: 'error',
            message: `Step ${step.stepNumber} has invalid condition format`
          });
        }
      }
    }
  }

  /**
   * Helper methods for database validation
   */
  private static async validateRoleExists(roleName: string): Promise<boolean> {
    try {
      const result = await sql`
        SELECT COUNT(*) as count FROM roles WHERE name = ${roleName}
      `;
      return parseInt(result[0].count) > 0;
    } catch (error) {
      console.error('Error validating role:', error);
      return false;
    }
  }

  private static async validateUserExists(userId: string): Promise<boolean> {
    try {
      const result = await sql`
        SELECT COUNT(*) as count FROM users 
        WHERE id = ${userId} AND status = 'Active'
      `;
      return parseInt(result[0].count) > 0;
    } catch (error) {
      console.error('Error validating user:', error);
      return false;
    }
  }

  private static async checkDuplicateWorkflowName(name: string, module: string, excludeId?: string): Promise<number> {
    try {
      let query = sql`
        SELECT COUNT(*) as count FROM workflow_templates 
        WHERE name = ${name} AND module = ${module} AND is_active = true
      `;
      
      if (excludeId) {
        query = sql`
          SELECT COUNT(*) as count FROM workflow_templates 
          WHERE name = ${name} AND module = ${module} AND is_active = true AND id != ${excludeId}
        `;
      }
      
      const result = await query;
      return parseInt(result[0].count);
    } catch (error) {
      console.error('Error checking duplicate workflow name:', error);
      return 0;
    }
  }

  private static async checkRoleHasActiveUsers(roleName: string): Promise<boolean> {
    try {
      const result = await sql`
        SELECT COUNT(*) as count FROM users u
        INNER JOIN roles r ON u.role_id = r.id
        WHERE r.name = ${roleName} AND u.status = 'Active'
      `;
      return parseInt(result[0].count) > 0;
    } catch (error) {
      console.error('Error checking role users:', error);
      return false;
    }
  }

  /**
   * Quick validation for save prevention
   */
  static async canSaveWorkflow(workflow: WorkflowTemplate): Promise<boolean> {
    const validation = await this.validateWorkflow(workflow);
    return validation.isValid;
  }

  /**
   * Get validation summary for UI display
   */
  static getValidationSummary(validation: ValidationResult): string {
    if (validation.isValid) {
      return validation.warnings.length > 0 
        ? `Workflow is valid with ${validation.warnings.length} warning(s)`
        : 'Workflow is valid and ready to save';
    }
    
    return `Cannot save: ${validation.errors.length} error(s) must be fixed`;
  }
}