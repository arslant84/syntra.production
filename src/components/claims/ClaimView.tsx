
"use client";

import React from 'react';
import type { ExpenseClaim, ExpenseItem, ForeignExchangeRate } from '@/types/claims';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { UserSquare, Banknote, Stethoscope, Briefcase, Globe, Info, Award, CalendarDays, SquarePen, Fingerprint } from "lucide-react";
import Image from 'next/image'; // For Petronas Logo

interface ClaimViewProps {
  claimData: ExpenseClaim;
}

const formatDateSafe = (date: Date | string | null | undefined, dateFormat = "PPP") => {
  if (!date) return "N/A";
  const d = typeof date === 'string' ? new Date(date) : date;
  return isValid(d) ? format(d, dateFormat) : "Invalid Date";
};

const formatTimeSafe = (timeStr: string | null | undefined) => {
  if (!timeStr || !/^[0-2]\d:[0-5]\d$/.test(timeStr)) return "N/A";
  const [hours, minutes] = timeStr.split(':');
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes));
  return format(date, "p"); 
};

const formatNumberSafe = (num: string | number | null | undefined, digits = 2) => {
  if (num === null || num === undefined || num === '') return "0.00"; // Default to 0.00 for display consistency in financial contexts
  const parsedNum = Number(num);
  return isNaN(parsedNum) ? "0.00" : parsedNum.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
};


const DetailItem: React.FC<{ label: string; value?: string | number | boolean | null; className?: string; valueClassName?: string; labelCols?: string; valueCols?: string; isCheckbox?: boolean; checked?: boolean }> = 
  ({ label, value, className, valueClassName, labelCols="sm:col-span-1", valueCols="sm:col-span-2", isCheckbox, checked }) => {
  
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === "" && !isCheckbox)) {
    // Don't skip if it's a checkbox, as we want to show its state
    // return null; 
  }
  
  return (
    <div className={cn("flex flex-col py-1 border-b border-dashed border-muted last:border-b-0", className)}>
      <span className={cn("text-xs font-medium text-muted-foreground uppercase", labelCols)}>{label}</span>
      {isCheckbox ? (
        <Checkbox checked={!!checked} disabled className={cn("mt-1 h-5 w-5", valueClassName)} />
      ) : (
        <span className={cn("text-sm text-foreground break-words", valueCols, valueClassName)}>
          {String(value === "" ? "N/A" : value)}
        </span>
      )}
    </div>
  );
};

// Mimic the structure of the PDF header
const ClaimFormHeader: React.FC<{claim: ExpenseClaim}> = ({claim}) => (
  <div className="mb-4 p-4 border rounded-lg bg-slate-50 print:bg-white">
    <div className="flex justify-between items-start mb-3">
        <div className="w-1/4">
             {/* Using a placeholder for the logo as next/image might cause issues in this context without proper setup */}
             <img src="https://placehold.co/150x50.png?text=PETRONAS&font=roboto" alt="Petronas Logo" className="h-12" data-ai-hint="company logo" />
        </div>
        <div className="flex-grow text-center">
            <h2 className="text-xl font-bold uppercase text-primary">STAFF</h2>
            <h1 className="text-2xl font-extrabold uppercase text-primary tracking-wider">EXPENSE CLAIM</h1>
            <h2 className="text-xl font-bold uppercase text-primary">FORM</h2>
        </div>
        <div className="w-1/4 text-right text-xs">
            <p>For Internal Use Only</p>
            <p>Appendix № 1</p>
        </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4">
      <div className="md:col-span-1 space-y-2 mb-4 md:mb-0 p-2 border-r border-muted">
        <DetailItem label="Bank" value={claim.bankDetails.bankName} />
        <DetailItem label="Name & Address" value={"Details usually on TSR/User Profile"} /> {/* Placeholder as not in form */}
        <DetailItem label="Purpose of Claim" value={claim.bankDetails.purposeOfClaim} />
      </div>
      <div className="md:col-span-2 grid grid-cols-2 gap-x-4 gap-y-1 p-2">
        <div className="col-span-1 text-sm font-medium text-muted-foreground">DOCUMENT</div>
        <div className="col-span-1 text-sm font-medium">{claim.headerDetails.documentType || "N/A"}</div>
        
        <div className="col-span-1 text-sm font-medium text-muted-foreground">NUMBER</div>
        <div className="col-span-1 text-sm font-medium">{claim.headerDetails.documentNumber || "N/A"}</div>

        <div className="col-span-1 text-sm font-medium text-muted-foreground">STAFF NAME:</div>
        <div className="col-span-1 text-sm font-medium">{claim.headerDetails.staffName}</div>

        <div className="col-span-2 my-1">
          <span className="text-xs text-muted-foreground">Select whichever is applicable:</span>
          <div className="flex gap-4 mt-0.5">
            <span className={cn("text-sm", claim.headerDetails.staffType === "PERMANENT STAFF" ? "font-semibold text-primary" : "")}>PERMANENT STAFF</span>
            <span className={cn("text-sm", claim.headerDetails.staffType === "CONTRACT STAFF" ? "font-semibold text-primary" : "")}>CONTRACT STAFF</span>
          </div>
           <div className="flex gap-4 mt-0.5">
            <span className={cn("text-sm", claim.headerDetails.executiveStatus === "EXECUTIVE" ? "font-semibold text-primary" : "")}>EXECUTIVE</span>
            <span className={cn("text-sm", claim.headerDetails.executiveStatus === "NON-EXECUTIVE" ? "font-semibold text-primary" : "")}>NON-EXECUTIVE</span>
          </div>
        </div>
        
        <div className="col-span-1 text-sm font-medium text-muted-foreground">STAFF NO:</div>
        <div className="col-span-1 text-sm font-medium">{claim.headerDetails.staffNo}</div>
        <div className="col-span-1 text-sm font-medium text-muted-foreground">GRED:</div>
        <div className="col-span-1 text-sm font-medium">{claim.headerDetails.gred}</div>

        <div className="col-span-1 text-sm font-medium text-muted-foreground">*DEPARTMENT CODE:</div>
        <div className="col-span-1 text-sm font-medium">{claim.headerDetails.departmentCode}</div>
        <div className="col-span-1 text-sm font-medium text-muted-foreground">DEPT COST CENTER CODE:</div>
        <div className="col-span-1 text-sm font-medium">{claim.headerDetails.deptCostCenterCode}</div>

        <div className="col-span-1 text-sm font-medium text-muted-foreground">LOCATION:</div>
        <div className="col-span-1 text-sm font-medium">{claim.headerDetails.location}</div>
        <div className="col-span-1 text-sm font-medium text-muted-foreground">TEL/EXT:</div>
        <div className="col-span-1 text-sm font-medium">{claim.headerDetails.telExt}</div>
        
        <div className="col-span-1 text-sm font-medium text-muted-foreground">CLAIM FOR THE MONTH OF:</div>
        <div className="col-span-1 text-sm font-medium">{formatDateSafe(claim.headerDetails.claimForMonthOf, "MMMM yyyy")}</div>
        
        <div className="col-span-2 text-sm font-medium text-muted-foreground mt-2">1. Start time from home to destination: <span className="text-foreground font-normal">{formatTimeSafe(claim.headerDetails.startTimeFromHome)}</span></div>
        <div className="col-span-2 text-sm font-medium text-muted-foreground">2. Time of arrival at home from official duty: <span className="text-foreground font-normal">{formatTimeSafe(claim.headerDetails.timeOfArrivalAtHome)}</span></div>
      </div>
    </div>
  </div>
);


export default function ClaimView({ claimData }: ClaimViewProps) {
  const { headerDetails, bankDetails, medicalClaimDetails, expenseItems, informationOnForeignExchangeRate, financialSummary, declaration } = claimData;

  const totalMileage = expenseItems.reduce((acc, item) => acc + (Number(item.officialMileageKM) || 0), 0);
  const totalTransport = expenseItems.reduce((acc, item) => acc + (Number(item.transport) || 0), 0);
  const totalHotel = expenseItems.reduce((acc, item) => acc + (Number(item.hotelAccommodationAllowance) || 0), 0);
  const totalOutstation = expenseItems.reduce((acc, item) => acc + (Number(item.outStationAllowanceMeal) || 0), 0);
  const totalMisc = expenseItems.reduce((acc, item) => acc + (Number(item.miscellaneousAllowance10Percent) || 0), 0);
  const totalOther = expenseItems.reduce((acc, item) => acc + (Number(item.otherExpenses) || 0), 0);

  return (
    <div className="space-y-6 p-2 print:p-0">
      <ClaimFormHeader claim={claimData} />

      {/* Medical Claim Details */}
      {medicalClaimDetails.isMedicalClaim && (
        <Card className="print:shadow-none print:border-none">
          <CardHeader className="print:pb-2"><CardTitle className="flex items-center gap-2 print:text-base"><Stethoscope /> Medical Claim Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 print:p-2">
            <DetailItem label="Applicable Medical Type" value={medicalClaimDetails.applicableMedicalType || "N/A"} />
            <DetailItem label="For Family?" value={medicalClaimDetails.isForFamily ? "Yes" : "No"} />
            {medicalClaimDetails.isForFamily && (
              <>
                <DetailItem label="Spouse" isCheckbox checked={medicalClaimDetails.familyMemberSpouse} />
                <DetailItem label="Children" isCheckbox checked={medicalClaimDetails.familyMemberChildren} />
                <DetailItem label="Other Family Member" value={medicalClaimDetails.familyMemberOther || "N/A"} />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Expense Items Table */}
      <Card className="print:shadow-none print:border-none">
        <CardHeader className="print:pb-2"><CardTitle className="flex items-center gap-2 print:text-base"><Briefcase /> Expense Details (Original Currency)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto print:p-0">
          <Table className="print:text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[100px] print:p-1">Date(s)</TableHead>
                <TableHead className="min-w-[200px] print:p-1">Claim or Travel Details (From - To / The Place of Stay)</TableHead>
                <TableHead className="min-w-[100px] text-center print:p-1">Official Mileage (KM) (B)</TableHead>
                <TableHead className="min-w-[100px] text-right print:p-1">Transport (C)</TableHead>
                <TableHead className="min-w-[120px] text-right print:p-1">Hotel Accom. Allowance (D)</TableHead>
                <TableHead className="min-w-[120px] text-right print:p-1">Out-Station Allowance (Meal) (E)</TableHead>
                <TableHead className="min-w-[120px] text-right print:p-1">Misc. Allowance (10%) (F)</TableHead>
                <TableHead className="min-w-[100px] text-right print:p-1">Other Expenses (G)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenseItems.map((item, index) => (
                <TableRow key={item.id || index}>
                  <TableCell className="print:p-1">{formatDateSafe(item.date)}</TableCell>
                  <TableCell className="print:p-1">{item.claimOrTravelDetails}</TableCell>
                  <TableCell className="text-center print:p-1">{formatNumberSafe(item.officialMileageKM, 0)}</TableCell>
                  <TableCell className="text-right print:p-1">{formatNumberSafe(item.transport)}</TableCell>
                  <TableCell className="text-right print:p-1">{formatNumberSafe(item.hotelAccommodationAllowance)}</TableCell>
                  <TableCell className="text-right print:p-1">{formatNumberSafe(item.outStationAllowanceMeal)}</TableCell>
                  <TableCell className="text-right print:p-1">{formatNumberSafe(item.miscellaneousAllowance10Percent)}</TableCell>
                  <TableCell className="text-right print:p-1">{formatNumberSafe(item.otherExpenses)}</TableCell>
                </TableRow>
              ))}
              {/* Totals Row */}
              <TableRow className="bg-muted/50 font-semibold print:bg-slate-100">
                <TableCell colSpan={2} className="text-right print:p-1">TOTAL</TableCell>
                <TableCell className="text-center print:p-1">{formatNumberSafe(totalMileage, 0)}</TableCell>
                <TableCell className="text-right print:p-1">{formatNumberSafe(totalTransport)}</TableCell>
                <TableCell className="text-right print:p-1">{formatNumberSafe(totalHotel)}</TableCell>
                <TableCell className="text-right print:p-1">{formatNumberSafe(totalOutstation)}</TableCell>
                <TableCell className="text-right print:p-1">{formatNumberSafe(totalMisc)}</TableCell>
                <TableCell className="text-right print:p-1">{formatNumberSafe(totalOther)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Foreign Exchange Rate & Financial Summary (Combined for layout) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 print:grid-cols-5">
        <div className={cn("md:col-span-3 print:col-span-3", informationOnForeignExchangeRate.length === 0 && "hidden print:hidden")}>
           {informationOnForeignExchangeRate.length > 0 && (
            <Card className="h-full print:shadow-none print:border-none">
              <CardHeader className="print:pb-2"><CardTitle className="flex items-center gap-2 print:text-base"><Globe /> Foreign Exchange Rate</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto print:p-0">
                <Table className="print:text-xs">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="print:p-1">Date</TableHead>
                      <TableHead className="print:p-1">Type of Currency</TableHead>
                      <TableHead className="text-right print:p-1">Selling Rate TT/OD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {informationOnForeignExchangeRate.map((fx, index) => (
                      <TableRow key={fx.id || index}>
                        <TableCell className="print:p-1">{formatDateSafe(fx.date)}</TableCell>
                        <TableCell className="print:p-1">{fx.typeOfCurrency}</TableCell>
                        <TableCell className="text-right print:p-1">{formatNumberSafe(fx.sellingRateTTOD, 4)}</TableCell>
                      </TableRow>
                    ))}
                    {/* Add empty rows to match PDF structure if needed */}
                    {Array.from({ length: Math.max(0, 5 - informationOnForeignExchangeRate.length) }).map((_, i) => (
                        <TableRow key={`empty-fx-${i}`} className="h-[34px] print:h-[28px]">
                            <TableCell className="print:p-1">&nbsp;</TableCell><TableCell className="print:p-1"></TableCell><TableCell className="print:p-1"></TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
        
        <div className={cn("md:col-span-2 print:col-span-2", informationOnForeignExchangeRate.length === 0 && "md:col-start-4 print:col-start-4")}>
          <Card className="h-full print:shadow-none print:border-none">
            <CardHeader className="print:pb-2"><CardTitle className="flex items-center gap-2 print:text-base"><Banknote /> Financial Summary</CardTitle></CardHeader>
            <CardContent className="space-y-1 print:p-2 print:text-xs">
              <DetailItem label="Total Advance/Claim Amount" value={formatNumberSafe(financialSummary.totalAdvanceClaimAmount)} valueClassName="text-right font-semibold" />
              <DetailItem label="Less: Advance Taken" value={formatNumberSafe(financialSummary.lessAdvanceTaken)} valueClassName="text-right" />
              <DetailItem label="Less: Corporate Credit Card Payment" value={formatNumberSafe(financialSummary.lessCorporateCreditCardPayment)} valueClassName="text-right" />
              <DetailItem label="Balance of Claim/Repayment (Cheque/Receipt No.)" value={`${formatNumberSafe(financialSummary.balanceClaimRepayment)} (${financialSummary.chequeReceiptNo || "N/A"})`} valueClassName="text-right font-bold" />
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Declaration, Signatures, and Notes */}
      <Card className="print:shadow-none print:border-none">
        <CardHeader className="print:pb-2"><CardTitle className="flex items-center gap-2 print:text-base"><Info /> Declaration & Notes</CardTitle></CardHeader>
        <CardContent className="space-y-4 print:p-2">
          <div className="border p-3 rounded-md bg-muted/20 print:border-gray-300 print:bg-white">
            <div className="flex items-start space-x-2">
              <Checkbox id="declarationView" checked={declaration.iDeclare} disabled className="mt-1" />
              <label htmlFor="declarationView" className="text-xs text-foreground">
                I hereby declare that all of the information provided in the Claim Form, as well as all of the information contained in the supporting documents and materials are true and complete.
                I understand that any false, fraudulent, or incomplete information on this Claim Form and the related supporting documents may serve as grounds for disciplinary action.
                I am fully aware of the requirements of the related PC(T)SB HR Policies and Orders, and hereby certify that all of the supporting documents are in compliance with the requirements of related company Policies.
                PC(T)SB reserves the right to check submitted Claim Form and Supporting Documents at any time.
                Should there be any false, fraudulent or incomplete information and/or documentation originating from the Claims Form(a), PC(T)SB reserves the right to recover from the Employee any/all sums that has been paid out.
              </label>
            </div>
            <div className="mt-2 pl-6 text-xs"><strong>Date:</strong> {formatDateSafe(declaration.date)}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 print:text-xs">
            <div className="border-t-2 border-muted-foreground pt-1">
              <DetailItem label="Signature" value="(Digital Signature Placeholder)" valueClassName="italic text-muted-foreground" />
              <DetailItem label="Date" value={formatDateSafe(declaration.date)} />
            </div>
            <div className="border-t-2 border-muted-foreground pt-1">
              <DetailItem label="Verified By (LINE MANAGER)" value="(Verification Placeholder)" valueClassName="italic text-muted-foreground" />
               <DetailItem label="Date" value={"(Pending Verification)"} />
            </div>
            <div className="border-t-2 border-muted-foreground pt-1">
              <DetailItem label="Approved By (HOD)" value={"(Approval Placeholder)"} valueClassName="italic text-muted-foreground" />
              <DetailItem label="Date" value={"(Pending Approval)"} />
            </div>
          </div>
          
          <div className="mt-4 text-xs text-muted-foreground space-y-0.5 print:text-[8px]">
            <p>(REV 3/93) *Please see the terms and conditions on next page.</p>
            <p>1) The approved expenses claim form in accordance to the LOA shall be submitted to Finance & Accounts Dept together with all supporting documents including original receipts, official bills, air fare tickets, boarding pass and others.</p>
            <p>2) Incomplete expense claim form shall be returned to the staff.</p>
            <p>3) Finance & Accounts Dept shall effect salary deduction without notifying relevant staff if she/he does not submit her/his claim within seven (7) working days from return after completion of official duty.</p>
            <p>4) Claim must be approved by Departmental Manager in accordance to terms and conditions as stated in the related "HUMAN RESOURCE MANAGEMENT POLICIES AND OPERATING PROCEDURES MANUAL/ORDERS" or relevant circulars issued out by the Human Resource Department from time to time.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
