import React from 'react';
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, AlertTriangle, Plane, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

// Standardized status badge variant mapping (following TSR format)
export const getStatusBadgeVariant = (status: string) => {
  const statusLower = status?.toLowerCase();
  
  if (statusLower.includes('approved')) return 'default';
  if (statusLower.includes('rejected') || statusLower.includes('cancelled')) return 'destructive';
  if (statusLower.includes('pending')) return 'outline';
  
  // Processing states
  if ([
    "Processing Flights", 
    "Processing Accommodation", 
    "Awaiting Visa", 
    "TSR Processed",
    "Processing with Visa Admin",
    "Verified",
    "Processed"
  ].includes(status)) return 'default';
  
  return 'secondary';
};

// Standardized status badge component with consistent colors and design
export const StatusBadge: React.FC<{ 
  status: string; 
  className?: string;
  showIcon?: boolean;
}> = ({ status, className, showIcon = false }) => {
  const variant = getStatusBadgeVariant(status);
  const statusLower = status?.toLowerCase();
  
  // Custom styling based on status type (following TSR design)
  let customClasses = "";
  let IconComponent = null;
  
  if (status === "Approved") {
    customClasses = "!bg-green-600 !text-white hover:!bg-green-700";
  } else if (statusLower.includes('rejected') || statusLower.includes('cancelled')) {
    customClasses = "!bg-red-600 !text-white hover:!bg-red-700";
    IconComponent = showIcon ? XCircle : null;
  } else if (statusLower.includes('pending')) {
    customClasses = "!border-amber-500 !text-amber-600 hover:!bg-amber-50";
    IconComponent = showIcon ? Clock : null;
  } else if (statusLower.includes('verified') || statusLower.includes('processed')) {
    customClasses = "!bg-blue-600 !text-white hover:!bg-blue-700";
    IconComponent = showIcon ? CheckCircle : null;
  } else if (statusLower.includes('verification')) {
    customClasses = "!border-blue-500 !text-blue-600 hover:!bg-blue-50";
    IconComponent = showIcon ? Clock : null;
  } else if (status === "Processed") {
    customClasses = "!bg-blue-600 !text-white hover:!bg-blue-700";
    IconComponent = showIcon ? CheckCircle : null;
  } else if (status === "Cancelled") {
    customClasses = "!bg-gray-600 !text-white hover:!bg-gray-700";
    IconComponent = showIcon ? XCircle : null;
  }
  
  return (
    <Badge 
      variant={variant} 
      className={cn(customClasses, className)}
    >
      {IconComponent && <IconComponent className="w-3 h-3 mr-1" />}
      {status}
    </Badge>
  );
};

// Legacy function for backward compatibility
export const getStatusBadge = (status: string, showIcon: boolean = true) => {
  return <StatusBadge status={status} showIcon={showIcon} />;
};

// Workflow step status utilities for consistent styling
export const getWorkflowStepStyles = (status: string) => {
  const statusLower = status?.toLowerCase();
  
  if (status === 'Approved' || status === 'Submitted') {
    return {
      containerClass: 'bg-green-100 text-green-600',
      icon: CheckCircle
    };
  }
  
  if (status === 'Rejected') {
    return {
      containerClass: 'bg-red-100 text-red-600',
      icon: XCircle
    };
  }
  
  if (status === 'Cancelled') {
    return {
      containerClass: 'bg-orange-100 text-orange-600',
      icon: Ban
    };
  }
  
  if (status === 'Current') {
    return {
      containerClass: 'bg-blue-100 text-blue-600',
      icon: AlertTriangle
    };
  }
  
  if (status === 'Pending' || statusLower.includes('pending')) {
    return {
      containerClass: 'bg-amber-100 text-amber-600',
      icon: Clock
    };
  }
  
  // Default/inactive state
  return {
    containerClass: 'bg-gray-100 text-gray-600',
    icon: null
  };
};

// Workflow step component for consistent workflow display
export const WorkflowStep: React.FC<{
  step: {
    status: string;
    role: string;
    name: string;
    date?: string;
    comments?: string;
  };
  index: number;
  formatDateSafe?: (date: string) => string;
  showStatusBadge?: boolean;
  className?: string;
}> = ({ step, index, formatDateSafe, showStatusBadge = true, className }) => {
  const { containerClass, icon: IconComponent } = getWorkflowStepStyles(step.status);
  
  // Check if this is a flight admin rejection due to no flights available
  const isFlightRejection = step.role === "Flight Admin" && 
                           step.status === "Rejected" && 
                           step.comments?.toLowerCase().includes("no flights available");
  
  return (
    <div className={cn(
      "flex items-center gap-4",
      isFlightRejection && "rounded-lg p-3 bg-red-50 border border-red-200",
      className
    )}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${containerClass}`}>
        {IconComponent ? (
          <IconComponent className="h-4 w-4" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-gray-400" />
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{step.role}</p>
          {isFlightRejection && <Plane className="h-4 w-4 text-red-600" />}
        </div>
        <p className="text-sm text-gray-600">{step.name !== 'TBD' ? step.name : 'To be assigned'}</p>
        {step.date && (
          <p className="text-xs text-gray-500">
            {formatDateSafe ? formatDateSafe(step.date) : step.date}
          </p>
        )}
        {step.comments && step.comments !== 'Request submitted' && (
          <div className={cn(
            "text-sm mt-1",
            isFlightRejection ? "p-2 rounded-md bg-red-100 text-red-800 border border-red-200" : "text-gray-600"
          )}>
            {isFlightRejection && (
              <div className="flex items-center gap-1 font-medium mb-1">
                <Plane className="h-3 w-3" />
                Flight Unavailable
              </div>
            )}
            {step.comments}
          </div>
        )}
      </div>
      {showStatusBadge && <StatusBadge status={step.status} />}
    </div>
  );
};