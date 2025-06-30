
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ExternalPartyRequestorInformation } from "@/types/trf";
import { Users } from "lucide-react"; 
import React, { useEffect } from 'react'; 

const externalPartyRequestorSchema = z.object({
  externalFullName: z.string().min(1, "Full name is required"),
  externalOrganization: z.string().min(1, "Organization/Entity is required"),
  externalRefToAuthorityLetter: z.string().min(1, "Reference to Authority Letter is required"),
  externalCostCenter: z.string().min(1, "Cost Center/Dept. Zatrat is required"),
});

interface ExternalPartyRequestorFormProps {
  initialData?: Partial<ExternalPartyRequestorInformation>;
  onSubmit: (data: ExternalPartyRequestorInformation) => void;
}

export default function ExternalPartyRequestorForm({ initialData, onSubmit }: ExternalPartyRequestorFormProps) {
  const form = useForm<ExternalPartyRequestorInformation>({
    resolver: zodResolver(externalPartyRequestorSchema),
    defaultValues: {
      externalFullName: "",
      externalOrganization: "",
      externalRefToAuthorityLetter: "",
      externalCostCenter: "",
    },
  });

  useEffect(() => {
    if (initialData) {
      console.log("ExternalPartyRequestorForm: Resetting form with initialData:", initialData);
      form.reset(initialData);
    }
  }, [initialData, form]);
  
  const handleFormSubmit = (values: ExternalPartyRequestorInformation) => {
    onSubmit(values);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl md:text-2xl">
          <Users className="w-6 h-6 md:w-7 md:w-7 text-primary" />
          Requestor Details / Данные запрашиваемого лица
        </CardTitle>
        <CardDescription>Please provide information for the external party.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="externalFullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name / Полное имя</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., John Smith" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="externalOrganization"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization/Entity / Организация</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Vendor Company XYZ" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="externalRefToAuthorityLetter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ref. to Authority Letter / №, ссылка на письмо о полномочиях №</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., AL-2024-001" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="externalCostCenter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cost Center / Центр затрат</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., CC-EXT-001" {...field} value={field.value || ''} />
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
