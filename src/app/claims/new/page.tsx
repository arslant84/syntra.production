"use client";

import React from 'react';
import ExpenseClaimForm from "@/components/claims/ExpenseClaimForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExpenseClaim } from "@/types/claims";
import { ReceiptText } from "lucide-react"; // Using a more relevant icon
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export default function NewClaimPage() {
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmitClaim = async (data: ExpenseClaim) => {
    console.log("Expense Claim Submitted - Starting submission process");
    console.log("Expense Claim Data Structure:", JSON.stringify(data, null, 2).substring(0, 1000) + "...");
    try {
      // Ensure all required fields are present and properly formatted
      if (!data.bankDetails?.purposeOfClaim) {
        console.error("Missing required field: purposeOfClaim");
      }
      
      // Send data to the backend API
      console.log("Sending data to API endpoint: /api/claims");
      const response = await fetch('/api/claims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      console.log("API Response Status:", response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`Error submitting claim: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Claim submission result:', result);

      toast({
        title: "Expense Claim Submitted!",
        description: "Your expense claim has been successfully submitted.",
        variant: "default",
      });
      
      // Wait a moment to ensure the database has been updated
      setTimeout(() => {
        router.push('/claims'); // Redirect to claims list or dashboard
      }, 1000);
    } catch (error) {
      console.error('Failed to submit claim:', error);
      toast({
        title: "Error Submitting Claim",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  // Initial empty data for the form
  const initialClaimData: Partial<ExpenseClaim> = {
    headerDetails: {
      documentType: "",
      documentNumber: "",
      claimForMonthOf: null,
      staffName: "", // Should be pre-filled ideally from user session
      staffNo: "",   // Should be pre-filled ideally
      gred: "",
      staffType: "",
      executiveStatus: "",
      departmentCode: "",
      deptCostCenterCode: "",
      location: "",
      telExt: "",
      startTimeFromHome: "",
      timeOfArrivalAtHome: "",
    },
    bankDetails: {
      bankName: "",
      accountNumber: "",
      purposeOfClaim: "",
    },
    medicalClaimDetails: {
      isMedicalClaim: false,
      applicableMedicalType: "",
      isForFamily: false,
      familyMemberSpouse: false,
      familyMemberChildren: false,
      familyMemberOther: "",
    },
    expenseItems: [],
    informationOnForeignExchangeRate: [],
    financialSummary: {
      totalAdvanceClaimAmount: "",
      lessAdvanceTaken: "",
      lessCorporateCreditCardPayment: "",
      balanceClaimRepayment: "", // This will be calculated
      chequeReceiptNo: "",
    },
    declaration: {
      iDeclare: false,
      date: new Date(), // Default to today
    },
  };

  return (
    <div className="w-full px-2 md:px-6 py-8 space-y-8">
      <Card className="w-full shadow-lg">
        <CardHeader className="bg-muted/30 rounded-t-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <ReceiptText className="w-7 h-7 text-primary" />
                Staff Expense Claim Form
              </CardTitle>
              <CardDescription>
                Complete the form to submit your expense claim. Ensure all details are accurate.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="py-8 px-4 md:px-8">
          <ExpenseClaimForm
            initialData={initialClaimData as ExpenseClaim}
            onSubmit={handleSubmitClaim}
            submitButtonText="Submit Claim"
          />
        </CardContent>
      </Card>
    </div>
  );
}
