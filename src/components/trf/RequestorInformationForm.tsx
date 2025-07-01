"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { RequestorInformation } from "@/types/trf";
import { UserCircle } from "lucide-react";
import React, { useEffect } from 'react'; 

const requestorSchema = z.object({
  requestorName: z.string().min(1, "Full name is required"),
  staffId: z.string().min(1, "Staff # is required"),
  department: z.string().min(1, "Department & Position is required"), 
  position: z.string().optional(), 
  costCenter: z.string().min(1, "Dept. Cost Centre is required"),
  telEmail: z.string().min(1, "Tel. Ext. & E-Mail is required"),
  email: z.string().email("Invalid email format").optional().or(z.literal('')), // Allow empty string for optional email
});


interface RequestorInformationFormProps {
  initialData?: Partial<RequestorInformation>;
  onSubmit: (data: RequestorInformation) => void;
}

export default function RequestorInformationForm({ initialData, onSubmit }: RequestorInformationFormProps) {
  const form = useForm<RequestorInformation>({
    resolver: zodResolver(requestorSchema),
    defaultValues: {
      requestorName: "",
      staffId: "",
      department: "",
      position: "", 
      costCenter: "",
      telEmail: "",
      email: "", 
    },
  });

  useEffect(() => {
    if (initialData) {
      console.log("RequestorInformationForm: Resetting form with initialData:", initialData);
      form.reset(initialData);
      console.log("RequestorInformationForm: Form errors after reset:", form.formState.errors);
    }
  }, [initialData, form]);
  
  const handleFormSubmit = (values: RequestorInformation) => {
    console.log("RequestorInformationForm: handleFormSubmit called with values:", values);
    onSubmit(values);
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
          <UserCircle className="w-6 h-6 md:w-7 md:w-7 text-primary" />
          Employee Details / Данные сотрудника
        </CardTitle>
        <CardDescription>Please provide your information as the requestor.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="requestorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name / Полное имя</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Your Full Name" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="staffId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Staff # / Штатный №</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., S-00000" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="department" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department & Position / Отдел и должность</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., IT Department / Software Engineer" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="costCenter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dept. Cost Centre / Центр затрат отдела</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., CC00000" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tel. Ext. & E-Mail / Телефон и почта</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 0000 / your.email@example.com" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField 
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="hidden"> {/* This field is hidden but part of the form state and schema */}
                  <FormLabel>Email (hidden, for data)</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="your.email@example.com" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end pt-4">
              <Button type="submit">Next: Travel Details</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
