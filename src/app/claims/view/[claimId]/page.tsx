"use client";

import React from 'react';
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, isValid, formatISO } from "date-fns";
import { ReceiptText, Clock, CheckCircle, XCircle, User, Building, CreditCard, FileText, Calendar, DollarSign, Info, ArrowLeft, Edit, Ban, Printer, Loader2, AlertTriangle, Trash2 } from "lucide-react";
import { StatusBadge, WorkflowStep } from "@/lib/status-utils";
import { formatCurrencyForTable } from "@/lib/currency-utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

// Type aliases to handle both snake_case and camelCase property names
type AnyObject = Record<string, any>;

// Helper function to safely get a value from an object that might use snake_case or camelCase
const getPropertyValue = <T,>(obj: AnyObject, snakeCaseKey: string, camelCaseKey: string, defaultValue: T): T => {
  return (obj[snakeCaseKey] !== undefined ? obj[snakeCaseKey] : 
         obj[camelCaseKey] !== undefined ? obj[camelCaseKey] : 
         defaultValue) as T;
};

const formatDateSafe = (date: Date | string | null | undefined, dateFormat = "PPP") => {
  if (!date) return "N/A";
  const d = typeof date === 'string' ? new Date(date) : date;
  return isValid(d) ? format(d, dateFormat) : "Invalid Date";
};

const formatNumberSafe = (num: number | string | null | undefined, digits = 2) => {
  if (num === null || num === undefined || String(num).trim() === '') return ""; // Return empty string for null/empty values
  const parsedNum = Number(num);
  return isNaN(parsedNum) ? String(num) : parsedNum.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const DetailItem = ({ label, value, fullWidth = false, className = "" }: { label: string; value?: string | number | null | React.ReactNode; fullWidth?: boolean; className?: string }) => {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === "")) {
    return null; 
  }
  return (
    <div className={`${fullWidth ? "col-span-full" : "sm:col-span-1"} print:break-inside-avoid ${className}`}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider print:text-[8pt] print:font-semibold">{label}</p>
      <div className="text-sm text-foreground break-words mt-0.5 print:text-[9pt]">
        {typeof value === 'string' || typeof value === 'number' ? String(value) : value}
      </div>
    </div>
  );
};

// Removed old getStatusBadge function - now using standardized StatusBadge component

export default function ClaimViewPage() {
  const params = useParams();
  const router = useRouter();
  const [claim, setClaim] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);
  const { toast } = useToast();
  const claimId = params.claimId as string;
  
  // Define which statuses allow editing and cancellation
  const EDITABLE_STATUSES = ["Pending Department Focal", "Pending Verification", "Draft", "Rejected", "Pending Approval"];
  const CANCELLABLE_STATUSES = ["Pending Department Focal", "Pending Verification", "Pending Approval", "Pending Line Manager", "Pending HOD"];
  const DELETABLE_STATUSES = ["Draft", "Pending Department Focal", "Pending Verification", "Rejected"];
  const TERMINAL_STATUSES = ["Approved", "Cancelled", "Processed"];

  useEffect(() => {
    const fetchClaimDetails = async () => {
      try {
        setLoading(true);
        console.log(`Fetching claim details for ID: ${claimId}`);
        
        // Use the claimId parameter name to match the API route
        const response = await fetch(`/api/claims/${claimId}`);
        console.log('API response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`Error fetching claim: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Claim details:', data);
        
        // Check if the data is wrapped in a claimData property
        if (data.claimData) {
          console.log('Found claim data in response:', data.claimData);
          setClaim(data.claimData);
        } else {
          console.log('No claim data wrapper found, using response directly');
          setClaim(data);
        }
      } catch (err) {
        console.error('Failed to fetch claim details:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch claim details');
      } finally {
        setLoading(false);
      }
    };

    if (claimId) {
      fetchClaimDetails();
    }
  }, [claimId]);

  const handleCancelClaim = async () => {
    if (!claim) return;
  
    setIsActionPending(true);
    try {
      const response = await fetch(`/api/claims/${claimId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          comments: "Cancelled by user.",
          cancelledBy: claim.requestorName || "User" 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || "Failed to cancel claim.");
      }

      const result = await response.json();
      setClaim(result.claim);
      toast({ 
        title: "Claim Cancelled", 
        description: `Claim ${result.claim?.document_number || claimId} has been cancelled.` 
      });
    } catch (err: any) {
      console.error('Error cancelling claim:', err);
      toast({ 
        title: "Error Cancelling Claim", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setIsActionPending(false);
    }
  };

  const handleDeleteClaim = async () => {
    if (!claim) return;
  
    setIsActionPending(true);
    try {
      const response = await fetch(`/api/claims/${claimId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || "Failed to delete claim.");
      }

      toast({ 
        title: "Claim Deleted", 
        description: `Claim ${claim.document_number || claimId} has been permanently deleted.` 
      });
      router.push('/claims');
    } catch (err: any) {
      console.error('Error deleting claim:', err);
      toast({ 
        title: "Error Deleting Claim", 
        description: err.message, 
        variant: "destructive" 
      });
      setIsActionPending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading Claim Details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <Card className="max-w-lg mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 text-destructive">
              <XCircle className="w-6 h-6" /> Error Loading Claim
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={() => router.back()} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="space-y-8">
        <Card className="max-w-lg mx-auto shadow-lg">
          <CardHeader>
            <CardTitle>Claim Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>The requested Claim (ID: {claimId}) could not be found or loaded.</p>
            <Button onClick={() => router.back()} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Extract data from the claim
  const headerDetails = claim.headerDetails || {};
  const bankDetails = claim.bankDetails || {};
  const medicalClaimDetails = claim.medicalClaimDetails || {};
  const expenseItems = claim.expenseItems || [];
  const informationOnForeignExchangeRate = claim.informationOnForeignExchangeRate || [];
  const financialSummary = claim.financialSummary || {};
  const declaration = claim.declaration || {};

  // Determine if the claim can be edited, cancelled or deleted based on its status
  const canEdit = claim && claim.status && 
    EDITABLE_STATUSES.includes(claim.status) && 
    !TERMINAL_STATUSES.includes(claim.status);

  console.log("Claim Status:", claim?.status);
  console.log("EDITABLE_STATUSES:", EDITABLE_STATUSES);
  console.log("Status included in editable:", EDITABLE_STATUSES.includes(claim?.status));
  console.log("Not terminal:", !TERMINAL_STATUSES.includes(claim?.status));
  console.log("Can Edit:", canEdit);
    
  const canCancel = claim && claim.status && 
    CANCELLABLE_STATUSES.includes(claim.status) && 
    !TERMINAL_STATUSES.includes(claim.status);

  const canDelete = claim && claim.status && 
    DELETABLE_STATUSES.includes(claim.status) && 
    !TERMINAL_STATUSES.includes(claim.status);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 print:py-0 print:px-0 print:space-y-4">
      <Card className="shadow-xl print:shadow-none print:border-none">
        <CardHeader className="bg-muted/30 print:bg-transparent print:p-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:flex-row print:items-start">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl print:text-2xl">
                <ReceiptText className="w-6 h-6 text-primary print:text-black" />
                Expense Claim Details
              </CardTitle>
              <CardDescription className="print:text-sm flex items-center gap-2">
                Viewing Claim ID: {claim.document_number || claim.documentNumber} - Status: <StatusBadge status={claim.status || 'Unknown'} showIcon />
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              {canEdit && (
                <Button variant="outline" asChild>
                  <Link href={`/claims/edit/${claimId}`}>
                    <Edit className="mr-2 h-4 w-4" /> Edit Claim
                  </Link>
                </Button>
              )}
              {canCancel && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isActionPending}>
                      <Ban className="mr-2 h-4 w-4" /> Cancel Claim
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Cancellation</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to cancel Claim {claimId}? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isActionPending}>Back</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleCancelClaim} 
                        disabled={isActionPending} 
                        className="bg-destructive hover:bg-destructive/90">
                        {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm Cancel
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isActionPending}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Claim
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete Claim {claimId}? This action is permanent and cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isActionPending}>Back</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleDeleteClaim} 
                        disabled={isActionPending} 
                        className="bg-destructive hover:bg-destructive/90">
                        {isActionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" /> Print / Save as PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Header Details */}
          <section>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
              <FileText className="print:hidden" /> Claim Header Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:gap-2">
              <DetailItem label="Document Type" value={headerDetails.documentType} />
              <DetailItem label="Document Number" value={headerDetails.documentNumber} />
              <DetailItem label="Claim For Month Of" value={formatDateSafe(headerDetails.claimForMonthOf, "MMMM yyyy")} />
              <DetailItem label="Staff Name" value={headerDetails.staffName} />
              <DetailItem label="Staff Number" value={headerDetails.staffNo} />
              <DetailItem label="Grade" value={headerDetails.gred} />
              <DetailItem label="Staff Type" value={headerDetails.staffType} />
              <DetailItem label="Executive Status" value={headerDetails.executiveStatus} />
              <DetailItem label="Department Code" value={headerDetails.departmentCode} />
              <DetailItem label="Department Cost Center" value={headerDetails.deptCostCenterCode} />
              <DetailItem label="Location" value={headerDetails.location} />
              <DetailItem label="Telephone Extension" value={headerDetails.telExt} />
              <DetailItem label="Start Time From Home" value={headerDetails.startTimeFromHome} />
              <DetailItem label="Time of Arrival at Home" value={headerDetails.timeOfArrivalAtHome} />
            </div>
          </section>

          {/* Bank Details */}
          <section>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
              <CreditCard className="print:hidden" /> Bank Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:gap-2">
              <DetailItem label="Bank Name" value={bankDetails.bankName} />
              <DetailItem label="Account Number" value={bankDetails.accountNumber} />
              <DetailItem label="Purpose of Claim" value={bankDetails.purposeOfClaim} fullWidth />
            </div>
          </section>

          {/* Medical Claim Details (if applicable) */}
          {medicalClaimDetails.isMedicalClaim && (
            <section>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
                <User className="print:hidden" /> Medical Claim Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:gap-2">
                <DetailItem label="Medical Claim Type" value={medicalClaimDetails.applicableMedicalType} />
                <DetailItem label="Is For Family" value={medicalClaimDetails.isForFamily ? "Yes" : "No"} />
                {medicalClaimDetails.isForFamily && (
                  <>
                    <DetailItem label="For Spouse" value={medicalClaimDetails.familyMemberSpouse ? "Yes" : "No"} />
                    <DetailItem label="For Children" value={medicalClaimDetails.familyMemberChildren ? "Yes" : "No"} />
                    <DetailItem label="For Other Family Member" value={medicalClaimDetails.familyMemberOther || "No"} />
                  </>
                )}
              </div>
            </section>
          )}

          {/* Expense Items */}
          {expenseItems.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
                <DollarSign className="print:hidden" /> Expense Items
              </h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="text-right">Mileage (KM)</TableHead>
                      <TableHead className="text-right">Transport</TableHead>
                      <TableHead className="text-right">Hotel/Accommodation</TableHead>
                      <TableHead className="text-right">Meals</TableHead>
                      <TableHead className="text-right">Misc. (10%)</TableHead>
                      <TableHead className="text-right">Other Expenses</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseItems.map((item: any, index: number) => {
                      // Handle claimOrTravelDetails display
                      let detailsText = '';
                      if (typeof item.claimOrTravelDetails === 'object' && item.claimOrTravelDetails !== null) {
                        const parts = [];
                        if (item.claimOrTravelDetails.from) parts.push(item.claimOrTravelDetails.from);
                        if (item.claimOrTravelDetails.to) parts.push(item.claimOrTravelDetails.to);
                        if (item.claimOrTravelDetails.placeOfStay) parts.push(item.claimOrTravelDetails.placeOfStay);
                        detailsText = parts.join(' - ');
                      } else if (typeof item.claimOrTravelDetails === 'string') {
                        detailsText = item.claimOrTravelDetails;
                      }
                      
                      return (
                        <TableRow key={index}>
                          <TableCell>{formatDateSafe(item.date, "dd MMM yyyy")}</TableCell>
                          <TableCell>{detailsText}</TableCell>
                          <TableCell className="text-right">{formatNumberSafe(item.officialMileageKM, 0)}</TableCell>
                          <TableCell className="text-right">{formatNumberSafe(item.transport)}</TableCell>
                          <TableCell className="text-right">{formatNumberSafe(item.hotelAccommodationAllowance)}</TableCell>
                          <TableCell className="text-right">{formatNumberSafe(item.outStationAllowanceMeal)}</TableCell>
                          <TableCell className="text-right">{formatNumberSafe(item.miscellaneousAllowance10Percent)}</TableCell>
                          <TableCell className="text-right">{formatNumberSafe(item.otherExpenses)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          {/* Foreign Exchange Rates (if applicable) */}
          {informationOnForeignExchangeRate && informationOnForeignExchangeRate.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
                <Calendar className="print:hidden" /> Foreign Exchange Rates
              </h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead className="text-right">Selling Rate (TT/OD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {informationOnForeignExchangeRate.map((item: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{formatDateSafe(item.date, "dd MMM yyyy")}</TableCell>
                        <TableCell>{item.typeOfCurrency}</TableCell>
                        <TableCell className="text-right">{formatNumberSafe(item.sellingRateTTOD, 4)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          {/* Financial Summary */}
          <section>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
              <Building className="print:hidden" /> Financial Summary
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:gap-2">
              <DetailItem label="Total Advance Claim Amount" value={formatCurrencyForTable(financialSummary?.totalAdvanceClaimAmount)} />
              <DetailItem label="Less Advance Taken" value={formatCurrencyForTable(financialSummary?.lessAdvanceTaken)} />
              <DetailItem label="Less Corporate Credit Card Payment" value={formatCurrencyForTable(financialSummary?.lessCorporateCreditCardPayment)} />
              <DetailItem label="Balance Claim/Repayment" value={formatCurrencyForTable(financialSummary?.balanceClaimRepayment)} />
              <div className="sm:col-span-2 flex justify-between items-center">
                <div className="font-medium text-xs text-muted-foreground uppercase tracking-wider print:text-[8pt] print:font-semibold">Cheque/Receipt No.</div>
                <div className="text-sm text-foreground break-words mt-0.5 print:text-[9pt]">{financialSummary?.chequeReceiptNo || ""}</div>
              </div>
            </div>
          </section>

          {/* Reimbursement Details (for processed claims) */}
          {claim?.status === 'Processed' && (
            <section>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
                <CheckCircle className="print:hidden" /> Reimbursement Details
              </h3>
              {claim?.reimbursementDetails ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:gap-2 bg-green-50 p-4 rounded-lg border border-green-200">
                  <DetailItem label="Payment Method" value={claim.reimbursementDetails.paymentMethod} />
                  <DetailItem label="Payment Date" value={claim.reimbursementDetails.paymentDate} />
                  <DetailItem label="Amount Paid" value={formatNumberSafe(claim.reimbursementDetails.amountPaid)} />
                  <DetailItem label="Tax Deducted" value={formatNumberSafe(claim.reimbursementDetails.taxDeducted)} />
                  <DetailItem label="Net Amount" value={formatNumberSafe(claim.reimbursementDetails.netAmount)} />
                  {claim.reimbursementDetails.bankTransferReference && (
                    <DetailItem label="Bank Transfer Reference" value={claim.reimbursementDetails.bankTransferReference} fullWidth />
                  )}
                  {claim.reimbursementDetails.chequeNumber && (
                    <DetailItem label="Cheque Number" value={claim.reimbursementDetails.chequeNumber} fullWidth />
                  )}
                  {claim.reimbursementDetails.verifiedBy && (
                    <DetailItem label="Verified By" value={claim.reimbursementDetails.verifiedBy} />
                  )}
                  {claim.reimbursementDetails.authorizedBy && (
                    <DetailItem label="Authorized By" value={claim.reimbursementDetails.authorizedBy} />
                  )}
                  {claim.reimbursementDetails.processingNotes && (
                    <DetailItem label="Processing Notes" value={claim.reimbursementDetails.processingNotes} fullWidth />
                  )}
                </div>
              ) : (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700 font-medium">✅ This claim has been processed and completed.</p>
                  <p className="text-xs text-green-600 mt-1">Reimbursement details are being finalized. Please contact Claims Admin for specific payment information.</p>
                </div>
              )}
            </section>
          )}

          {/* Declaration */}
          <section>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
              <Info className="print:hidden" /> Declaration
            </h3>
            <div className="grid grid-cols-1 gap-4 print:gap-2">
              <DetailItem 
                label="Declaration Status" 
                value={declaration?.iDeclare ? "Declared" : "Not Declared"} 
              />
              <DetailItem 
                label="Declaration Date" 
                value={formatDateSafe(declaration?.date)} 
              />
              <div className="text-xs text-muted-foreground mt-2 border-t pt-2">
                <p className="font-semibold">Declaration Statement:</p>
                <p className="mt-1">
                  I hereby declare that all of the information provided in the Claim Form, as well as all of the information contained in the supporting documents and materials are true and complete.
                  I understand that any false, fraudulent, or incomplete information on this Claim Form and the related supporting documents may serve as grounds for disciplinary action.
                </p>
              </div>
            </div>
          </section>

          {/* Approval Workflow */}
          {claim?.approvalWorkflow && claim.approvalWorkflow.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
                <CheckCircle className="print:hidden" /> Approval Workflow
              </h3>
              <div className="space-y-4">
                {claim.approvalWorkflow.map((step: any, index: number) => (
                  <WorkflowStep 
                    key={index} 
                    step={step} 
                    index={index} 
                    formatDateSafe={formatDateSafe}
                    showStatusBadge={true}
                  />
                ))}
              </div>
            </section>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
