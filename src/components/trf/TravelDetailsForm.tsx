
"use client";

import React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TravelDetails, ItinerarySegment, AccommodationDetail, CompanyTransportDetail, AdvanceBankDetails, AdvanceAmountRequestedItem, TravelType } from "@/types/trf";
import { cn } from "@/lib/utils";
import { format, isValid, startOfDay, getDay } from "date-fns";
import { CalendarIcon, MapPin, PlusCircle, Trash2, ClipboardList, Utensils, Bed, Car, Landmark, CreditCard, FileText } from "lucide-react";

const itinerarySegmentSchema = z.object({
  date: z.date({ required_error: "Date is required." }).nullable(),
  day: z.string().optional(),
  from: z.string().min(1, "Origin is required."),
  to: z.string().min(1, "Destination is required."),
  etd: z.string().optional().refine(val => val === '' || /^([01]\d|2[0-3]):([0-5]\d)$/.test(val!), { message: "Invalid time format (HH:MM)" }),
  eta: z.string().optional().refine(val => val === '' || /^([01]\d|2[0-3]):([0-5]\d)$/.test(val!), { message: "Invalid time format (HH:MM)" }),
  flightNumber: z.string().optional(),
  remarks: z.string().optional(),
});

const mealProvisionSchema = z.object({
  dateFromTo: z.string().optional(),
  breakfast: z.preprocess(val => String(val) === '' ? '' : Number(val), z.number().nonnegative("Must be non-negative").optional().or(z.literal(''))),
  lunch: z.preprocess(val => String(val) === '' ? '' : Number(val), z.number().nonnegative("Must be non-negative").optional().or(z.literal(''))),
  dinner: z.preprocess(val => String(val) === '' ? '' : Number(val), z.number().nonnegative("Must be non-negative").optional().or(z.literal(''))),
  supper: z.preprocess(val => String(val) === '' ? '' : Number(val), z.number().nonnegative("Must be non-negative").optional().or(z.literal(''))),
  refreshment: z.preprocess(val => String(val) === '' ? '' : Number(val), z.number().nonnegative("Must be non-negative").optional().or(z.literal(''))),
});

const accommodationDetailSchema = z.object({
  accommodationType: z.enum(['Hotel/Отели', 'Staff House/PKC Kampung/Kiyanly camp', 'Other'], { required_error: "Accommodation type is required." }),
  checkInDate: z.date({ required_error: "Check-in date is required."}).nullable(),
  checkInTime: z.string().optional().refine(val => val === '' || /^([01]\d|2[0-3]):([0-5]\d)$/.test(val!), { message: "Invalid time format (HH:MM)" }),
  checkOutDate: z.date({ required_error: "Check-out date is required."}).nullable(),
  checkOutTime: z.string().optional().refine(val => val === '' || /^([01]\d|2[0-3]):([0-5]\d)$/.test(val!), { message: "Invalid time format (HH:MM)" }),
  remarks: z.string().optional(),
  otherTypeDescription: z.string().optional(),
}).refine(data => data.accommodationType !== 'Other' || (data.accommodationType === 'Other' && data.otherTypeDescription && data.otherTypeDescription.trim().length > 0), {
  message: "Description for 'Other' accommodation type is required.",
  path: ["otherTypeDescription"],
}).refine(data => {
  if (!data.checkInDate || !data.checkOutDate || !isValid(data.checkInDate) || !isValid(data.checkOutDate)) return true; // Skip if dates are invalid/null
  return data.checkOutDate >= data.checkInDate;
}, {
  message: "Check-out date cannot be before check-in date.",
  path: ["checkOutDate"],
});


const companyTransportDetailSchema = z.object({
  date: z.date({ required_error: "Date is required."}).nullable(),
  day: z.string().optional(),
  from: z.string().min(1, "Origin is required."),
  to: z.string().min(1, "Destination is required."),
  btNoRequired: z.string().optional(),
  accommodationTypeN: z.string().optional(),
  address: z.string().optional(),
  remarks: z.string().optional(),
});

const advanceBankDetailsSchema = z.object({
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
});

const advanceAmountRequestedItemSchema = z.object({
  dateFrom: z.date({required_error: "Date From is required"}).nullable(),
  dateTo: z.date().nullable(),
  lh: z.preprocess(val => String(val) === '' ? '' : Number(val), z.number().nonnegative("Must be non-negative").optional().or(z.literal(''))),
  ma: z.preprocess(val => String(val) === '' ? '' : Number(val), z.number().nonnegative("Must be non-negative").optional().or(z.literal(''))),
  oa: z.preprocess(val => String(val) === '' ? '' : Number(val), z.number().nonnegative("Must be non-negative").optional().or(z.literal(''))),
  tr: z.preprocess(val => String(val) === '' ? '' : Number(val), z.number().nonnegative("Must be non-negative").optional().or(z.literal(''))),
  oe: z.preprocess(val => String(val) === '' ? '' : Number(val), z.number().nonnegative("Must be non-negative").optional().or(z.literal(''))),
  usd: z.preprocess(val => String(val) === '' ? '' : Number(val), z.number({required_error: "USD amount is required"}).nonnegative("Must be non-negative").optional().or(z.literal(''))),
  remarks: z.string().optional(),
}).refine(data => {
  if (!data.dateFrom || !data.dateTo || !isValid(data.dateFrom) || !isValid(data.dateTo)) return true; // Skip if dates are invalid/null
  return data.dateTo >= data.dateFrom;
}, {
  message: "Date To cannot be before Date From.",
  path: ["dateTo"],
});


const travelDetailsSchema = z.object({
  departureDate: z.date({ required_error: "Overall departure date is required." }),
  returnDate: z.date({ required_error: "Overall return date is required." }),
  travelType: z.string({required_error: "Travel type is required."})
    .refine(val => val !== "", { message: "Please select a travel type." })
    .pipe(z.enum(["Domestic", "International", "Home Leave Passage", "External Contract Staff"])) as z.ZodType<Exclude<TravelType, "">>,
  purpose: z.string().min(10, "Purpose of travel must be at least 10 characters."),
  itinerary: z.array(itinerarySegmentSchema).min(1, "At least one itinerary segment is required."),
  mealProvision: mealProvisionSchema,
  accommodationDetails: z.array(accommodationDetailSchema).optional(),
  companyTransportDetails: z.array(companyTransportDetailSchema).optional(),
  advanceBankDetails: advanceBankDetailsSchema,
  advanceAmountRequested: z.array(advanceAmountRequestedItemSchema).optional(),
}).refine(data => {
   if (!data.departureDate || !data.returnDate || !isValid(data.departureDate) || !isValid(data.returnDate)) return true; // Skip if dates are invalid
   return data.returnDate >= data.departureDate;
 }, {
  message: "Return date cannot be before overall departure date.",
  path: ["returnDate"],
}).superRefine((data, ctx) => {
  if (data.travelType === "Domestic") {
    if (!data.mealProvision.dateFromTo?.trim()) { 
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Meal provision Date From/To is required for domestic travel.", path: ["mealProvision.dateFromTo"]});
    }
  } else if (data.travelType === "International" || data.travelType === "Home Leave Passage") {
    if (!data.advanceBankDetails?.bankName?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Bank name is required for this travel type.", path: ["advanceBankDetails.bankName"] });
    }
    if (!data.advanceBankDetails?.accountNumber?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Account number is required for this travel type.", path: ["advanceBankDetails.accountNumber"] });
    }
    if (!data.advanceAmountRequested || data.advanceAmountRequested.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one advance amount item is required for this travel type.", path: ["advanceAmountRequested"] });
    } else {
      data.advanceAmountRequested.forEach((item, index) => {
        if (!item.dateFrom || !isValid(item.dateFrom)) { // dateFrom is already required by its own schema, this is redundant but safe
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valid date from is required.", path: [`advanceAmountRequested.${index}.dateFrom`] });
        }
         if (item.usd === '' || item.usd === undefined || item.usd === null || isNaN(Number(item.usd)) ) { // Also handled by item schema
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valid USD amount is required.", path: [`advanceAmountRequested.${index}.usd`] });
        }
      });
    }
  }
});


interface TravelDetailsFormProps {
  initialData: TravelDetails; 
  onSubmit: (data: TravelDetails) => void;
  onBack: () => void;
}

export default function TravelDetailsForm({ initialData, onSubmit, onBack }: TravelDetailsFormProps) {
  const form = useForm<TravelDetails>({
    resolver: zodResolver(travelDetailsSchema),
    defaultValues: initialData, 
  });

  const { fields: itineraryFields, append: appendItinerary, remove: removeItinerary } = useFieldArray({ control: form.control, name: "itinerary" });
  const { fields: accommodationFields, append: appendAccommodation, remove: removeAccommodation } = useFieldArray({ control: form.control, name: "accommodationDetails" });
  const { fields: transportFields, append: appendTransport, remove: removeTransport } = useFieldArray({ control: form.control, name: "companyTransportDetails" });
  const { fields: advanceAmountFields, append: appendAdvanceAmount, remove: removeAdvanceAmount } = useFieldArray({ control: form.control, name: "advanceAmountRequested" });

  const currentTravelType = form.watch("travelType");
  const isInternationalType = currentTravelType === "International" || currentTravelType === "Home Leave Passage";
  const isDomesticType = currentTravelType === "Domestic";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-6 h-6 text-primary" />
              Travel & Services Request Details
            </CardTitle>
            <CardDescription>Please provide the specifics of your travel. Sections will adapt based on Travel Type.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="travelType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Travel Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""} defaultValue={initialData?.travelType || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select travel type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Domestic">Domestic Business Travel</SelectItem>
                        <SelectItem value="International">Overseas Business Travel</SelectItem>
                        <SelectItem value="Home Leave Passage">Home Leave Passage (Expatriate Staff)</SelectItem>
                        <SelectItem value="External Contract Staff">Travel for External Contract Staff</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="departureDate" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Overall Departure Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value && isValid(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} disabled={(date) => date < startOfDay(new Date())} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="returnDate" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Overall Return Date</FormLabel>
                  <Popover>
                     <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                           {field.value && isValid(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar 
                        mode="single" 
                        selected={field.value ?? undefined} 
                        onSelect={field.onChange} 
                        disabled={(date) => {
                          const departureD = form.getValues("departureDate");
                          const minReturnDate = departureD && isValid(departureD) ? departureD : startOfDay(new Date());
                          return date < minReturnDate;
                        }}
                        initialFocus 
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="purpose" render={({ field }) => ( <FormItem> <FormLabel className="text-lg font-semibold flex items-center gap-2"><FileText /> Purpose of Travel / Цель поездки</FormLabel> <FormControl> <Textarea placeholder="Describe the purpose of your travel in detail..." className="min-h-[100px] resize-y" {...field} /> </FormControl> <FormMessage /> </FormItem> )} />

            <Card className="border-dashed">
              <CardHeader> <CardTitle className="text-lg font-semibold flex items-center gap-2"><ClipboardList /> Itinerary / Маршрут</CardTitle> </CardHeader>
              <CardContent className="space-y-4">
                {itineraryFields.map((item, index) => (
                  <div key={item.id} className="p-4 border rounded-md space-y-3 relative">
                    <h4 className="font-medium">Segment {index + 1}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      <FormField control={form.control} name={`itinerary.${index}.date`} render={({ field }) => (
                        <FormItem className="xl:col-span-1"> <FormLabel>Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button variant={"outline"} className={cn("w-full h-10 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}> {field.value && isValid(field.value) ? format(field.value, "PPP") : <span>Pick date</span>} <CalendarIcon className="ml-auto h-4 w-4 opacity-50" /> </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={field.value ?? undefined}
                                onSelect={field.onChange}
                                initialFocus
                                disabled={index > 0 ? (date) => {
                                  const prevDate = form.getValues(`itinerary.${index - 1}.date`);
                                  return prevDate && isValid(prevDate) ? date < prevDate : false;
                                } : undefined}
                              />
                            </PopoverContent>
                          </Popover> <FormMessage />
                        </FormItem>
                      )} />
                      {/* Day display (not input) */}
                      <div className="xl:col-span-1 flex flex-col">
                        <label className="block text-sm font-medium mb-1">Day</label>
                        <div className="w-full h-10 px-3 py-2 rounded border bg-muted/50 flex items-center text-base">
                          {(() => {
                            const date = form.getValues(`itinerary.${index}.date`);
                            return date && isValid(date) ? weekdayNames[getDay(date)] : '—';
                          })()}
                        </div>
                      </div>
                      <FormField control={form.control} name={`itinerary.${index}.from`} render={({ field }) => (<FormItem><FormLabel>From</FormLabel><FormControl><Input placeholder="Origin" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.to`} render={({ field }) => (<FormItem><FormLabel>To</FormLabel><FormControl><Input placeholder="Destination" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.etd`} render={({ field }) => (<FormItem><FormLabel>ETD</FormLabel><FormControl><Input type="time" step="900" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.eta`} render={({ field }) => (<FormItem><FormLabel>ETA</FormLabel><FormControl><Input type="time" step="900" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.flightNumber`} render={({ field }) => (<FormItem><FormLabel>{isInternationalType ? "Flight/Class" : "Flight/Rein"}</FormLabel><FormControl><Input placeholder={isInternationalType ? "e.g. Business Class" : "Flight #"} {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.remarks`} render={({ field }) => (<FormItem className="md:col-span-full"><FormLabel>Remarks</FormLabel><FormControl><Textarea placeholder="Segment remarks" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    {itineraryFields.length > 1 && <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive hover:text-destructive/80" onClick={() => removeItinerary(index)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                ))}
                 <Button type="button" variant="outline" size="sm" onClick={() => appendItinerary({ date: null, day: '', from: '', to: '', etd: '', eta: '', flightNumber: '', remarks: '' })}> <PlusCircle className="mr-2 h-4 w-4" /> Add Itinerary Segment </Button>
              </CardContent>
            </Card>

            {isDomesticType && (
              <Card className="border-dashed">
                <CardHeader> <CardTitle className="text-lg font-semibold flex items-center gap-2"><Utensils /> Meal Provision in Kiyanly / Питание в Киянлы</CardTitle> </CardHeader>
                <CardContent className="space-y-3">
                  <FormField control={form.control} name="mealProvision.dateFromTo" render={({ field }) => (<FormItem><FormLabel>Date From/To</FormLabel><FormControl><Input placeholder="e.g., 15 May - 20 May" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <FormField control={form.control} name="mealProvision.breakfast" render={({ field }) => (<FormItem><FormLabel>Breakfast</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="mealProvision.lunch" render={({ field }) => (<FormItem><FormLabel>Lunch</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="mealProvision.dinner" render={({ field }) => (<FormItem><FormLabel>Dinner</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="mealProvision.supper" render={({ field }) => (<FormItem><FormLabel>Supper</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="mealProvision.refreshment" render={({ field }) => (<FormItem><FormLabel>Refreshment</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                </CardContent>
              </Card>
            )}

            {isDomesticType && (
              <Card className="border-dashed">
                <CardHeader> <CardTitle className="text-lg font-semibold flex items-center gap-2"><Bed /> Accommodation / Жилье</CardTitle> </CardHeader>
                <CardContent className="space-y-4">
                  {accommodationFields.map((item, index) => (
                    <div key={item.id} className="p-4 border rounded-md space-y-3 relative">
                      <h4 className="font-medium">Accommodation {index + 1}</h4>
                      <FormField control={form.control} name={`accommodationDetails.${index}.accommodationType`} render={({ field }) => ( <FormItem><FormLabel>Type</FormLabel> <Select onValueChange={field.onChange} value={field.value || undefined} defaultValue={item.accommodationType || undefined}> <FormControl><SelectTrigger><SelectValue placeholder="Select accommodation type" /></SelectTrigger></FormControl> <SelectContent> <SelectItem value="Hotel/Отели">Hotel/Отели</SelectItem> <SelectItem value="Staff House/PKC Kampung/Kinyahli camp">Staff House/PKC Kampung/Kinyahli camp</SelectItem> <SelectItem value="Other">Other</SelectItem> </SelectContent> </Select> <FormMessage /> </FormItem>)} />
                      {form.watch(`accommodationDetails.${index}.accommodationType`) === 'Other' && ( <FormField control={form.control} name={`accommodationDetails.${index}.otherTypeDescription`} render={({ field }) => ( <FormItem><FormLabel>Other Type Description</FormLabel><FormControl><Input placeholder="Specify other type" {...field} /></FormControl><FormMessage /></FormItem>)} /> )}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <FormField control={form.control} name={`accommodationDetails.${index}.checkInDate`} render={({ field }) => (
                          <FormItem><FormLabel>Check-in Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                    {field.value && isValid(field.value) ? format(field.value, "PPP") : <span>Pick date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`accommodationDetails.${index}.checkInTime`} render={({ field }) => (<FormItem><FormLabel>Check-in Time</FormLabel><FormControl><Input type="time" step="900" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`accommodationDetails.${index}.checkOutDate`} render={({ field }) => (
                          <FormItem><FormLabel>Check-out Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                    {field.value && isValid(field.value) ? format(field.value, "PPP") : <span>Pick date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar 
                                  mode="single" 
                                  selected={field.value ?? undefined} 
                                  onSelect={field.onChange} 
                                  disabled={(date) => {
                                    const checkInD = form.getValues(`accommodationDetails.${index}.checkInDate`);
                                    const minCheckOutDate = checkInD && isValid(checkInD) ? checkInD : startOfDay(new Date());
                                    return date < minCheckOutDate;
                                  }}
                                  initialFocus 
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`accommodationDetails.${index}.checkOutTime`} render={({ field }) => (<FormItem><FormLabel>Check-out Time</FormLabel><FormControl><Input type="time" step="900" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <FormField control={form.control} name={`accommodationDetails.${index}.remarks`} render={({ field }) => (<FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea placeholder="Accommodation remarks" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      {accommodationFields.length > 0 && <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive hover:text-destructive/80" onClick={() => removeAccommodation(index)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => appendAccommodation({ accommodationType: 'Hotel/Отели', checkInDate: null, checkInTime: '', checkOutDate: null, checkOutTime: '', remarks: '', otherTypeDescription: '' })}> <PlusCircle className="mr-2 h-4 w-4" /> Add Accommodation </Button>
                </CardContent>
              </Card>
            )}

            {isDomesticType && (
              <Card className="border-dashed">
                <CardHeader> <CardTitle className="text-lg font-semibold flex items-center gap-2"><Car /> Company Transportation / Транспорт компании</CardTitle> </CardHeader>
                <CardContent className="space-y-4">
                  {transportFields.map((item, index) => (
                    <div key={item.id} className="p-4 border rounded-md space-y-3 relative">
                      <h4 className="font-medium">Transport Request {index + 1}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                         <FormField control={form.control} name={`companyTransportDetails.${index}.date`} render={({ field }) => (
                           <FormItem><FormLabel>Date</FormLabel>
                             <Popover>
                               <PopoverTrigger asChild>
                                 <FormControl>
                                   <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                     {field.value && isValid(field.value) ? format(field.value, "PPP") : <span>Pick date</span>}
                                     <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                   </Button>
                                 </FormControl>
                               </PopoverTrigger>
                               <PopoverContent className="w-auto p-0">
                                 <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus />
                               </PopoverContent>
                             </Popover>
                             <FormMessage />
                           </FormItem>
                         )} />
                        <FormField control={form.control} name={`companyTransportDetails.${index}.day`} render={({ field }) => (<FormItem><FormLabel>Day</FormLabel><FormControl><Input placeholder="e.g., Mon" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`companyTransportDetails.${index}.from`} render={({ field }) => (<FormItem><FormLabel>From</FormLabel><FormControl><Input placeholder="Origin" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`companyTransportDetails.${index}.to`} render={({ field }) => (<FormItem><FormLabel>To</FormLabel><FormControl><Input placeholder="Destination" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`companyTransportDetails.${index}.btNoRequired`} render={({ field }) => (<FormItem><FormLabel>BT No (if req)</FormLabel><FormControl><Input placeholder="BT Number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`companyTransportDetails.${index}.accommodationTypeN`} render={({ field }) => (<FormItem><FormLabel>Accom. Type/N</FormLabel><FormControl><Input placeholder="Accom. Type/N" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`companyTransportDetails.${index}.address`} render={({ field }) => (<FormItem className="lg:col-span-2"><FormLabel>Address/Adpec</FormLabel><FormControl><Input placeholder="Address" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <FormField control={form.control} name={`companyTransportDetails.${index}.remarks`} render={({ field }) => (<FormItem><FormLabel>Remarks</FormLabel><FormControl><Textarea placeholder="Transport remarks" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      {transportFields.length > 0 && <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive hover:text-destructive/80" onClick={() => removeTransport(index)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => appendTransport({ date: null, day: '', from: '', to: '', btNoRequired: '', accommodationTypeN: '', address: '', remarks: '' })}> <PlusCircle className="mr-2 h-4 w-4" /> Add Company Transport </Button>
                </CardContent>
              </Card>
            )}

            {isInternationalType && (
              <Card className="border-dashed">
                <CardHeader> <CardTitle className="text-lg font-semibold flex items-center gap-2"><Landmark /> Advance Form / Бланк заявки на получение аванса</CardTitle> </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-2 text-base">Bank Details / Банковские реквизиты</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="advanceBankDetails.bankName" render={({ field }) => (<FormItem><FormLabel>Bank Name / Наименование банка</FormLabel><FormControl><Input placeholder="Enter bank name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="advanceBankDetails.accountNumber" render={({ field }) => (<FormItem><FormLabel>Account Number / Номер счета</FormLabel><FormControl><Input placeholder="Enter account number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                  </div>
                  <div>
                     <h4 className="font-medium mb-3 text-base flex items-center gap-2"><CreditCard /> Details for the Amount Requested / Детали по запрашиваемой сумме</h4>
                    {advanceAmountFields.map((item, index) => (
                      <div key={item.id} className="p-4 border rounded-md space-y-3 mb-4 relative">
                        <h5 className="font-medium text-sm">Advance Item {index + 1}</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField control={form.control} name={`advanceAmountRequested.${index}.dateFrom`} render={({ field }) => (
                            <FormItem><FormLabel>Date From</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                      {field.value && isValid(field.value) ? format(field.value, "dd/MM/yy") : <span>Pick date</span>}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`advanceAmountRequested.${index}.dateTo`} render={({ field }) => (
                            <FormItem><FormLabel>Date To</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                      {field.value && isValid(field.value) ? format(field.value, "dd/MM/yy") : <span>Pick date</span>}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar 
                                    mode="single" 
                                    selected={field.value ?? undefined} 
                                    onSelect={field.onChange} 
                                    disabled={(date) => {
                                      const dateFrom = form.getValues(`advanceAmountRequested.${index}.dateFrom`);
                                      const minDateTo = dateFrom && isValid(dateFrom) ? dateFrom : startOfDay(new Date());
                                      return date < minDateTo;
                                    }} 
                                    initialFocus 
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                          <FormField control={form.control} name={`advanceAmountRequested.${index}.lh`} render={({ field }) => (<FormItem><FormLabel>LH</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name={`advanceAmountRequested.${index}.ma`} render={({ field }) => (<FormItem><FormLabel>MA</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name={`advanceAmountRequested.${index}.oa`} render={({ field }) => (<FormItem><FormLabel>OA</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name={`advanceAmountRequested.${index}.tr`} render={({ field }) => (<FormItem><FormLabel>TR</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name={`advanceAmountRequested.${index}.oe`} render={({ field }) => (<FormItem><FormLabel>OE</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name={`advanceAmountRequested.${index}.usd`} render={({ field }) => (<FormItem><FormLabel>USD</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <FormField control={form.control} name={`advanceAmountRequested.${index}.remarks`} render={({ field }) => (<FormItem><FormLabel>Remarks / Примечания</FormLabel><FormControl><Textarea placeholder="Remarks for this advance item" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        {advanceAmountFields.length > 1 && <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive hover:text-destructive/80" onClick={() => removeAdvanceAmount(index)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => appendAdvanceAmount({ dateFrom: null, dateTo: null, lh: '', ma: '', oa: '', tr: '', oe: '', usd: '', remarks: '' })}> <PlusCircle className="mr-2 h-4 w-4" /> Add Advance Item </Button>
                    <FormDescription className="mt-2 text-xs">
                      LH: Lodging/Hotel. MA: Meal Allowance. OA: Other Allowances. TR: Transportation. OE: Other Expenses.
                    </FormDescription>
                  </div>
                </CardContent>
              </Card>
            )}

          </CardContent>
          <CardFooter className="flex justify-between pt-8">
            <Button type="button" variant="outline" onClick={onBack}>
              Back: Requestor Info
            </Button>
            <Button type="submit">Next: Approval &amp; Submission</Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}

