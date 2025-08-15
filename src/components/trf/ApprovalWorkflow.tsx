
"use client";

import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ApprovalStep } from "@/types/trf";
import { format, isValid } from "date-fns";
import { StatusBadge } from "@/lib/status-utils";

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
        <div key={index} className="flex items-center gap-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step.status === 'Approved' || step.status === 'Submitted' ? 'bg-green-100 text-green-600' :
            step.status === 'Rejected' ? 'bg-red-100 text-red-600' :
            step.status === 'Current' ? 'bg-blue-100 text-blue-600' :
            step.status === 'Pending' ? 'bg-yellow-100 text-yellow-600' :
            'bg-gray-100 text-gray-600'
          }`}>
            {step.status === 'Approved' || step.status === 'Submitted' ? <CheckCircle className="h-4 w-4" /> :
             step.status === 'Rejected' ? <XCircle className="h-4 w-4" /> :
             step.status === 'Current' ? <AlertCircle className="h-4 w-4" /> :
             step.status === 'Pending' ? <Clock className="h-4 w-4" /> :
             <div className="w-2 h-2 rounded-full bg-gray-400" />}
          </div>
          <div className="flex-1">
            <p className="font-medium">{step.role}</p>
            <p className="text-sm text-gray-600">{step.name !== 'TBD' ? step.name : 'To be assigned'}</p>
            {step.date && (
              <p className="text-xs text-gray-500">{formatDateSafe(step.date)}</p>
            )}
            {step.comments && step.comments !== 'Request submitted' && (
              <p className="text-sm text-gray-600 mt-1">{step.comments}</p>
            )}
          </div>
          <StatusBadge status={step.status} />
        </div>
      ))}
    </div>
  );
}
