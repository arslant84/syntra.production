
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { VisaApplication, VisaPurpose } from "@/types/visa";
import { cn } from "@/lib/utils";
import { format, isValid, startOfDay } from "date-fns";
import { CalendarIcon, UserCircle, Briefcase, Plane, Paperclip, AlertTriangle } from "lucide-react";
import React from "react";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];


const visaApplicationSchema = z.object({
  travelPurpose: z.enum(["Business Trip", "Expatriate Relocation"], {
    required_error: "Travel purpose is required.",
  }).refine(val => val !== "", "Please select a travel purpose."),
  destination: z.string().optional(),
  employeeId: z.string().min(1, "Employee ID is required."),
  nationality: z.string().min(1, "Nationality is required."),
  passportCopy: z.any()
    .refine((file) => file instanceof File || file === null || file === undefined, "Passport copy is required.")
    .refine((file) => !file || file.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine((file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.type), "Only .jpg, .jpeg, .png, .webp and .pdf formats are supported.")
    .optional().nullable(),
  tripStartDate: z.date({ required_error: "Trip start date is required." }),
  tripEndDate: z.date({ required_error: "Trip end date is required." }),
  itineraryDetails: z.string().min(10, "Itinerary details must be at least 10 characters."),
  supportingDocumentsNotes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.travelPurpose === "Business Trip" && !data.destination?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Destination is required for business trips.",
      path: ["destination"],
    });
  }
  if (data.tripStartDate && data.tripEndDate && data.tripEndDate < data.tripStartDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Trip end date cannot be before start date.",
      path: ["tripEndDate"],
    });
  }
});

type VisaFormValues = Omit<VisaApplication, 'id' | 'userId' | 'status' | 'submittedDate' | 'lastUpdatedDate' | 'passportCopyFilename' | 'uploadedDocumentFilenames'>;

interface VisaApplicationFormProps {
  initialData: Partial<VisaApplication>;
  onSubmit: (data: VisaFormValues) => void;
}

export default function VisaApplicationForm({ initialData, onSubmit }: VisaApplicationFormProps) {
  const form = useForm<VisaFormValues>({
    resolver: zodResolver(visaApplicationSchema),
    defaultValues: {
      travelPurpose: initialData.travelPurpose || "",
      destination: initialData.destination || "",
      employeeId: initialData.employeeId || "",
      nationality: initialData.nationality || "",
      passportCopy: initialData.passportCopy || null,
      tripStartDate: initialData.tripStartDate || null,
      tripEndDate: initialData.tripEndDate || null,
      itineraryDetails: initialData.itineraryDetails || "",
      supportingDocumentsNotes: initialData.supportingDocumentsNotes || "",
    },
  });

  const watchTravelPurpose = form.watch("travelPurpose");

  function handleFormSubmit(values: VisaFormValues) {
    onSubmit(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Briefcase className="w-5 h-5 text-primary" /> Travel Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="travelPurpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Travel Purpose</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select travel purpose" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Business Trip">Business Trip</SelectItem>
                      <SelectItem value="Expatriate Relocation">Expatriate Relocation</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {watchTravelPurpose === "Business Trip" && (
              <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination</FormLabel>
                    <FormControl><Input placeholder="Enter destination country/city" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <UserCircle className="w-5 h-5 text-primary" /> Personal Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="employeeId" render={({ field }) => (<FormItem><FormLabel>Employee ID</FormLabel><FormControl><Input placeholder="Your Employee ID" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="nationality" render={({ field }) => (<FormItem><FormLabel>Nationality</FormLabel><FormControl><Input placeholder="Your Nationality" {...field} /></FormControl><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>
        
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
                <Plane className="w-5 h-5 text-primary" /> Trip Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="tripStartDate" render={({ field }) => (
              <FormItem className="flex flex-col"><FormLabel>Trip Start Date</FormLabel>
                <Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < startOfDay(new Date())} initialFocus /></PopoverContent>
                </Popover><FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="tripEndDate" render={({ field }) => (
              <FormItem className="flex flex-col"><FormLabel>Trip End Date</FormLabel>
                <Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => { const startDate = form.getValues("tripStartDate"); return startDate ? date < startDate : date < startOfDay(new Date()); }} initialFocus /></PopoverContent>
                </Popover><FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="itineraryDetails" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Itinerary Details</FormLabel><FormControl><Textarea placeholder="Provide a summary of your itinerary or state 'As per TRF if linked'" className="min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
             <CardTitle className="flex items-center gap-2 text-xl">
                <Paperclip className="w-5 h-5 text-primary" /> Supporting Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
                control={form.control}
                name="passportCopy"
                render={({ field: { onChange, value, ...rest } }) => (
                    <FormItem>
                        <FormLabel>Passport Copy (PDF, JPG, PNG - Max 5MB)</FormLabel>
                        <FormControl>
                            <Input 
                                type="file" 
                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                onChange={(e) => onChange(e.target.files ? e.target.files[0] : null)} 
                                {...rest} 
                                className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField control={form.control} name="supportingDocumentsNotes" render={({ field }) => (<FormItem><FormLabel>Other Supporting Documents</FormLabel><FormControl><Textarea placeholder="List other supporting documents (e.g., Invitation Letter, Hotel Booking Confirmation). You will be contacted if physical copies are needed." className="min-h-[100px]" {...field} /></FormControl><FormDescription className="text-xs">Actual document upload for these will be handled separately if required by the Visa Clerk.</FormDescription><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>
        
        <div className="p-4 border-l-4 border-yellow-500 bg-yellow-50 rounded-md">
            <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                <p className="text-sm font-medium text-yellow-700">Important: Visa approval is required before flight and accommodation bookings can be finalized.</p>
            </div>
        </div>


        <div className="flex justify-end pt-6">
          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Submitting..." : "Submit Visa Application"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
