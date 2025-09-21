
"use client";

import type { VisaApplication, VisaApprovalStep } from '@/types/visa';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from '@/components/ui/badge';
import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { UserCircle, Briefcase, Plane, Paperclip, CalendarDays, Globe, Flag, FileBadge, Link2, Mail, MapPin, FileText, Info, CreditCard, CheckCircle, Users } from "lucide-react";
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
    processingDetails, processingStartedAt, processingCompletedAt,
    // Enhanced LOI fields
    dateOfBirth, placeOfBirth, citizenship, passportPlaceOfIssuance, passportDateOfIssuance,
    contactTelephone, homeAddress, educationDetails, currentEmployerName, currentEmployerAddress,
    maritalStatus, familyInformation, requestType, approximatelyArrivalDate, durationOfStay,
    visaEntryType, workVisitCategory, applicationFeesBorneBy, costCentreNumber,
    lineFocalPerson, lineFocalDept, lineFocalContact, lineFocalDate,
    sponsoringDeptHead, sponsoringDeptHeadDept, sponsoringDeptHeadContact, sponsoringDeptHeadDate,
    ceoApprovalName, ceoApprovalDate
  } = visaData;

  // Removed getStatusBadgeVariant function - now using standardized StatusBadge component
  
  return (
    <div className="space-y-4 print:space-y-2">
      {/* Header Section */}
      <Card className="shadow-lg border-t-4 border-t-primary print:shadow-none print:border-none print:break-inside-avoid">
        <CardHeader className="text-center print:p-0 print:mb-2">
          <CardTitle className="text-2xl font-bold text-primary print:text-lg">REQUEST FOR LOI, VISA & WP</CardTitle>
          <CardDescription className="print:text-xs">
            Application ID: {id} | Status: <StatusBadge status={status || "Unknown"} showIcon className="print:text-xs inline" />
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="shadow-md print:shadow-none print:border-none print:break-inside-avoid">
        <CardHeader className="print:p-0 print:mb-2">
          <div className="flex items-center justify-between print:mb-1">
            <CardTitle className="text-xl flex items-center gap-2 print:text-lg">
              <UserCircle className="w-5 h-5 text-primary print:hidden" /> Section A: PARTICULARS OF APPLICANT
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4 print:p-0 print:space-y-2">
          <section className="print:break-inside-avoid">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
              <UserCircle className="print:hidden" />
              Personal Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 p-2 rounded-md print:grid-cols-3 print:p-0">
              <DetailItem label="Full Name" value={applicantName || requestorName} />
              <DetailItem label="Date of Birth" value={formatDateSafe(dateOfBirth)} />
              <DetailItem label="Place of Birth" value={placeOfBirth} />
              <DetailItem label="Citizenship" value={citizenship} />
              <DetailItem label="Contact Telephone" value={contactTelephone} />
              <DetailItem label="Marital Status" value={maritalStatus} />
              <DetailItem label="Home Address" value={homeAddress} fullWidth />
              <DetailItem label="Education Details" value={educationDetails} fullWidth />
              <DetailItem label="Family Information" value={familyInformation} fullWidth />
            </div>
          </section>

          <section className="print:break-inside-avoid">
            <Separator className="my-2 print:hidden" />
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
              <Briefcase className="print:hidden" />
              Employment Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 p-2 rounded-md print:grid-cols-3 print:p-0">
              <DetailItem label="Employee ID" value={employeeId || staffId} />
              <DetailItem label="Department" value={department} />
              <DetailItem label="Position" value={position} />
              <DetailItem label="Email" value={email} />
              <DetailItem label="Current Employer" value={currentEmployerName} />
              <DetailItem label="Employer Address" value={currentEmployerAddress} fullWidth />
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
              <DetailItem label="Place of Issuance" value={passportPlaceOfIssuance} />
              <DetailItem label="Date of Issuance" value={formatDateSafe(passportDateOfIssuance)} />
              <DetailItem label="Expiry Date" value={formatDateSafe(passportExpiryDate)} />
            </div>
          </section>
        </CardContent>
      </Card>

      {/* Section B: Type of Request */}
      <Card className="shadow-md print:shadow-none print:border-none print:break-inside-avoid">
        <CardHeader className="print:p-0 print:mb-2">
          <CardTitle className="text-xl flex items-center gap-2 print:text-lg">
            <CheckCircle className="w-5 h-5 text-primary print:hidden" /> Section B: TYPE OF REQUEST
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4 print:p-0 print:space-y-2">
          <section className="print:break-inside-avoid">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
              <FileText className="print:hidden" />
              Request Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 p-2 rounded-md print:grid-cols-3 print:p-0">
              <DetailItem label="Request Type" value={requestType} />
              <DetailItem label="Travel Purpose" value={travelPurpose} />
              <DetailItem label="Destination" value={travelPurpose === 'Expatriate Relocation' ? 'Home Country' : destination} />
              <DetailItem label="Arrival Date" value={formatDateSafe(approximatelyArrivalDate)} />
              <DetailItem label="Duration of Stay" value={durationOfStay} />
              <DetailItem label="Visa Entry Type" value={visaEntryType} />
              <DetailItem label="Work/Visit Category" value={workVisitCategory} />
              <DetailItem label="Application Fees Borne By" value={applicationFeesBorneBy} />
              <DetailItem label="Cost Centre Number" value={costCentreNumber} />
              <DetailItem label="Trip Start Date" value={formatDateSafe(tripStartDate)} />
              <DetailItem label="Trip End Date" value={formatDateSafe(tripEndDate)} />
              <DetailItem label="Visa Type" value={visaType} />
            </div>
          </section>

          {/* Visa Processing Details (for processed visa applications) */}
          {(status === 'Processed' || status === 'Processing with Visa Admin') && (
            <section className="print:break-inside-avoid">
              <Separator className="my-2 print:hidden" />
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
                <CheckCircle className="print:hidden" /> Visa Processing Details
              </h3>
              {processingDetails ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 p-4 rounded-lg bg-green-50 border border-green-200 print:grid-cols-3 print:p-0">
                  {processingDetails.paymentMethod && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Payment Method</p>
                      <p className="text-sm">{processingDetails.paymentMethod}</p>
                    </div>
                  )}
                  {processingDetails.paymentDate && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Payment Date</p>
                      <p className="text-sm">{formatDateSafe(processingDetails.paymentDate)}</p>
                    </div>
                  )}
                  {processingDetails.applicationFee && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Application Fee</p>
                      <p className="text-sm">${processingDetails.applicationFee}</p>
                    </div>
                  )}
                  {processingDetails.processingFee && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Processing Fee</p>
                      <p className="text-sm">${processingDetails.processingFee}</p>
                    </div>
                  )}
                  {processingDetails.totalFee && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Fee</p>
                      <p className="text-sm">${processingDetails.totalFee}</p>
                    </div>
                  )}
                  {processingDetails.visaNumber && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Visa Number</p>
                      <p className="text-sm">{processingDetails.visaNumber}</p>
                    </div>
                  )}
                  {processingDetails.visaValidFrom && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Visa Valid From</p>
                      <p className="text-sm">{formatDateSafe(processingDetails.visaValidFrom)}</p>
                    </div>
                  )}
                  {processingDetails.visaValidTo && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Visa Valid To</p>
                      <p className="text-sm">{formatDateSafe(processingDetails.visaValidTo)}</p>
                    </div>
                  )}
                  {processingDetails.bankTransferReference && (
                    <div className="sm:col-span-2 md:col-span-3">
                      <p className="text-sm font-medium text-gray-600">Bank Transfer Reference</p>
                      <p className="text-sm">{processingDetails.bankTransferReference}</p>
                    </div>
                  )}
                  {processingDetails.chequeNumber && (
                    <div className="sm:col-span-2 md:col-span-3">
                      <p className="text-sm font-medium text-gray-600">Cheque Number</p>
                      <p className="text-sm">{processingDetails.chequeNumber}</p>
                    </div>
                  )}
                  {processingDetails.verifiedBy && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Verified By</p>
                      <p className="text-sm">{processingDetails.verifiedBy}</p>
                    </div>
                  )}
                  {processingDetails.authorizedBy && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Authorized By</p>
                      <p className="text-sm">{processingDetails.authorizedBy}</p>
                    </div>
                  )}
                  {processingDetails.processingNotes && (
                    <div className="sm:col-span-2 md:col-span-3">
                      <p className="text-sm font-medium text-gray-600">Visa Admin Notes</p>
                      <p className="text-sm">{processingDetails.processingNotes}</p>
                    </div>
                  )}
                  {processingStartedAt && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Processing Started</p>
                      <p className="text-sm">{formatDateSafe(processingStartedAt)}</p>
                    </div>
                  )}
                  {processingCompletedAt && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Processing Completed</p>
                      <p className="text-sm">{formatDateSafe(processingCompletedAt)}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`p-4 rounded-lg border ${status === 'Processed' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                  <p className={`text-sm font-medium ${status === 'Processed' ? 'text-green-700' : 'text-blue-700'}`}>
                    {status === 'Processed'
                      ? '✅ This visa application has been processed and completed.'
                      : '🔄 This visa application is currently being processed by the Visa Administrator.'}
                  </p>
                  <p className={`text-xs mt-1 ${status === 'Processed' ? 'text-green-600' : 'text-blue-600'}`}>
                    {status === 'Processed'
                      ? 'Visa processing details are being finalized. Please contact the Visa Administrator for specific visa information including visa number, validity dates, and collection instructions.'
                      : 'Processing is in progress. Visa details will be updated once the embassy process is complete.'}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Approval Workflow Information */}
          {(lineFocalPerson || sponsoringDeptHead || ceoApprovalName) && (
            <section className="print:break-inside-avoid">
              <Separator className="my-2 print:hidden" />
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
                <Users className="print:hidden" />
                Approval Workflow
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 p-2 rounded-md print:grid-cols-3 print:p-0">
                <DetailItem label="Line Focal Person" value={lineFocalPerson} />
                <DetailItem label="Line Focal Dept" value={lineFocalDept} />
                <DetailItem label="Line Focal Contact" value={lineFocalContact} />
                <DetailItem label="Line Focal Date" value={formatDateSafe(lineFocalDate)} />
                <DetailItem label="Sponsoring Dept Head" value={sponsoringDeptHead} />
                <DetailItem label="Sponsoring Dept Head Dept" value={sponsoringDeptHeadDept} />
                <DetailItem label="Sponsoring Dept Head Contact" value={sponsoringDeptHeadContact} />
                <DetailItem label="Sponsoring Dept Head Date" value={formatDateSafe(sponsoringDeptHeadDate)} />
                <DetailItem label="CEO Approval Name" value={ceoApprovalName} />
                <DetailItem label="CEO Approval Date" value={formatDateSafe(ceoApprovalDate)} />
              </div>
            </section>
          )}
        </CardContent>
      </Card>

      {supportingDocumentsNotes && (
        <Card className="shadow-md print:shadow-none print:border-none print:break-inside-avoid">
          <CardHeader className="print:p-0 print:mb-2">
            <CardTitle className="text-lg flex items-center gap-2 print:text-base">
              <Paperclip className="print:hidden" />
              Supporting Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="print:p-0">
            <p className="whitespace-pre-wrap text-sm print:text-[9pt]">{supportingDocumentsNotes}</p>
          </CardContent>
        </Card>
      )}

      {itineraryDetails && (
        <Card className="shadow-md print:shadow-none print:border-none print:break-inside-avoid">
          <CardHeader className="print:p-0 print:mb-2">
            <CardTitle className="text-lg flex items-center gap-2 print:text-base">
              <Plane className="print:hidden" />
              Itinerary Details
            </CardTitle>
          </CardHeader>
          <CardContent className="print:p-0">
            <p className="whitespace-pre-wrap text-sm print:text-[9pt]">{itineraryDetails}</p>
          </CardContent>
        </Card>
      )}

      {additionalComments && (
        <Card className="shadow-md print:shadow-none print:border-none print:break-inside-avoid">
          <CardHeader className="print:p-0 print:mb-2">
            <CardTitle className="text-lg flex items-center gap-2 print:text-base">
              <Info className="print:hidden" />
              Additional Comments
            </CardTitle>
          </CardHeader>
          <CardContent className="print:p-0">
            <p className="whitespace-pre-wrap text-sm print:text-[9pt]">{additionalComments}</p>
          </CardContent>
        </Card>
      )}

      {/* Application Timeline */}
      <Card className="shadow-md print:shadow-none print:border-none print:break-inside-avoid">
        <CardHeader className="print:p-0 print:mb-2">
          <CardTitle className="text-lg flex items-center gap-2 print:text-base">
            <CalendarDays className="print:hidden" />
            Application Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="print:p-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 p-2 rounded-md print:grid-cols-3 print:p-0">
            <DetailItem label="Submitted Date" value={formatDateSafe(submittedDate)} />
            <DetailItem label="Last Updated" value={formatDateSafe(lastUpdatedDate)} />
            <DetailItem label="Application ID" value={id} />
          </div>
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
            <CardTitle className="text-lg font-semibold print:text-base">System Approval Workflow</CardTitle>
          </CardHeader>
          <CardContent className="print:p-0">
            <ApprovalWorkflow steps={approvalWorkflow || approvalHistory || []} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
