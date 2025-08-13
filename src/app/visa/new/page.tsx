"use client";

import React from 'react';
import VisaApplicationForm from "@/components/visa/VisaApplicationForm";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { VisaApplication } from "@/types/visa";
import { StickyNote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export default function NewVisaApplicationPage() {
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmitVisaApplication = async (data: Omit<VisaApplication, 'id' | 'userId' | 'submittedDate' | 'lastUpdatedDate' | 'status'>) => {
    try {
      // Map the form data to the API expected format
      const apiData = {
        applicantName: 'Test User',
        travelPurpose: data.travelPurpose,
        destination: data.destination || '',
        employeeId: data.employeeId,
        // nationality field removed since it doesn't exist in database
        visaType: data.travelPurpose === 'Business Trip' ? 'Business Visa' : 'Work Visa',
        tripStartDate: data.tripStartDate ? data.tripStartDate.toISOString() : null,
        tripEndDate: data.tripEndDate ? data.tripEndDate.toISOString() : null,
        passportNumber: data.passportNumber,
        passportExpiryDate: data.passportExpiryDate ? data.passportExpiryDate.toISOString().split('T')[0] : null,
        itineraryDetails: data.itineraryDetails,
        supportingDocumentsNotes: data.supportingDocumentsNotes
      };

      console.log('Sending visa application to API:', apiData);
      
      const response = await fetch('/api/visa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error Details:", JSON.stringify(errorData, null, 2));
        throw new Error(errorData.error || 'Failed to submit visa application');
      }

      const result = await response.json();
      console.log('API Response:', result);

      toast({
        title: 'Visa Application Submitted!',
        description: 'Your visa application has been successfully submitted for verification.',
        variant: 'default',
      });
      
      router.push('/visa');
    } catch (error) {
      console.error('Error submitting visa application:', error);
      toast({
        title: 'Error Submitting Visa Application',
        description: error instanceof Error ? error.message : 'Failed to submit visa application',
        variant: 'destructive',
      });
    }
  };

  const initialVisaData: Partial<VisaApplication> = {
    travelPurpose: "",
    destination: undefined,
    employeeId: "", // Should be pre-filled from user session ideally
    // nationality field removed since it doesn't exist in database
    passportCopy: null,
    tripStartDate: null,
    tripEndDate: null,
    itineraryDetails: "",
    supportingDocumentsNotes: "",
  };

  return (
    <div className="w-full px-2 md:px-6 py-8 space-y-8">
      <Card className="w-full shadow-lg">
        <CardHeader className="bg-muted/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <StickyNote className="w-7 h-7 text-primary" />
                New Visa Application
              </CardTitle>
              <CardDescription>
                Complete the form to submit your visa application. Ensure all details are accurate and supporting documents are ready.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
      <VisaApplicationForm
        initialData={initialVisaData}
        onSubmit={handleSubmitVisaApplication}
      />
    </div>
  );
}
