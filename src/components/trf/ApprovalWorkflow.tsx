
"use client";

import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Clock, Plane } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ApprovalStep } from "@/types/trf";
import { format, isValid } from "date-fns";
import { StatusBadge, WorkflowStep } from "@/lib/status-utils";

interface ApprovalWorkflowProps {
  steps: ApprovalStep[];
}

const formatDateSafe = (date: Date | string | undefined) => {
  if (!date) return "";
  const d = typeof date === 'string' ? new Date(date) : date;
  return isValid(d) ? format(d, "PPp") : "";
};

export default function ApprovalWorkflow({ steps }: ApprovalWorkflowProps) {
  if (!steps || steps.length === 0) {
    return <p className="text-muted-foreground text-sm">No approval workflow defined.</p>;
  }
  
  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <WorkflowStep 
          key={index} 
          step={step} 
          index={index} 
          formatDateSafe={formatDateSafe}
          showStatusBadge={true}
          className="rounded-lg p-3"
        />
      ))}
    </div>
  );
}
