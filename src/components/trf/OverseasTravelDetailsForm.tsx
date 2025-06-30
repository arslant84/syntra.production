"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { OverseasTravelSpecificDetails, ItinerarySegment, AdvanceBankDetails, AdvanceAmountRequestedItem } from "@/types/trf";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import React, { useEffect } from 'react';
import { CalendarIcon, PlusCircle, Trash2, ClipboardList, FileText, Landmark, CreditCard, Globe } from "lucide-react";

// Time format validation regex (HH:MM)
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Zod schema for itinerary segment validation
const itinerarySegmentSchema = z.object({
  id: z.string().optional(),
  date: z.date({ required_error: "Date is required." }).nullable(),
  day: z.string().min(1, "Day is required."),
  from: z.string().min(1, "Origin is required."),
  to: z.string().min(1, "Destination is required."),
  etd: z.string().regex(timeRegex, "Invalid ETD format (HH:MM)").optional().or(z.literal("")),
  eta: z.string().regex(timeRegex, "Invalid ETA format (HH:MM)").optional().or(z.literal("")),
  flightNumber: z.string().min(1, "Flight/Rein/Class is required."),
  remarks: z.string().optional(),
});

// Zod schema for advance bank details validation
const advanceBankDetailsSchema = z.object({
  bankName: z.string().min(1, "Bank name is required."),
  accountNumber: z.string().min(1, "Account number is required."),
});

// Zod schema for advance amount requested item validation
const advanceAmountRequestedItemSchema = z.object({
  id: z.string().optional(),
  dateFrom: z.date({ required_error: "Date From is required." }).nullable(),
  dateTo: z.date({ required_error: "Date To is required." }).nullable(),
  lh: z.preprocess(val => String(val) === '' ? 0 : Number(val), z.number().int().nonnegative("Must be non-negative").optional()),
  ma: z.preprocess(val => String(val) === '' ? 0 : Number(val), z.number().int().nonnegative("Must be non-negative").optional()),
  oa: z.preprocess(val => String(val) === '' ? 0 : Number(val), z.number().int().nonnegative("Must be non-negative").optional()),
  tr: z.preprocess(val => String(val) === '' ? 0 : Number(val), z.number().int().nonnegative("Must be non-negative").optional()),
  oe: z.preprocess(val => String(val) === '' ? 0 : Number(val), z.number().int().nonnegative("Must be non-negative").optional()),
  usd: z.preprocess(val => String(val) === '' ? 0 : Number(val), z.number().nonnegative("USD amount must be non-negative").optional()),
  remarks: z.string().optional(),
}).refine(data => {
  if (!data.dateFrom || !data.dateTo || !isValid(data.dateFrom) || !isValid(data.dateTo)) return true;
  return data.dateTo >= data.dateFrom;
}, { message: "Date To cannot be before Date From.", path: ["dateTo"] });

// Main schema for overseas travel details
const overseasTravelDetailsSchema = z.object({
  purpose: z.string().min(10, "Purpose of travel must be at least 10 characters."),
  itinerary: z.array(itinerarySegmentSchema).min(1, "At least one itinerary segment is required."),
  advanceBankDetails: advanceBankDetailsSchema.optional(),
  advanceAmountRequested: z.array(advanceAmountRequestedItemSchema).optional(),
});

// Props interface for the component
interface OverseasTravelDetailsFormProps {
  initialData?: Partial<OverseasTravelSpecificDetails>;
  onSubmit: (data: OverseasTravelSpecificDetails) => void;
  onBack: () => void;
}

/**
 * OverseasTravelDetailsForm Component
 * 
 * This component handles the overseas travel details form including:
 * - Purpose of travel
 * - Itinerary segments with flight class
 * - Advance bank details
 * - Advance amount requested items
 */
export default function OverseasTravelDetailsForm({ initialData, onSubmit, onBack }: OverseasTravelDetailsFormProps) {
  // Initialize form with Zod resolver and default values
  // Use explicit type assertion to avoid TypeScript errors while maintaining runtime validation with Zod
  const form = useForm({
    resolver: zodResolver(overseasTravelDetailsSchema) as any,
    defaultValues: {
      purpose: initialData?.purpose || "",
      itinerary: initialData?.itinerary?.length ? initialData.itinerary.map((seg: any) => ({
        ...seg,
        date: seg.date ? new Date(seg.date) : null,
        day: seg.day || "",
        from: seg.from || "",
        to: seg.to || "",
        etd: seg.etd || "",
        eta: seg.eta || "",
        flightNumber: seg.flight_class || seg.flightNumber || "",
        remarks: seg.remarks || ""
      })) : [{
        date: null,
        day: "",
        from: "",
        to: "",
        etd: "",
        eta: "",
        flightClass: "",
        remarks: ""
      }],
      advanceBankDetails: {
        bankName: (initialData?.advanceBankDetails as any)?.bank_name || initialData?.advanceBankDetails?.bankName || "",
        accountNumber: (initialData?.advanceBankDetails as any)?.account_number || initialData?.advanceBankDetails?.accountNumber || "",
      },
      advanceAmountRequested: initialData?.advanceAmountRequested?.length ? 
        initialData.advanceAmountRequested.map((item: any) => ({
          ...item,
          dateFrom: item.date_from ? new Date(item.date_from) : (item.dateFrom ? new Date(item.dateFrom) : null),
          dateTo: item.date_to ? new Date(item.date_to) : (item.dateTo ? new Date(item.dateTo) : null),
          lh: typeof item.lh === 'string' ? Number(item.lh) || 0 : item.lh || 0,
          ma: typeof item.ma === 'string' ? Number(item.ma) || 0 : item.ma || 0,
          oa: typeof item.oa === 'string' ? Number(item.oa) || 0 : item.oa || 0,
          tr: typeof item.tr === 'string' ? Number(item.tr) || 0 : item.tr || 0,
          oe: typeof item.oe === 'string' ? Number(item.oe) || 0 : item.oe || 0,
          usd: typeof item.usd === 'string' ? Number(item.usd) || 0 : item.usd || 0,
          remarks: item.remarks || "",
        })) : [{
          dateFrom: null,
          dateTo: null,
          lh: 0,
          ma: 0,
          oa: 0,
          tr: 0,
          oe: 0,
          usd: 0,
          remarks: ""
        }],
    },
  }) as any;

  // Set up field arrays for itinerary and advance amount requested items
  const { fields: itineraryFields, append: appendItinerary, remove: removeItinerary } = useFieldArray({
    name: "itinerary",
    control: form.control,
  });
  
  const { fields: advanceAmountFields, append: appendAdvanceAmount, remove: removeAdvanceAmount } = useFieldArray({
    name: "advanceAmountRequested",
    control: form.control,
  });

  const advanceAmountRequestedValues = form.watch("advanceAmountRequested");

  
  
  // Handle form submission with explicit type annotation
  // Handle form submission with explicit type annotation
  const handleSubmit = form.handleSubmit((data: any) => {
    // Filter out empty itinerary segments before submission
    const filteredItinerary = data.itinerary.filter((seg: any) =>
      seg.date && seg.day && seg.from && seg.to && seg.flightNumber
    ).map((seg: any) => ({
      ...seg,
      remarks: seg.remarks || "",
      flightNumber: seg.flightNumber || ""
    }));

    // Calculate USD for each advance amount requested item before submission
    const calculatedAdvanceAmountRequested = data.advanceAmountRequested?.map((item: any) => {
      const lh = Number(item.lh) || 0;
      const ma = Number(item.ma) || 0;
      const oa = Number(item.oa) || 0;
      const tr = Number(item.tr) || 0;
      const oe = Number(item.oe) || 0;
      const totalUsd = lh + ma + oa + tr + oe;
      return {
        ...item,
        usd: totalUsd,
        remarks: item.remarks || ""
      };
    }) || [];

    // Ensure all values are properly defined before submission
    const sanitizedData = {
      ...data,
      itinerary: filteredItinerary,
      advanceAmountRequested: calculatedAdvanceAmountRequested
    };
    onSubmit(sanitizedData as OverseasTravelSpecificDetails);
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="w-full max-w-4xl mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Overseas Travel Details
            </CardTitle>
            <CardDescription>Please provide details specific to your overseas travel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Purpose of Travel */}
            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose of Travel / Цель поездки</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the purpose of your travel"
                      className="min-h-[100px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Itinerary Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Itinerary / Маршрут
                </h3>
              </div>
              
              {itineraryFields.map((field, index) => (
                <div key={field.id} className="relative p-4 border rounded-md bg-muted/20 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Date Field */}
                    <FormField
                      control={form.control}
                      name={`itinerary.${index}.date`}
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Date / Дата</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value || undefined}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {/* Day Field */}
                    <FormField
                      control={form.control}
                      name={`itinerary.${index}.day`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Day / День</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Day 1" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* From Field */}
                    <FormField
                      control={form.control}
                      name={`itinerary.${index}.from`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>From / Откуда</FormLabel>
                          <FormControl>
                            <Input placeholder="Origin city/airport" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {/* To Field */}
                    <FormField
                      control={form.control}
                      name={`itinerary.${index}.to`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>To / Куда</FormLabel>
                          <FormControl>
                            <Input placeholder="Destination city/airport" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* ETD Field */}
                    <FormField
                      control={form.control}
                      name={`itinerary.${index}.etd`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ETD / Время отправления (HH:MM)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 09:30" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {/* ETA Field */}
                    <FormField
                      control={form.control}
                      name={`itinerary.${index}.eta`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ETA / Время прибытия (HH:MM)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 14:45" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Flight Class Field */}
                    <FormField
                      control={form.control}
                      name={`itinerary.${index}.flightNumber`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Flight/Rein/Class / Рейс/Класс</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., LH1234, Economy" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Remarks Field */}
                  <FormField
                    control={form.control}
                    name={`itinerary.${index}.remarks`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Remarks / Примечания</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Any additional information about this segment" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  
                  {/* Remove button */}
                  {itineraryFields.length > 1 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2 text-destructive hover:text-destructive/80" 
                      onClick={() => removeItinerary(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              
              {/* Add Itinerary Button */}
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => appendItinerary({ 
                  date: null, 
                  day: '', 
                  from: '', 
                  to: '', 
                  etd: '', 
                  eta: '', 
                  flightNumber: '',
                  remarks: '' 
                })}
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Itinerary Segment
              </Button>
            </div>

            {/* Advance Bank Details Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" />
                Advance Bank Details / Банковские реквизиты для аванса
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="advanceBankDetails.bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Name / Название банка</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter bank name" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="advanceBankDetails.accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number / Номер счета</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter account number" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Advance Amount Requested Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Details for the Amount Requested / Детали по запрашиваемой сумме
                </h3>
              </div>
              
              {advanceAmountFields.map((field, index) => (
                <div key={field.id} className="relative p-4 border rounded-md bg-muted/20 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Date From Field */}
                    <FormField
                      control={form.control}
                      name={`advanceAmountRequested.${index}.dateFrom`}
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Date From / Дата с</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value || undefined}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {/* Date To Field */}
                    <FormField
                      control={form.control}
                      name={`advanceAmountRequested.${index}.dateTo`}
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Date To / Дата по</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value || undefined}
                                onSelect={field.onChange}
                                disabled={(date) => { 
                                  const dateFrom = form.getValues(`advanceAmountRequested.${index}.dateFrom`); 
                                  return !!dateFrom && isValid(dateFrom) && date < dateFrom; 
                                }} 
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Amount Fields */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
                    <FormField 
                      control={form.control} 
                      name={`advanceAmountRequested.${index}.lh`} 
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>LH</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} value={field.value || 0} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} 
                    />
                    <FormField 
                      control={form.control} 
                      name={`advanceAmountRequested.${index}.ma`} 
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MA</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} value={field.value || 0} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} 
                    />
                    <FormField 
                      control={form.control} 
                      name={`advanceAmountRequested.${index}.oa`} 
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>OA</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} value={field.value || 0} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} 
                    />
                    <FormField 
                      control={form.control} 
                      name={`advanceAmountRequested.${index}.tr`} 
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>TR</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} value={field.value || 0} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} 
                    />
                    <FormField 
                      control={form.control} 
                      name={`advanceAmountRequested.${index}.oe`} 
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>OE</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} value={field.value || 0} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} 
                    />
                    <FormField 
                      control={form.control} 
                      name={`advanceAmountRequested.${index}.usd`} 
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>USD</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? 0} readOnly />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} 
                    />
                  </div>
                  
                  {/* Remarks Field */}
                  <FormField 
                    control={form.control} 
                    name={`advanceAmountRequested.${index}.remarks`} 
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Remarks / Примечания</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Remarks for this advance item" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} 
                  />
                  
                  {/* Remove Button */}
                  {advanceAmountFields.length > 1 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2 text-destructive hover:text-destructive/80" 
                      onClick={() => removeAdvanceAmount(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              
              {/* Add Advance Amount Button */}
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => appendAdvanceAmount({ 
                  dateFrom: null, 
                  dateTo: null, 
                  lh: 0, 
                  ma: 0, 
                  oa: 0, 
                  tr: 0, 
                  oe: 0, 
                  usd: '', 
                  remarks: '' 
                })}
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Advance Item
              </Button>
              <FormDescription className="text-xs text-muted-foreground mt-2">
                LH: Lodging/Hotel. MA: Meal Allowance. OA: Other Allowances. TR: Transportation. OE: Other Expenses.
              </FormDescription>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between pt-8 border-t">
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