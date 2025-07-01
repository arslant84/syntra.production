
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
import type { ExternalPartiesTravelSpecificDetails, ItinerarySegment, ExternalPartyAccommodationDetail, MealProvisionDetails } from "@/types/trf";
import { cn } from "@/lib/utils";
import { format, isValid, startOfDay } from "date-fns";
import { CalendarIcon, PlusCircle, Trash2, ClipboardList, Utensils, Bed, FileText, Users } from "lucide-react"; // Removed Car
import React, { useEffect } from 'react'; 

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM format

const itinerarySegmentSchema = z.object({
  id: z.string().optional(),
  date: z.date({ required_error: "Date is required." }).nullable(),
  day: z.string().min(1, "Day is required."),
  from: z.string().min(1, "Origin is required."),
  to: z.string().min(1, "Destination is required."),
  etd: z.string().regex(timeRegex, "Invalid ETD (HH:MM)").optional().or(z.literal("")),
  eta: z.string().regex(timeRegex, "Invalid ETA (HH:MM)").optional().or(z.literal("")),
  flightNumber: z.string().min(1, "Flight/Rein is required."),
  remarks: z.string().optional(),
});

const externalPartyAccommodationDetailSchema = z.object({
  id: z.string().optional(),
  checkInDate: z.date({ required_error: "Check-in date is required."}).nullable(),
  checkOutDate: z.date({ required_error: "Check-out date is required."}).nullable(),
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

const mealProvisionSchema = z.object({
  dateFromTo: z.string().min(1, "Date From/To is required for meal provision."),
  breakfast: z.preprocess(val => String(val).trim() === '' ? 0 : Number(val), z.number().int().nonnegative().optional()),
  lunch: z.preprocess(val => String(val).trim() === '' ? 0 : Number(val), z.number().int().nonnegative().optional()),
  dinner: z.preprocess(val => String(val).trim() === '' ? 0 : Number(val), z.number().int().nonnegative().optional()),
  supper: z.preprocess(val => String(val).trim() === '' ? 0 : Number(val), z.number().int().nonnegative().optional()),
  refreshment: z.preprocess(val => String(val).trim() === '' ? 0 : Number(val), z.number().int().nonnegative().optional()),
});

const externalPartiesTravelDetailsSchema = z.object({
  purpose: z.string().min(10, "Purpose of travel must be at least 10 characters."),
  itinerary: z.array(itinerarySegmentSchema).min(1, "At least one itinerary segment is required."),
  accommodationDetails: z.array(externalPartyAccommodationDetailSchema).optional(),
  mealProvision: mealProvisionSchema,
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
      mealProvision: initialData?.mealProvision ? {
        ...initialData.mealProvision,
        breakfast: Number(initialData.mealProvision.breakfast || 0),
        lunch: Number(initialData.mealProvision.lunch || 0),
        dinner: Number(initialData.mealProvision.dinner || 0),
        supper: Number(initialData.mealProvision.supper || 0),
        refreshment: Number(initialData.mealProvision.refreshment || 0),
      } : { dateFromTo: "", breakfast: 0, lunch: 0, dinner: 0, supper: 0, refreshment: 0 },
    },
  });


  const { fields: itineraryFields, append: appendItinerary, remove: removeItinerary } = useFieldArray({ control: form.control, name: "itinerary" });
  const { fields: accommodationFields, append: appendAccommodation, remove: removeAccommodation } = useFieldArray({ control: form.control, name: "accommodationDetails" });

  const handleFormSubmit = (data: z.infer<typeof externalPartiesTravelDetailsSchema>) => {
    const formattedData: ExternalPartiesTravelSpecificDetails = {
      ...data,
      itinerary: data.itinerary.map(item => ({
        ...item,
        date: item.date ? new Date(item.date) : null,
      })),
      accommodationDetails: data.accommodationDetails?.map(detail => ({
        ...detail,
        checkInDate: detail.checkInDate ? new Date(detail.checkInDate) : null,
        checkOutDate: detail.checkOutDate ? new Date(detail.checkOutDate) : null,
        estimatedCostPerNight: Number(detail.estimatedCostPerNight) || 0,
      })),
      mealProvision: {
        ...data.mealProvision,
        breakfast: Number(data.mealProvision.breakfast) || 0,
        lunch: Number(data.mealProvision.lunch) || 0,
        dinner: Number(data.mealProvision.dinner) || 0,
        supper: Number(data.mealProvision.supper) || 0,
        refreshment: Number(data.mealProvision.refreshment) || 0,
      },
    };
    onSubmit(formattedData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8">
        <Card className="w-full max-w-4xl mx-auto shadow-lg">
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

            {/* Itinerary */}
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
                                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                  {field.value && isValid(field.value) ? format(field.value, "PPP") : <span>Pick date</span>} <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus /></PopoverContent>
                          </Popover> <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`itinerary.${index}.day`} render={({ field }) => (<FormItem><FormLabel>Day / День</FormLabel><FormControl><Input placeholder="e.g. Mon" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.from`} render={({ field }) => (<FormItem><FormLabel>From / Откуда</FormLabel><FormControl><Input placeholder="Origin" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.to`} render={({ field }) => (<FormItem><FormLabel>To / Куда</FormLabel><FormControl><Input placeholder="Destination" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.etd`} render={({ field }) => (<FormItem><FormLabel>ETD / Вылет</FormLabel><FormControl><Input type="time" placeholder="HH:MM" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.eta`} render={({ field }) => (<FormItem><FormLabel>ETA / Прилет</FormLabel><FormControl><Input type="time" placeholder="HH:MM" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`itinerary.${index}.flightNumber`} render={({ field }) => (<FormItem><FormLabel>Flight / Рейс</FormLabel><FormControl><Input placeholder="Flight #" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                       <FormField control={form.control} name={`itinerary.${index}.remarks`} render={({ field }) => (<FormItem className="lg:col-span-full"><FormLabel>Remarks / Примечания</FormLabel><FormControl><Textarea placeholder="Any remarks for this segment..." {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    {itineraryFields.length > 1 && <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive hover:text-destructive/80" onClick={() => removeItinerary(index)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => appendItinerary({ date: null, day: '', from: '', to: '', etd: '', eta: '', flightNumber: '', remarks: '' })}> <PlusCircle className="mr-2 h-4 w-4" /> Add Itinerary Segment </Button>
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
                <Button type="button" variant="outline" size="sm" onClick={() => appendAccommodation({ checkInDate: null, checkOutDate: null, placeOfStay: '', estimatedCostPerNight: '', remarks: '' })}> <PlusCircle className="mr-2 h-4 w-4" /> Add Accommodation Entry</Button>
              </CardContent>
            </Card>

            {/* Meal Provision */}
            <Card className="border-dashed">
              <CardHeader><CardTitle className="text-lg font-semibold flex items-center gap-2"><Utensils /> Meal Provision in Kiyanly / Питание в Киянлы</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <FormField control={form.control} name="mealProvision.dateFromTo" render={({ field }) => (<FormItem><FormLabel>Date From/To / Даты с/по</FormLabel><FormControl><Input placeholder="e.g., 15 May - 20 May" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <FormField control={form.control} name="mealProvision.breakfast" render={({ field }) => (<FormItem><FormLabel>Breakfast / Завтрак</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? 0} onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="mealProvision.lunch" render={({ field }) => (<FormItem><FormLabel>Lunch / Обед</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? 0} onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="mealProvision.dinner" render={({ field }) => (<FormItem><FormLabel>Dinner / Ужин</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? 0} onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="mealProvision.supper" render={({ field }) => (<FormItem><FormLabel>Supper / Поздний ужин</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? 0} onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="mealProvision.refreshment" render={({ field }) => (<FormItem><FormLabel>Refreshment / Закуски</FormLabel><FormControl><Input type="number" placeholder="0" {...field} value={field.value ?? 0} onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                 <FormDescription className="text-xs pt-2">Total/Итого fields are auto-calculated in the PDF/final document.</FormDescription>
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
