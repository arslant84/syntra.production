// src/types/workflows.ts

/**
 * Represents a workflow step in a module's approval process
 */
export interface WorkflowStep {
  id: string;
  name: string;
  approverRoleId: string;
  approverRole?: string;
  escalationRoleId?: string;
  escalationRole?: string;
  escalationHours?: number;
  order: number;
  moduleId: string;
  moduleName?: string;
  created_at?: string | Date;
  updated_at?: string | Date;
}

/**
 * Represents a module that can have a workflow
 */
export interface WorkflowModule {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string | Date;
  updated_at?: string | Date;
}

/**
 * Represents a module with its workflow steps
 */
export interface WorkflowModuleWithSteps extends WorkflowModule {
  steps: WorkflowStep[];
}

/**
 * Form values for creating or updating a workflow step
 */
export interface WorkflowStepFormValues {
  name: string;
  approverRoleId: string;
  escalationRoleId?: string;
  escalationHours?: number;
  order?: number;
}
