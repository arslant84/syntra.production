
"use client";

import type { TravelRequestForm, ItinerarySegment, AccommodationDetail, ExternalPartyAccommodationDetail, CompanyTransportDetail, AdvanceAmountRequestedItem, MealProvisionDetails, AdvanceBankDetails } from "@/types/trf";

// Type aliases to handle both snake_case and camelCase property names
type AnyObject = Record<string, any>;

// Helper function to safely get a value from an object that might use snake_case or camelCase
const getPropertyValue = <T,>(obj: AnyObject, snakeCaseKey: string, camelCaseKey: string, defaultValue: T): T => {
  // First, try to get the value using snake_case path
  let value = snakeCaseKey.split('.').reduce((acc, part) => acc && acc[part], obj);
  if (value !== undefined && value !== null) return value as T;

  // If not found, try to get the value using camelCase path
  value = camelCaseKey.split('.').reduce((acc, part) => acc && acc[part], obj);
  if (value !== undefined && value !== null) return value as T;

  // Otherwise, return the default value
  return defaultValue;
};

// We'll use type assertions to work around TypeScript's strict checking
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import ApprovalWorkflow from "./ApprovalWorkflow";
import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { UserCircle, Users as ExternalUserIcon, FileText, ClipboardList, Utensils, Bed, Car, Landmark, CreditCard, Building, Globe, Home as HomeIcon, Info } from "lucide-react";

interface TrfViewProps {
  trfData: TravelRequestForm;
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

const DetailItem: React.FC<{ label: string; value?: string | number | null | React.ReactNode; fullWidth?: boolean; className?: string }> = ({ label, value, fullWidth = false, className }) => {
  if (value === null || value === undefined) {
    return null; 
  }
  return (
    <div className={cn(fullWidth ? "col-span-full" : "sm:col-span-1", "print:break-inside-avoid", className)}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider print:text-[8pt] print:font-semibold">{label}</p>
      <div className="text-sm text-foreground break-words mt-0.5 print:text-[9pt]">
        {typeof value === 'string' || typeof value === 'number' ? String(value) : value}
      </div>
    </div>
  );
};


export default function TrfView({ trfData }: TrfViewProps) {
  console.log("TSR Data in TrfView:", trfData);
  const {
    travelType,
    requestorName, staffId, department, position, costCenter, telEmail,
    externalPartyRequestorInfo,
    domesticTravelDetails,
    overseasTravelDetails,
    externalPartiesTravelDetails,
    additionalComments,
    approvalWorkflow,
    status,
  } = trfData;

  const isExternal = travelType === 'External Parties' && externalPartyRequestorInfo;
  const isOverseas = (travelType === 'Overseas' || travelType === 'Home Leave Passage') && overseasTravelDetails;
  const isDomestic = travelType === 'Domestic' && domesticTravelDetails;
  
  // Get purpose and itinerary based on travel type
  let currentPurpose = "";
  let currentItinerary: AnyObject[] = [];

  if (isDomestic) {
    currentPurpose = domesticTravelDetails.purpose;
    currentItinerary = domesticTravelDetails.itinerary;
  } else if (isOverseas) {
    currentPurpose = overseasTravelDetails.purpose;
    currentItinerary = overseasTravelDetails.itinerary;
  } else if (isExternal && externalPartiesTravelDetails) {
    currentPurpose = externalPartiesTravelDetails.purpose;
    currentItinerary = externalPartiesTravelDetails.itinerary;
  }


  const getTravelTypeIcon = () => {
    switch (travelType) {
      case 'Domestic': return <Building className="w-5 h-5 print:hidden" />;
      case 'Overseas': return <Globe className="w-5 h-5 print:hidden" />;
      case 'Home Leave Passage': return <HomeIcon className="w-5 h-5 print:hidden" />;
      case 'External Parties': return <ExternalUserIcon className="w-5 h-5 print:hidden" />;
      default: return <FileText className="w-5 h-5 print:hidden" />;
    }
  };

  return (
    <div className="space-y-4 print:space-y-2">
      <Card className="shadow-md print:shadow-none print:border-none print:break-inside-avoid">
        <CardHeader className="print:p-0 print:mb-2">
          <div className="flex items-center justify-between print:mb-1">
            <CardTitle className="text-xl flex items-center gap-2 print:text-lg">
              {getTravelTypeIcon()} {travelType} Travel Request
            </CardTitle>
            <Badge variant={status === "Approved" ? "default" : status === "Rejected" ? "destructive" : "outline"} className={cn(status === "Approved" ? "bg-green-600 text-white" : "", "print:text-xs")}>{status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4 print:p-0 print:space-y-2">
          <section className="print:break-inside-avoid">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1">
              {isExternal ? <ExternalUserIcon className="print:hidden"/> : <UserCircle className="print:hidden" />}
              {isExternal ? "External Party Details" : "Employee Details"}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 p-2 rounded-md print:grid-cols-3 print:p-0">
              {isExternal && externalPartyRequestorInfo ? (
                <>
                  <DetailItem label="Full Name" value={externalPartyRequestorInfo.externalFullName} />
                  <DetailItem label="Organization" value={externalPartyRequestorInfo.externalOrganization} />
                  <DetailItem label="Authority Letter Ref." value={externalPartyRequestorInfo.externalRefToAuthorityLetter} />
                  <DetailItem label="Cost Center" value={externalPartyRequestorInfo.externalCostCenter} />
                </>
              ) : (
                <>
                  <DetailItem label="Requestor Name" value={requestorName} />
                  <DetailItem label="Staff ID" value={staffId} />
                  <DetailItem label="Department & Position" value={position ? `${department} / ${position}`: department} />
                  <DetailItem label="Cost Center" value={costCenter} />
                  <DetailItem label="Tel/Email" value={telEmail} />
                </>
              )}
            </div>
          </section>

          {currentPurpose && (
            <section className="print:break-inside-avoid">
              <Separator className="my-2 print:hidden" />
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1"><FileText className="print:hidden" /> Purpose of Travel</h3>
              <div className="p-2 rounded-md print:p-0">
                <p className="whitespace-pre-wrap text-sm print:text-[9pt]">{currentPurpose}</p>
              </div>
            </section>
          )}

          {currentItinerary && currentItinerary.length > 0 && (
            <section className="print:break-inside-avoid">
              <Separator className="my-2 print:hidden" />
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1"><ClipboardList className="print:hidden"/> Itinerary</h3>
              <div className="overflow-x-auto print:overflow-visible">
                <Table className="print:text-[8pt]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="print:p-0.5">Date</TableHead>
                      <TableHead className="print:p-0.5">Day</TableHead>
                      <TableHead className="print:p-0.5">From</TableHead>
                      <TableHead className="print:p-0.5">To</TableHead>
                      <TableHead className="print:p-0.5">ETD</TableHead>
                      <TableHead className="print:p-0.5">ETA</TableHead>
                      <TableHead className="print:p-0.5">{isOverseas ? "Flight/Class" : "Flight/Rein"}</TableHead>
                      <TableHead className="print:p-0.5">Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentItinerary.map((seg: AnyObject, idx) => (
                      <TableRow key={seg.id || idx}>
                        <TableCell className="print:p-0.5">{formatDateSafe(seg.date)}</TableCell>
                        <TableCell className="print:p-0.5">{seg.day || seg.day_of_week || seg.dayOfWeek || 'N/A'}</TableCell>
                        <TableCell className="print:p-0.5">{seg.from || seg.from_location || seg.fromLocation || 'N/A'}</TableCell>
                        <TableCell className="print:p-0.5">{seg.to || seg.to_location || seg.toLocation || 'N/A'}</TableCell>
                        <TableCell className="print:p-0.5">{formatTimeSafe(seg.etd)}</TableCell>
                        <TableCell className="print:p-0.5">{formatTimeSafe(seg.eta)}</TableCell>
                        <TableCell className="print:p-0.5">
                          {seg.flightNumber || seg.flight_number || 'N/A'}
                        </TableCell>
                        <TableCell className="whitespace-pre-wrap text-xs max-w-xs print:p-0.5 print:max-w-none">
                          {typeof seg.remarks === 'object' ? 
                            (seg.remarks ? 
                              (seg.remarks.toString() === '[object Object]' ? 
                                JSON.stringify(seg.remarks) : seg.remarks.toString()) : 
                              'N/A') : 
                            (seg.remarks || 'N/A')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          {isDomestic && domesticTravelDetails?.mealProvision && (
            <section className="print:break-inside-avoid">
              <Separator className="my-2 print:hidden" />
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1"><Utensils className="print:hidden"/> Meal Provision (Kiyanly)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2 p-2 rounded-md print:grid-cols-3 print:p-0">
                <DetailItem 
                  label="Date From/To" 
                  value={domesticTravelDetails.mealProvision.dateFromTo || domesticTravelDetails.mealProvision.date_from_to} 
                />
                <DetailItem label="Breakfast" value={formatNumberSafe(domesticTravelDetails.mealProvision.breakfast)} />
                <DetailItem label="Lunch" value={formatNumberSafe(domesticTravelDetails.mealProvision.lunch)} />
                <DetailItem label="Dinner" value={formatNumberSafe(domesticTravelDetails.mealProvision.dinner)} />
                <DetailItem label="Supper" value={formatNumberSafe(domesticTravelDetails.mealProvision.supper)} />
                <DetailItem label="Refreshment" value={formatNumberSafe(domesticTravelDetails.mealProvision.refreshment)} />
              </div>
            </section>
          )}

          {isDomestic && domesticTravelDetails?.accommodationDetails && domesticTravelDetails.accommodationDetails.length > 0 && (
            <section className="print:break-inside-avoid">
              <Separator className="my-2 print:hidden" />
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1"><Bed className="print:hidden"/> Accommodation</h3>
              {domesticTravelDetails.accommodationDetails.map((acc: AnyObject, idx) => {
                // Handle both snake_case and camelCase property names
                const accommodationType = acc.accommodation_type || acc.accommodationType;
                const otherTypeDesc = acc.other_type_description || acc.otherTypeDescription;
                const checkInDate = acc.check_in_date || acc.checkInDate;
                const checkInTime = acc.check_in_time || acc.checkInTime;
                const checkOutDate = acc.check_out_date || acc.checkOutDate;
                const checkOutTime = acc.check_out_time || acc.checkOutTime;
                
                return (
                  <div key={acc.id || idx} className="p-2 border rounded-md mb-2 bg-muted/20 print:p-0 print:border-none print:mb-1">
                    <h4 className="font-medium text-sm mb-1 text-muted-foreground print:hidden">Entry {idx + 1}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 print:grid-cols-3">
                      {accommodationType === 'Hotel/Отели' && <DetailItem label="Accommodation Type" value="Hotel/Отели" />}
                      {accommodationType === 'Staff House/PKC Kampung/Kiyanly camp' && <DetailItem label="Accommodation Type" value="Staff House/PKC Kampung/Kiyanly camp" />}
                      {accommodationType === 'Other' && <DetailItem label="Accommodation Type" value="Other" />}
                      {accommodationType === 'Other' && <DetailItem label="Other Description" value={otherTypeDesc} />}
                      {(accommodationType === 'Hotel/Отели' || accommodationType === 'Other') && (
                        <>
                          <DetailItem label="Location" value={acc.location || 'N/A'} />
                          <DetailItem label="Place of Stay" value={acc.placeOfStay || 'N/A'} />
                          <DetailItem label="Est. Cost/Night" value={formatNumberSafe(acc.estimatedCostPerNight, 2)} />
                        </>
                      )}
                    </div>
                    <DetailItem label="Remarks" value={acc.remarks || 'N/A'} fullWidth className="mt-2 print:mt-1" />
                  </div>
                );
              })}
            </section>
          )}

          {isExternal && externalPartiesTravelDetails && (
            <>
              {externalPartiesTravelDetails.accommodationDetails && externalPartiesTravelDetails.accommodationDetails.length > 0 && (
                <section className="print:break-inside-avoid">
                  <Separator className="my-2 print:hidden" />
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1"><Bed className="print:hidden"/> Accommodation</h3>
                  {externalPartiesTravelDetails.accommodationDetails.map((acc: AnyObject, idx: number) => {
                    // Handle both snake_case and camelCase property names
                    const checkInDate = acc.check_in_date || acc.checkInDate;
                    const checkOutDate = acc.check_out_date || acc.checkOutDate;
                    const placeOfStay = acc.place_of_stay || acc.placeOfStay;
                    const estimatedCost = Number(acc.estimated_cost_per_night || acc.estimatedCostPerNight || 0);
                    
                    return (
                      <div key={acc.id || idx} className="p-2 border rounded-md mb-2 bg-muted/20 print:p-0 print:border-none print:mb-1">
                        <h4 className="font-medium text-sm mb-1 text-muted-foreground print:hidden">Entry {idx + 1}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 print:grid-cols-3">
                          <DetailItem label="Check-in Date" value={formatDateSafe(checkInDate)} />
                          <DetailItem label="Check-out Date" value={formatDateSafe(checkOutDate)} />
                          <DetailItem label="Place of Stay" value={placeOfStay || 'N/A'} />
                          <DetailItem label="Est. Cost/Night" value={formatNumberSafe(estimatedCost, 2)} />
                        </div>
                        <DetailItem label="Remarks" value={acc.remarks || 'N/A'} fullWidth className="mt-2 print:mt-1" />
                      </div>
                    );
                  })}
                </section>
              )}
              {externalPartiesTravelDetails.mealProvision && (
                <section className="print:break-inside-avoid">
                  <Separator className="my-2 print:hidden" />
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1"><Utensils className="print:hidden"/> Meal Provision (Kiyanly)</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2 p-2 rounded-md print:grid-cols-3 print:p-0">
                    <DetailItem 
                      label="Date From/To" 
                      value={externalPartiesTravelDetails.mealProvision.dateFromTo || externalPartiesTravelDetails.mealProvision.date_from_to} 
                    />
                    <DetailItem label="Breakfast" value={formatNumberSafe(externalPartiesTravelDetails.mealProvision.breakfast)} />
                    <DetailItem label="Lunch" value={formatNumberSafe(externalPartiesTravelDetails.mealProvision.lunch)} />
                    <DetailItem label="Dinner" value={formatNumberSafe(externalPartiesTravelDetails.mealProvision.dinner)} />
                    <DetailItem label="Supper" value={formatNumberSafe(externalPartiesTravelDetails.mealProvision.supper)} />
                    <DetailItem label="Refreshment" value={formatNumberSafe(externalPartiesTravelDetails.mealProvision.refreshment)} />
                  </div>
                </section>
              )}
            </>
          )}

          {isDomestic && domesticTravelDetails?.companyTransportDetails && domesticTravelDetails.companyTransportDetails.length > 0 && (
            <section className="print:break-inside-avoid">
              <Separator className="my-2 print:hidden" />
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1"><Car className="print:hidden"/> Company Transportation</h3>
              {domesticTravelDetails.companyTransportDetails.map((trans: AnyObject, idx) => {
                // Handle both snake_case and camelCase property names
                const transportDate = trans.transport_date || trans.date;
                const day = trans.day_of_week || trans.day;
                const from = trans.from_location || trans.from;
                const to = trans.to_location || trans.to;
                const btNoRequired = trans.bt_no_required || trans.btNoRequired;
                const accommodationTypeN = trans.accommodation_type_n || trans.accommodationTypeN;
                
                return (
                  <div key={trans.id || idx} className="p-2 border rounded-md mb-2 bg-muted/20 print:p-0 print:border-none print:mb-1">
                    <h4 className="font-medium text-sm mb-1 text-muted-foreground print:hidden">Request {idx + 1}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 print:grid-cols-3">
                      <DetailItem label="Date" value={formatDateSafe(transportDate)} />
                      <DetailItem label="Day" value={day || 'N/A'} />
                      <DetailItem label="From" value={from || 'N/A'} />
                      <DetailItem label="To" value={to || 'N/A'} />
                      <DetailItem label="BT No (if req)" value={btNoRequired || 'N/A'} />
                      <DetailItem label="Accom. Type/N" value={accommodationTypeN || 'N/A'} />
                      <DetailItem label="Address" value={trans.address || 'N/A'} fullWidth />
                    </div>
                    <DetailItem label="Remarks" value={trans.remarks || 'N/A'} fullWidth className="mt-2 print:mt-1" />
                  </div>
                );
              })}
            </section>
          )}

          {isOverseas && (
            <section className="print:break-inside-avoid">
              <Separator className="my-2 print:hidden" />
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1"><Landmark className="print:hidden"/> Advance Request</h3>
              
              {/* Bank Details */}
              <div className="p-2 rounded-md mb-2 bg-muted/20 border print:p-0 print:border-none">
                <h4 className="font-medium text-md mb-1 text-primary/80 print:text-sm">Bank Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  <DetailItem 
                    label="Bank Name" 
                    value={getPropertyValue(overseasTravelDetails, 'advanceBankDetails.bank_name', 'advanceBankDetails.bankName', 'N/A')}
                  />
                  <DetailItem 
                    label="Account Number" 
                    value={getPropertyValue(overseasTravelDetails, 'advanceBankDetails.account_number', 'advanceBankDetails.accountNumber', 'N/A')}
                  />
                </div>
              </div>
              
              {/* Amount Requested Details */}
              {overseasTravelDetails.advanceAmountRequested && overseasTravelDetails.advanceAmountRequested.length > 0 && (
                <div className="overflow-x-auto print:overflow-visible">
                  <h4 className="font-medium text-md mb-1 text-primary/80 mt-2 print:text-sm">Amount Requested Details</h4>
                  <Table className="print:text-[8pt]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="print:p-0.5">Date From</TableHead>
                        <TableHead className="print:p-0.5">Date To</TableHead>
                        <TableHead className="text-right print:p-0.5" title="Lodging & Hotel">LH</TableHead>
                        <TableHead className="text-right print:p-0.5" title="Meals Allowance">MA</TableHead>
                        <TableHead className="text-right print:p-0.5" title="Other Allowance">OA</TableHead>
                        <TableHead className="text-right print:p-0.5" title="Transportation">TR</TableHead>
                        <TableHead className="text-right print:p-0.5" title="Other Expenses">OE</TableHead>
                        <TableHead className="text-right print:p-0.5">USD</TableHead>
                        <TableHead className="print:p-0.5">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overseasTravelDetails.advanceAmountRequested.map((item: AnyObject, idx) => {
                        // Handle both snake_case and camelCase property names
                        const dateFrom = item.date_from || item.dateFrom;
                        const dateTo = item.date_to || item.dateTo;
                        return (
                          <TableRow key={item.id || idx}>
                            <TableCell className="print:p-0.5">{formatDateSafe(dateFrom, "dd/MM/yy")}</TableCell>
                            <TableCell className="print:p-0.5">{formatDateSafe(dateTo, "dd/MM/yy")}</TableCell>
                            <TableCell className="text-right print:p-0.5">{formatNumberSafe(item.lh)}</TableCell>
                            <TableCell className="text-right print:p-0.5">{formatNumberSafe(item.ma)}</TableCell>
                            <TableCell className="text-right print:p-0.5">{formatNumberSafe(item.oa)}</TableCell>
                            <TableCell className="text-right print:p-0.5">{formatNumberSafe(item.tr)}</TableCell>
                            <TableCell className="text-right print:p-0.5">{formatNumberSafe(item.oe)}</TableCell>
                            <TableCell className="text-right font-semibold print:p-0.5">{formatNumberSafe(item.usd, 2)}</TableCell>
                            <TableCell className="whitespace-pre-wrap text-xs max-w-xs print:p-0.5 print:max-w-none">{item.remarks || 'N/A'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              
              {/* Legend for abbreviations */}
              <div className="text-xs text-muted-foreground mt-2 print:text-[7pt]">
                <p>LH: Lodging & Hotel | MA: Meals Allowance | OA: Other Allowance | TR: Transportation | OE: Other Expenses</p>
              </div>
            </section>
          )}
          
          {additionalComments && (
             <section className="print:break-inside-avoid">
                <Separator className="my-2 print:hidden" />
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary border-b pb-1 print:text-base print:mb-1"><Info className="print:hidden"/> Additional Comments</h3>
                <div className="p-2 rounded-md print:p-0">
                    <p className="whitespace-pre-wrap text-sm print:text-[9pt]">
                      {/* Filter out the JSON data from comments */}
                      {(() => {
                        // Use a function to handle the regex without the 's' flag
                        const regex = /\[Advance Amount Data:[\s\S]*?\]/;
                        return additionalComments.replace(regex, '').trim();
                      })()}
                    </p>
                </div>
            </section>
          )}

        </CardContent>
      </Card>

      {approvalWorkflow && approvalWorkflow.length > 0 && (
        <Card className="shadow-md print:shadow-none print:border-none print:break-inside-avoid">
            <CardHeader className="print:p-0 print:mb-2">
            <CardTitle className="text-lg font-semibold print:text-base">Approval Workflow</CardTitle>
            </CardHeader>
            <CardContent className="print:p-0">
            <ApprovalWorkflow steps={approvalWorkflow} />
            </CardContent>
        </Card>
      )}
    </div>
  );
}
