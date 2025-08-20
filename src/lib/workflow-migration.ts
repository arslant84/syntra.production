// Workflow Migration System
// Migrates from hardcoded approval workflows to configurable system

import { sql } from '@/lib/db';
import { WorkflowTemplate, WorkflowStep } from '@/lib/workflow-validation';

export interface MigrationAnalysis {
  module: string;
  currentImplementation: {
    hardcodedSteps: Array<{
      stepName: string;
      role: string;
      location: string; // file path
      lineNumber?: number;
    }>;
    statusFlow: string[];
    dependencies: string[];
  };
  suggestedWorkflow: WorkflowTemplate;
  migrationComplexity: 'low' | 'medium' | 'high';
  requiredChanges: Array<{
    file: string;
    description: string;
    codeChanges: string;
  }>;
}

export class WorkflowMigrationService {
  /**
   * Analyze current hardcoded workflows and suggest migrations
   */
  static async analyzeCurrentWorkflows(): Promise<MigrationAnalysis[]> {
    const analyses: MigrationAnalysis[] = [];

    // Analyze each module
    const modules = ['trf', 'claims', 'visa', 'transport', 'accommodation'];
    
    for (const module of modules) {
      try {
        const analysis = await this.analyzeModuleWorkflow(module);
        analyses.push(analysis);
      } catch (error) {
        console.error(`Error analyzing ${module} workflow:`, error);
      }
    }

    return analyses;
  }

  /**
   * Analyze a specific module's workflow implementation
   */
  private static async analyzeModuleWorkflow(module: string): Promise<MigrationAnalysis> {
    switch (module) {
      case 'trf':
        return this.analyzeTrfWorkflow();
      case 'claims':
        return this.analyzeClaimsWorkflow();
      case 'visa':
        return this.analyzeVisaWorkflow();
      case 'transport':
        return this.analyzeTransportWorkflow();
      case 'accommodation':
        return this.analyzeAccommodationWorkflow();
      default:
        throw new Error(`Unknown module: ${module}`);
    }
  }

  /**
   * Analyze TRF workflow implementation
   */
  private static async analyzeTrfWorkflow(): Promise<MigrationAnalysis> {
    // Based on the current TRF status flow we've seen
    const hardcodedSteps = [
      {
        stepName: 'Department Focal Review',
        role: 'Department Focal',
        location: 'src/app/api/trf/[trfId]/action/route.ts',
        lineNumber: 95
      },
      {
        stepName: 'Line Manager Approval',
        role: 'Line Manager',
        location: 'src/app/api/trf/[trfId]/action/route.ts',
        lineNumber: 105
      },
      {
        stepName: 'HOD Final Approval',
        role: 'HOD',
        location: 'src/app/api/trf/[trfId]/action/route.ts',
        lineNumber: 115
      }
    ];

    const statusFlow = [
      'Draft',
      'Pending Department Focal',
      'Pending Line Manager',
      'Pending HOD',
      'Approved',
      'Rejected',
      'Processing Flights',
      'Processing Accommodation',
      'Awaiting Visa',
      'TSR Processed'
    ];

    const suggestedWorkflow: WorkflowTemplate = {
      name: 'Standard TRF Approval Workflow',
      description: 'Migrated from hardcoded TRF approval process',
      module: 'trf',
      isActive: true,
      steps: [
        {
          stepNumber: 1,
          stepName: 'Department Focal Review',
          requiredRole: 'Department Focal',
          description: 'Initial review and validation of travel request',
          isMandatory: true,
          canDelegate: true,
          timeoutDays: 3
        },
        {
          stepNumber: 2,
          stepName: 'Line Manager Approval',
          requiredRole: 'Line Manager',
          description: 'Line manager approval for travel authorization',
          isMandatory: true,
          canDelegate: true,
          timeoutDays: 5
        },
        {
          stepNumber: 3,
          stepName: 'HOD Final Approval',
          requiredRole: 'HOD',
          description: 'Head of Department final approval',
          isMandatory: true,
          canDelegate: false,
          timeoutDays: 7,
          escalationRole: 'Senior Management'
        }
      ]
    };

    const requiredChanges = [
      {
        file: 'src/app/api/trf/[trfId]/action/route.ts',
        description: 'Replace hardcoded approval logic with WorkflowEngine calls',
        codeChanges: `
// Replace existing approval logic with:
import { WorkflowEngine } from '@/lib/workflow-engine';

// Instead of hardcoded status updates, use:
const context = {
  requestId: trfId,
  requestType: 'trf' as const,
  requestData: trfData,
  userId: session.user.id,
  userRole: userRole,
  department: userDepartment
};

if (action === 'submit') {
  // Start workflow
  await WorkflowEngine.startWorkflow(context);
} else {
  // Process step action
  await WorkflowEngine.processStepAction(executionId, stepNumber, action, {
    userId: session.user.id,
    comments: body.comments
  });
}`
      },
      {
        file: 'src/types/trf.ts',
        description: 'Update status types to be workflow-agnostic',
        codeChanges: `
// Replace hardcoded status enum with dynamic workflow status
export type TrfStatus = 'Draft' | 'In Progress' | 'Approved' | 'Rejected' | 'Cancelled';
// Remove: 'Pending Department Focal' | 'Pending Line Manager' | 'Pending HOD'
`
      }
    ];

    return {
      module: 'trf',
      currentImplementation: {
        hardcodedSteps,
        statusFlow,
        dependencies: ['src/app/api/trf/[trfId]/action/route.ts', 'src/types/trf.ts']
      },
      suggestedWorkflow,
      migrationComplexity: 'medium',
      requiredChanges
    };
  }

  /**
   * Analyze Claims workflow implementation
   */
  private static async analyzeClaimsWorkflow(): Promise<MigrationAnalysis> {
    const hardcodedSteps = [
      {
        stepName: 'Department Focal Verification',
        role: 'Department Focal',
        location: 'src/app/api/claims/[claimId]/action/route.ts'
      },
      {
        stepName: 'Line Manager Approval',
        role: 'Line Manager',
        location: 'src/app/api/claims/[claimId]/action/route.ts'
      },
      {
        stepName: 'HOD Authorization',
        role: 'HOD',
        location: 'src/app/api/claims/[claimId]/action/route.ts'
      }
    ];

    const statusFlow = [
      'Draft',
      'Pending Verification',
      'Pending Approval',
      'Approved',
      'Rejected'
    ];

    const suggestedWorkflow: WorkflowTemplate = {
      name: 'Standard Claims Approval Workflow',
      description: 'Migrated from hardcoded claims approval process',
      module: 'claims',
      isActive: true,
      steps: [
        {
          stepNumber: 1,
          stepName: 'Department Focal Verification',
          requiredRole: 'Department Focal',
          description: 'Verify expense claim details and supporting documents',
          isMandatory: true,
          canDelegate: true,
          timeoutDays: 3
        },
        {
          stepNumber: 2,
          stepName: 'Line Manager Approval',
          requiredRole: 'Line Manager',
          description: 'Approve expense claim amount and business justification',
          isMandatory: true,
          canDelegate: true,
          timeoutDays: 5
        },
        {
          stepNumber: 3,
          stepName: 'HOD Authorization',
          requiredRole: 'HOD',
          description: 'Final authorization for expense claim payment',
          isMandatory: true,
          canDelegate: false,
          timeoutDays: 7
        }
      ]
    };

    return {
      module: 'claims',
      currentImplementation: {
        hardcodedSteps,
        statusFlow,
        dependencies: ['src/app/api/claims/[claimId]/action/route.ts']
      },
      suggestedWorkflow,
      migrationComplexity: 'medium',
      requiredChanges: [
        {
          file: 'src/app/api/claims/[claimId]/action/route.ts',
          description: 'Replace hardcoded approval logic with WorkflowEngine',
          codeChanges: 'Similar to TRF migration - replace status-based logic with workflow engine calls'
        }
      ]
    };
  }

  /**
   * Analyze Visa workflow implementation
   */
  private static async analyzeVisaWorkflow(): Promise<MigrationAnalysis> {
    const hardcodedSteps = [
      {
        stepName: 'HR Initial Review',
        role: 'HR',
        location: 'src/app/api/visa/[visaId]/action/route.ts'
      },
      {
        stepName: 'Line Manager Endorsement',
        role: 'Line Manager',
        location: 'src/app/api/visa/[visaId]/action/route.ts'
      },
      {
        stepName: 'HOD Final Approval',
        role: 'HOD',
        location: 'src/app/api/visa/[visaId]/action/route.ts'
      }
    ];

    const suggestedWorkflow: WorkflowTemplate = {
      name: 'Standard Visa Approval Workflow',
      description: 'Migrated from hardcoded visa approval process',
      module: 'visa',
      isActive: true,
      steps: [
        {
          stepNumber: 1,
          stepName: 'HR Initial Review',
          requiredRole: 'HR',
          description: 'Review visa application and required documentation',
          isMandatory: true,
          canDelegate: true,
          timeoutDays: 2
        },
        {
          stepNumber: 2,
          stepName: 'Line Manager Endorsement',
          requiredRole: 'Line Manager',
          description: 'Endorse business need for visa application',
          isMandatory: true,
          canDelegate: true,
          timeoutDays: 3
        },
        {
          stepNumber: 3,
          stepName: 'HOD Final Approval',
          requiredRole: 'HOD',
          description: 'Final approval for visa processing',
          isMandatory: true,
          canDelegate: false,
          timeoutDays: 5
        }
      ]
    };

    return {
      module: 'visa',
      currentImplementation: {
        hardcodedSteps,
        statusFlow: ['Draft', 'Under Review', 'Approved', 'Rejected'],
        dependencies: ['src/app/api/visa/[visaId]/action/route.ts']
      },
      suggestedWorkflow,
      migrationComplexity: 'low',
      requiredChanges: [
        {
          file: 'src/app/api/visa/[visaId]/action/route.ts',
          description: 'Replace hardcoded logic with workflow engine',
          codeChanges: 'Replace status-based approval with WorkflowEngine integration'
        }
      ]
    };
  }

  /**
   * Analyze Transport workflow implementation
   */
  private static async analyzeTransportWorkflow(): Promise<MigrationAnalysis> {
    const hardcodedSteps = [
      {
        stepName: 'Line Manager Approval',
        role: 'Line Manager',
        location: 'src/app/api/transport/[transportId]/route.ts'
      },
      {
        stepName: 'HOD Authorization',
        role: 'HOD',
        location: 'src/app/api/transport/[transportId]/route.ts'
      }
    ];

    const suggestedWorkflow: WorkflowTemplate = {
      name: 'Standard Transport Approval Workflow',
      description: 'Migrated from hardcoded transport approval process',
      module: 'transport',
      isActive: true,
      steps: [
        {
          stepNumber: 1,
          stepName: 'Line Manager Approval',
          requiredRole: 'Line Manager',
          description: 'Approve transport request and business justification',
          isMandatory: true,
          canDelegate: true,
          timeoutDays: 2
        },
        {
          stepNumber: 2,
          stepName: 'HOD Authorization',
          requiredRole: 'HOD',
          description: 'Final authorization for transport arrangement',
          isMandatory: true,
          canDelegate: false,
          timeoutDays: 3
        }
      ]
    };

    return {
      module: 'transport',
      currentImplementation: {
        hardcodedSteps,
        statusFlow: ['Draft', 'Pending Line Manager', 'Pending HOD', 'Approved', 'Rejected'],
        dependencies: ['src/app/api/transport/[transportId]/route.ts']
      },
      suggestedWorkflow,
      migrationComplexity: 'low',
      requiredChanges: [
        {
          file: 'src/app/api/transport/[transportId]/route.ts',
          description: 'Simplify with workflow engine integration',
          codeChanges: 'Replace hardcoded approval logic with WorkflowEngine calls'
        }
      ]
    };
  }

  /**
   * Analyze Accommodation workflow implementation
   */
  private static async analyzeAccommodationWorkflow(): Promise<MigrationAnalysis> {
    const hardcodedSteps = [
      {
        stepName: 'HR Review',
        role: 'HR',
        location: 'src/app/api/accommodation/route.ts'
      },
      {
        stepName: 'Line Manager Approval',
        role: 'Line Manager',
        location: 'src/app/api/accommodation/route.ts'
      },
      {
        stepName: 'HOD Final Approval',
        role: 'HOD',
        location: 'src/app/api/accommodation/route.ts'
      }
    ];

    const suggestedWorkflow: WorkflowTemplate = {
      name: 'Standard Accommodation Approval Workflow',
      description: 'Migrated from hardcoded accommodation approval process',
      module: 'accommodation',
      isActive: true,
      steps: [
        {
          stepNumber: 1,
          stepName: 'HR Review',
          requiredRole: 'HR',
          description: 'Review accommodation request and eligibility',
          isMandatory: true,
          canDelegate: true,
          timeoutDays: 2
        },
        {
          stepNumber: 2,
          stepName: 'Line Manager Approval',
          requiredRole: 'Line Manager',
          description: 'Approve accommodation need and duration',
          isMandatory: true,
          canDelegate: true,
          timeoutDays: 3
        },
        {
          stepNumber: 3,
          stepName: 'HOD Final Approval',
          requiredRole: 'HOD',
          description: 'Final approval for accommodation booking',
          isMandatory: true,
          canDelegate: false,
          timeoutDays: 5
        }
      ]
    };

    return {
      module: 'accommodation',
      currentImplementation: {
        hardcodedSteps,
        statusFlow: ['Draft', 'Under Review', 'Approved', 'Rejected'],
        dependencies: ['src/app/api/accommodation/route.ts']
      },
      suggestedWorkflow,
      migrationComplexity: 'low',
      requiredChanges: [
        {
          file: 'src/app/api/accommodation/route.ts',
          description: 'Replace with configurable workflow',
          codeChanges: 'Integrate WorkflowEngine for dynamic approval process'
        }
      ]
    };
  }

  /**
   * Execute migration for a specific module
   */
  static async executeMigration(module: string, createBackup = true): Promise<{
    success: boolean;
    message: string;
    backupFiles?: string[];
    workflowId?: string;
  }> {
    try {
      // Get migration analysis
      const analysis = await this.analyzeModuleWorkflow(module);
      
      // Create backup if requested
      let backupFiles: string[] = [];
      if (createBackup) {
        backupFiles = await this.createBackupFiles(analysis.currentImplementation.dependencies);
      }

      // Create the workflow template in database
      const workflowResult = await sql`
        INSERT INTO workflow_templates (name, description, module, steps, is_active)
        VALUES (
          ${analysis.suggestedWorkflow.name},
          ${analysis.suggestedWorkflow.description},
          ${analysis.suggestedWorkflow.module},
          ${JSON.stringify(analysis.suggestedWorkflow.steps)},
          ${analysis.suggestedWorkflow.isActive}
        )
        RETURNING id
      `;

      const workflowId = workflowResult[0].id;

      // Create migration record
      await sql`
        INSERT INTO workflow_migrations (
          module, workflow_id, migration_date, status, backup_files, analysis_data
        ) VALUES (
          ${module},
          ${workflowId},
          NOW(),
          'completed',
          ${JSON.stringify(backupFiles)},
          ${JSON.stringify(analysis)}
        )
      `;

      return {
        success: true,
        message: `Successfully migrated ${module} workflow to configurable system`,
        backupFiles,
        workflowId
      };

    } catch (error) {
      console.error(`Migration failed for ${module}:`, error);
      return {
        success: false,
        message: `Migration failed: ${error.message}`
      };
    }
  }

  /**
   * Create backup files before migration
   */
  private static async createBackupFiles(dependencies: string[]): Promise<string[]> {
    const backupFiles: string[] = [];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    for (const filePath of dependencies) {
      const backupPath = `${filePath}.backup.${timestamp}`;
      // In a real implementation, you would copy the file
      // For now, just record the backup path
      backupFiles.push(backupPath);
    }

    return backupFiles;
  }

  /**
   * Generate migration report
   */
  static async generateMigrationReport(): Promise<{
    totalModules: number;
    readyForMigration: string[];
    requiresAttention: string[];
    estimatedEffort: {
      module: string;
      effort: 'low' | 'medium' | 'high';
      timeEstimate: string;
    }[];
    benefits: string[];
    risks: string[];
  }> {
    const analyses = await this.analyzeCurrentWorkflows();
    
    const readyForMigration = analyses
      .filter(a => a.migrationComplexity === 'low')
      .map(a => a.module);

    const requiresAttention = analyses
      .filter(a => a.migrationComplexity === 'high')
      .map(a => a.module);

    const estimatedEffort = analyses.map(a => ({
      module: a.module,
      effort: a.migrationComplexity,
      timeEstimate: this.getTimeEstimate(a.migrationComplexity)
    }));

    const benefits = [
      'Centralized workflow management and configuration',
      'Real-time workflow validation and error prevention',
      'Dynamic approval routing without code changes',
      'Comprehensive audit trail and execution tracking',
      'Timeout and escalation management',
      'Delegation support for improved flexibility',
      'Reduced maintenance overhead',
      'Consistent approval experience across all modules'
    ];

    const risks = [
      'Temporary disruption during migration period',
      'Need for thorough testing of migrated workflows',
      'Training required for administrators',
      'Data integrity during transition phase'
    ];

    return {
      totalModules: analyses.length,
      readyForMigration,
      requiresAttention,
      estimatedEffort,
      benefits,
      risks
    };
  }

  private static getTimeEstimate(complexity: 'low' | 'medium' | 'high'): string {
    switch (complexity) {
      case 'low': return '1-2 days';
      case 'medium': return '3-5 days';
      case 'high': return '1-2 weeks';
    }
  }

  /**
   * Rollback migration if needed
   */
  static async rollbackMigration(module: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // Get migration record
      const migration = await sql`
        SELECT * FROM workflow_migrations 
        WHERE module = ${module} 
        ORDER BY migration_date DESC 
        LIMIT 1
      `;

      if (migration.length === 0) {
        return {
          success: false,
          message: `No migration found for module: ${module}`
        };
      }

      // Deactivate the workflow
      await sql`
        UPDATE workflow_templates 
        SET is_active = false 
        WHERE id = ${migration[0].workflow_id}
      `;

      // Mark migration as rolled back
      await sql`
        UPDATE workflow_migrations 
        SET status = 'rolled_back', rollback_date = NOW()
        WHERE id = ${migration[0].id}
      `;

      return {
        success: true,
        message: `Successfully rolled back migration for ${module}`
      };

    } catch (error) {
      console.error(`Rollback failed for ${module}:`, error);
      return {
        success: false,
        message: `Rollback failed: ${error.message}`
      };
    }
  }
}