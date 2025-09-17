"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormSubmitButton } from "@/components/ui/submit-button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { format, isValid, startOfDay } from "date-fns";
import { CalendarIcon, UserCircle, Briefcase, Plane, Paperclip, AlertTriangle, FileText, Users, CheckSquare } from "lucide-react";
import React, { useEffect } from "react";
import type { VisaApplication, RequestType, VisaEntryType, WorkVisitCategory, ApplicationFeesBorneBy } from "@/types/visa";

// No custom wrapper needed - react-hook-form handles controlled state

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];

// Enhanced schema to match LOI Request Form
const enhancedVisaApplicationSchema = z.object({
  // Section A: Particulars of Applicant
  applicantName: z.string().min(1, "Full name is required."),
  dateOfBirth: z.date({ required_error: "Date of birth is required." }),
  placeOfBirth: z.string().min(1, "Place of birth is required."),
  citizenship: z.string().min(1, "Citizenship is required."),
  passportNumber: z.string().min(1, "Passport number is required."),
  passportPlaceOfIssuance: z.string().min(1, "Place of passport issuance is required."),
  passportDateOfIssuance: z.date({ required_error: "Date of passport issuance is required." }),
  passportExpiryDate: z.date({ required_error: "Passport expiry date is required." }),
  contactTelephone: z.string().min(1, "Contact telephone is required."),
  homeAddress: z.string().min(1, "Home address is required."),
  educationDetails: z.string().min(1, "Education details are required."),
  currentEmployerName: z.string().min(1, "Current employer name is required."),
  currentEmployerAddress: z.string().min(1, "Current employer address is required."),
  position: z.string().min(1, "Current position is required."),
  department: z.string().min(1, "Department is required."),
  maritalStatus: z.string().default(""),
  familyInformation: z.string().default(""),

  // Section B: Type of Request
  requestType: z.enum(["LOI", "VISA", "WORK_PERMIT"] as const, {
    required_error: "Request type is required.",
  }),
  approximatelyArrivalDate: z.date({ required_error: "Approximate arrival date is required." }),
  durationOfStay: z.string().min(1, "Duration of stay is required."),
  visaEntryType: z.enum(["Multiple", "Single", "Double"] as const, {
    required_error: "Visa entry type is required.",
  }),
  travelPurpose: z.string().min(1, "Purpose of work/visit is required."),
  destination: z.string().min(1, "Destination is required."),
  workVisitCategory: z.enum([
    "CEO", "TLS", "TSE", "TKA",
    "TKA-ME", "TKA-PE", "TKA-TE", "TKA-OE",
    "TPD", "TSS", "TWD", "TFA",
    "TPM", "TBE", "TBE-IT", "TRA",
    "TSM", "THR", "THR-CM", "Company Guest"
  ] as const, {
    required_error: "Category of work/visit is required.",
  }),
  applicationFeesBorneBy: z.enum(["PC(T)SB Dept", "OPU", "Myself"] as const, {
    required_error: "Please specify who will bear the application fees.",
  }),
  costCentreNumber: z.string().default(""),

  // Trip details
  tripStartDate: z.date({ required_error: "Trip start date is required." }),
  tripEndDate: z.date({ required_error: "Trip end date is required." }),
  itineraryDetails: z.string().min(10, "Itinerary details must be at least 10 characters."),

  // Supporting Documents
  passportCopy: z.any()
    .refine((file) => file instanceof File || file === null || file === undefined, "Passport copy is required.")
    .refine((file) => !file || file.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine((file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.type), "Only .jpg, .jpeg, .png, .webp and .pdf formats are supported.")
    .optional().nullable(),
  additionalDocuments: z.any()
    .refine((files) => {
      if (!files || files.length === 0) return true;
      return Array.from(files).every((file: any) => file instanceof File && file.size <= MAX_FILE_SIZE);
    }, `Each file must be less than 5MB.`)
    .refine((files) => {
      if (!files || files.length === 0) return true;
      return Array.from(files).every((file: any) => ACCEPTED_IMAGE_TYPES.includes(file.type));
    }, "Only .jpg, .jpeg, .png, .webp and .pdf formats are supported.")
    .optional(),
}).superRefine((data, ctx) => {
  if (data.passportExpiryDate && data.passportExpiryDate < new Date()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Passport expiry date cannot be in the past.",
      path: ["passportExpiryDate"],
    });
  }
  if (data.tripStartDate && data.tripEndDate && data.tripEndDate < data.tripStartDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Trip end date cannot be before start date.",
      path: ["tripEndDate"],
    });
  }
  if (data.approximatelyArrivalDate && data.tripStartDate && data.approximatelyArrivalDate > data.tripStartDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Arrival date should not be after trip start date.",
      path: ["approximatelyArrivalDate"],
    });
  }
});

type EnhancedVisaFormValues = z.infer<typeof enhancedVisaApplicationSchema>;

interface EnhancedVisaApplicationFormProps {
  initialData?: Partial<VisaApplication>;
  onSubmit: (data: EnhancedVisaFormValues) => Promise<void>;
}

export default function EnhancedVisaApplicationForm({ initialData, onSubmit }: EnhancedVisaApplicationFormProps) {
  // Prepare complete default values ensuring no undefined strings
  const defaultFormValues = React.useMemo(() => ({
    // Section A: Particulars of Applicant
    applicantName: initialData?.applicantName || "",
    dateOfBirth: initialData?.dateOfBirth || null,
    placeOfBirth: initialData?.placeOfBirth || "",
    citizenship: initialData?.citizenship || "",
    passportNumber: initialData?.passportNumber || "",
    passportPlaceOfIssuance: initialData?.passportPlaceOfIssuance || "",
    passportDateOfIssuance: initialData?.passportDateOfIssuance || null,
    passportExpiryDate: initialData?.passportExpiryDate || null,
    contactTelephone: initialData?.contactTelephone || "",
    homeAddress: initialData?.homeAddress || "",
    educationDetails: initialData?.educationDetails || "",
    currentEmployerName: initialData?.currentEmployerName || "",
    currentEmployerAddress: initialData?.currentEmployerAddress || "",
    position: initialData?.position || "",
    department: initialData?.department || "",
    maritalStatus: initialData?.maritalStatus || "",
    familyInformation: initialData?.familyInformation || "",

    // Section B: Type of Request
    requestType: (initialData?.requestType as "LOI" | "VISA" | "WORK_PERMIT") || "VISA",
    approximatelyArrivalDate: initialData?.approximatelyArrivalDate || null,
    durationOfStay: initialData?.durationOfStay || "",
    visaEntryType: (initialData?.visaEntryType as "Multiple" | "Single" | "Double") || "Single",
    workVisitCategory: (initialData?.workVisitCategory as any) || "CEO",
    applicationFeesBorneBy: (initialData?.applicationFeesBorneBy as "PC(T)SB Dept" | "OPU" | "Myself") || "PC(T)SB Dept",
    costCentreNumber: initialData?.costCentreNumber || "",

    // Trip details
    tripStartDate: initialData?.tripStartDate || null,
    tripEndDate: initialData?.tripEndDate || null,
    travelPurpose: initialData?.travelPurpose || "",
    destination: initialData?.destination || "",
    itineraryDetails: initialData?.itineraryDetails || "",
    passportCopy: null,
    additionalDocuments: null,
  }), [initialData]);

  const form = useForm<EnhancedVisaFormValues>({
    resolver: zodResolver(enhancedVisaApplicationSchema),
    defaultValues: defaultFormValues,
  });

  const watchRequestType = form.watch("requestType");
  const watchApplicationFeesBorneBy = form.watch("applicationFeesBorneBy");

  // Reset form when initialData changes
  React.useEffect(() => {
    form.reset(defaultFormValues);
  }, [form, defaultFormValues]);

  async function handleFormSubmit(values: EnhancedVisaFormValues) {
    try {
      await onSubmit(values);
    } catch (error) {
      console.error('Enhanced visa form submission error:', error);
      throw error;
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8">

        {/* Header Section */}
        <Card className="shadow-lg border-t-4 border-t-primary">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-primary">REQUEST FOR LOI, VISA & WP</CardTitle>
            <CardDescription>
              Please complete all sections of this form and submit to Visa Application Unit at least 3 days before application.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Section B: Type of Request */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CheckSquare className="w-5 h-5 text-primary" /> Section B: TYPE OF REQUEST
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="requestType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Request Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select request type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="LOI">LOI</SelectItem>
                        <SelectItem value="VISA">VISA</SelectItem>
                        <SelectItem value="WORK_PERMIT">WORK PERMIT</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="approximatelyArrivalDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Approximately Date of arrival</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={field.onChange}
                          disabled={(date) => date < startOfDay(new Date())}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="durationOfStay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration of Stay</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 30 days, 6 months" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="visaEntryType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type of visa</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select visa type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Multiple">Multiple</SelectItem>
                        <SelectItem value="Single">Single</SelectItem>
                        <SelectItem value="Double">Double</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="workVisitCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category of Work/Visit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CEO">CEO</SelectItem>
                        <SelectItem value="TLS">TLS</SelectItem>
                        <SelectItem value="TSE">TSE</SelectItem>
                        <SelectItem value="TKA">TKA</SelectItem>
                        <SelectItem value="TKA-ME">TKA-ME</SelectItem>
                        <SelectItem value="TKA-PE">TKA-PE</SelectItem>
                        <SelectItem value="TKA-TE">TKA-TE</SelectItem>
                        <SelectItem value="TKA-OE">TKA-OE</SelectItem>
                        <SelectItem value="TPD">TPD</SelectItem>
                        <SelectItem value="TSS">TSS</SelectItem>
                        <SelectItem value="TWD">TWD</SelectItem>
                        <SelectItem value="TFA">TFA</SelectItem>
                        <SelectItem value="TPM">TPM</SelectItem>
                        <SelectItem value="TBE">TBE</SelectItem>
                        <SelectItem value="TBE-IT">TBE-IT</SelectItem>
                        <SelectItem value="TRA">TRA</SelectItem>
                        <SelectItem value="TSM">TSM</SelectItem>
                        <SelectItem value="THR">THR</SelectItem>
                        <SelectItem value="THR-CM">THR-CM</SelectItem>
                        <SelectItem value="Company Guest">Company Guest</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="travelPurpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose of work/visit</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the purpose of your work/visit in detail..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="destination"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destination</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter destination country/city..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormLabel className="text-base font-semibold">Application Fees to be borne by:</FormLabel>
              <FormField
                control={form.control}
                name="applicationFeesBorneBy"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="space-y-3">
                        {(["PC(T)SB Dept", "OPU", "Myself"] as const).map((option) => (
                          <div key={option} className="flex items-center space-x-3">
                            <Checkbox
                              checked={field.value === option}
                              onCheckedChange={(checked) => {
                                if (checked) field.onChange(option);
                              }}
                            />
                            <FormLabel className="font-normal cursor-pointer">{option}</FormLabel>
                          </div>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(watchApplicationFeesBorneBy === "PC(T)SB Dept" || watchApplicationFeesBorneBy === "OPU") && (
                <FormField
                  control={form.control}
                  name="costCentreNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost Centre No:</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter cost centre number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section A: Particulars of Applicant */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <UserCircle className="w-5 h-5 text-primary" /> Section A: PARTICULARS OF APPLICANT
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="applicantName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date of Birth</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={field.onChange}
                          disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="placeOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Place of Birth</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter place of birth" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="citizenship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Citizenship</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter citizenship" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="passportNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Passport No</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter passport number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="passportPlaceOfIssuance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Place of issuance of passport</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter place of issuance" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="passportDateOfIssuance"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date of issuance of passport</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={field.onChange}
                          disabled={(date) => date > new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="passportExpiryDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Expiry date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="contactTelephone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Telephone No</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter contact telephone" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="homeAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Home address</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter home address"
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="educationDetails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Education (type of education, year, full name of University/College, course or secondary school, specialty)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide detailed education information..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="currentEmployerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name of Current Employer</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter current employer name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currentEmployerAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter employer address"
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Position</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter current position" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter department" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="familyInformation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marital status & family information (name of wife/husband/children, DOB, citizenship)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide family information if applicable..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Trip Details */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Plane className="w-5 h-5 text-primary" /> Trip Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="tripStartDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Trip Start Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={field.onChange}
                        disabled={(date) => date < startOfDay(new Date())}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tripEndDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Trip End Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                        >
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={field.onChange}
                        disabled={(date) => {
                          const startDate = form.getValues("tripStartDate");
                          return startDate ? date < new Date(startDate) : date < startOfDay(new Date());
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="itineraryDetails"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Itinerary Details</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide a detailed summary of your itinerary..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Supporting Documents */}
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

            <FormField
              control={form.control}
              name="additionalDocuments"
              render={({ field: { onChange, value, ...rest } }) => (
                <FormItem>
                  <FormLabel>Additional Supporting Documents (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => onChange(e.target.files)}
                      {...rest}
                      className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Upload additional documents such as invitation letters, hotel bookings, etc. (Max 5MB per file)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="p-4 border-l-4 border-yellow-500 bg-yellow-50 rounded-md">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
            <p className="text-sm font-medium text-yellow-700">
              Important: This Request form must be endorsed by the Head of the Sponsoring/Receiving Department before Admin Section can proceed with the application.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-6">
          <FormSubmitButton
            onClick={form.handleSubmit(handleFormSubmit)}
            type="button"
            size="lg"
            loadingText="Submitting LOI/Visa application..."
            disabled={!form.formState.isValid}
            preventMultipleClicks={true}
            debounceMs={500}
          >
            Submit {watchRequestType} Application
          </FormSubmitButton>
        </div>
      </form>
    </Form>
  );
}