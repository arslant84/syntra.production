
"use client";

import React from 'react';
import type { AccommodationRequestDetails } from '@/types/accommodation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { UserCircle, Briefcase, MapPin, CalendarDays, Bed, MessageSquare, CheckCircle2, AlertCircle, Clock, Link as LinkIcon, CheckCircle, XCircle } from "lucide-react";
import { StatusBadge } from "@/lib/status-utils";
import Link from 'next/link';

interface AccommodationRequestDetailsViewProps {
  requestData: AccommodationRequestDetails;
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

// Removed getStatusBadgeVariant function - now using standardized StatusBadge component

export default function AccommodationRequestDetailsView({ requestData }: AccommodationRequestDetailsViewProps) {
  const {
    id, trfId, requestorName, department, requestorGender,
    location, requestedCheckInDate, requestedCheckOutDate, requestedRoomType,
    status, assignedRoomName, assignedStaffHouseName,
    specialRequests, notes, submittedDate, lastUpdatedDate,
    flightArrivalTime, flightDepartureTime, approvalWorkflow
  } = requestData;

  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-primary" /> Requestor & Trip Information
            </CardTitle>
            <StatusBadge status={status} showIcon />
          </div>
           <CardDescription>
            Submitted: {formatDateSafe(submittedDate, "Pp")} | Last Updated: {formatDateSafe(lastUpdatedDate, "Pp")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 pt-4">
          <DetailItem label="Request ID" value={id} />
          <DetailItem label="TSR Reference" value={trfId ? <Link href={`/trf/view/${trfId}`} className="text-primary hover:underline flex items-center gap-1">{trfId} <LinkIcon className="h-3 w-3"/></Link> : "N/A"} />
          <DetailItem label="Requestor Name" value={requestorName} />
          <DetailItem label="Department" value={department} />
          <DetailItem label="Gender" value={requestorGender} />
          <DetailItem label="Requested Location" value={location} />
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" /> Booking Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 pt-4">
          <DetailItem label="Requested Check-in" value={formatDateSafe(requestedCheckInDate)} />
          <DetailItem label="Requested Check-out" value={formatDateSafe(requestedCheckOutDate)} />
          <DetailItem label="Requested Room Type" value={requestedRoomType || 'N/A'} />
          <DetailItem label="Flight Arrival Time" value={flightArrivalTime || 'N/A'} />
          <DetailItem label="Flight Departure Time" value={flightDepartureTime || 'N/A'} />
           {specialRequests && <DetailItem label="Special Requests" value={<p className="whitespace-pre-wrap">{specialRequests}</p>} fullWidth />}
        </CardContent>
      </Card>
      
      {status === 'Confirmed' && (
        <Card className="shadow-md border-green-500 bg-green-50/50">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5" /> Assignment Confirmed
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 pt-4">
            <DetailItem label="Assigned Staff House" value={assignedStaffHouseName || 'N/A'} />
            <DetailItem label="Assigned Room/Unit" value={assignedRoomName || 'N/A'} />
          </CardContent>
        </Card>
      )}

      {status === 'Rejected' && (
         <Card className="shadow-md border-red-500 bg-red-50/50">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" /> Request Rejected
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
             {/* Placeholder for rejection reason, to be added to type if needed */}
            <DetailItem label="Reason for Rejection" value={notes || "Reason not specified."} fullWidth />
          </CardContent>
        </Card>
      )}
      
      {notes && (status !== 'Rejected' || (status === 'Rejected' && !notes.toLowerCase().includes("reason"))) && ( // Avoid showing notes twice if it's the rejection reason
        <Card className="shadow-md">
            <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" /> Admin Notes
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
                <DetailItem label="Notes" value={<p className="whitespace-pre-wrap">{notes}</p>} fullWidth />
            </CardContent>
        </Card>
      )}

      {/* Approval Workflow */}
      {approvalWorkflow && approvalWorkflow.length > 0 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" /> Approval Workflow
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              {approvalWorkflow.map((step, index) => (
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
          </CardContent>
        </Card>
      )}

    </div>
  );
}
