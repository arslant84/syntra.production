'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, Settings, Play, Download, Upload, AlertCircle, CheckCircle, 
  Clock, RotateCcw, FileText, Database, Zap, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowBuilder } from '@/components/admin/workflow/WorkflowBuilder';
import { WorkflowTester } from '@/components/admin/workflow/WorkflowTester';
import { WorkflowTemplate, WorkflowValidator } from '@/lib/workflow-validation';

interface WorkflowListItem extends WorkflowTemplate {
  createdByName?: string;
  createdAt?: Date;
  updatedAt?: Date;
  stepCount: number;
}

interface MigrationStatus {
  module: string;
  status: 'not_migrated' | 'migrated' | 'in_progress' | 'failed';
  workflowId?: string;
  migrationDate?: Date;
  complexity: 'low' | 'medium' | 'high';
}

interface MigrationReport {
  totalModules: number;
  readyForMigration: string[];
  requiresAttention: string[];
  estimatedEffort: Array<{
    module: string;
    effort: 'low' | 'medium' | 'high';
    timeEstimate: string;
  }>;
  benefits: string[];
  risks: string[];
}

export default function WorkflowSettingsPage() {
  // State management
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [migrationStatuses, setMigrationStatuses] = useState<MigrationStatus[]>([]);
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Modal states
  const [showBuilder, setShowBuilder] = useState(false);
  const [showTester, setShowTester] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowTemplate | null>(null);
  const [testingWorkflow, setTestingWorkflow] = useState<WorkflowTemplate | null>(null);

  // Migration states
  const [migrationInProgress, setMigrationInProgress] = useState<string[]>([]);
  const [migrationResults, setMigrationResults] = useState<Record<string, any>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadWorkflows(),
        loadMigrationStatus(),
        loadMigrationReport()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkflows = async () => {
    try {
      const response = await fetch('/api/admin/workflows');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const workflowsWithCounts = data.data.map((workflow: any) => ({
            ...workflow,
            stepCount: workflow.steps?.length || 0
          }));
          setWorkflows(workflowsWithCounts);
        }
      }
    } catch (error) {
      console.error('Error loading workflows:', error);
    }
  };

  const loadMigrationStatus = async () => {
    try {
      const response = await fetch('/api/admin/workflows/migration');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Transform migration history into status
          const modules = ['trf', 'claims', 'visa', 'transport', 'accommodation'];
          const statuses = modules.map(module => {
            const migration = data.migrations.find((m: any) => m.module === module && m.status === 'completed');
            return {
              module,
              status: migration ? 'migrated' : 'not_migrated',
              workflowId: migration?.workflowId,
              migrationDate: migration?.migrationDate,
              complexity: getModuleComplexity(module)
            };
          });
          setMigrationStatuses(statuses);
        }
      }
    } catch (error) {
      console.error('Error loading migration status:', error);
    }
  };

  const loadMigrationReport = async () => {
    try {
      const response = await fetch('/api/admin/workflows/migration?action=report');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMigrationReport(data.report);
        }
      }
    } catch (error) {
      console.error('Error loading migration report:', error);
    }
  };

  const getModuleComplexity = (module: string): 'low' | 'medium' | 'high' => {
    const complexityMap: Record<string, 'low' | 'medium' | 'high'> = {
      'visa': 'low',
      'transport': 'low',
      'accommodation': 'low',
      'trf': 'medium',
      'claims': 'medium'
    };
    return complexityMap[module] || 'medium';
  };

  const handleCreateWorkflow = () => {
    setEditingWorkflow(null);
    setShowBuilder(true);
  };

  const handleEditWorkflow = (workflow: WorkflowTemplate) => {
    setEditingWorkflow(workflow);
    setShowBuilder(true);
  };

  const handleTestWorkflow = (workflow: WorkflowTemplate) => {
    setTestingWorkflow(workflow);
    setShowTester(true);
  };

  const handleSaveWorkflow = async (workflow: WorkflowTemplate) => {
    try {
      const url = editingWorkflow ? '/api/admin/workflows' : '/api/admin/workflows';
      const method = editingWorkflow ? 'PUT' : 'POST';
      
      const requestBody = {
        ...workflow,
        id: editingWorkflow?.id,
        // Convert to legacy format for existing API
        is_active: workflow.isActive,
        steps: workflow.steps.map(step => ({
          step_number: step.stepNumber,
          step_name: step.stepName,
          required_role: step.requiredRole,
          description: step.description,
          is_mandatory: step.isMandatory,
          can_delegate: step.canDelegate,
          timeout_days: step.timeoutDays,
          escalation_role: step.escalationRole,
          conditions: step.conditions
        }))
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setShowBuilder(false);
        setEditingWorkflow(null);
        await loadWorkflows();
      } else {
        alert(data.error || 'Failed to save workflow');
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
      alert('Failed to save workflow');
    }
  };

  const handleMigrateModule = async (module: string) => {
    if (migrationInProgress.includes(module)) return;

    setMigrationInProgress(prev => [...prev, module]);
    
    try {
      const response = await fetch('/api/admin/workflows/migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          createBackup: true,
          migrationNotes: `Automated migration from hardcoded to configurable workflow for ${module}`
        })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setMigrationResults(prev => ({
          ...prev,
          [module]: { success: true, message: data.message }
        }));
        await loadMigrationStatus();
        await loadWorkflows();
      } else {
        setMigrationResults(prev => ({
          ...prev,
          [module]: { success: false, message: data.message || 'Migration failed' }
        }));
      }
    } catch (error) {
      console.error(`Error migrating ${module}:`, error);
      setMigrationResults(prev => ({
        ...prev,
        [module]: { success: false, message: 'Migration failed due to network error' }
      }));
    } finally {
      setMigrationInProgress(prev => prev.filter(m => m !== module));
    }
  };

  const handleRollbackModule = async (module: string) => {
    try {
      const response = await fetch(`/api/admin/workflows/migration?module=${module}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setMigrationResults(prev => ({
          ...prev,
          [module]: { success: true, message: data.message }
        }));
        await loadMigrationStatus();
        await loadWorkflows();
      } else {
        alert(data.message || 'Rollback failed');
      }
    } catch (error) {
      console.error(`Error rolling back ${module}:`, error);
      alert('Rollback failed due to network error');
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'migrated': return 'default';
      case 'in_progress': return 'secondary';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'migrated': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <Database className="h-4 w-4 text-gray-400" />;
    }
  };

  const getComplexityColor = (complexity: 'low' | 'medium' | 'high') => {
    switch (complexity) {
      case 'low': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-red-600 bg-red-50';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Approval Workflow Configuration</h1>
          <p className="text-muted-foreground">
            Manage configurable approval workflows and migrate from hardcoded processes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleCreateWorkflow}>
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="migration">Migration</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* System Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{workflows.filter(w => w.isActive).length}</div>
                <p className="text-xs text-muted-foreground">
                  {workflows.length} total workflows
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Migrated Modules</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {migrationStatuses.filter(m => m.status === 'migrated').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  of {migrationStatuses.length} modules
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ready to Migrate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {migrationReport?.readyForMigration.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  low complexity modules
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Status</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">Healthy</div>
                <p className="text-xs text-muted-foreground">
                  all systems operational
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Migration Benefits */}
          {migrationReport && (
            <Card>
              <CardHeader>
                <CardTitle>Migration Benefits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-3 text-green-600">Benefits</h4>
                    <ul className="space-y-2">
                      {migrationReport.benefits.slice(0, 4).map((benefit, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-3 text-orange-600">Considerations</h4>
                    <ul className="space-y-2">
                      {migrationReport.risks.map((risk, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows" className="space-y-6">
          <div className="grid gap-4">
            {workflows.map((workflow) => (
              <Card key={workflow.id} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {workflow.name}
                        {workflow.isActive && (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        )}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {workflow.description || 'No description'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{workflow.module.toUpperCase()}</Badge>
                      <Badge variant="secondary">{workflow.stepCount} steps</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Created {workflow.createdAt ? new Date(workflow.createdAt).toLocaleDateString() : 'Recently'}
                      {workflow.createdByName && ` by ${workflow.createdByName}`}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestWorkflow(workflow)}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Test
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditWorkflow(workflow)}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>

                  {/* Step Preview */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <FileText className="h-4 w-4" />
                      Workflow Steps
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {workflow.steps.map((step, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {step.stepNumber}. {step.stepName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {workflows.length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No workflows configured</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first workflow or migrate from existing hardcoded processes
                  </p>
                  <Button onClick={handleCreateWorkflow}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Workflow
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Migration Tab */}
        <TabsContent value="migration" className="space-y-6">
          {/* Migration Status */}
          <Card>
            <CardHeader>
              <CardTitle>Module Migration Status</CardTitle>
              <p className="text-sm text-muted-foreground">
                Migrate from hardcoded approval processes to configurable workflows
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {migrationStatuses.map((migration) => (
                <div key={migration.module} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(migration.status)}
                      <div>
                        <h4 className="font-medium capitalize">
                          {migration.module} Module
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={getStatusBadgeVariant(migration.status)}>
                            {migration.status.replace('_', ' ')}
                          </Badge>
                          <Badge 
                            variant="secondary"
                            className={getComplexityColor(migration.complexity)}
                          >
                            {migration.complexity} complexity
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {migration.status === 'not_migrated' && (
                        <Button
                          onClick={() => handleMigrateModule(migration.module)}
                          disabled={migrationInProgress.includes(migration.module)}
                          size="sm"
                        >
                          {migrationInProgress.includes(migration.module) ? (
                            <>
                              <Clock className="h-4 w-4 mr-2 animate-spin" />
                              Migrating...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Migrate
                            </>
                          )}
                        </Button>
                      )}
                      {migration.status === 'migrated' && (
                        <Button
                          variant="outline"
                          onClick={() => handleRollbackModule(migration.module)}
                          size="sm"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Rollback
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Migration Result */}
                  {migrationResults[migration.module] && (
                    <Alert className={
                      migrationResults[migration.module].success 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-red-200 bg-red-50'
                    }>
                      {migrationResults[migration.module].success ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}
                      <AlertDescription className={
                        migrationResults[migration.module].success 
                          ? 'text-green-800' 
                          : 'text-red-800'
                      }>
                        {migrationResults[migration.module].message}
                      </AlertDescription>
                    </Alert>
                  )}

                  {migration.migrationDate && (
                    <div className="text-sm text-muted-foreground mt-2">
                      Migrated on {new Date(migration.migrationDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Migration Report */}
          {migrationReport && (
            <Card>
              <CardHeader>
                <CardTitle>Migration Analysis Report</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Effort Estimates</h4>
                    <div className="space-y-2">
                      {migrationReport.estimatedEffort.map((effort) => (
                        <div key={effort.module} className="flex justify-between text-sm">
                          <span className="capitalize">{effort.module}</span>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline"
                              className={getComplexityColor(effort.effort)}
                            >
                              {effort.effort}
                            </Badge>
                            <span className="text-muted-foreground">
                              {effort.timeEstimate}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 text-green-600">Ready to Migrate</h4>
                    <div className="space-y-1">
                      {migrationReport.readyForMigration.map((module) => (
                        <div key={module} className="text-sm capitalize">{module}</div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 text-orange-600">Requires Attention</h4>
                    <div className="space-y-1">
                      {migrationReport.requiresAttention.map((module) => (
                        <div key={module} className="text-sm capitalize">{module}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workflow System Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Advanced settings for workflow system behavior and performance.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Default Timeout Settings</h4>
                    <p className="text-sm text-muted-foreground">
                      Configure default timeout periods for workflow steps.
                    </p>
                  </div>
                  <div>
                    <Button variant="outline">Configure Timeouts</Button>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Notification Templates</h4>
                    <p className="text-sm text-muted-foreground">
                      Customize notification messages for workflow events.
                    </p>
                  </div>
                  <div>
                    <Button variant="outline">Manage Templates</Button>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Audit & Logging</h4>
                    <p className="text-sm text-muted-foreground">
                      Configure audit trail and logging for workflow actions.
                    </p>
                  </div>
                  <div>
                    <Button variant="outline">View Audit Logs</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {showBuilder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-7xl max-h-[90vh] overflow-hidden">
            <WorkflowBuilder
              initialWorkflow={editingWorkflow || undefined}
              onSave={handleSaveWorkflow}
              onCancel={() => {
                setShowBuilder(false);
                setEditingWorkflow(null);
              }}
            />
          </div>
        </div>
      )}

      {showTester && testingWorkflow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-auto">
            <div className="p-6">
              <WorkflowTester
                workflow={testingWorkflow}
                onClose={() => {
                  setShowTester(false);
                  setTestingWorkflow(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}