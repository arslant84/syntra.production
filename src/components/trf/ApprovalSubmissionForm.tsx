"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import ApprovalWorkflow from "./ApprovalWorkflow";
import type { TravelRequestForm, ApprovalSubmissionData, ApprovalStep, ItinerarySegment, AccommodationDetail, ExternalPartyAccommodationDetail, CompanyTransportDetail, AdvanceAmountRequestedItem } from "@/types/trf";
import { format, isValid } from "date-fns";
import { FileCheck2, ClipboardList, Utensils, Bed, Car, UserCircle, CalendarDays, Landmark, CreditCard, FileText as PurposeIcon, Building, Globe, Home as HomeIcon, Users } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import React, { useEffect } from 'react'; 


const approvalSchemaBase = z.object({
  additionalComments: z.string().optional(),
  confirmPolicy: z.boolean().refine(val => val === true, {
    message: "You must confirm compliance with travel policy.",
  }),
  confirmManagerApproval: z.boolean().refine(val => val === true, {
    message: "You must acknowledge manager approval requirement.",
  }),
});

// Conditional schema for overseas terms
const approvalSchema = approvalSchemaBase.extend({
  confirmTermsAndConditions: z.boolean().optional(),
});


interface ApprovalSubmissionFormProps {
  trfData: TravelRequestForm; 
  approvalWorkflowSteps: ApprovalStep[];
  onSubmit: (data: ApprovalSubmissionData) => void;
  onBack: () => void;
  isEditMode?: boolean;
  initialData?: ApprovalSubmissionData;
}

const formatDateSafe = (date: Date | string | null | undefined, dateFormat = "PPP") => {
  if (!date) return "N/A";
  const d = typeof date === 'string' ? new Date(date) : date;
  return isValid(d) ? format(d, dateFormat) : "Invalid Date";
};

const formatTimeSafe = (timeStr: string | null | undefined) => {
  if (!timeStr || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr)) return "N/A";
  const [hours, minutes] = timeStr.split(':');
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes));
  return format(date, "p"); 
};

const formatNumberSafe = (num: number | string | null | undefined, digits = 0) => {
  if (num === null || num === undefined || String(num).trim() === '') return "N/A"; 
  const parsedNum = Number(num);
  return isNaN(parsedNum) ? String(num) : parsedNum.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}


export default function ApprovalSubmissionForm({ 
  trfData, 
  approvalWorkflowSteps, 
  onSubmit, 
  onBack, 
  isEditMode = false,
  initialData 
}: ApprovalSubmissionFormProps) {
  const isInternationalStyleTravel = trfData.travelType === 'Overseas' || trfData.travelType === 'Home Leave Passage';
  const isExternalPartyTravel = trfData.travelType === 'External Parties';

  const form = useForm({
    resolver: zodResolver(
      approvalSchemaBase.extend({
        confirmTermsAndConditions: isInternationalStyleTravel 
          ? z.boolean().refine(val => val === true, { message: "You must agree to the terms and conditions for this travel type."}) 
          : z.boolean().optional(),
      })
    ) as any,
    defaultValues: initialData || {
      additionalComments: trfData.additionalComments || "",
      confirmPolicy: false, // Default to false, user must re-confirm on edit/submit
      confirmManagerApproval: false, // Default to false
      confirmTermsAndConditions: isInternationalStyleTravel ? false : undefined,
    },
  }) as any;
  
  useEffect(() => {
    if (initialData) {
      form.reset({
        additionalComments: initialData.additionalComments || "",
        confirmPolicy: initialData.confirmPolicy || false,
        confirmManagerApproval: initialData.confirmManagerApproval || false,
        confirmTermsAndConditions: isInternationalStyleTravel ? (initialData.confirmTermsAndConditions || false) : undefined,
      });
    } else { // For new forms or if initialData is not fully provided
        form.reset({
            additionalComments: trfData.additionalComments || "",
            confirmPolicy: false,
            confirmManagerApproval: false,
            confirmTermsAndConditions: isInternationalStyleTravel ? false : undefined,
        });
    }
  }, [initialData, form, isInternationalStyleTravel, trfData.additionalComments]);


  const renderDetail = (label: string, value: any, fullWidth = false) => (
    value || typeof value === 'number' || typeof value === 'boolean'? (
      <div className={cn(fullWidth && "col-span-full")}>
        <p className="text-sm font-medium text-muted-foreground">{label}:</p>
        <p className="text-sm text-foreground break-words">{String(value)}</p>
      </div>
    ) : null
  );
  
  const domesticDetails = trfData.domesticTravelDetails;
  const overseasDetails = trfData.overseasTravelDetails;
  const externalPartiesDetails = trfData.externalPartiesTravelDetails;
  const externalPartyRequestor = trfData.externalPartyRequestorInfo;

  const getTravelTypeIcon = () => {
    switch (trfData.travelType) {
      case 'Domestic': return <Building className="w-4 h-4" />;
      case 'Overseas': return <Globe className="w-4 h-4" />;
      case 'Home Leave Passage': return <HomeIcon className="w-4 h-4" />;
      case 'External Parties': return <Users className="w-4 h-4" />;
      default: return null;
    }
  };
  
  const getSubmitButtonText = () => {
    const action = isEditMode ? "Update" : "Submit";
    let typeText = trfData.travelType || "Travel";
    if (trfData.travelType === "Home Leave Passage") typeText = "Home Leave";
    else if (trfData.travelType === "External Parties") typeText = "External Party";
    return `${action} ${typeText} Request`;
  };


  return (
    <div className="w-full space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="bg-muted/10">
          <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
              <FileCheck2 className="w-6 h-6 md:w-7 md:w-7 text-primary"/>
              Approval &amp; Submission
          </CardTitle>
          <CardDescription>Review your travel request details and submit for approval.</CardDescription>
        </CardHeader>
      </Card>
      
      <Card className="bg-slate-50 dark:bg-slate-800/50 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Travel Request Summary</CardTitle>
          <CardDescription className="flex items-center gap-1">
            Type: {getTravelTypeIcon()} {trfData.travelType}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          
          <section>
            <h3 className="text-md font-semibold mb-3 flex items-center gap-2 text-primary">
              {isExternalPartyTravel ? <Users /> : <UserCircle />}
              {isExternalPartyTravel ? "External Party Details" : "Employee Details"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 p-3 border rounded-md bg-white dark:bg-slate-700/30 shadow-sm">
              {isExternalPartyTravel && externalPartyRequestor ? (
                <>
                  {renderDetail("Full Name", externalPartyRequestor.externalFullName)}
                  {renderDetail("Organization/Entity", externalPartyRequestor.externalOrganization)}
                  {renderDetail("Ref. to Authority Letter", externalPartyRequestor.externalRefToAuthorityLetter)}
                  {renderDetail("Cost Center", externalPartyRequestor.externalCostCenter)}
                </>
              ) : (
                <>
                  {renderDetail("Requestor Name", trfData.requestorName)}
                  {renderDetail("Staff ID", trfData.staffId)}
                  {renderDetail("Department & Position", trfData.department ? `${trfData.department}${trfData.position ? ` / ${trfData.position}` : ''}` : 'N/A')}
                  {renderDetail("Dept. Cost Centre", trfData.costCenter)}
                  {renderDetail("Tel. Ext. & E-Mail", trfData.telEmail)}
                </>
              )}
            </div>
          </section>
          
          {(domesticDetails || overseasDetails || externalPartiesDetails) && (
            <>
              <Separator />
              <section>
                <h3 className="text-md font-semibold mb-3 flex items-center gap-2 text-primary"><PurposeIcon /> Purpose of Travel</h3>
                 <div className="p-3 border rounded-md bg-white dark:bg-slate-700/30 shadow-sm">
                    <p className="whitespace-pre-wrap text-sm">{domesticDetails?.purpose || overseasDetails?.purpose || externalPartiesDetails?.purpose || "N/A"}</p>
                 </div>
              </section>
              <Separator />
              
              {(domesticDetails?.itinerary || overseasDetails?.itinerary || externalPartiesDetails?.itinerary) && 
               ((domesticDetails?.itinerary?.length ?? 0) > 0 || (overseasDetails?.itinerary?.length ?? 0) > 0 || (externalPartiesDetails?.itinerary?.length ?? 0) > 0) && (
                <section>
                  <h3 className="text-md font-semibold mb-3 flex items-center gap-2 text-primary"><ClipboardList /> Itinerary</h3>
                  {(domesticDetails?.itinerary || overseasDetails?.itinerary || externalPartiesDetails?.itinerary)?.map((segment: ItinerarySegment, index: number) => (
                    <div key={segment.id || index} className="mb-3 p-3 border rounded-md bg-white dark:bg-slate-700/30 shadow-sm">
                      <h4 className="font-medium text-sm mb-1.5 text-muted-foreground">Segment {index + 1}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                        {renderDetail("Date", formatDateSafe(segment.date))}
                        {renderDetail("Day", segment.day)}
                        {renderDetail("From", segment.from)}
                        {renderDetail("To", segment.to)}
                        {renderDetail("ETD", formatTimeSafe(segment.etd))}
                        {renderDetail("ETA", formatTimeSafe(segment.eta))}
                        {renderDetail(isInternationalStyleTravel ? "Flight/Class" : "Flight/Rein", segment.flightNumber)}
                      </div>
                      {renderDetail("Remarks", typeof segment.remarks === 'object' ? JSON.stringify(segment.remarks) : (segment.remarks || "N/A"), true)}
                    </div>
                  ))}
                </section>
              )}
              {(domesticDetails?.itinerary || overseasDetails?.itinerary || externalPartiesDetails?.itinerary) && <Separator />}

              {/* Domestic & External Parties: Meal Provision */}
              {(domesticDetails?.mealProvision?.dailyMealSelections?.length > 0 || externalPartiesDetails?.mealProvision?.dailyMealSelections?.length > 0) && (trfData.travelType === 'Domestic' || trfData.travelType === 'External Parties') && (
                <section>
                  <h3 className="text-md font-semibold mb-3 flex items-center gap-2 text-primary"><Utensils /> Meal Provision (Kiyanly)</h3>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-muted-foreground">Daily Meal Selections:</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-center">Breakfast</TableHead>
                          <TableHead className="text-center">Lunch</TableHead>
                          <TableHead className="text-center">Dinner</TableHead>
                          <TableHead className="text-center">Supper</TableHead>
                          <TableHead className="text-center">Refreshment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(domesticDetails?.mealProvision?.dailyMealSelections || externalPartiesDetails?.mealProvision?.dailyMealSelections)?.map((dailyMeal: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {formatDateSafe(dailyMeal.meal_date, "EEE, MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-center">
                              {dailyMeal.breakfast ? "✅" : "❌"}
                            </TableCell>
                            <TableCell className="text-center">
                              {dailyMeal.lunch ? "✅" : "❌"}
                            </TableCell>
                            <TableCell className="text-center">
                              {dailyMeal.dinner ? "✅" : "❌"}
                            </TableCell>
                            <TableCell className="text-center">
                              {dailyMeal.supper ? "✅" : "❌"}
                            </TableCell>
                            <TableCell className="text-center">
                              {dailyMeal.refreshment ? "✅" : "❌"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    
                    {/* Summary totals */}
                    <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-md border">
                      <h5 className="font-medium text-sm text-muted-foreground mb-2">Summary Totals:</h5>
                      <div className="grid grid-cols-5 gap-4 text-sm">
                        {(['breakfast', 'lunch', 'dinner', 'supper', 'refreshment'] as const).map((mealType) => {
                          const count = (domesticDetails?.mealProvision?.dailyMealSelections || externalPartiesDetails?.mealProvision?.dailyMealSelections)?.reduce((acc: number, dailyMeal: any) => {
                            return acc + (dailyMeal[mealType] ? 1 : 0);
                          }, 0) || 0;
                          return (
                            <div key={mealType} className="text-center">
                              <div className="font-medium capitalize">{mealType}</div>
                              <div className="text-lg font-bold text-primary">{count}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>
              )}
              {(domesticDetails?.mealProvision?.dailyMealSelections?.length > 0 || externalPartiesDetails?.mealProvision?.dailyMealSelections?.length > 0) && (trfData.travelType === 'Domestic' || trfData.travelType === 'External Parties') && <Separator />}

              {/* Domestic Accommodation */}
              {domesticDetails?.accommodationDetails && domesticDetails.accommodationDetails.length > 0 && trfData.travelType === 'Domestic' && (
                <section>
                  <h3 className="text-md font-semibold mb-3 flex items-center gap-2 text-primary"><Bed /> Accommodation</h3>
                  {domesticDetails.accommodationDetails.map((acc: AccommodationDetail, index: number) => (
                    <div key={acc.id || index} className="mb-3 p-3 border rounded-md bg-white dark:bg-slate-700/30 shadow-sm">
                      <h4 className="font-medium text-sm mb-1.5 text-muted-foreground">Entry {index + 1}</h4>
                       <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                        {renderDetail("Type", acc.accommodationType)}
                        {acc.accommodationType === 'Other' && renderDetail("Other Type", acc.otherTypeDescription)}
                        {renderDetail("Check-in Date", formatDateSafe(acc.checkInDate))}
                        {renderDetail("Check-in Time", formatTimeSafe(acc.checkInTime))}
                        {renderDetail("Check-out Date", formatDateSafe(acc.checkOutDate))}
                        {renderDetail("Check-out Time", formatTimeSafe(acc.checkOutTime))}
                      </div>
                      {renderDetail("Remarks", typeof acc.remarks === 'object' ? JSON.stringify(acc.remarks) : (acc.remarks || "N/A"), true)}
                    </div>
                  ))}
                </section>
              )}
              {domesticDetails?.accommodationDetails && domesticDetails.accommodationDetails.length > 0 && trfData.travelType === 'Domestic' && <Separator />}
              
              {/* External Parties Accommodation */}
              {externalPartiesDetails?.accommodationDetails && externalPartiesDetails.accommodationDetails.length > 0 && trfData.travelType === 'External Parties' && (
                <section>
                  <h3 className="text-md font-semibold mb-3 flex items-center gap-2 text-primary"><Bed /> Accommodation</h3>
                  {externalPartiesDetails.accommodationDetails.map((acc: ExternalPartyAccommodationDetail, index: number) => (
                    <div key={acc.id || index} className="mb-3 p-3 border rounded-md bg-white dark:bg-slate-700/30 shadow-sm">
                      <h4 className="font-medium text-sm mb-1.5 text-muted-foreground">Entry {index + 1}</h4>
                       <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                        {renderDetail("Check-in Date", formatDateSafe(acc.checkInDate))}
                        {renderDetail("Check-out Date", formatDateSafe(acc.checkOutDate))}
                        {renderDetail("Place of Stay", acc.placeOfStay)}
                        {renderDetail("Est. cost per night", formatNumberSafe(acc.estimatedCostPerNight, 2))}
                      </div>
                       {renderDetail("Remarks", typeof acc.remarks === 'object' ? JSON.stringify(acc.remarks) : (acc.remarks || "N/A"), true)}
                    </div>
                  ))}
                </section>
              )}
              {externalPartiesDetails?.accommodationDetails && externalPartiesDetails.accommodationDetails.length > 0 && trfData.travelType === 'External Parties' && <Separator />}


              {/* Domestic Company Transportation */}
              {domesticDetails?.companyTransportDetails && domesticDetails.companyTransportDetails.length > 0 && trfData.travelType === 'Domestic' && (
                <section>
                  <h3 className="text-md font-semibold mb-3 flex items-center gap-2 text-primary"><Car /> Company Transportation</h3>
                  {domesticDetails.companyTransportDetails.map((transport: CompanyTransportDetail, index: number) => (
                    <div key={transport.id || index} className="mb-3 p-3 border rounded-md bg-white dark:bg-slate-700/30 shadow-sm">
                      <h4 className="font-medium text-sm mb-1.5 text-muted-foreground">Transport Request {index + 1}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                        {renderDetail("Date", formatDateSafe(transport.date))}
                        {renderDetail("Day", transport.day)}
                        {renderDetail("From", transport.from)}
                        {renderDetail("To", transport.to)}
                        {renderDetail("BT No (if req)", transport.btNoRequired)}
                        {renderDetail("Accom. Type/N", transport.accommodationTypeN)}
                        {renderDetail("Address", transport.address)}
                      </div>
                      {renderDetail("Remarks", typeof transport.remarks === 'object' ? JSON.stringify(transport.remarks) : (transport.remarks || "N/A"), true)}
                    </div>
                  ))}
                </section>
              )}
              {domesticDetails?.companyTransportDetails && domesticDetails.companyTransportDetails.length > 0 && trfData.travelType === 'Domestic' && <Separator />}

              {/* Overseas & Home Leave Specific Sections */}
              {overseasDetails && isInternationalStyleTravel && (
                <section>
                  <h3 className="text-md font-semibold mb-3 flex items-center gap-2 text-primary"><Landmark /> Advance Form</h3>
                  <div className="p-3 border rounded-md bg-white dark:bg-slate-700/30 shadow-sm space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-1.5 text-muted-foreground">Bank Details</h4>
                      {renderDetail("Bank Name", overseasDetails.advanceBankDetails.bankName)}
                      {renderDetail("Account Number", overseasDetails.advanceBankDetails.accountNumber)}
                    </div>
                    {overseasDetails.advanceAmountRequested.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-1.5 text-muted-foreground">Details for the Amount Requested</h4>
                         <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date From</TableHead>
                                <TableHead>Date To</TableHead>
                                <TableHead className="text-right">LH</TableHead>
                                <TableHead className="text-right">MA</TableHead>
                                <TableHead className="text-right">OA</TableHead>
                                <TableHead className="text-right">TR</TableHead>
                                <TableHead className="text-right">OE</TableHead>
                                <TableHead className="text-right">USD</TableHead>
                                <TableHead>Remarks</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {overseasDetails.advanceAmountRequested.map((item: AdvanceAmountRequestedItem, idx: number) => (
                                <TableRow key={item.id || idx}>
                                  <TableCell>{formatDateSafe(item.dateFrom, "dd/MM/yy")}</TableCell>
                                  <TableCell>{formatDateSafe(item.dateTo, "dd/MM/yy")}</TableCell>
                                  <TableCell className="text-right">{formatNumberSafe(item.lh)}</TableCell>
                                  <TableCell className="text-right">{formatNumberSafe(item.ma)}</TableCell>
                                  <TableCell className="text-right">{formatNumberSafe(item.oa)}</TableCell>
                                  <TableCell className="text-right">{formatNumberSafe(item.tr)}</TableCell>
                                  <TableCell className="text-right">{formatNumberSafe(item.oe)}</TableCell>
                                  <TableCell className="text-right font-semibold">{formatNumberSafe(item.usd, 2)}</TableCell>
                                  <TableCell className="whitespace-pre-wrap">{item.remarks || "N/A"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader><CardTitle className="text-lg font-semibold">Approval Workflow</CardTitle></CardHeader>
        <CardContent>
          <ApprovalWorkflow steps={approvalWorkflowSteps} />
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Additional Comments & Confirmation</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(
  (data: any) => onSubmit(data as ApprovalSubmissionData),
  (errors: Record<string, any>) => {
    // Only log validation errors in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('ApprovalSubmissionForm validation errors:', errors);
    }
    
    // Add toast notification for validation errors
    const errorMessages: string[] = [];
    if (errors.confirmPolicy) errorMessages.push("You must confirm compliance with travel policy");
    if (errors.confirmManagerApproval) errorMessages.push("You must acknowledge manager approval requirement");
    if (errors.confirmTermsAndConditions) errorMessages.push("You must agree to the terms and conditions");
    
    // Alert the user about validation errors
    if (errorMessages.length > 0) {
      alert(`Please correct the following issues:\n- ${errorMessages.join('\n- ')}`);
    }
  }
)} className="space-y-6">
              <FormField control={form.control as any} name="additionalComments" render={({ field }) => ( <FormItem> <FormLabel>Additional Comments</FormLabel> <FormControl><Textarea placeholder="Enter any additional information or special requests..." className="min-h-[100px]" {...field} value={field.value || ''}/></FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={form.control as any} name="confirmPolicy" render={({ field }) => ( <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-white dark:bg-slate-700/30"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="confirmPolicy" /></FormControl> <div className="space-y-1 leading-none"> <FormLabel htmlFor="confirmPolicy" className="font-normal text-sm"> I confirm that all information provided is accurate and in compliance with company travel policy. </FormLabel> <FormMessage /> </div> </FormItem> )} />
              <FormField control={form.control as any} name="confirmManagerApproval" render={({ field }) => ( <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-white dark:bg-slate-700/30"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="confirmManagerApproval" /></FormControl> <div className="space-y-1 leading-none"> <FormLabel htmlFor="confirmManagerApproval" className="font-normal text-sm"> I understand that this request requires approval from my line manager and/or relevant authorities. </FormLabel> <FormMessage /> </div> </FormItem> )} />
              
              {isInternationalStyleTravel && (
                <FormField control={form.control as any} name="confirmTermsAndConditions" render={({ field }) => ( <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-white dark:bg-slate-700/30"> <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="confirmTermsAndConditions" /></FormControl> <div className="space-y-1 leading-none"> <FormLabel htmlFor="confirmTermsAndConditions" className="font-normal text-sm"> I hereby acknowledge the Terms and Conditions for this travel type and agree to the conditions regarding advance utilization and refund. </FormLabel> <FormMessage /> </div> </FormItem> )} />
              )}

              <div className="flex justify-between pt-4">
                <Button type="button" variant="outline" onClick={onBack}>
                  Back: Travel Details
                </Button>
                <Button type="submit" size="lg">
                   {getSubmitButtonText()}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
