'use client';

import React, { useState, useEffect } from 'react';
import { Play, Clock, CheckCircle, XCircle, AlertCircle, Users, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { WorkflowTemplate } from '@/lib/workflow-validation';

interface WorkflowTesterProps {
  workflow: WorkflowTemplate;
  onClose: () => void;
}

interface SimulationStep {
  stepNumber: number;
  stepName: string;
  assignedRole?: string;
  assignedUser?: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'timeout';
  actionTakenBy?: string;
  actionTakenAt?: Date;
  comments?: string;
  timeoutDays?: number;
  simulatedAction?: 'approve' | 'reject' | 'timeout' | 'delegate';
}

interface SimulationResult {
  finalStatus: 'approved' | 'rejected' | 'timeout' | 'cancelled';
  totalDuration: number;
  completedSteps: SimulationStep[];
  issues: string[];
  recommendations: string[];
}

export function WorkflowTester({ workflow, onClose }: WorkflowTesterProps) {
  const [simulationData, setSimulationData] = useState({
    requestType: workflow.module,
    testRequestId: 'TEST-' + Math.random().toString(36).substr(2, 9),
    testUser: '',
    testDepartment: ''
  });

  const [simulationSteps, setSimulationSteps] = useState<SimulationStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Initialize simulation steps
  useEffect(() => {
    const steps: SimulationStep[] = workflow.steps.map(step => ({
      stepNumber: step.stepNumber,
      stepName: step.stepName,
      assignedRole: step.requiredRole,
      assignedUser: step.assignedUserId,
      status: 'pending',
      timeoutDays: step.timeoutDays,
      simulatedAction: 'approve' // Default action
    }));
    setSimulationSteps(steps);
  }, [workflow]);

  const updateStepAction = (stepIndex: number, action: 'approve' | 'reject' | 'timeout' | 'delegate') => {
    setSimulationSteps(prev => prev.map((step, index) => 
      index === stepIndex ? { ...step, simulatedAction: action } : step
    ));
  };

  const runSimulation = async () => {
    setIsRunning(true);
    setSimulationResult(null);
    setCurrentStepIndex(0);

    const completedSteps: SimulationStep[] = [];
    const issues: string[] = [];
    const recommendations: string[] = [];
    let totalDuration = 0;
    let finalStatus: 'approved' | 'rejected' | 'timeout' | 'cancelled' = 'approved';

    // Simulate each step
    for (let i = 0; i < simulationSteps.length; i++) {
      setCurrentStepIndex(i);
      
      const step = simulationSteps[i];
      const simulatedStep: SimulationStep = { ...step };

      // Simulate processing time (in days)
      const processingTime = step.simulatedAction === 'timeout' 
        ? (step.timeoutDays || 7)
        : Math.floor(Math.random() * (step.timeoutDays || 3)) + 1;

      totalDuration += processingTime;

      // Process the action
      switch (step.simulatedAction) {
        case 'approve':
          simulatedStep.status = 'approved';
          simulatedStep.actionTakenBy = `Simulated ${step.assignedRole}`;
          simulatedStep.actionTakenAt = new Date();
          simulatedStep.comments = 'Simulated approval';
          break;

        case 'reject':
          simulatedStep.status = 'rejected';
          simulatedStep.actionTakenBy = `Simulated ${step.assignedRole}`;
          simulatedStep.actionTakenAt = new Date();
          simulatedStep.comments = 'Simulated rejection';
          finalStatus = 'rejected';
          completedSteps.push(simulatedStep);
          
          // Stop simulation on rejection
          issues.push(`Workflow rejected at step ${step.stepNumber}: ${step.stepName}`);
          break;

        case 'timeout':
          simulatedStep.status = 'timeout';
          simulatedStep.comments = `Timed out after ${step.timeoutDays} days`;
          issues.push(`Step ${step.stepNumber} timed out: ${step.stepName}`);
          
          // Check if escalation is configured
          const workflowStep = workflow.steps.find(s => s.stepNumber === step.stepNumber);
          if (workflowStep?.escalationRole) {
            simulatedStep.comments += ` - Escalated to ${workflowStep.escalationRole}`;
            simulatedStep.status = 'approved'; // Assume escalation resolves it
            recommendations.push(`Configure escalation for step ${step.stepNumber} to ${workflowStep.escalationRole}`);
          } else {
            finalStatus = 'timeout';
            issues.push(`No escalation configured for step ${step.stepNumber}`);
          }
          break;

        case 'delegate':
          simulatedStep.status = 'approved';
          simulatedStep.actionTakenBy = `Delegated by ${step.assignedRole}`;
          simulatedStep.actionTakenAt = new Date();
          simulatedStep.comments = 'Simulated delegation and approval';
          break;
      }

      completedSteps.push(simulatedStep);

      // Add realistic delay for visualization
      await new Promise(resolve => setTimeout(resolve, 500));

      // Stop if rejected or timeout without escalation
      if (finalStatus === 'rejected' || finalStatus === 'timeout') {
        break;
      }
    }

    // Generate recommendations
    if (totalDuration > 21) {
      recommendations.push('Workflow takes more than 3 weeks - consider reducing timeout periods');
    }

    if (workflow.steps.some(s => !s.timeoutDays)) {
      recommendations.push('Some steps lack timeout configuration - add timeouts to prevent delays');
    }

    if (workflow.steps.some(s => !s.canDelegate)) {
      recommendations.push('Consider enabling delegation for critical steps to prevent bottlenecks');
    }

    const result: SimulationResult = {
      finalStatus,
      totalDuration,
      completedSteps,
      issues,
      recommendations
    };

    setSimulationResult(result);
    setIsRunning(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'timeout': return <Clock className="h-4 w-4 text-orange-600" />;
      case 'pending': return <AlertCircle className="h-4 w-4 text-blue-600" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-50';
      case 'rejected': return 'text-red-600 bg-red-50';
      case 'timeout': return 'text-orange-600 bg-orange-50';
      case 'pending': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Workflow Simulation</h2>
          <p className="text-muted-foreground">Test and validate workflow: {workflow.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button 
            onClick={runSimulation} 
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {isRunning ? 'Running...' : 'Run Simulation'}
          </Button>
        </div>
      </div>

      {/* Simulation Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Simulation Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Test Request ID</Label>
              <Input
                value={simulationData.testRequestId}
                onChange={(e) => setSimulationData({...simulationData, testRequestId: e.target.value})}
                placeholder="TEST-123"
              />
            </div>
            <div className="space-y-2">
              <Label>Request Type</Label>
              <Input
                value={simulationData.requestType}
                readOnly
                className="bg-gray-50"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Step Actions Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {simulationSteps.map((step, index) => (
            <div key={step.stepNumber} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">Step {step.stepNumber}</Badge>
                  <span className="font-medium">{step.stepName}</span>
                  {index === currentStepIndex && isRunning && (
                    <Badge className="bg-blue-100 text-blue-800">Currently Processing</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-muted-foreground">{step.assignedRole}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Simulated Action</Label>
                  <Select
                    value={step.simulatedAction}
                    onValueChange={(value: any) => updateStepAction(index, value)}
                    disabled={isRunning}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approve">Approve</SelectItem>
                      <SelectItem value="reject">Reject</SelectItem>
                      <SelectItem value="timeout">Timeout</SelectItem>
                      <SelectItem value="delegate">Delegate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Timeout Days</Label>
                  <Input
                    value={step.timeoutDays || 'Not set'}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(step.status)}
                    <span className={`text-sm px-2 py-1 rounded ${getStatusColor(step.status)}`}>
                      {step.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Simulation Results */}
      {simulationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Simulation Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{simulationResult.finalStatus}</div>
                <div className="text-sm text-muted-foreground">Final Status</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{simulationResult.totalDuration}</div>
                <div className="text-sm text-muted-foreground">Total Days</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{simulationResult.completedSteps.length}</div>
                <div className="text-sm text-muted-foreground">Steps Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{simulationResult.issues.length}</div>
                <div className="text-sm text-muted-foreground">Issues Found</div>
              </div>
            </div>

            <Separator />

            {/* Issues */}
            {simulationResult.issues.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Issues Identified:</strong>
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    {simulationResult.issues.map((issue, index) => (
                      <li key={index} className="text-sm">{issue}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Recommendations */}
            {simulationResult.recommendations.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Recommendations:</strong>
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    {simulationResult.recommendations.map((rec, index) => (
                      <li key={index} className="text-sm">{rec}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Step Details */}
            <div className="space-y-3">
              <h4 className="font-medium">Step Execution Details</h4>
              {simulationResult.completedSteps.map((step, index) => (
                <div key={step.stepNumber} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">Step {step.stepNumber}</Badge>
                      <span className="font-medium">{step.stepName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(step.status)}
                      <span className={`text-sm px-2 py-1 rounded ${getStatusColor(step.status)}`}>
                        {step.status}
                      </span>
                    </div>
                  </div>
                  {step.actionTakenBy && (
                    <div className="text-sm text-muted-foreground">
                      Action by: {step.actionTakenBy}
                    </div>
                  )}
                  {step.comments && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {step.comments}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}