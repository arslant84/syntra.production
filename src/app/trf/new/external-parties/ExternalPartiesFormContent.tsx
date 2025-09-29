"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TrfStepper from '@/components/trf/TrfStepper';
import ExternalPartyRequestorForm from '@/components/trf/ExternalPartyRequestorForm';
import ExternalPartiesTravelDetailsForm from '@/components/trf/ExternalPartiesTravelDetailsForm';
import ApprovalSubmissionForm from '@/components/trf/ApprovalSubmissionForm';
import type { ExternalPartyRequestorInformation, ExternalPartiesTravelSpecificDetails, ApprovalSubmissionData, TravelRequestForm, ApprovalStep } from '@/types/trf';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Loader2, AlertTriangle } from 'lucide-react';
import { formatISO, parseISO, isValid } from 'date-fns';

const STEPS = ["Requestor Details", "Travel Details", "Approval & Submission"];

const initialRequestorData: ExternalPartyRequestorInformation = {
  externalFullName: "", externalOrganization: "", externalRefToAuthorityLetter: "", externalCostCenter: "",
};
const initialTravelDetailsData: ExternalPartiesTravelSpecificDetails = {
  purpose: "",
  itinerary: [{ date: null, day: '', from: '', to: '', etd: '', eta: '', flightNumber: '', remarks: '' }],
  accommodationDetails: [],
  mealProvision: { dateFromTo: "", breakfast: 0, lunch: 0, dinner: 0, supper: 0, refreshment: 0 },
};
const initialApprovalData: ApprovalSubmissionData = {
  additionalComments: "", confirmPolicy: false, confirmManagerApproval: false,
};

const createInitialApprovalWorkflow = (requestorName?: string): ApprovalStep[] => [
  { role: "Requestor", name: requestorName || "Petronas Contact Person", status: "Current", date: new Date() },
  { role: "Department Focal", name: "Pending Department Focal", status: "Pending" },
  { role: "Line Manager", name: "Pending Line Manager Approval", status: "Pending" },
  { role: "HOD", name: "Pending HOD Approval", status: "Pending" },
];

const parseDatesInExternalPartiesTSRData = (data: any): Partial<TravelRequestForm> => {
  if (!data) return {};
  const parsed = { ...data };
  const parseDateOrNull = (dateStr: string | Date | undefined | null): Date | null => {
    if (!dateStr) return null;
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    return isValid(date) ? date : null;
  };

  if (parsed.externalPartiesTravelDetails) {
    if (parsed.externalPartiesTravelDetails.itinerary) {
      parsed.externalPartiesTravelDetails.itinerary = parsed.externalPartiesTravelDetails.itinerary.map((seg: any) => ({
        ...seg,
        date: parseDateOrNull(seg.date),
      }));
    }
    if (parsed.externalPartiesTravelDetails.accommodationDetails) {
      parsed.externalPartiesTravelDetails.accommodationDetails = parsed.externalPartiesTravelDetails.accommodationDetails.map((acc: any) => ({
        ...acc,
        checkInDate: parseDateOrNull(acc.checkInDate),
        checkOutDate: parseDateOrNull(acc.checkOutDate),
        estimatedCostPerNight: Number(acc.estimatedCostPerNight || 0), // Ensure estimatedCostPerNight is parsed as number
      }));
    }
    if (parsed.externalPartiesTravelDetails.mealProvision) {
      parsed.externalPartiesTravelDetails.mealProvision = {
        ...parsed.externalPartiesTravelDetails.mealProvision,
        breakfast: Number(parsed.externalPartiesTravelDetails.mealProvision.breakfast || 0),
        lunch: Number(parsed.externalPartiesTravelDetails.mealProvision.lunch || 0),
        dinner: Number(parsed.externalPartiesTravelDetails.mealProvision.dinner || 0),
        supper: Number(parsed.externalPartiesTravelDetails.mealProvision.supper || 0),
        refreshment: Number(parsed.externalPartiesTravelDetails.mealProvision.refreshment || 0),
      };
    }
  }
  parsed.submittedAt = parseDateOrNull(parsed.submittedAt);
  parsed.createdAt = parseDateOrNull(parsed.createdAt);
  parsed.updatedAt = parseDateOrNull(parsed.updatedAt);
   if (parsed.approvalWorkflow) {
    parsed.approvalWorkflow = parsed.approvalWorkflow.map((step: any) => ({
      ...step,
      date: parseDateOrNull(step.date),
    }));
  }
  return parsed as Partial<TravelRequestForm>;
};


export default function ExternalPartiesFormContent() {
  const router = useRouter(); 
  const searchParams = useSearchParams(); 
  const { toast } = useToast();
  
  const editId = searchParams.get('editId'); 
  const isEditMode = !!editId;
  
  const [currentStep, setCurrentStep] = useState(1); 
  const [isLoadingTrf, setIsLoadingTrf] = useState(false); 
  const [trfLoadError, setTrfLoadError] = useState<string | null>(null);
  
  const [requestorInfo, setRequestorInfo] = useState<ExternalPartyRequestorInformation>(initialRequestorData);
  const [travelDetails, setTravelDetails] = useState<ExternalPartiesTravelSpecificDetails>(initialTravelDetailsData);
  const [approvalData, setApprovalData] = useState<ApprovalSubmissionData>(initialApprovalData);
  const [approvalWorkflow, setApprovalWorkflow] = useState<ApprovalStep[]>(createInitialApprovalWorkflow(initialRequestorData.externalFullName));


  const [initialRequestorInfoForForm, setInitialRequestorInfoForForm] = useState<ExternalPartyRequestorInformation | undefined>(undefined);
  const [initialTravelDetailsForForm, setInitialTravelDetailsForForm] = useState<ExternalPartiesTravelSpecificDetails | undefined>(undefined);
  const [initialApprovalDataForForm, setInitialApprovalDataForForm] = useState<ApprovalSubmissionData | undefined>(undefined);


  useEffect(() => {
    if (isEditMode && editId) {
      setIsLoadingTrf(true); 
      setTrfLoadError(null);
      const fetchTrfForEdit = async () => {
        try {
          const response = await fetch(`/api/trf/${editId}`);
          if (!response.ok) {
            const contentType = response.headers.get('content-type') || '';
            let errorMessage = `Failed to fetch TSR ${editId}: ${response.status} ${response.statusText}`;
            
            if (contentType.includes('application/json')) {
              try {
                const errorData = await response.json();
                errorMessage = errorData?.error || errorData?.details || errorMessage;
              } catch {
                // If JSON parsing fails, use the default error message
              }
            } else {
              // For non-JSON responses (like HTML 503 pages), use status text
              errorMessage = `Failed to fetch TSR ${editId}: ${response.status}`;
            }
            
            throw new Error(errorMessage);
          }
          const result = await response.json();
          const fetchedTsr = parseDatesInExternalPartiesTSRData(result.trf) as TravelRequestForm;

          if (fetchedTsr && fetchedTsr.travelType === 'External Parties') {
            if (fetchedTsr.externalPartyRequestorInfo) {
              setRequestorInfo(fetchedTsr.externalPartyRequestorInfo);
              setInitialRequestorInfoForForm(fetchedTsr.externalPartyRequestorInfo);
            } else {
              // Handle case where externalPartyRequestorInfo might be missing but expected
              setRequestorInfo(initialRequestorData);
              setInitialRequestorInfoForForm(initialRequestorData);
            }

            if (fetchedTsr.externalPartiesTravelDetails) {
              setTravelDetails(fetchedTsr.externalPartiesTravelDetails);
              setInitialTravelDetailsForForm(fetchedTsr.externalPartiesTravelDetails);
            } else {
              setTravelDetails(initialTravelDetailsData);
              setInitialTravelDetailsForForm(initialTravelDetailsData);
            }

            const appData: ApprovalSubmissionData = {
              additionalComments: fetchedTsr.additionalComments || "",
              confirmPolicy: false,
              confirmManagerApproval: false,
            };
            setApprovalData(appData);
            setInitialApprovalDataForForm(appData);
            setApprovalWorkflow(fetchedTsr.approvalWorkflow || createInitialApprovalWorkflow(fetchedTsr.externalPartyRequestorInfo?.externalFullName));

          } else {
            throw new Error(`TSR ${editId} is not an External Parties TSR or data is invalid.`);
          }
        } catch (err: any) {
          console.error("Error fetching TSR for edit:", err);
          setTrfLoadError(err.message);
          toast({ title: "Error Loading TSR", description: err.message, variant: "destructive" });
        } finally {
          setIsLoadingTrf(false);
        }
      };
      fetchTrfForEdit();
    } else {
      setRequestorInfo(initialRequestorData);
      setTravelDetails(initialTravelDetailsData);
      setApprovalData(initialApprovalData);
      setApprovalWorkflow(createInitialApprovalWorkflow(initialRequestorData.externalFullName));
      setInitialRequestorInfoForForm(initialRequestorData);
      setInitialTravelDetailsForForm(initialTravelDetailsData);
      setInitialApprovalDataForForm(initialApprovalData);
    }
  }, [editId, isEditMode, toast]);

  const handleNextStep = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
  const handlePrevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  
  const handleRequestorSubmit = (data: ExternalPartyRequestorInformation) => { 
    setRequestorInfo(data); 
    setApprovalWorkflow(createInitialApprovalWorkflow(data.externalFullName));
    handleNextStep(); 
  };
  
  const handleTravelDetailsSubmit = (data: ExternalPartiesTravelSpecificDetails) => { 
    setTravelDetails(data); 
    handleNextStep(); 
  };

  const handleFinalSubmit = async (data: ApprovalSubmissionData) => {
    setApprovalData(data);
    const finalTSRData = {
      externalPartyRequestorInfo: requestorInfo,
      travelType: 'External Parties',
      externalPartiesTravelDetails: {
        ...travelDetails,
        itinerary: (travelDetails.itinerary || []).map(seg => ({ 
          ...seg, 
          date: seg.date ? formatISO(seg.date, { representation: 'date' }) : null 
        })),
        accommodationDetails: (travelDetails.accommodationDetails || []).map(acc => ({
          ...acc,
          checkInDate: acc.checkInDate ? formatISO(acc.checkInDate, {representation: 'date'}) : null,
          checkOutDate: acc.checkOutDate ? formatISO(acc.checkOutDate, {representation: 'date'}) : null,
          estimatedCostPerNight: Number(acc.estimatedCostPerNight || 0), // Ensure estimatedCostPerNight is parsed as number
        })),
        mealProvision: travelDetails.mealProvision, // Explicitly include mealProvision
      },
      additionalComments: data.additionalComments,
      confirmPolicy: data.confirmPolicy,
      confirmManagerApproval: data.confirmManagerApproval,
      estimatedCost: 1000, // Mock estimated cost
    };

    const endpoint = isEditMode && editId ? `/api/trf/${editId}` : '/api/trf';
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const response = await fetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalTSRData),
      });
      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = `Failed to ${isEditMode ? 'update' : 'submit'} TSR: ${response.status} ${response.statusText}`;
        let errorData: any = {};
        
        if (contentType.includes('application/json')) {
          try {
            errorData = await response.json();
            errorMessage = errorData?.error || errorData?.details || errorMessage;
          } catch {
            // If JSON parsing fails, use the default error message
          }
        } else {
          // For non-JSON responses (like HTML 503 pages), use status text
          errorMessage = `Failed to ${isEditMode ? 'update' : 'submit'} TSR: ${response.status}`;
        }
         if (typeof errorData.details === 'object' && errorData.details.fieldErrors) { 
             errorMessage = Object.values(errorData.details.fieldErrors).flat().join('; ') || "Validation failed with multiple errors.";
        } else if (typeof errorData.details === 'object' && errorData.details.formErrors) {
            errorMessage = errorData.details.formErrors.join('; ') || "A form-level error occurred.";
        }
        throw new Error(errorMessage);
      }
      const result = await response.json();
      toast({ 
        title: `External Parties TSR ${isEditMode ? 'Updated' : 'Submitted'}!`, 
        description: `TSR ID ${result.trf?.id || editId || result.trfId} processed successfully.`, 
        variant: "default", 
      });
      router.push('/trf');
    } catch (err: any) {
      toast({ 
        title: `Error ${isEditMode ? 'Updating' : 'Submitting'} TSR`, 
        description: err.message || "An unexpected error occurred.", 
        variant: "destructive" 
      });
    }
  };

  const trfDataForSummary: TravelRequestForm = { 
    id: editId || 'temp-external-id', 
    status: isEditMode ? 'Editing' : 'Draft', 
    externalPartyRequestorInfo: requestorInfo,
    travelType: 'External Parties', 
    externalPartiesTravelDetails: travelDetails, 
    additionalComments: approvalData.additionalComments, 
    confirmPolicy: approvalData.confirmPolicy, 
    confirmManagerApproval: approvalData.confirmManagerApproval,
    approvalWorkflow: approvalWorkflow,
    estimatedCost: 1000, // Mock
  };
  
  if (isEditMode && isLoadingTrf) { return (<div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="w-12 h-12 text-primary animate-spin mb-4" /><p className="text-muted-foreground">Loading TSR for editing...</p></div>); }
  if (isEditMode && trfLoadError) { return (<div className="space-y-8"><Card className="max-w-lg mx-auto shadow-lg"><CardHeader><CardTitle className="flex items-center justify-center gap-2 text-destructive"><AlertTriangle className="w-6 h-6" /> Error Loading TSR</CardTitle></CardHeader><CardContent><p>{trfLoadError}</p><Button onClick={() => router.push('/trf')} className="mt-4">Back to TSR List</Button></CardContent></Card></div>); }

  return (
    <div className="w-full px-2 md:px-6 py-8 space-y-8">
      <Card className="w-full shadow-lg">
        <CardHeader className="bg-muted/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Users className="w-7 h-7 text-primary" />
                {isEditMode ? 'Edit Business Travel Request (External Parties)' : 'New Business Travel Request (External Parties)'}
              </CardTitle>
              <CardDescription>Follow the steps to complete the TSR for an external party.</CardDescription>
            </div>
            <p className="text-sm text-muted-foreground mt-2 sm:mt-0">Step {currentStep} of {STEPS.length}</p>
          </div>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          <TrfStepper currentStep={currentStep} steps={STEPS} onStepClick={(step) => { if (step <= currentStep) { setCurrentStep(step); } }} />
        </CardContent>
      </Card>
      
      {currentStep === 1 && (
        <ExternalPartyRequestorForm 
          initialData={initialRequestorInfoForForm} 
          onSubmit={handleRequestorSubmit} 
        />
      )}
      {currentStep === 2 && (
        <ExternalPartiesTravelDetailsForm 
          initialData={initialTravelDetailsForForm} 
          onSubmit={handleTravelDetailsSubmit} 
          onBack={handlePrevStep} 
        />
      )}
      {currentStep === 3 && (
        <ApprovalSubmissionForm 
          isEditMode={isEditMode} 
          trfData={trfDataForSummary} 
          approvalWorkflowSteps={approvalWorkflow} 
          initialData={initialApprovalDataForForm}
          onSubmit={handleFinalSubmit} 
          onBack={handlePrevStep} 
        />
      )}
    </div>
  );
}
