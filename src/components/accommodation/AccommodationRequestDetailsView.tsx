
"use client";

import type { AccommodationRequestDetails } from '@/types/accommodation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { UserCircle, Briefcase, MapPin, CalendarDays, Bed, MessageSquare, CheckCircle2, AlertCircle, Clock, Link as LinkIcon } from "lucide-react";
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

const getStatusBadgeVariant = (status: AccommodationRequestDetails['status']) => {
  switch (status) {
    case 'Confirmed': return 'default';
    case 'Rejected': return 'destructive';
    case 'Pending Assignment': return 'outline';
    case 'Blocked': return 'secondary';
    default: return 'secondary';
  }
};

export default function AccommodationRequestDetailsView({ requestData }: AccommodationRequestDetailsViewProps) {
  const {
    id, trfId, requestorName, department, requestorGender,
    location, requestedCheckInDate, requestedCheckOutDate, requestedRoomType,
    status, assignedRoomName, assignedStaffHouseName,
    specialRequests, notes, submittedDate, lastUpdatedDate,
    flightArrivalTime, flightDepartureTime
  } = requestData;

  return (
    <div className="space-y-6">
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-primary" /> Requestor & Trip Information
            </CardTitle>
            <Badge variant={getStatusBadgeVariant(status)} className={cn(status === "Confirmed" ? "bg-green-600 text-white" : "")}>
                {status}
            </Badge>
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

    </div>
  );
}
