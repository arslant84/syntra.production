
"use client";

import type { VisaApplication, VisaApprovalStep } from '@/types/visa';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from '@/components/ui/badge';
import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { UserCircle, Briefcase, Plane, Paperclip, CalendarDays, Globe, Flag, FileBadge, Link2, Mail, MapPin, FileText, Info, CreditCard, CheckCircle } from "lucide-react";
import ApprovalWorkflow from "../trf/ApprovalWorkflow";
import VisaDocuments from "./VisaDocuments";
import { StatusBadge } from "@/lib/status-utils";
import Link from 'next/link';
import React from 'react';

interface VisaApplicationViewProps {
  visaData: VisaApplication;
  canManageDocuments?: boolean;
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



export default function VisaApplicationView({ visaData, canManageDocuments = false }: VisaApplicationViewProps) {
  const {
    id, userId, applicantName, travelPurpose, destination, employeeId,
    tripStartDate, tripEndDate, itineraryDetails, status, submittedDate, lastUpdatedDate, 
    approvalWorkflow, approvalHistory, requestorName, staffId, department, position, email, visaType,
    passportNumber, passportExpiryDate, additionalComments, supportingDocumentsNotes,
    processingDetails, processingStartedAt, processingCompletedAt
  } = visaData;

  // Removed getStatusBadgeVariant function - now using standardized StatusBadge component
  
  return (
    <div className="space-y-4 print:space-y-2">
      <Card className="shadow-md print:shadow-none print:border-none print:break-inside-avoid">
        <CardHeader className="print:p-0 print:mb-2">
          <div className="flex items-center justify-between print:mb-1">
            <CardTitle className="text-xl flex items-center gap-2 print:text-lg">
              <UserCircle className="w-5 h-5 text-primary print:hidden" /> Applicant Information
            </CardTitle>
            <StatusBadge status={status || "Unknown"} showIcon className="print:text-xs" />
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
              <DetailItem label="Destination" value={travelPurpose === 'Expatriate Relocation' ? 'Home Country' : destination} />
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

          {/* Processing Details (for processed visas) */}
          {(status === 'Visa Issued' || status === 'Approved') && (
            <section className="print:break-inside-avoid">
              <Separator className="my-2 print:hidden" />
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
                <CheckCircle className="print:hidden" /> Processing Details
              </h3>
              {processingDetails ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 p-2 rounded-md print:grid-cols-3 print:p-0 bg-green-50 border border-green-200">
                  {processingDetails.paymentMethod && (
                    <DetailItem label="Payment Method" value={processingDetails.paymentMethod} />
                  )}
                  {processingDetails.paymentDate && (
                    <DetailItem label="Payment Date" value={formatDateSafe(processingDetails.paymentDate)} />
                  )}
                  {processingDetails.applicationFee && (
                    <DetailItem label="Application Fee" value={`$${processingDetails.applicationFee}`} />
                  )}
                  {processingDetails.processingFee && (
                    <DetailItem label="Processing Fee" value={`$${processingDetails.processingFee}`} />
                  )}
                  {processingDetails.totalFee && (
                    <DetailItem label="Total Fee" value={`$${processingDetails.totalFee}`} />
                  )}
                  {processingDetails.visaNumber && (
                    <DetailItem label="Visa Number" value={processingDetails.visaNumber} />
                  )}
                  {processingDetails.visaValidFrom && (
                    <DetailItem label="Visa Valid From" value={formatDateSafe(processingDetails.visaValidFrom)} />
                  )}
                  {processingDetails.visaValidTo && (
                    <DetailItem label="Visa Valid To" value={formatDateSafe(processingDetails.visaValidTo)} />
                  )}
                  {processingDetails.bankTransferReference && (
                    <DetailItem label="Bank Transfer Reference" value={processingDetails.bankTransferReference} fullWidth />
                  )}
                  {processingDetails.chequeNumber && (
                    <DetailItem label="Cheque Number" value={processingDetails.chequeNumber} fullWidth />
                  )}
                  {processingDetails.verifiedBy && (
                    <DetailItem label="Verified By" value={processingDetails.verifiedBy} />
                  )}
                  {processingDetails.authorizedBy && (
                    <DetailItem label="Authorized By" value={processingDetails.authorizedBy} />
                  )}
                  {processingDetails.processingNotes && (
                    <DetailItem label="Processing Notes" value={processingDetails.processingNotes} fullWidth />
                  )}
                  {processingStartedAt && (
                    <DetailItem label="Processing Started" value={formatDateSafe(processingStartedAt)} />
                  )}
                  {processingCompletedAt && (
                    <DetailItem label="Processing Completed" value={formatDateSafe(processingCompletedAt)} />
                  )}
                </div>
              ) : (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700 font-medium">✅ This visa has been processed and completed.</p>
                  <p className="text-xs text-green-600 mt-1">Processing details are being finalized. Please contact Visa Admin for specific processing information.</p>
                </div>
              )}
            </section>
          )}

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

      {/* Documents Section */}
      <VisaDocuments 
        visaId={id} 
        canUpload={canManageDocuments} 
        canDelete={canManageDocuments}
        className="print:break-inside-avoid" 
      />

      {(approvalWorkflow || approvalHistory) && (approvalWorkflow || approvalHistory)!.length > 0 && (
        <Card className="shadow-md print:shadow-none print:border-none print:break-inside-avoid">
          <CardHeader className="print:p-0 print:mb-2">
            <CardTitle className="text-lg font-semibold print:text-base">Approval Workflow</CardTitle>
          </CardHeader>
          <CardContent className="print:p-0">
            <ApprovalWorkflow steps={approvalWorkflow || approvalHistory || []} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
