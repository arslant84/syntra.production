import React from 'react';
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, AlertTriangle } from "lucide-react";
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
    "Processing with Embassy",
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