"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ExpenseClaimForm from "@/components/claims/ExpenseClaimForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ReceiptText, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ExpenseClaim } from "@/types/claims";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function EditClaimPage() {
  const { claimId } = useParams<{ claimId: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [claimData, setClaimData] = useState<ExpenseClaim | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClaimData() {
      if (!claimId) return;

      try {
        setIsLoading(true);
        setError(null);
        console.log(`Fetching claim data for editing: ${claimId}`);
        const response = await fetch(`/api/claims/${claimId}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch claim: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Claim data fetched successfully:", data);
        setClaimData(data.claimData);
      } catch (err: any) {
        console.error("Error fetching claim data:", err);
        setError(err.message || "Failed to load claim data");
      } finally {
        setIsLoading(false);
      }
    }

    fetchClaimData();
  }, [claimId]);

  const handleSubmitClaim = async (data: ExpenseClaim) => {
    console.log("Expense Claim Revising - Starting revision process");
    console.log("Expense Claim Data Structure:", JSON.stringify(data, null, 2).substring(0, 1000) + "...");
    try {
      // Ensure all required fields are present and properly formatted
      if (!data.bankDetails?.purposeOfClaim) {
        console.error("Missing required field: purposeOfClaim");
      }
      
      // Send data to the backend API
      console.log("Sending data to API endpoint: /api/claims/" + claimId);
      const response = await fetch(`/api/claims/${claimId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      console.log("API Response Status:", response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error revising claim: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Claim revision result:', result);

      toast({
        title: "Expense Claim Revised!",
        description: "Your expense claim has been successfully revised.",
        variant: "default",
      });
      
      // Wait a moment to ensure the database has been updated
      setTimeout(() => {
        router.push(`/claims/view/${claimId}`); // Redirect to view page
      }, 1000);
    } catch (error) {
      console.error('Failed to revise claim:', error);
      toast({
        title: "Error Revising Claim",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    router.push(`/claims/view/${claimId}`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading claim data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => router.push('/claims')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Claims
        </Button>
      </div>
    );
  }

  if (!claimData) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Claim data not found</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => router.push('/claims')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Claims
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full px-2 md:px-6 py-8 space-y-8">
      <Card className="w-full shadow-lg">
        <CardHeader className="bg-muted/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <ReceiptText className="w-7 h-7 text-primary" />
                Edit Expense Claim
              </CardTitle>
              <CardDescription>
                Update your expense claim details. Ensure all information is accurate before submitting.
              </CardDescription>
            </div>
            <div className="flex gap-2 mt-4 sm:mt-0">
              <Button variant="outline" onClick={handleCancel}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <ExpenseClaimForm
        initialData={claimData}
        onSubmit={handleSubmitClaim}
        submitButtonText="Revise Claim"
        claimId={claimId} // Pass the claimId to the form
      />
    </div>
  );
}
