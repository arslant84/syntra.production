"use client";

import React, { useState, useEffect } from 'react';
import VisaApplicationForm from "@/components/visa/VisaApplicationForm";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { VisaApplication } from "@/types/visa";
import { StickyNote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useUserDetails } from '@/hooks/use-user-details';

export default function NewVisaApplicationPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { userDetails, loading: userDetailsLoading } = useUserDetails();
  const [initialVisaData, setInitialVisaData] = useState<Partial<VisaApplication>>(null);

  const handleSubmitVisaApplication = async (data: Omit<VisaApplication, 'id' | 'userId' | 'submittedDate' | 'lastUpdatedDate' | 'status'>) => {
    try {
      // First, create the visa application
      const apiData = {
        applicantName: userDetails?.requestorName || 'Unknown User',
        travelPurpose: data.travelPurpose,
        destination: data.destination || '',
        employeeId: data.employeeId,
        visaType: data.travelPurpose === 'Business Trip' ? 'Business Visa' : 'Work Visa',
        tripStartDate: data.tripStartDate ? data.tripStartDate.toISOString() : null,
        tripEndDate: data.tripEndDate ? data.tripEndDate.toISOString() : null,
        passportNumber: data.passportNumber,
        passportExpiryDate: data.passportExpiryDate ? data.passportExpiryDate.toISOString().split('T')[0] : null,
        itineraryDetails: data.itineraryDetails
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
      const visaId = result.requestId || result.visaApplication?.id;

      // Upload documents if provided
      const documentsToUpload: Array<{file: File, type: string}> = [];
      
      // Add passport copy if provided
      if (data.passportCopy && visaId) {
        documentsToUpload.push({ file: data.passportCopy, type: 'passport_copy' });
      }
      
      // Add additional documents if provided
      if (data.additionalDocuments && data.additionalDocuments.length > 0 && visaId) {
        Array.from(data.additionalDocuments).forEach((file: File) => {
          documentsToUpload.push({ file, type: 'supporting_document' });
        });
      }

      // Upload all documents
      if (documentsToUpload.length > 0) {
        console.log(`Uploading ${documentsToUpload.length} documents...`);
        
        const uploadPromises = documentsToUpload.map(async ({ file, type }) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('documentType', type);

          return fetch(`/api/visa/${visaId}/documents`, {
            method: 'POST',
            body: formData,
          });
        });

        try {
          const uploadResults = await Promise.all(uploadPromises);
          const failedUploads = uploadResults.filter(response => !response.ok);
          
          if (failedUploads.length > 0) {
            console.warn(`${failedUploads.length} document uploads failed, but visa application was created`);
            toast({
              title: 'Visa Application Submitted!',
              description: `Visa application created successfully, but ${failedUploads.length} document(s) failed to upload. You can upload them later.`,
              variant: 'default',
            });
          } else {
            console.log('All documents uploaded successfully');
          }
        } catch (uploadError) {
          console.warn('Some documents failed to upload:', uploadError);
        }
      }

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

  // Initialize visa data with user details when available
  useEffect(() => {
    if (userDetails && !userDetailsLoading) {
      const newInitialData: Partial<VisaApplication> = {
        travelPurpose: "",
        destination: undefined,
        employeeId: userDetails.staffId || "",
        passportCopy: null,
        additionalDocuments: null,
        tripStartDate: null,
        tripEndDate: null,
        itineraryDetails: "",
      };
      setInitialVisaData(newInitialData);
    }
  }, [userDetails, userDetailsLoading]);

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
      {initialVisaData ? (
        <VisaApplicationForm
          initialData={initialVisaData}
          onSubmit={handleSubmitVisaApplication}
        />
      ) : (
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Loading user details...</div>
        </div>
      )}
    </div>
  );
}
