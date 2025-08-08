
"use client";

import type { VisaApplication, VisaApprovalStep } from '@/types/visa';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from '@/components/ui/badge';
import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { UserCircle, Briefcase, Plane, Paperclip, CalendarDays, Globe, Flag, FileBadge, CheckCircle, Circle, AlertCircle, Clock, Link2, Mail, MapPin, FileText, Info, CreditCard } from "lucide-react";
import Link from 'next/link';
import React from 'react';

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
    <div className={cn(fullWidth ? "sm:col-span-2 md:col-span-3" : "sm:col-span-1", "print:break-inside-avoid", className)}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider print:text-[8pt] print:font-semibold">{label}</p>
      <div className="text-sm text-foreground break-words mt-0.5 print:text-[9pt]">
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
                <p className="text-xs text-muted-foreground">By: {step.approverName || 'To be assigned'}</p>
                {step.date && <p className="text-xs text-muted-foreground">Date: {formatDateSafe(step.date, "Pp")}</p>}
                {step.comments && <p className="text-xs text-muted-foreground italic mt-1">Comment: {step.comments}</p>}
            </div>
        </div>
    );
};


export default function VisaApplicationView({ visaData }: VisaApplicationViewProps) {
  const {
    id, userId, applicantName, travelPurpose, destination, employeeId,
    tripStartDate, tripEndDate, itineraryDetails, status, submittedDate, lastUpdatedDate, 
    approvalHistory, requestorName, staffId, department, position, email, visaType,
    passportNumber, passportExpiryDate, additionalComments, supportingDocumentsNotes
  } = visaData;

  const getStatusBadgeVariant = (currentStatus: VisaApplication['status']) => {
    switch (currentStatus) {
      case 'Approved': return 'default';
      case 'Rejected': return 'destructive';
      default: return 'outline';
    }
  };
  
  return (
    <div className="space-y-4 print:space-y-2">
      <Card className="shadow-md print:shadow-none print:border-none print:break-inside-avoid">
        <CardHeader className="print:p-0 print:mb-2">
          <div className="flex items-center justify-between print:mb-1">
            <CardTitle className="text-xl flex items-center gap-2 print:text-lg">
              <UserCircle className="w-5 h-5 text-primary print:hidden" /> Applicant Information
            </CardTitle>
            <Badge variant={getStatusBadgeVariant(status)} className={cn(status === "Approved" ? "bg-green-600 text-white" : "", "print:text-xs")}>
              {status || "Unknown"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4 print:p-0 print:space-y-2">
          <section className="print:break-inside-avoid">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
              <UserCircle className="print:hidden" />
              Personal Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 p-2 rounded-md print:grid-cols-3 print:p-0">
              <DetailItem label="Applicant Name" value={applicantName || requestorName} />
              <DetailItem label="Employee ID" value={employeeId || staffId} />
              <DetailItem label="Department" value={department} />
              <DetailItem label="Position" value={position} />
              <DetailItem label="Email" value={email} />
              {/* nationality field removed since it doesn't exist in database */}
            </div>
          </section>

          <section className="print:break-inside-avoid">
            <Separator className="my-2 print:hidden" />
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
              <Briefcase className="print:hidden" />
              Travel Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 p-2 rounded-md print:grid-cols-3 print:p-0">
              <DetailItem label="Travel Purpose" value={travelPurpose} />
              <DetailItem label="Destination" value={destination} />
              <DetailItem label="Visa Type" value={visaType} />
              <DetailItem label="Trip Start Date" value={formatDateSafe(tripStartDate)} />
              <DetailItem label="Trip End Date" value={formatDateSafe(tripEndDate)} />
            </div>
          </section>

          <section className="print:break-inside-avoid">
            <Separator className="my-2 print:hidden" />
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
              <CreditCard className="print:hidden" />
              Passport Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 p-2 rounded-md print:grid-cols-3 print:p-0">
              <DetailItem label="Passport Number" value={passportNumber} />
              <DetailItem label="Passport Expiry Date" value={formatDateSafe(passportExpiryDate)} />
            </div>
          </section>

          {supportingDocumentsNotes && (
            <section className="print:break-inside-avoid">
              <Separator className="my-2 print:hidden" />
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
                <Paperclip className="print:hidden" />
                Supporting Documents
              </h3>
              <div className="p-2 rounded-md print:p-0">
                <p className="whitespace-pre-wrap text-sm print:text-[9pt]">{supportingDocumentsNotes}</p>
              </div>
            </section>
          )}

          {itineraryDetails && (
            <section className="print:break-inside-avoid">
              <Separator className="my-2 print:hidden" />
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
                <Plane className="print:hidden" />
                Itinerary Details
              </h3>
              <div className="p-2 rounded-md print:p-0">
                <p className="whitespace-pre-wrap text-sm print:text-[9pt]">{itineraryDetails}</p>
              </div>
            </section>
          )}

          {additionalComments && (
            <section className="print:break-inside-avoid">
              <Separator className="my-2 print:hidden" />
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
                <Info className="print:hidden" />
                Additional Comments
              </h3>
              <div className="p-2 rounded-md print:p-0">
                <p className="whitespace-pre-wrap text-sm print:text-[9pt]">{additionalComments}</p>
              </div>
            </section>
          )}

          <section className="print:break-inside-avoid">
            <Separator className="my-2 print:hidden" />
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
              <CalendarDays className="print:hidden" />
              Application Timeline
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 p-2 rounded-md print:grid-cols-3 print:p-0">
              <DetailItem label="Submitted Date" value={formatDateSafe(submittedDate)} />
              <DetailItem label="Last Updated" value={formatDateSafe(lastUpdatedDate)} />
              <DetailItem label="Application ID" value={id} />
            </div>
          </section>
        </CardContent>
      </Card>

      {approvalHistory && approvalHistory.length > 0 && (
        <Card className="shadow-md print:shadow-none print:border-none print:break-inside-avoid">
          <CardHeader className="print:p-0 print:mb-2">
            <CardTitle className="text-lg font-semibold print:text-base">Approval Workflow</CardTitle>
          </CardHeader>
          <CardContent className="print:p-0">
            {approvalHistory.map((step, index) => (
              <ApprovalStepView key={index} step={step} isLast={index === approvalHistory.length - 1} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
