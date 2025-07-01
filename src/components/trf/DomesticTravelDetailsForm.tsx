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
import type { DomesticTravelSpecificDetails, ItinerarySegment, MealProvisionDetails, AccommodationDetail, CompanyTransportDetail, AccommodationType } from "@/types/trf";
import { cn } from "@/lib/utils";
import { format, isValid, startOfDay } from "date-fns";
import { CalendarIcon, PlusCircle, Trash2, ClipboardList, Utensils, Bed, Car, FileText, Building } from "lucide-react";
import React, { useEffect } from 'react';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const itinerarySegmentSchema = z.object({
  id: z.string().optional(),
  date: z.date({ required_error: "Date is required." }).nullable(),
  day: z.string().min(1, "Day is required."),
  from: z.string().min(1, "Origin is required."),
  to: z.string().min(1, "Destination is required."),
  // Ensure etd and eta are always strings (never undefined) to match interface
  etd: z.string().regex(timeRegex, "Invalid ETD (HH:MM)").optional().or(z.literal("")).transform(val => val || ""),
  eta: z.string().regex(timeRegex, "Invalid ETA (HH:MM)").optional().or(z.literal("")).transform(val => val || ""),
  flightNumber: z.string().min(1, "Flight/Rein is required."),
  flightClass: z.string().default(""), // Added to match interface requirement
  remarks: z.string().optional().transform(val => val || ""), // Ensure remarks is always a string
});

const mealProvisionSchema = z.object({
  dateFromTo: z.string().min(1, "Date From/To is required for meal provision."),
  // Allow both number and string types to match MealProvisionDetails interface
  breakfast: z.union([z.string(), z.number()]).transform(val => String(val) === '' ? '0' : val),
  lunch: z.union([z.string(), z.number()]).transform(val => String(val) === '' ? '0' : val),
  dinner: z.union([z.string(), z.number()]).transform(val => String(val) === '' ? '0' : val),
  supper: z.union([z.string(), z.number()]).transform(val => String(val) === '' ? '0' : val),
  refreshment: z.union([z.string(), z.number()]).transform(val => String(val) === '' ? '0' : val),
});

const accommodationDetailSchema = z.object({
  id: z.string().optional(),
  // Ensure accommodationType is one of the valid types from AccommodationType or empty string
  accommodationType: z.enum(["Hotel/Otels", "Staff House/PKC Kampung/Kinyahli camp", "Other", ""]).transform(val => val === "" ? "Hotel/Otels" : val),
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
  day: z.string().min(1, "Day is required."),
  from: z.string().min(1, "Origin is required."),
  to: z.string().min(1, "Destination is required."),
  btNoRequired: z.string().optional().transform(val => val || ""),
  accommodationTypeN: z.string().optional().transform(val => val || ""),
  address: z.string().optional().transform(val => val || ""),
  remarks: z.string().optional().transform(val => val || ""),
});

const domesticTravelDetailsSchema = z.object({
  purpose: z.string().min(1, "Purpose of travel is required."),
  itinerary: z.array(itinerarySegmentSchema).optional(),
  mealProvision: mealProvisionSchema.optional(),
  accommodationDetails: z.array(accommodationDetailSchema).optional(),
  companyTransportDetails: z.array(companyTransportDetailSchema).optional(),
});

// Define a type that ensures accommodationType can't be empty string in the form
type AccommodationDetailForm = Omit<AccommodationDetail, 'accommodationType'> & {
  accommodationType: "Hotel/Otels" | "Staff House/PKC Kampung/Kinyahli camp" | "Other";
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
  { value: 'Hotel/Otels', label: 'Hotel/Otels' },
  { value: 'Staff House/PKC Kampung/Kinyahli camp', label: 'Staff House/PKC Kampung/Kinyahli camp' },
  { value: 'Other', label: 'Other/Другое' },
];


export default function DomesticTravelDetailsForm({ initialData, onSubmit, onBack }: DomesticTravelDetailsFormProps) {
  // Use the zod schema to infer the form type
  type FormValues = z.infer<typeof domesticTravelDetailsSchema>;
  
  const form = useForm<FormValues>({
    resolver: zodResolver(domesticTravelDetailsSchema),
    defaultValues: {
      purpose: initialData?.purpose || "",
      itinerary: (initialData?.itinerary && initialData.itinerary.length > 0 
        ? initialData.itinerary.map(item => ({ ...item, date: item.date ? new Date(item.date) : null }))
        : [{ date: null, day: '', from: '', to: '', etd: '', eta: '', flightNumber: '', flightClass: '', remarks: '' }]),
      mealProvision: initialData?.mealProvision || { dateFromTo: "", breakfast: 0, lunch: 0, dinner: 0, supper: 0, refreshment: 0 },
      accommodationDetails: (initialData?.accommodationDetails && initialData.accommodationDetails.length > 0
        ? initialData.accommodationDetails.map(item => ({
          ...item,
          checkInDate: item.checkInDate ? new Date(item.checkInDate) : null,
          checkOutDate: item.checkOutDate ? new Date(item.checkOutDate) : null,
          fromDate: item.fromDate ? new Date(item.fromDate) : null,
          toDate: item.toDate ? new Date(item.toDate) : null,
          accommodationType: item.accommodationType || "Hotel/Otels",
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

  const handleSubmit = form.handleSubmit((data) => {
    console.log('DomesticTravelDetailsForm onSubmit called!');
    const formattedData: DomesticTravelSpecificDetails = {
      purpose: data.purpose,
      itinerary: data.itinerary.map(item => ({
        ...item,
        remarks: item.remarks || '',
      })),
      mealProvision: {
        ...data.mealProvision,
      },
      accommodationDetails: (data.accommodationDetails || []).map(item => ({
        ...item,
        remarks: item.remarks || '',
      })),
      companyTransportDetails: (data.companyTransportDetails || []).map(item => ({
        ...item,
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

            {/* Itinerary */}
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
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus /></PopoverContent>
                          </Popover> <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`itinerary.${index}.day`} render={({ field }) => (<FormItem className="xl:col-span-1"><FormLabel>Day / День</FormLabel><FormControl><Input placeholder="e.g. Mon" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.from`} render={({ field }) => (<FormItem className="xl:col-span-1"><FormLabel>From / Откуда</FormLabel><FormControl><Input placeholder="Origin" {...field} value={field.value || ''}/></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.to`} render={({ field }) => (<FormItem className="xl:col-span-1"><FormLabel>To / Куда</FormLabel><FormControl><Input placeholder="Destination" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.etd`} render={({ field }) => (<FormItem className="xl:col-span-1"><FormLabel>ETD / Вылет</FormLabel><FormControl><Input type="time" placeholder="HH:MM" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.eta`} render={({ field }) => (<FormItem className="xl:col-span-1"><FormLabel>ETA / Прилет</FormLabel><FormControl><Input type="time" placeholder="HH:MM" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.flightNumber`} render={({ field }) => (<FormItem className="xl:col-span-1"><FormLabel>Flight / Рейс</FormLabel><FormControl><Input placeholder="Flight #" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                       <FormField control={form.control} name={`itinerary.${index}.remarks`} render={({ field }) => (<FormItem className="xl:col-span-8"><FormLabel>Remarks / Примечания</FormLabel><FormControl><Textarea placeholder="Any remarks for this segment..." {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    {itineraryFields.length > 1 && <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive hover:text-destructive/80" onClick={() => removeItinerary(index)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => appendItinerary({ date: null, day: '', from: '', to: '', etd: '', eta: '', flightNumber: '', flightClass: '', remarks: '' })}> <PlusCircle className="mr-2 h-4 w-4" /> Add Itinerary Segment </Button>
              </CardContent>
            </Card>

            {/* Meal Provision */}
            <Card className="border-dashed">
              <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><Utensils /> Meal Provision in Kiyanly / Питание в Киянлы</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <FormField control={form.control} name="mealProvision.dateFromTo" render={({ field }) => (<FormItem><FormLabel>Date From/To / Даты с/по</FormLabel><FormControl><Input placeholder="e.g., 15 May - 20 May" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <FormField control={form.control} name="mealProvision.breakfast" render={({ field }) => (<FormItem><FormLabel>Breakfast / Завтрак</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value || 0} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="mealProvision.lunch" render={({ field }) => (<FormItem><FormLabel>Lunch / Обед</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value || 0} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="mealProvision.dinner" render={({ field }) => (<FormItem><FormLabel>Dinner / Ужин</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value || 0} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="mealProvision.supper" render={({ field }) => (<FormItem><FormLabel>Supper / Поздний ужин</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value || 0} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="mealProvision.refreshment" render={({ field }) => (<FormItem><FormLabel>Refreshment / Закуски</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value || 0} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                 <FormDescription className="text-xs pt-2">Total/Итого fields are auto-calculated in the PDF/final document.</FormDescription>
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
                          defaultValue={field.value || "Hotel/Otels"}>
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
                      <FormField control={form.control} name={`accommodationDetails.${index}.checkInTime`} render={({ field }) => (<FormItem><FormLabel>Check-in Time / Время заезда</FormLabel><FormControl><Input type="time" placeholder="HH:MM" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
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
                      <FormField control={form.control} name={`accommodationDetails.${index}.checkOutTime`} render={({ field }) => (<FormItem><FormLabel>Check-out Time / Время выезда</FormLabel><FormControl><Input type="time" placeholder="HH:MM" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      
                      {/* New DB schema fields */}
                      <FormField control={form.control} name={`accommodationDetails.${index}.location`} render={({ field }) => (<FormItem><FormLabel>Location / Местоположение</FormLabel><FormControl><Input placeholder="Location" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`accommodationDetails.${index}.placeOfStay`} render={({ field }) => (<FormItem><FormLabel>Place of Stay / Место проживания</FormLabel><FormControl><Input placeholder="Place of Stay" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`accommodationDetails.${index}.estimatedCostPerNight`} render={({ field }) => (<FormItem><FormLabel>Est. Cost Per Night / Примерная стоимость за ночь</FormLabel><FormControl><Input placeholder="0" {...field} value={field.value || '0'} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <FormField control={form.control} name={`accommodationDetails.${index}.remarks`} render={({ field }) => (<FormItem><FormLabel>Remarks / Примечания</FormLabel><FormControl><Textarea placeholder="Accommodation remarks..." {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                    {accommodationFields.length > 1 && <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive hover:text-destructive/80" onClick={() => removeAccommodation(index)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => appendAccommodation({ accommodationType: "Hotel/Otels", checkInDate: null, checkInTime: "", checkOutDate: null, checkOutTime: "", otherTypeDescription: "", remarks: "", location: "", fromDate: null, toDate: null, fromLocation: "", toLocation: "", btNoRequired: "", accommodationTypeN: "", address: "", placeOfStay: "", estimatedCostPerNight: "0" })}> <PlusCircle className="mr-2 h-4 w-4" /> Add Accommodation Entry</Button>
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
                <Button type="button" variant="outline" size="sm" onClick={() => appendTransport({ date: null, day: '', from: '', to: '', btNoRequired: '', accommodationTypeN: '', address: '', remarks: '' })}> <PlusCircle className="mr-2 h-4 w-4" /> Add Transport Request</Button>
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
