
"use client";

import type { VisaApplication, VisaApprovalStep } from '@/types/visa';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// import { Separator } from "@/components/ui/separator"; // Not used
import { Badge } from '@/components/ui/badge';
import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { UserCircle, Briefcase, Plane, Paperclip, CalendarDays, Globe, Flag, FileBadge, CheckCircle, Circle, AlertCircle, Clock, Link2 } from "lucide-react";
import Link from 'next/link';
import React from 'react'; // Ensure React is imported

interface VisaApplicationViewProps {
  visaData: VisaApplication;
}

const formatDateSafe = (date: Date | string | null | undefined, dateFormat = "PPP") => {
  if (!date) return "N/A";
  const d = typeof date === 'string' ? new Date(date) : date;
  return isValid(d) ? format(d, dateFormat) : "Invalid Date";
};

const DetailItem: React.FC<{ label: string; value?: string | number | null | React.ReactNode; fullWidth?: boolean; className?: string }> = ({ label, value, fullWidth = false, className }) => {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === "")) {
    return null;
  }
  return (
    <div className={cn(fullWidth ? "sm:col-span-2 md:col-span-3" : "sm:col-span-1", "mb-3", className)}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="text-sm text-foreground break-words mt-0.5">
        {typeof value === 'string' || typeof value === 'number' ? String(value) : value}
      </div>
    </div>
  );
};

const ApprovalStepView: React.FC<{ step: VisaApprovalStep; isLast: boolean }> = ({ step, isLast }) => {
    let IconComponent = Circle;
    let iconColor = "text-muted-foreground";

    if (step.status === "Approved") {
        IconComponent = CheckCircle;
        iconColor = "text-green-500";
    } else if (step.status === "Rejected") {
        IconComponent = AlertCircle;
        iconColor = "text-destructive";
    } else if (step.status === "Pending") { 
        IconComponent = Clock;
        iconColor = "text-amber-500";
    }
    
    return (
        <div className="flex items-start">
            <div className="flex flex-col items-center mr-4">
                <IconComponent className={cn("w-6 h-6", iconColor)} />
                {!isLast && <div className="w-0.5 h-8 bg-border mt-1"></div>}
            </div>
            <div className="pb-8">
                <p className="font-semibold text-sm">{step.stepName} <span className="text-xs text-muted-foreground">({step.status})</span></p>
                {step.approverName && <p className="text-xs text-muted-foreground">By: {step.approverName}</p>}
                {step.date && <p className="text-xs text-muted-foreground">Date: {formatDateSafe(step.date, "Pp")}</p>}
                {step.comments && <p className="text-xs text-muted-foreground italic mt-1">Comment: {step.comments}</p>}
            </div>
        </div>
    );
};


export default function VisaApplicationView({ visaData }: VisaApplicationViewProps) {
  const {
    travelPurpose, destination, employeeId, nationality, passportCopyFilename,
    tripStartDate, tripEndDate, itineraryDetails, supportingDocumentsNotes,
    status, submittedDate, lastUpdatedDate, approvalHistory, tsrReferenceNumber, visaCopyFilename, applicantName
  } = visaData;

  const getStatusBadgeVariant = (currentStatus: VisaApplication['status']) => {
    switch (currentStatus) {
      case 'Approved': return 'default';
      case 'Rejected': return 'destructive';
      default: return 'outline';
    }
  };
  
  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" /> General Information
            </CardTitle>
            <Badge variant={getStatusBadgeVariant(status)} className={cn(status === "Approved" ? "bg-green-600 text-white" : "")}>
              {status || "Unknown"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 pt-4">
          <DetailItem label="Travel Purpose" value={travelPurpose} />
          <DetailItem label="Destination" value={destination || 'N/A'} />
          <DetailItem label="TSR Reference" value={tsrReferenceNumber ? 
            <Link href={`/trf/view/${tsrReferenceNumber}`} className="text-primary hover:underline flex items-center gap-1">
              {tsrReferenceNumber} <Link2 className="h-3 w-3"/>
            </Link> : 'N/A'} 
          />
          <DetailItem label="Applicant Name" value={applicantName || 'N/A'} />
          <DetailItem label="Employee ID" value={employeeId} />
          <DetailItem label="Nationality" value={nationality} />
          <DetailItem label="Submitted On" value={formatDateSafe(submittedDate)} />
          <DetailItem label="Last Updated" value={formatDateSafe(lastUpdatedDate)} />
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Plane className="w-5 h-5 text-primary" /> Trip Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 pt-4">
            <DetailItem label="Trip Start Date" value={formatDateSafe(tripStartDate)} />
            <DetailItem label="Trip End Date" value={formatDateSafe(tripEndDate)} />
            <DetailItem label="Itinerary Details" value={<p className="whitespace-pre-wrap">{itineraryDetails}</p>} fullWidth />
        </CardContent>
      </Card>
      
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-primary" /> Document Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 pt-4">
            <DetailItem label="Passport Copy" value={passportCopyFilename || 'Not Provided'} />
            {visaCopyFilename && status === 'Approved' && (
                 <DetailItem label="Approved Visa Copy" value={visaCopyFilename} />
            )}
            <DetailItem label="Notes on Other Supporting Documents" value={<p className="whitespace-pre-wrap">{supportingDocumentsNotes || 'N/A'}</p>} fullWidth />
        </CardContent>
      </Card>

      {approvalHistory && approvalHistory.length > 0 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Approval Workflow</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {approvalHistory.map((step, index) => (
              <ApprovalStepView key={index} step={step} isLast={index === approvalHistory.length - 1} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
