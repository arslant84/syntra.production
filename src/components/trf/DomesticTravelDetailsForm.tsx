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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DomesticTravelSpecificDetails, ItinerarySegment, MealProvisionDetails, AccommodationDetail, CompanyTransportDetail, AccommodationType, TripType } from "@/types/trf";
import { cn } from "@/lib/utils";
import { format, isValid, startOfDay, getDay } from "date-fns";
import { CalendarIcon, PlusCircle, Trash2, ClipboardList, Utensils, Bed, Car, FileText, Building } from "lucide-react";
import React, { useEffect } from 'react';
import { DailyMealSelection } from "./DailyMealSelection";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const itinerarySegmentSchema = z.object({
  id: z.string().optional(),
  date: z.date({ required_error: "Date is required." }),
  day: z.string().optional().transform(val => val || ""),
  from: z.string().min(1, "Origin is required."),
  to: z.string().min(1, "Destination is required."),
  // Ensure etd and eta are always strings (never undefined) to match interface
  etd: z.string().optional().refine(val => val === '' || !val || timeRegex.test(val), "Invalid ETD format (HH:MM)").transform(val => val || ""),
  eta: z.string().optional().refine(val => val === '' || !val || timeRegex.test(val), "Invalid ETA format (HH:MM)").transform(val => val || ""),
  flightNumber: z.string().optional().transform(val => val || ""),
  flightClass: z.string().default(""), // Added to match interface requirement
  remarks: z.string().optional().transform(val => val || ""), // Ensure remarks is always a string
});

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
  // Allow both number and string types to match MealProvisionDetails interface
  breakfast: z.union([z.string(), z.number()]).transform(val => String(val) === '' ? '0' : val),
  lunch: z.union([z.string(), z.number()]).transform(val => String(val) === '' ? '0' : val),
  dinner: z.union([z.string(), z.number()]).transform(val => String(val) === '' ? '0' : val),
  supper: z.union([z.string(), z.number()]).transform(val => String(val) === '' ? '0' : val),
  refreshment: z.union([z.string(), z.number()]).transform(val => String(val) === '' ? '0' : val),
  // Daily meal selections (no longer using toggle)
  dailyMealSelections: z.array(dailyMealSelectionSchema).optional(),
});

const accommodationDetailSchema = z.object({
  id: z.string().optional(),
  // Ensure accommodationType is one of the valid types from AccommodationType or empty string
  accommodationType: z.enum(["Hotel/Отели", "Staff House/PKC Kampung/Kiyanly camp", "Other", ""]).transform(val => val === "" ? "Hotel/Отели" : val),
  checkInDate: z.date().nullable(),
  checkInTime: z.string().regex(timeRegex, "Invalid check-in time (HH:MM)").optional().or(z.literal("")).transform(val => val || ""),
  checkOutDate: z.date().nullable(),
  checkOutTime: z.string().regex(timeRegex, "Invalid check-out time (HH:MM)").optional().or(z.literal("")).transform(val => val || ""),
  otherTypeDescription: z.string().optional().transform(val => val || ""),
  remarks: z.string().optional().transform(val => val || ""),
  // Additional fields from DB schema
  location: z.string().optional().transform(val => val || ""),
  fromDate: z.date().nullable(),
  toDate: z.date().nullable(),
  fromLocation: z.string().optional().transform(val => val || ""),
  toLocation: z.string().optional().transform(val => val || ""),
  btNoRequired: z.string().optional().transform(val => val || ""),
  accommodationTypeN: z.string().optional().transform(val => val || ""),
  address: z.string().optional().transform(val => val || ""),
  placeOfStay: z.string().optional().transform(val => val || ""),
  estimatedCostPerNight: z.union([z.string(), z.number()]).optional().transform(val => val === "" ? "0" : val),
}).refine(data => data.accommodationType !== 'Other' || (data.accommodationType === 'Other' && data.otherTypeDescription && data.otherTypeDescription.trim().length > 0), {
  message: "Description for 'Other' accommodation type is required.",
  path: ["otherTypeDescription"],
}).refine(data => {
    if (!data.checkInDate || !data.checkOutDate) return true; // Don't validate if dates are not set
    return startOfDay(data.checkOutDate) >= startOfDay(data.checkInDate);
}, { message: "Check-out date cannot be before check-in date.", path: ["checkOutDate"] });

const companyTransportDetailSchema = z.object({
  id: z.string().optional(),
  date: z.date().nullable(),
  day: z.string().optional().transform(val => val || ""),
  from: z.string().min(1, "Origin is required."),
  to: z.string().min(1, "Destination is required."),
  btNoRequired: z.string().optional().transform(val => val || ""),
  accommodationTypeN: z.string().optional().transform(val => val || ""),
  address: z.string().optional().transform(val => val || ""),
  remarks: z.string().optional().transform(val => val || ""),
});

const domesticTravelDetailsSchema = z.object({
  purpose: z.string().min(1, "Purpose of travel is required."),
  tripType: z.enum(['One Way', 'Round Trip']).default('One Way'),
  itinerary: z.array(itinerarySegmentSchema).min(1, "At least one itinerary segment is required."),
  mealProvision: mealProvisionSchema.optional(),
  accommodationDetails: z.array(accommodationDetailSchema).optional(),
  companyTransportDetails: z.array(companyTransportDetailSchema).optional(),
});

// Define a type that ensures accommodationType can't be empty string in the form
type AccommodationDetailForm = Omit<AccommodationDetail, 'accommodationType'> & {
  accommodationType: "Hotel/Отели" | "Staff House/PKC Kampung/Kiyanly camp" | "Other";
};

// Define FormValues type from the schema with the accommodation type fix
type FormValues = {
  purpose: string;
  itinerary: ItinerarySegment[];
  mealProvision: MealProvisionDetails;
  accommodationDetails: AccommodationDetailForm[];
  companyTransportDetails: CompanyTransportDetail[];
};

interface DomesticTravelDetailsFormProps {
  initialData?: Partial<DomesticTravelSpecificDetails>;
  onSubmit: (data: DomesticTravelSpecificDetails) => void;
  onBack: () => void;
}

const accommodationTypeOptions: { value: AccommodationType; label: string }[] = [
  { value: 'Hotel/Отели', label: 'Hotel/Отели' },
  { value: 'Staff House/PKC Kampung/Kiyanly camp', label: 'Staff House/PKC Kampung/Kiyanly camp' },
  { value: 'Other', label: 'Other/Другое' },
];

const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function DomesticTravelDetailsForm({ initialData, onSubmit, onBack }: DomesticTravelDetailsFormProps) {
  // Use the zod schema to infer the form type
  type FormValues = z.infer<typeof domesticTravelDetailsSchema>;
  
  const form = useForm<FormValues>({
    resolver: zodResolver(domesticTravelDetailsSchema),
    defaultValues: {
      purpose: initialData?.purpose || "",
      tripType: initialData?.tripType || "One Way",
      itinerary: (initialData?.itinerary && initialData.itinerary.length > 0 
        ? initialData.itinerary.map(item => ({ ...item, date: item.date ? new Date(item.date) : null }))
        : [{ date: null, day: '', from: '', to: '', etd: '', eta: '', flightNumber: '', flightClass: '', remarks: '' }]),
      mealProvision: initialData?.mealProvision || { dailyMealSelections: [] },
      accommodationDetails: (initialData?.accommodationDetails && initialData.accommodationDetails.length > 0
        ? initialData.accommodationDetails.map(item => ({
          ...item,
          checkInDate: item.checkInDate ? new Date(item.checkInDate) : null,
          checkOutDate: item.checkOutDate ? new Date(item.checkOutDate) : null,
          fromDate: item.fromDate ? new Date(item.fromDate) : null,
          toDate: item.toDate ? new Date(item.toDate) : null,
          accommodationType: item.accommodationType || "Hotel/Отели",
          location: item.location || "",
          placeOfStay: item.placeOfStay || "",
          estimatedCostPerNight: item.estimatedCostPerNight || "0",
        }))
        : []),
      companyTransportDetails: (initialData?.companyTransportDetails && initialData.companyTransportDetails.length > 0
        ? initialData.companyTransportDetails.map(item => ({
            ...item,
            date: item.date ? new Date(item.date) : null,
            day: item.day || '',
            from: item.from || '',
            to: item.to || '',
            btNoRequired: item.btNoRequired || '',
            accommodationTypeN: item.accommodationTypeN || '',
            address: item.address || '',
            remarks: item.remarks || ''
          }))
        : []),
    },
  });


  const { fields: itineraryFields, append: appendItinerary, remove: removeItinerary } = useFieldArray({ control: form.control, name: "itinerary" });
  const { fields: accommodationFields, append: appendAccommodation, remove: removeAccommodation } = useFieldArray({ control: form.control, name: "accommodationDetails" });
  const { fields: transportFields, append: appendTransport, remove: removeTransport } = useFieldArray({ control: form.control, name: "companyTransportDetails" });

  // Watch trip type and clear itinerary when switching to One Way
  const tripType = form.watch('tripType');
  useEffect(() => {
    if (tripType === 'One Way') {
      if (itineraryFields.length === 0) {
        appendItinerary({ date: null, day: '', from: '', to: '', etd: '', eta: '', flightNumber: '', flightClass: '', remarks: '' });
      } else if (itineraryFields.length > 1) {
        form.setValue('itinerary', [itineraryFields[0]]);
      }
    } else if (tripType === 'Round Trip' && itineraryFields.length === 0) {
      appendItinerary({ date: null, day: '', from: '', to: '', etd: '', eta: '', flightNumber: '', flightClass: '', remarks: '' });
    }
    // Only run when tripType or itineraryFields.length changes
  }, [tripType, itineraryFields.length]);

  // Watch itinerary changes to auto-populate accommodation dates
  const currentItinerary = form.watch("itinerary");
  useEffect(() => {
    console.log('DomesticTravelDetailsForm: Itinerary changed, updating accommodation dates');
    
    if (!currentItinerary || currentItinerary.length === 0) {
      console.log('DomesticTravelDetailsForm: No itinerary data, skipping accommodation date sync');
      return;
    }

    // Get valid dates from itinerary segments
    const validDates = currentItinerary
      .filter(item => item.date && isValid(item.date))
      .map(item => item.date)
      .sort((a, b) => a.getTime() - b.getTime());

    if (validDates.length === 0) {
      console.log('DomesticTravelDetailsForm: No valid dates in itinerary, skipping accommodation date sync');
      return;
    }

    const firstDate = validDates[0]; // Check-in date (arrival/departure date from segment 1)
    const lastDate = validDates[validDates.length - 1]; // Check-out date (return date from last segment)

    console.log('DomesticTravelDetailsForm: Syncing accommodation dates:', {
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
        console.log(`DomesticTravelDetailsForm: Updated check-in date for accommodation ${index + 1}`);
      }

      if (!currentCheckOut || currentCheckOut.getTime() !== lastDate.getTime()) {
        form.setValue(`accommodationDetails.${index}.checkOutDate`, lastDate);
        console.log(`DomesticTravelDetailsForm: Updated check-out date for accommodation ${index + 1}`);
      }
    });
  }, [
    currentItinerary?.length,
    // Watch for changes in the actual date values within segments
    currentItinerary?.map(item => item.date?.getTime() || 0).join(','),
    accommodationFields.length
  ]);

  // Watch itinerary and accommodation changes to auto-populate transport data
  const currentAccommodation = form.watch("accommodationDetails");
  useEffect(() => {
    console.log('DomesticTravelDetailsForm: Itinerary/Accommodation changed, updating transport data');
    
    if (!currentItinerary || currentItinerary.length === 0) {
      console.log('DomesticTravelDetailsForm: No itinerary data, skipping transport sync');
      return;
    }

    // Get the first valid date from itinerary (pick-up date)
    const firstValidDate = currentItinerary
      .filter(item => item.date && isValid(item.date))
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0]?.date;

    if (!firstValidDate) {
      console.log('DomesticTravelDetailsForm: No valid first date in itinerary, skipping transport sync');
      return;
    }

    // Get accommodation type for Accom. № Type
    const firstAccommodationType = currentAccommodation && currentAccommodation.length > 0 
      ? currentAccommodation[0].accommodationType 
      : null;

    const pickUpDate = firstValidDate;
    const dayOfWeek = weekdayNames[getDay(pickUpDate)];
    
    // Map accommodation type to transport accommodation type
    const transportAccommodationType = firstAccommodationType 
      ? (firstAccommodationType === 'Hotel/Отели' ? 'Hotel' 
         : firstAccommodationType === 'Staff House/PKC Kampung/Kiyanly camp' ? 'Camp'
         : firstAccommodationType === 'Other' ? 'Other' 
         : '')
      : '';

    console.log('DomesticTravelDetailsForm: Syncing transport data:', {
      pickUpDate: pickUpDate.toDateString(),
      dayOfWeek: dayOfWeek,
      accommodationType: transportAccommodationType,
      transportCount: transportFields.length
    });

    // Update all existing transport entries
    transportFields.forEach((_, index) => {
      const currentDate = form.getValues(`companyTransportDetails.${index}.date`);
      const currentDay = form.getValues(`companyTransportDetails.${index}.day`);
      const currentAccomType = form.getValues(`companyTransportDetails.${index}.accommodationTypeN`);

      // Update pick-up date if not set or different from first itinerary date
      if (!currentDate || currentDate.getTime() !== pickUpDate.getTime()) {
        form.setValue(`companyTransportDetails.${index}.date`, pickUpDate);
        console.log(`DomesticTravelDetailsForm: Updated transport ${index + 1} date`);
      }

      // Update day based on pick-up date
      if (currentDay !== dayOfWeek) {
        form.setValue(`companyTransportDetails.${index}.day`, dayOfWeek);
        console.log(`DomesticTravelDetailsForm: Updated transport ${index + 1} day to ${dayOfWeek}`);
      }

      // Update accommodation type if available and different
      if (transportAccommodationType && currentAccomType !== transportAccommodationType) {
        form.setValue(`companyTransportDetails.${index}.accommodationTypeN`, transportAccommodationType);
        console.log(`DomesticTravelDetailsForm: Updated transport ${index + 1} accommodation type to ${transportAccommodationType}`);
      }
    });
  }, [
    currentItinerary?.length,
    currentItinerary?.map(item => item.date?.getTime() || 0).join(','),
    currentAccommodation?.length,
    currentAccommodation?.map(item => item.accommodationType).join(','),
    transportFields.length
  ]);

  const handleSubmit = form.handleSubmit((data) => {
    console.log('DomesticTravelDetailsForm onSubmit called!');
    const formattedData: DomesticTravelSpecificDetails = {
      purpose: data.purpose,
      tripType: data.tripType,
      itinerary: data.itinerary.map(item => ({
        ...item,
        day: item.date && isValid(item.date) ? weekdayNames[getDay(item.date)] : '',
        remarks: item.remarks || '',
      })),
      mealProvision: {
        ...data.mealProvision,
      },
      accommodationDetails: (data.accommodationDetails || []).map(item => ({
        ...item,
        remarks: item.remarks || '',
      })),
      companyTransportDetails: (data.companyTransportDetails || [])
        .filter(item => item.from && item.to && item.date) // Only include transport requests with essential fields
        .map(item => ({
          ...item,
          day: item.date && isValid(item.date) ? weekdayNames[getDay(item.date)] : '',
          remarks: item.remarks || '',
        })),
    };
    onSubmit(formattedData);
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="w-full shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
              <Building className="w-6 h-6 md:w-7 md:w-7 text-primary" />
              Domestic Travel Details
            </CardTitle>
            <CardDescription>Fill in the details for your domestic business trip.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Purpose of Travel */}
            <FormField control={form.control} name="purpose" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-lg font-semibold flex items-center gap-2"><FileText /> Purpose of Travel / Цель поездки</FormLabel>
                <FormControl><Textarea placeholder="Describe the purpose of your travel..." className="min-h-[100px] resize-y" {...field} value={field.value || ''} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Trip Type */}
            <FormField control={form.control} name="tripType" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-lg font-semibold flex items-center gap-2"><ClipboardList /> Trip Type / Тип поездки</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select trip type" />
                    </SelectTrigger>
                  </FormControl>
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
                    <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-8 gap-4 items-start">
                      <FormField control={form.control} name={`itinerary.${index}.date`} render={({ field }) => (
                        <FormItem className="xl:col-span-1"> <FormLabel>Date / Дата</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button variant={"outline"} className={cn("w-full h-10 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}> {field.value && isValid(field.value) ? format(field.value, "PPP") : <span>Pick date</span>} <CalendarIcon className="ml-auto h-4 w-4 opacity-50" /> </Button>
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
                      <div className="xl:col-span-1 flex flex-col">
                        <label className="block text-sm font-medium mb-1">Day / День</label>
                        <div className="w-full h-10 px-3 py-2 rounded border bg-muted/50 flex items-center text-base">
                          {(() => {
                            const date = form.getValues(`itinerary.${index}.date`);
                            return date && isValid(date) ? weekdayNames[getDay(date)] : '—';
                          })()}
                        </div>
                      </div>
                      <FormField control={form.control} name={`itinerary.${index}.from`} render={({ field }) => (<FormItem className="xl:col-span-1"><FormLabel>From / Откуда</FormLabel><FormControl><Input placeholder="Origin" {...field} value={field.value || ''}/></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.to`} render={({ field }) => (<FormItem className="xl:col-span-1"><FormLabel>To / Куда</FormLabel><FormControl><Input placeholder="Destination" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                                              <FormField control={form.control} name={`itinerary.${index}.etd`} render={({ field }) => (<FormItem className="xl:col-span-1"><FormLabel>ETD / Вылет</FormLabel><FormControl><Input type="time" placeholder="HH:MM" step="900" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.eta`} render={({ field }) => (<FormItem className="xl:col-span-1"><FormLabel>ETA / Прилет</FormLabel><FormControl><Input type="time" placeholder="HH:MM" step="900" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`itinerary.${index}.flightNumber`} render={({ field }) => (<FormItem className="xl:col-span-1"><FormLabel>Flight / Рейс</FormLabel><FormControl><Input placeholder="Flight #" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                         <FormField control={form.control} name={`itinerary.${index}.remarks`} render={({ field }) => (<FormItem className="xl:col-span-8"><FormLabel>Remarks / Примечания</FormLabel><FormControl><Textarea placeholder="Any remarks for this segment..." {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    {/* Only allow removing if more than 1 segment and tripType is Round Trip */}
                    {itineraryFields.length > 1 && tripType === 'Round Trip' && (
                      <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive hover:text-destructive/80" onClick={() => removeItinerary(index)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                ))}
                {/* Add button logic: show for Round Trip only */}
                {tripType === 'Round Trip' && (
                  <Button type="button" variant="outline" size="sm" onClick={() => appendItinerary({ date: null, day: '', from: '', to: '', etd: '', eta: '', flightNumber: '', flightClass: '', remarks: '' })}> <PlusCircle className="mr-2 h-4 w-4" /> Add Itinerary Segment </Button>
                )}
              </CardContent>
            </Card>

            {/* Meal Provision */}
            <Card className="border-dashed">
              <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><Utensils /> Meal Provision in Kiyanly / Питание в Киянлы</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <DailyMealSelection />
              </CardContent>
            </Card>

            {/* Accommodation */}
            <Card className="border-dashed">
              <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><Bed /> Accommodation / Жильё</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {accommodationFields.map((item, index) => (
                  <div key={item.id} className="p-4 border rounded-md space-y-3 relative bg-background/50">
                    <h4 className="font-medium text-md">Accommodation Entry {index + 1}</h4>
                     <FormField control={form.control} name={`accommodationDetails.${index}.accommodationType`} render={({ field }) => (
                      <FormItem><FormLabel>Accommodation / Жильё</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            // Reset otherTypeDescription if another type is chosen
                            if (value !== 'Other') {
                              form.setValue(`accommodationDetails.${index}.otherTypeDescription`, '');
                            }
                          }}
                          defaultValue={field.value || "Hotel/Отели"}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select accommodation type" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {accommodationTypeOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                    {form.watch(`accommodationDetails.${index}.accommodationType`) === 'Other' && (
                      <FormField control={form.control} name={`accommodationDetails.${index}.otherTypeDescription`} render={({ field }) => (<FormItem><FormLabel>Other Type Description / Описание другого типа</FormLabel><FormControl><Input placeholder="Specify other accommodation" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                      <FormField control={form.control} name={`accommodationDetails.${index}.checkInDate`} render={({ field }) => (
                        <FormItem><FormLabel>Check-in Date / Дата заезда</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button variant={"outline"} className={cn("w-full h-10 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value && isValid(field.value) ? format(field.value, "PPP") : <span>Pick date</span>} <CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus /></PopoverContent>
                          </Popover><FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`accommodationDetails.${index}.checkInTime`} render={({ field }) => (<FormItem><FormLabel>Check-in Time / Время заезда</FormLabel><FormControl><Input type="time" placeholder="HH:MM" step="900" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`accommodationDetails.${index}.checkOutDate`} render={({ field }) => (
                        <FormItem><FormLabel>Check-out Date / Дата выезда</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button variant={"outline"} className={cn("w-full h-10 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value && isValid(field.value) ? format(field.value, "PPP") : <span>Pick date</span>} <CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button>
                              </FormControl> 
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} 
                                disabled={(date) => {
                                  const checkInD = form.getValues(`accommodationDetails.${index}.checkInDate`);
                                  return !!checkInD && isValid(checkInD) && startOfDay(date) < startOfDay(checkInD);
                                }}
                                initialFocus />
                            </PopoverContent>
                          </Popover><FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`accommodationDetails.${index}.checkOutTime`} render={({ field }) => (<FormItem><FormLabel>Check-out Time / Время выезда</FormLabel><FormControl><Input type="time" placeholder="HH:MM" step="900" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      
                      {/* New DB schema fields */}
                      {form.watch(`accommodationDetails.${index}.accommodationType`) !== 'Staff House/PKC Kampung/Kiyanly camp' && (
                        <>
                          <FormField control={form.control} name={`accommodationDetails.${index}.location`} render={({ field }) => (<FormItem><FormLabel>Location / Местоположение</FormLabel><FormControl><Input placeholder="Location" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name={`accommodationDetails.${index}.placeOfStay`} render={({ field }) => (<FormItem><FormLabel>Place of Stay / Место проживания</FormLabel><FormControl><Input placeholder="Place of Stay" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name={`accommodationDetails.${index}.estimatedCostPerNight`} render={({ field }) => (<FormItem><FormLabel>Est. Cost Per Night / Примерная стоимость за ночь</FormLabel><FormControl><Input placeholder="0" {...field} value={field.value || '0'} /></FormControl><FormMessage /></FormItem>)} />
                        </>
                      )}
                    </div>
                    <FormField control={form.control} name={`accommodationDetails.${index}.remarks`} render={({ field }) => (<FormItem><FormLabel>Remarks / Примечания</FormLabel><FormControl><Textarea placeholder="Accommodation remarks..." {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                    {accommodationFields.length > 1 && <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive hover:text-destructive/80" onClick={() => removeAccommodation(index)}><Trash2 className="h-4 w-4" /></Button>}
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
                    accommodationType: "Hotel/Отели", 
                    checkInDate: checkInDate, 
                    checkInTime: "", 
                    checkOutDate: checkOutDate, 
                    checkOutTime: "", 
                    otherTypeDescription: "", 
                    remarks: "", 
                    location: "", 
                    fromDate: null, 
                    toDate: null, 
                    fromLocation: "", 
                    toLocation: "", 
                    btNoRequired: "", 
                    accommodationTypeN: "", 
                    address: "", 
                    placeOfStay: "", 
                    estimatedCostPerNight: "0" 
                  });
                }}> <PlusCircle className="mr-2 h-4 w-4" /> Add Accommodation Entry</Button>
              </CardContent>
            </Card>
            
            {/* Company Transport */}
            <Card className="border-dashed">
              <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><Car /> Company Transport / Транспорт компании</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {transportFields.map((item, index) => (
                  <div key={item.id} className="p-4 border rounded-md space-y-3 relative bg-background/50">
                    <h4 className="font-medium text-md">Transport Request {index + 1}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                      <FormField control={form.control} name={`companyTransportDetails.${index}.date`} render={({ field }) => (
                        <FormItem><FormLabel>Date / Дата</FormLabel>
                           <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button variant={"outline"} className={cn("w-full h-10 pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value && isValid(field.value) ? format(field.value, "PPP") : <span>Pick date</span>} <CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus /></PopoverContent>
                          </Popover><FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`companyTransportDetails.${index}.day`} render={({ field }) => (<FormItem><FormLabel>Day / День</FormLabel><FormControl><Input placeholder="e.g., Mon" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`companyTransportDetails.${index}.from`} render={({ field }) => (<FormItem><FormLabel>From / Откуда</FormLabel><FormControl><Input placeholder="Origin" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`companyTransportDetails.${index}.to`} render={({ field }) => (<FormItem><FormLabel>To / Куда</FormLabel><FormControl><Input placeholder="Destination" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`companyTransportDetails.${index}.btNoRequired`} render={({ field }) => (<FormItem><FormLabel>BT No (if req) / № ком.</FormLabel><FormControl><Input placeholder="BT Number" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`companyTransportDetails.${index}.accommodationTypeN`} render={({ field }) => (<FormItem><FormLabel>Accom. № Type / № Тип жилья</FormLabel><FormControl><Input placeholder="e.g., Hotel ABC" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`companyTransportDetails.${index}.address`} render={({ field }) => (<FormItem className="lg:col-span-2"><FormLabel>Address / Адрес</FormLabel><FormControl><Input placeholder="Full address" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <FormField control={form.control} name={`companyTransportDetails.${index}.remarks`} render={({ field }) => (<FormItem><FormLabel>Remarks / Примечания</FormLabel><FormControl><Textarea placeholder="Transport remarks..." {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                    <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive hover:text-destructive/80" onClick={() => removeTransport(index)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  // Get data from itinerary and accommodation to pre-populate new transport entry
                  const itinerary = form.getValues("itinerary");
                  const accommodation = form.getValues("accommodationDetails");
                  
                  // Get first valid date from itinerary for pick-up date
                  const firstValidDate = itinerary
                    .filter(item => item.date && isValid(item.date))
                    .sort((a, b) => a.date.getTime() - b.date.getTime())[0]?.date;
                  
                  const dayOfWeek = firstValidDate ? weekdayNames[getDay(firstValidDate)] : '';
                  
                  // Get accommodation type for Accom. № Type
                  const firstAccommodationType = accommodation && accommodation.length > 0 
                    ? accommodation[0].accommodationType 
                    : null;
                  
                  const transportAccommodationType = firstAccommodationType 
                    ? (firstAccommodationType === 'Hotel/Отели' ? 'Hotel' 
                       : firstAccommodationType === 'Staff House/PKC Kampung/Kiyanly camp' ? 'Camp'
                       : firstAccommodationType === 'Other' ? 'Other' 
                       : '')
                    : '';
                  
                  appendTransport({ 
                    date: firstValidDate || null, 
                    day: dayOfWeek, 
                    from: '', 
                    to: '', 
                    btNoRequired: '', 
                    accommodationTypeN: transportAccommodationType, 
                    address: '', 
                    remarks: '' 
                  });
                }}> <PlusCircle className="mr-2 h-4 w-4" /> Add Transport Request</Button>
              </CardContent>
            </Card>

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
