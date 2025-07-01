
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ExpenseClaim, ExpenseItem, ForeignExchangeRate } from "@/types/claims";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import { CalendarIcon, PlusCircle, Trash2, Banknote, Briefcase, Stethoscope, UserSquare, AlertTriangle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import React from "react";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const claimFormSchema = z.object({
  headerDetails: z.object({
    documentType: z.enum(["TR01", "TB35", "TB05", ""], { required_error: "Document type is required."}).refine(val => val !== "", "Document type is required."),
    documentNumber: z.string().min(1, "Document number is required."),
    claimForMonthOf: z.date({ required_error: "Claim month is required." }),
    staffName: z.string().min(1, "Staff name is required."),
    staffNo: z.string().min(1, "Staff No. is required."),
    gred: z.string().min(1, "Gred is required."),
    staffType: z.enum(["PERMANENT STAFF", "CONTRACT STAFF", ""], { required_error: "Staff type is required."}).refine(val => val !== "", "Staff type is required."),
    executiveStatus: z.enum(["EXECUTIVE", "NON-EXECUTIVE", ""], { required_error: "Executive status is required."}).refine(val => val !== "", "Executive status is required."),
    departmentCode: z.string().min(1, "Department code is required."),
    deptCostCenterCode: z.string().min(1, "Dept. Cost Center Code is required."),
    location: z.string().min(1, "Location is required."),
    telExt: z.string().min(1, "Tel/Ext is required."),
    startTimeFromHome: z.string().regex(timeRegex, "Invalid start time (HH:MM)."),
    timeOfArrivalAtHome: z.string().regex(timeRegex, "Invalid arrival time (HH:MM)."),
  }),
  bankDetails: z.object({
    bankName: z.string().min(1, "Bank name is required."),
    accountNumber: z.string().min(1, "Account number is required."),
    purposeOfClaim: z.string().min(1, "Purpose of claim is required."),
  }),
  medicalClaimDetails: z.object({
    isMedicalClaim: z.boolean().default(false),
    applicableMedicalType: z.enum(["Inpatient", "Outpatient", ""], { required_error: "Medical type is required if it's a medical claim." }).optional(),
    isForFamily: z.boolean().default(false),
    familyMemberSpouse: z.boolean().default(false),
    familyMemberChildren: z.boolean().default(false),
    familyMemberOther: z.string().optional(),
  }).superRefine((data, ctx) => {
    if (data.isMedicalClaim && !data.applicableMedicalType) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please select applicable medical type.", path: ["applicableMedicalType"] });
    }
    if (data.isMedicalClaim && data.isForFamily && !data.familyMemberSpouse && !data.familyMemberChildren && !data.familyMemberOther?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Please specify family member.", path: ["isForFamily"]});
    }
  }),
  expenseItems: z.array(
    z.object({
      date: z.date({ required_error: "Date is required." }),
      claimOrTravelDetails: z.string().min(1, "Claim/Travel details are required."),
      officialMileageKM: z.preprocess(val => String(val) === '' ? undefined : Number(val), z.number({invalid_type_error: "Must be a number"}).nonnegative().optional()),
      transport: z.preprocess(val => String(val) === '' ? undefined : Number(val), z.number({invalid_type_error: "Must be a number"}).nonnegative().optional()),
      hotelAccommodationAllowance: z.preprocess(val => String(val) === '' ? undefined : Number(val), z.number({invalid_type_error: "Must be a number"}).nonnegative().optional()),
      outStationAllowanceMeal: z.preprocess(val => String(val) === '' ? undefined : Number(val), z.number({invalid_type_error: "Must be a number"}).nonnegative().optional()),
      miscellaneousAllowance10Percent: z.preprocess(val => String(val) === '' ? undefined : Number(val), z.number({invalid_type_error: "Must be a number"}).nonnegative().optional()),
      otherExpenses: z.preprocess(val => String(val) === '' ? undefined : Number(val), z.number({invalid_type_error: "Must be a number"}).nonnegative().optional()),
    })
  ).min(1, "At least one expense item is required."),
  informationOnForeignExchangeRate: z.array(
    z.object({
      date: z.date({ required_error: "Date is required." }),
      typeOfCurrency: z.string().min(1, "Type of currency is required."),
      sellingRateTTOD: z.preprocess(val => String(val) === '' ? '' : Number(val), z.number({invalid_type_error: "Must be a number"}).nonnegative("Rate must be non-negative.")),
    })
  ).optional(),
  financialSummary: z.object({
    totalAdvanceClaimAmount: z.preprocess(val => String(val) === '' ? undefined : Number(val), z.number({required_error: "Total amount is required.", invalid_type_error: "Must be a number"}).nonnegative()),
    lessAdvanceTaken: z.preprocess(val => String(val) === '' ? undefined : Number(val), z.number({invalid_type_error: "Must be a number"}).nonnegative().optional()),
    lessCorporateCreditCardPayment: z.preprocess(val => String(val) === '' ? undefined : Number(val), z.number({invalid_type_error: "Must be a number"}).nonnegative().optional()),
    balanceClaimRepayment: z.preprocess(val => String(val) === '' ? undefined : Number(val), z.number({invalid_type_error: "Must be a number"}).optional()), // This will be calculated
    chequeReceiptNo: z.string().optional(),
  }),
  declaration: z.object({
    iDeclare: z.boolean().refine(val => val === true, { message: "You must agree to the declaration." }),
    date: z.date({ required_error: "Declaration date is required." }),
  }),
});

type ClaimFormValues = z.infer<typeof claimFormSchema>;

interface ExpenseClaimFormProps {
  initialData: Partial<ExpenseClaim>;
  onSubmit: (data: ExpenseClaim) => void;
  submitButtonText: string;
}

export default function ExpenseClaimForm({ initialData, onSubmit, submitButtonText }: ExpenseClaimFormProps) {
  // Ensure initialData is properly formatted for the form
  const formattedInitialData = React.useMemo(() => {
    if (!initialData) return {};
    
    // Deep clone to avoid mutation issues
    const data = JSON.parse(JSON.stringify(initialData));
    
    // Ensure dates are properly formatted as Date objects
    if (data.headerDetails?.claimForMonthOf) {
      data.headerDetails.claimForMonthOf = new Date(data.headerDetails.claimForMonthOf);
    }
    
    if (data.declaration?.date) {
      data.declaration.date = new Date(data.declaration.date);
    }
    
    if (data.expenseItems && Array.isArray(data.expenseItems)) {
      data.expenseItems = data.expenseItems.map((item: any) => ({
        ...item,
        date: item.date ? new Date(item.date) : null,
      }));
    }
    
    if (data.informationOnForeignExchangeRate && Array.isArray(data.informationOnForeignExchangeRate)) {
      data.informationOnForeignExchangeRate = data.informationOnForeignExchangeRate.map((item: any) => ({
        ...item,
        date: item.date ? new Date(item.date) : null,
      }));
    }
    
    return data;
  }, [initialData]);
  
  const form = useForm<ClaimFormValues>({
    resolver: zodResolver(claimFormSchema),
    defaultValues: formattedInitialData as any,
    mode: "onBlur", // Validate fields when they lose focus
  });

  const { fields: expenseFields, append: appendExpense, remove: removeExpense } = useFieldArray({
    control: form.control,
    name: "expenseItems",
  });

  const { fields: fxFields, append: appendFx, remove: removeFx } = useFieldArray({
    control: form.control,
    name: "informationOnForeignExchangeRate",
  });

  const watchExpenseItems = form.watch("expenseItems");
  const watchFinancialSummary = form.watch("financialSummary");

  const calculateColumnTotal = React.useCallback((fieldName: keyof ExpenseItem) => {
    return watchExpenseItems.reduce((acc, item) => {
      // Safe access to the field with type checking
      const fieldValue = item[fieldName as keyof typeof item];
      const value = parseFloat(String(fieldValue));
      return acc + (isNaN(value) ? 0 : value);
    }, 0);
  }, [watchExpenseItems]);
  
  const totalMileage = calculateColumnTotal("officialMileageKM");
  const totalTransport = calculateColumnTotal("transport");
  const totalHotel = calculateColumnTotal("hotelAccommodationAllowance");
  const totalOutstation = calculateColumnTotal("outStationAllowanceMeal");
  const totalMisc = calculateColumnTotal("miscellaneousAllowance10Percent");
  const totalOther = calculateColumnTotal("otherExpenses");

  const calculateBalance = React.useCallback(() => {
    const total = parseFloat(String(watchFinancialSummary.totalAdvanceClaimAmount)) || 0;
    const advance = parseFloat(String(watchFinancialSummary.lessAdvanceTaken)) || 0;
    const creditCard = parseFloat(String(watchFinancialSummary.lessCorporateCreditCardPayment)) || 0;
    return total - advance - creditCard;
  }, [watchFinancialSummary]);

  React.useEffect(() => {
    form.setValue("financialSummary.balanceClaimRepayment", calculateBalance());
  }, [calculateBalance, form]);

  const handleFormSubmit = (data: ClaimFormValues) => {
    console.log('handleFormSubmit called!');
    console.log('Form submitted with data:', JSON.stringify(data, null, 2));
    
    // Preserve the original ID from initialData if it exists
    const submissionData = {
      ...data,
      id: initialData?.id, // Keep the original ID for updates
      status: initialData?.status, // Keep the original status
      submittedAt: initialData?.submittedAt // Keep the original submission timestamp
    };
    
    // Convert the form data to the ExpenseClaim format expected by the parent component
    onSubmit(submissionData as unknown as ExpenseClaim);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8" noValidate>
        {/* Header Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserSquare className="w-5 h-5 text-primary" /> Staff & Claim Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="headerDetails.documentType" render={({ field }) => (
                <FormItem><FormLabel>Document</FormLabel>
                  <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                    <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="TR01" /></FormControl><FormLabel className="font-normal">TR01</FormLabel></FormItem>
                    <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="TB35" /></FormControl><FormLabel className="font-normal">TB35</FormLabel></FormItem>
                    <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="TB05" /></FormControl><FormLabel className="font-normal">TB05</FormLabel></FormItem>
                  </RadioGroup><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="headerDetails.documentNumber" render={({ field }) => (<FormItem><FormLabel>Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="headerDetails.claimForMonthOf" render={({ field }) => (
                <FormItem className="flex flex-col"><FormLabel>Claim for the Month of</FormLabel>
                  <Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn(!field.value && "text-muted-foreground")}>{field.value ? format(field.value, "MMMM yyyy") : <span>Pick a month</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} captionLayout="dropdown-buttons" fromYear={2020} toYear={2030} /></PopoverContent>
                  </Popover><FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="headerDetails.staffName" render={({ field }) => (<FormItem><FormLabel>Staff Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="headerDetails.staffNo" render={({ field }) => (<FormItem><FormLabel>Staff No.</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="headerDetails.gred" render={({ field }) => (<FormItem><FormLabel>Gred</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="headerDetails.staffType" render={({ field }) => (
                    <FormItem><FormLabel>Select whichever is applicable:</FormLabel>
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                        <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="PERMANENT STAFF" /></FormControl><FormLabel className="font-normal">Permanent Staff</FormLabel></FormItem>
                        <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="CONTRACT STAFF" /></FormControl><FormLabel className="font-normal">Contract Staff</FormLabel></FormItem>
                    </RadioGroup><FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="headerDetails.executiveStatus" render={({ field }) => (
                    <FormItem><FormLabel>Select whichever is applicable:</FormLabel>
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                        <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="EXECUTIVE" /></FormControl><FormLabel className="font-normal">Executive</FormLabel></FormItem>
                        <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="NON-EXECUTIVE" /></FormControl><FormLabel className="font-normal">Non-Executive</FormLabel></FormItem>
                    </RadioGroup><FormMessage />
                    </FormItem>
                )} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="headerDetails.departmentCode" render={({ field }) => (<FormItem><FormLabel>Department Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="headerDetails.deptCostCenterCode" render={({ field }) => (<FormItem><FormLabel>Dept. Cost Center Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="headerDetails.location" render={({ field }) => (<FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="headerDetails.telExt" render={({ field }) => (<FormItem><FormLabel>Tel/Ext.</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="headerDetails.startTimeFromHome" render={({ field }) => (<FormItem><FormLabel>1. Start time from home to destination</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="headerDetails.timeOfArrivalAtHome" render={({ field }) => (<FormItem><FormLabel>2. Time of arrival at home from official duty</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
          </CardContent>
        </Card>

        {/* Bank Details */}
        <Card>
          <CardHeader>
             <CardTitle className="flex items-center gap-2"><Banknote className="w-5 h-5 text-primary" /> Bank & Purpose</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="bankDetails.bankName" render={({ field }) => (<FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="bankDetails.accountNumber" render={({ field }) => (<FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="bankDetails.purposeOfClaim" render={({ field }) => (<FormItem><FormLabel>Purpose of Claim</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
          </CardContent>
        </Card>

        {/* Medical Claim Details (Conditional) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Stethoscope className="w-5 h-5 text-primary" /> Medical Claim (if applicable)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField control={form.control} name="medicalClaimDetails.isMedicalClaim" render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <FormLabel className="font-normal">Applying for medical claim?</FormLabel>
              </FormItem>
            )} />
            {form.watch("medicalClaimDetails.isMedicalClaim") && (
              <div className="space-y-4 p-4 border rounded-md mt-2">
                <FormField control={form.control} name="medicalClaimDetails.applicableMedicalType" render={({ field }) => (
                    <FormItem><FormLabel>Select whichever is applicable</FormLabel>
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                        <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="Inpatient" /></FormControl><FormLabel className="font-normal">Inpatient</FormLabel></FormItem>
                        <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="Outpatient" /></FormControl><FormLabel className="font-normal">Outpatient</FormLabel></FormItem>
                    </RadioGroup><FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="medicalClaimDetails.isForFamily" render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="font-normal">Medical claim for your family?</FormLabel>
                  </FormItem>
                )} />
                {form.watch("medicalClaimDetails.isForFamily") && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="medicalClaimDetails.familyMemberSpouse" render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Spouse</FormLabel></FormItem>
                    )} />
                     <FormField control={form.control} name="medicalClaimDetails.familyMemberChildren" render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Children</FormLabel></FormItem>
                    )} />
                    <FormField control={form.control} name="medicalClaimDetails.familyMemberOther" render={({ field }) => (
                        <FormItem><FormLabel className="font-normal">Other (Specify)</FormLabel><FormControl><Input {...field} placeholder="e.g. Parent" /></FormControl></FormItem>
                    )} />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expense Items Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Briefcase className="w-5 h-5 text-primary" /> Expense Details (Original Currency)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Date(s)</TableHead>
                    <TableHead className="min-w-[250px]">Claim or Travel Details (From - To / The Place of Stay)</TableHead>
                    <TableHead className="min-w-[150px] text-center">Official Mileage (KM)</TableHead>
                    <TableHead className="min-w-[120px] text-right">Transport</TableHead>
                    <TableHead className="min-w-[150px] text-right">Hotel Accom. Allowance</TableHead>
                    <TableHead className="min-w-[150px] text-right">Out-Station Allowance (Meal)</TableHead>
                    <TableHead className="min-w-[150px] text-right">Misc. Allowance (10%)</TableHead>
                    <TableHead className="min-w-[120px] text-right">Other Expenses</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseFields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell>
                        <FormField control={form.control} name={`expenseItems.${index}.date`} render={({ field: dateField }) => (
                          <Popover><PopoverTrigger asChild><FormControl><Button size="sm" variant="outline" className={cn("w-full justify-start text-left font-normal", !dateField.value && "text-muted-foreground")}>{dateField.value ? format(dateField.value, "PPP") : <span>Pick date</span>}<CalendarIcon className="ml-auto h-3 w-3 opacity-50" /></Button></FormControl></PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} initialFocus /></PopoverContent>
                          </Popover>
                        )} />
                      </TableCell>
                      <TableCell><FormField control={form.control} name={`expenseItems.${index}.claimOrTravelDetails`} render={({ field: itemField }) => <Textarea {...itemField} placeholder="Details..." className="min-h-[40px]" />} /></TableCell>
                      <TableCell><FormField control={form.control} name={`expenseItems.${index}.officialMileageKM`} render={({ field: itemField }) => <Input type="number" {...itemField} placeholder="0" className="text-center" />} /></TableCell>
                      <TableCell><FormField control={form.control} name={`expenseItems.${index}.transport`} render={({ field: itemField }) => <Input type="number" {...itemField} placeholder="0.00" className="text-right" />} /></TableCell>
                      <TableCell><FormField control={form.control} name={`expenseItems.${index}.hotelAccommodationAllowance`} render={({ field: itemField }) => <Input type="number" {...itemField} placeholder="0.00" className="text-right" />} /></TableCell>
                      <TableCell><FormField control={form.control} name={`expenseItems.${index}.outStationAllowanceMeal`} render={({ field: itemField }) => <Input type="number" {...itemField} placeholder="0.00" className="text-right" />} /></TableCell>
                      <TableCell><FormField control={form.control} name={`expenseItems.${index}.miscellaneousAllowance10Percent`} render={({ field: itemField }) => <Input type="number" {...itemField} placeholder="0.00" className="text-right" />} /></TableCell>
                      <TableCell><FormField control={form.control} name={`expenseItems.${index}.otherExpenses`} render={({ field: itemField }) => <Input type="number" {...itemField} placeholder="0.00" className="text-right" />} /></TableCell>
                      <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => removeExpense(index)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Row */}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={2} className="text-right">TOTAL</TableCell>
                    <TableCell className="text-center">{totalMileage.toFixed(0)}</TableCell>
                    <TableCell className="text-right">{totalTransport.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{totalHotel.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{totalOutstation.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{totalMisc.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{parseFloat(String(totalOther)) ? Number(parseFloat(String(totalOther))).toFixed(2) : ""}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => appendExpense({ date: new Date(), claimOrTravelDetails: "", officialMileageKM: undefined, transport: undefined, hotelAccommodationAllowance: undefined, outStationAllowanceMeal: undefined, miscellaneousAllowance10Percent: undefined, otherExpenses: undefined })}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Expense Item
            </Button>
          </CardContent>
        </Card>

        {/* Foreign Exchange Rate (Conditional/Optional) */}
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Banknote className="w-5 h-5 text-primary" /> Information on Foreign Money Exchange Rate (For overseas claim)</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-1/3">Date</TableHead>
                            <TableHead className="w-1/3">Type of Currency</TableHead>
                            <TableHead className="w-1/3 text-right">Selling Rate TT/OD</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fxFields.map((field, index) => (
                            <TableRow key={field.id}>
                                <TableCell>
                                    <FormField control={form.control} name={`informationOnForeignExchangeRate.${index}.date`} render={({ field: dateField }) => (
                                        <Popover><PopoverTrigger asChild><FormControl><Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal", !dateField.value && "text-muted-foreground")}>{dateField.value ? format(dateField.value, "PPP") : <span>Pick date</span>}<CalendarIcon className="ml-auto h-3 w-3 opacity-50" /></Button></FormControl></PopoverTrigger>
                                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} initialFocus /></PopoverContent>
                                        </Popover>
                                    )} />
                                </TableCell>
                                <TableCell><FormField control={form.control} name={`informationOnForeignExchangeRate.${index}.typeOfCurrency`} render={({ field: itemField }) => <Input {...itemField} placeholder="e.g. USD" />} /></TableCell>
                                <TableCell><FormField control={form.control} name={`informationOnForeignExchangeRate.${index}.sellingRateTTOD`} render={({ field: itemField }) => <Input type="number" {...itemField} placeholder="0.0000" className="text-right" />} /></TableCell>
                                <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => removeFx(index)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <Button type="button" variant="outline" size="sm" onClick={() => appendFx({date: new Date(), typeOfCurrency: "", sellingRateTTOD: undefined})} className="mt-2">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add FX Rate
                </Button>
            </CardContent>
        </Card>
        
        {/* Financial Summary */}
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Banknote className="w-5 h-5 text-primary" /> Financial Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
                <FormField control={form.control} name="financialSummary.totalAdvanceClaimAmount" render={({ field }) => (<FormItem><FormLabel>Total Advance/Claim Amount</FormLabel><FormControl><Input type="number" {...field} placeholder="0.00" className="text-right" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="financialSummary.lessAdvanceTaken" render={({ field }) => (<FormItem><FormLabel>Less: Advance Taken</FormLabel><FormControl><Input type="number" {...field} placeholder="0.00" className="text-right" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="financialSummary.lessCorporateCreditCardPayment" render={({ field }) => (<FormItem><FormLabel>Less: Corporate Credit Card Payment</FormLabel><FormControl><Input type="number" {...field} placeholder="0.00" className="text-right" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="financialSummary.balanceClaimRepayment" render={({ field }) => (<FormItem><FormLabel>Balance of Claim/Repayment</FormLabel><FormControl><Input type="number" {...field} placeholder="0.00" className="text-right font-semibold" readOnly /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="financialSummary.chequeReceiptNo" render={({ field }) => (<FormItem><FormLabel>Cheque / Receipt No.</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            </CardContent>
        </Card>

        {/* Declaration */}
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-primary" /> Declaration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                 <FormField control={form.control} name="declaration.iDeclare" render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="iDeclare" /></FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel htmlFor="iDeclare" className="font-normal text-sm">
                                I hereby declare that all of the information provided in the Claim Form, as well as all of the information contained in the supporting documents and materials are true and complete.
                                I understand that any false, fraudulent, or incomplete information on this Claim Form and the related supporting documents may serve as grounds for disciplinary action.
                                I am fully aware of the requirements of the related PC(T)SB HR Policies and Orders, and hereby certify that all of the supporting documents are in compliance with the requirements of related company Policies.
                                PC(T)SB reserves the right to check submitted Claim Form and Supporting Documents at any time.
                                Should there be any false, fraudulent or incomplete information and/or documentation originating from the Claims Form(a), PC(T)SB reserves the right to recover from the Employee any/all sums that has been paid out.
                            </FormLabel>
                            <FormMessage />
                        </div>
                    </FormItem>
                 )} />
                 <FormField control={form.control} name="declaration.date" render={({ field }) => (
                    <FormItem className="flex flex-col max-w-xs"><FormLabel>Date</FormLabel>
                    <Popover><PopoverTrigger asChild><FormControl><Button variant="outline" className={cn(!field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                    </Popover><FormMessage />
                    </FormItem>
                 )} />
                 <p className="text-xs text-muted-foreground">
                    (REV 3/93) *Please see the terms and conditions on next page.<br/>
                    1) The approved expenses claim form in accordance to the LOA shall be submitted to Finance & Accounts Dept together with all supporting documents including original receipts, official bills, air fare tickets, boarding pass and others.<br/>
                    2) Incomplete expense claim form shall be returned to the staff.<br/>
                    3) Finance & Accounts Dept shall effect salary deduction without notifying relevant staff if she/he does not submit her/his claim within seven (7) working days from return after completion of official duty.<br/>
                    4) Claim must be approved by Departmental Manager in accordance to terms and conditions as stated in the related "HUMAN RESOURCE MANAGEMENT POLICIES AND OPERATING PROCEDURES MANUAL/ORDERS" or relevant circulars issued out by the Human Resource Department from time to time.
                 </p>
            </CardContent>
        </Card>

        <div className="flex justify-end pt-6">
          <Button type="submit" size="lg">{submitButtonText}</Button>
        </div>
      </form>
    </Form>
  );
}

