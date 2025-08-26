
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { ExternalPartiesTravelSpecificDetails, ItinerarySegment, ExternalPartyAccommodationDetail, MealProvisionDetails, TripType } from "@/types/trf";
import { cn } from "@/lib/utils";
import { format, isValid, startOfDay, getDay } from "date-fns";
import { CalendarIcon, PlusCircle, Trash2, ClipboardList, Utensils, Bed, FileText, Users } from "lucide-react"; // Removed Car
import React, { useEffect } from 'react'; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DailyMealSelection } from "./DailyMealSelection";

const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM format

const itinerarySegmentSchema = z.object({
  id: z.string().optional(),
  date: z.date({ required_error: "Date is required." }),
  day: z.string().optional().transform(val => val || ""),
  from: z.string().min(1, "Origin is required."),
  to: z.string().min(1, "Destination is required."),
  etd: z.string().regex(timeRegex, "Invalid ETD (HH:MM)").optional().or(z.literal("")),
  eta: z.string().regex(timeRegex, "Invalid ETA (HH:MM)").optional().or(z.literal("")),
  flightNumber: z.string().min(1, "Flight/Rein is required."),
  remarks: z.string().optional(),
});

const externalPartyAccommodationDetailSchema = z.object({
  id: z.string().optional(),
  checkInDate: z.date({ required_error: "Check-in date is required."}),
  checkOutDate: z.date({ required_error: "Check-out date is required."}),
  placeOfStay: z.string().min(1, "Place of stay is required."),
  estimatedCostPerNight: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? null : Number(val),
    z.number().nonnegative("Must be a non-negative number").optional().nullable()
  ),
  remarks: z.string().optional(),
}).refine(data => {
    if (!data.checkInDate || !data.checkOutDate || !isValid(data.checkInDate) || !isValid(data.checkOutDate)) return true;
    return data.checkOutDate >= data.checkInDate;
  }, { message: "Check-out date cannot be before check-in date.", path: ["checkOutDate"] });

const dailyMealSelectionSchema = z.object({
  id: z.string().optional(),
  trf_id: z.string().optional(),
  meal_date: z.coerce.date(),
  breakfast: z.boolean(),
  lunch: z.boolean(),
  dinner: z.boolean(),
  supper: z.boolean(),
  refreshment: z.boolean(),
});

const mealProvisionSchema = z.object({
  dateFromTo: z.string().optional().transform(val => val || ""),
  breakfast: z.preprocess(val => String(val).trim() === '' ? 0 : Number(val), z.number().int().nonnegative().optional()),
  lunch: z.preprocess(val => String(val).trim() === '' ? 0 : Number(val), z.number().int().nonnegative().optional()),
  dinner: z.preprocess(val => String(val).trim() === '' ? 0 : Number(val), z.number().int().nonnegative().optional()),
  supper: z.preprocess(val => String(val).trim() === '' ? 0 : Number(val), z.number().int().nonnegative().optional()),
  refreshment: z.preprocess(val => String(val).trim() === '' ? 0 : Number(val), z.number().int().nonnegative().optional()),
  // Daily meal selections (no longer using toggle)
  dailyMealSelections: z.array(dailyMealSelectionSchema).optional(),
});

const externalPartiesTravelDetailsSchema = z.object({
  purpose: z.string().min(1, "Purpose of travel is required."),
  tripType: z.enum(['One Way', 'Round Trip']).default('One Way'),
  itinerary: z.array(itinerarySegmentSchema).superRefine((segments, ctx) => {
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].date && segments[i-1].date && segments[i].date < segments[i-1].date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Segment ${i+1} date cannot be before segment ${i} date`,
          path: [i, "date"]
        });
      }
    }
  }),
  accommodationDetails: z.array(externalPartyAccommodationDetailSchema).optional(),
  mealProvision: mealProvisionSchema.optional(),
});

interface ExternalPartiesTravelDetailsFormProps {
  initialData?: Partial<ExternalPartiesTravelSpecificDetails>;
  onSubmit: (data: ExternalPartiesTravelSpecificDetails) => void;
  onBack: () => void;
}

export default function ExternalPartiesTravelDetailsForm({ initialData, onSubmit, onBack }: ExternalPartiesTravelDetailsFormProps) {
  const form = useForm<ExternalPartiesTravelSpecificDetails>({
    resolver: zodResolver(externalPartiesTravelDetailsSchema),
    defaultValues: {
      purpose: initialData?.purpose || "",
      tripType: initialData?.tripType || "One Way",
      itinerary: (initialData?.itinerary && initialData.itinerary.length > 0
        ? initialData.itinerary.map(item => ({ 
            ...item, 
            date: item.date ? new Date(item.date) : null 
          }))
        : [{ date: null, day: '', from: '', to: '', etd: '', eta: '', flightNumber: '', remarks: '' }]),
      accommodationDetails: (initialData?.accommodationDetails && initialData.accommodationDetails.length > 0
        ? initialData.accommodationDetails.map(item => ({
            ...item,
            checkInDate: item.checkInDate ? new Date(item.checkInDate) : null,
            checkOutDate: item.checkOutDate ? new Date(item.checkOutDate) : null,
            estimatedCostPerNight: Number(item.estimatedCostPerNight || 0),
          }))
        : []),
      mealProvision: initialData?.mealProvision || { dailyMealSelections: [] },
    },
  });


  const { fields: itineraryFields, append: appendItinerary, remove: removeItinerary } = useFieldArray({ control: form.control, name: "itinerary" });
  const { fields: accommodationFields, append: appendAccommodation, remove: removeAccommodation } = useFieldArray({ control: form.control, name: "accommodationDetails" });

  // Watch trip type and clear itinerary when switching to One Way
  const tripType = form.watch('tripType');
  useEffect(() => {
    if (tripType === 'One Way') {
      if (itineraryFields.length === 0) {
        appendItinerary({ date: null, day: '', from: '', to: '', etd: '', eta: '', flightNumber: '', remarks: '' });
      } else if (itineraryFields.length > 1) {
        form.setValue('itinerary', [itineraryFields[0]]);
      }
    } else if (tripType === 'Round Trip' && itineraryFields.length === 0) {
      appendItinerary({ date: null, day: '', from: '', to: '', etd: '', eta: '', flightNumber: '', remarks: '' });
    }
  }, [tripType, itineraryFields.length]);

  // Auto-populate day field when date changes
  useEffect(() => {
    itineraryFields.forEach((item, idx) => {
      const date = form.getValues(`itinerary.${idx}.date`);
      if (date && isValid(date)) {
        const dayName = weekdayNames[getDay(date)];
        if (form.getValues(`itinerary.${idx}.day`) !== dayName) {
          form.setValue(`itinerary.${idx}.day`, dayName);
        }
      }
    });
  }, [itineraryFields.length, itineraryFields.map(f => form.getValues(`itinerary.${f.id}.date`)).join(",")]);

  // Watch itinerary changes to auto-populate accommodation dates
  const currentItinerary = form.watch("itinerary");
  useEffect(() => {
    console.log('ExternalPartiesTravelDetailsForm: Itinerary changed, updating accommodation dates');
    
    if (!currentItinerary || currentItinerary.length === 0) {
      console.log('ExternalPartiesTravelDetailsForm: No itinerary data, skipping accommodation date sync');
      return;
    }

    // Get valid dates from itinerary segments
    const validDates = currentItinerary
      .filter(item => item.date && isValid(item.date))
      .map(item => item.date)
      .sort((a, b) => a.getTime() - b.getTime());

    if (validDates.length === 0) {
      console.log('ExternalPartiesTravelDetailsForm: No valid dates in itinerary, skipping accommodation date sync');
      return;
    }

    const firstDate = validDates[0]; // Check-in date (arrival/departure date from segment 1)
    const lastDate = validDates[validDates.length - 1]; // Check-out date (return date from last segment)

    console.log('ExternalPartiesTravelDetailsForm: Syncing accommodation dates:', {
      checkIn: firstDate.toDateString(),
      checkOut: lastDate.toDateString(),
      accommodationCount: accommodationFields.length
    });

    // Update all existing accommodation entries with the travel period dates
    accommodationFields.forEach((_, index) => {
      const currentCheckIn = form.getValues(`accommodationDetails.${index}.checkInDate`);
      const currentCheckOut = form.getValues(`accommodationDetails.${index}.checkOutDate`);

      // Only update if dates are not already set, or if they're different from itinerary dates
      if (!currentCheckIn || currentCheckIn.getTime() !== firstDate.getTime()) {
        form.setValue(`accommodationDetails.${index}.checkInDate`, firstDate);
        console.log(`ExternalPartiesTravelDetailsForm: Updated check-in date for accommodation ${index + 1}`);
      }

      if (!currentCheckOut || currentCheckOut.getTime() !== lastDate.getTime()) {
        form.setValue(`accommodationDetails.${index}.checkOutDate`, lastDate);
        console.log(`ExternalPartiesTravelDetailsForm: Updated check-out date for accommodation ${index + 1}`);
      }
    });
  }, [
    currentItinerary?.length,
    // Watch for changes in the actual date values within segments
    currentItinerary?.map(item => item.date?.getTime() || 0).join(','),
    accommodationFields.length
  ]);

  const handleFormSubmit = (data: z.infer<typeof externalPartiesTravelDetailsSchema>) => {
    console.log('ExternalPartiesTravelDetailsForm: Form submission successful, data:', data);
    const formattedData: ExternalPartiesTravelSpecificDetails = {
      ...data,
      itinerary: data.itinerary.map(item => ({
        ...item,
        date: item.date ? new Date(item.date) : null,
        day: item.day || (item.date && isValid(new Date(item.date)) ? weekdayNames[getDay(new Date(item.date))] : ''),
        remarks: item.remarks || '',
      })),
      accommodationDetails: data.accommodationDetails
        ?.filter(detail => detail.checkInDate && detail.checkOutDate) // Only include accommodation with dates
        ?.map(detail => ({
          ...detail,
          checkInDate: detail.checkInDate ? new Date(detail.checkInDate) : null,
          checkOutDate: detail.checkOutDate ? new Date(detail.checkOutDate) : null,
          estimatedCostPerNight: Number(detail.estimatedCostPerNight) || 0,
          placeOfStay: detail.placeOfStay || '',
          remarks: detail.remarks || '',
        })) || [],
      mealProvision: data.mealProvision,
    };
    onSubmit(formattedData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8">
        <Card className="w-full shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
              <Users className="w-6 h-6 md:w-7 md:w-7 text-primary" />
              External Party Travel Details
            </CardTitle>
            <CardDescription>Fill in the travel details for the external party.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Purpose of Travel */}
            <FormField control={form.control} name="purpose" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-lg font-semibold flex items-center gap-2"><FileText /> Purpose of Travel / Цель поездки</FormLabel>
                <FormControl><Textarea placeholder="Describe the purpose of travel..." className="min-h-[100px] resize-y" {...field} value={field.value || ''} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Trip Type */}
            <FormField control={form.control} name="tripType" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-lg font-semibold flex items-center gap-2"><ClipboardList /> Trip Type / Тип поездки</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a trip type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="One Way">One Way</SelectItem>
                    <SelectItem value="Round Trip">Round Trip</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Always show itinerary section */}
            <Card className="border-dashed">
              <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><ClipboardList /> Itinerary / Маршрут</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {itineraryFields.map((item, index) => (
                  <div key={item.id} className="p-4 border rounded-md space-y-3 relative bg-background/50">
                    <h4 className="font-medium text-md">Segment {index + 1}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <FormField control={form.control} name={`itinerary.${index}.date`} render={({ field }) => (
                        <FormItem className="flex flex-col"> <FormLabel>Date / Дата</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value && isValid(field.value) ? format(field.value, "PPP") : <span>Pick date</span>} <CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button>
                              </FormControl>
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
                      <div className="flex flex-col">
                        <label className="block text-sm font-medium mb-1">Day / День</label>
                        <div className="w-full h-10 px-3 py-2 rounded border bg-muted/50 flex items-center text-base">
                          {(() => {
                            const date = form.getValues(`itinerary.${index}.date`);
                            return date && isValid(date) ? weekdayNames[getDay(date)] : '—';
                          })()}
                        </div>
                      </div>
                      <FormField control={form.control} name={`itinerary.${index}.from`} render={({ field }) => (<FormItem><FormLabel>From / Откуда</FormLabel><FormControl><Input placeholder="Origin" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.to`} render={({ field }) => (<FormItem><FormLabel>To / Куда</FormLabel><FormControl><Input placeholder="Destination" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.etd`} render={({ field }) => (<FormItem><FormLabel>ETD / Вылет</FormLabel><FormControl><Input type="time" placeholder="HH:MM" step="900" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.eta`} render={({ field }) => (<FormItem><FormLabel>ETA / Прилет</FormLabel><FormControl><Input type="time" placeholder="HH:MM" step="900" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.flightNumber`} render={({ field }) => (<FormItem><FormLabel>Flight / Рейс</FormLabel><FormControl><Input placeholder="Flight #" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                       <FormField control={form.control} name={`itinerary.${index}.remarks`} render={({ field }) => (<FormItem className="lg:col-span-full"><FormLabel>Remarks / Примечания</FormLabel><FormControl><Textarea placeholder="Any remarks for this segment..." {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    {/* Only allow removing if more than 1 segment and tripType is Round Trip */}
                    {itineraryFields.length > 1 && tripType === 'Round Trip' && (
                      <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive hover:text-destructive/80" onClick={() => removeItinerary(index)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                ))}
                {/* Add button logic: show for Round Trip only */}
                {tripType === 'Round Trip' && (
                  <Button type="button" variant="outline" size="sm" onClick={() => appendItinerary({ date: null, day: '', from: '', to: '', etd: '', eta: '', flightNumber: '', remarks: '' })}> <PlusCircle className="mr-2 h-4 w-4" /> Add Itinerary Segment </Button>
                )}
              </CardContent>
            </Card>

            {/* Accommodation */}
            <Card className="border-dashed">
              <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><Bed /> Accommodation / Жильё</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {accommodationFields.map((item, index) => (
                  <div key={item.id} className="p-4 border rounded-md space-y-3 relative bg-background/50">
                    <h4 className="font-medium text-md">Accommodation Entry {index + 1}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name={`accommodationDetails.${index}.checkInDate`} render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Check-in Date / Заезд</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                  {field.value && isValid(field.value) ? format(field.value, "PPP") : <span>Pick date</span>} <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus /></PopoverContent>
                          </Popover><FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`accommodationDetails.${index}.checkOutDate`} render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Check-out Date / Выезд</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                  {field.value && isValid(field.value) ? format(field.value, "PPP") : <span>Pick date</span>} <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} 
                                disabled={(date) => {
                                  const checkInD = form.getValues(`accommodationDetails.${index}.checkInDate`);
                                  return !!checkInD && isValid(checkInD) && date < checkInD;
                                }}
                                initialFocus />
                            </PopoverContent>
                          </Popover><FormMessage />
                        </FormItem>
                      )} />
                    </div>
                     <FormField control={form.control} name={`accommodationDetails.${index}.placeOfStay`} render={({ field }) => (<FormItem><FormLabel>Place of stay / Место проживания</FormLabel><FormControl><Input placeholder="e.g., Hotel Name / Address" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name={`accommodationDetails.${index}.estimatedCostPerNight`} render={({ field }) => (<FormItem><FormLabel>Est. cost per night / Примерная ст-мость в сутки</FormLabel><FormControl><Input type="number" placeholder="e.g., 100" {...field} value={field.value || '0'} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name={`accommodationDetails.${index}.remarks`} render={({ field }) => (<FormItem><FormLabel>Remarks / Примечания</FormLabel><FormControl><Textarea placeholder="Accommodation remarks..." {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                    <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive hover:text-destructive/80" onClick={() => removeAccommodation(index)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  // Get travel dates from itinerary to pre-populate new accommodation entry
                  const itinerary = form.getValues("itinerary");
                  const validDates = itinerary
                    .filter(item => item.date && isValid(item.date))
                    .map(item => item.date)
                    .sort((a, b) => a.getTime() - b.getTime());
                  
                  const checkInDate = validDates.length > 0 ? validDates[0] : null;
                  const checkOutDate = validDates.length > 0 ? validDates[validDates.length - 1] : null;
                  
                  appendAccommodation({ 
                    checkInDate: checkInDate, 
                    checkOutDate: checkOutDate, 
                    placeOfStay: '', 
                    estimatedCostPerNight: '', 
                    remarks: '' 
                  });
                }}> <PlusCircle className="mr-2 h-4 w-4" /> Add Accommodation Entry</Button>
              </CardContent>
            </Card>

            {/* Meal Provision */}
            <Card className="border-dashed">
              <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><Utensils /> Meal Provision in Kiyanly / Питание в Киянлы</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <DailyMealSelection />
              </CardContent>
            </Card>

          </CardContent>
          <CardFooter className="flex justify-between pt-8 border-t">
            <Button type="button" variant="outline" onClick={onBack}>
              Back: Requestor Info
            </Button>
            <Button 
              type="submit" 
              onClick={() => {
                const errors = form.formState.errors;
                if (Object.keys(errors).length > 0) {
                  console.log('ExternalPartiesTravelDetailsForm: Form validation errors preventing submission:', errors);
                }
              }}
            >
              Next: Approval &amp; Submission
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
