
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TrfStepper from '@/components/trf/TrfStepper';
import RequestorInformationForm from '@/components/trf/RequestorInformationForm';
import OverseasTravelDetailsForm from '@/components/trf/OverseasTravelDetailsForm'; // Reusing for Home Leave
import ApprovalSubmissionForm from '@/components/trf/ApprovalSubmissionForm';
import type { RequestorInformation, OverseasTravelSpecificDetails, ApprovalSubmissionData, TravelRequestForm, ApprovalStep } from '@/types/trf';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home as HomeIconLucide, Loader2, AlertTriangle } from 'lucide-react'; 
import { formatISO, parseISO, isValid } from 'date-fns';

const STEPS = ["Requestor Information", "Home Leave Details", "Approval & Submission"];

const initialRequestorData: RequestorInformation = {
  requestorName: "", staffId: "", department: "", position: "", costCenter: "", telEmail: "", email: "",
};
const initialTravelDetailsData: OverseasTravelSpecificDetails = {
  purpose: "Home Leave Passage Entitlement #1", // Default purpose
  itinerary: [{ date: null, day: '', from: '', to: '', etd: '', eta: '', flightNumber: '', remarks: '' }],
  advanceBankDetails: { bankName: "", accountNumber: "" },
  advanceAmountRequested: [],
};
const initialApprovalData: ApprovalSubmissionData = {
  additionalComments: "", confirmPolicy: false, confirmManagerApproval: false, confirmTermsAndConditions: false,
};

const createInitialApprovalWorkflow = (requestorName?: string): ApprovalStep[] => [
  { role: "Requestor", name: requestorName || "Requestor", status: "Current", date: new Date() },
  { role: "Department Focal", name: "Pending Department Focal", status: "Pending" }, // Or HR Focal
  { role: "Line Manager", name: "Pending Line Manager", status: "Pending" },
  { role: "HOD", name: "Pending HOD", status: "Pending" },
];

// Re-using Overseas parser as structure is similar
const parseDatesInHomeLeaveTRFData = (data: any): Partial<TravelRequestForm> => { 
  if (!data) return {};
  const parsed = { ...data };
  const parseDateOrNull = (dateStr: string | Date | undefined | null): Date | null => {
    if (!dateStr) return null;
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    return isValid(date) ? date : null;
  };

  if (parsed.overseasTravelDetails) { // Home Leave uses overseas structure
    if (parsed.overseasTravelDetails.itinerary) {
      parsed.overseasTravelDetails.itinerary = parsed.overseasTravelDetails.itinerary.map((seg: any) => ({
        ...seg,
        date: parseDateOrNull(seg.date),
      }));
    }
    if (parsed.overseasTravelDetails.advanceAmountRequested) {
      parsed.overseasTravelDetails.advanceAmountRequested = parsed.overseasTravelDetails.advanceAmountRequested.map((item: any) => ({
        ...item,
        dateFrom: parseDateOrNull(item.dateFrom),
        dateTo: parseDateOrNull(item.dateTo),
      }));
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

export default function NewHomeLeaveTRFPage() {
  const router = useRouter(); 
  const searchParams = useSearchParams(); 
  const { toast } = useToast();
  
  const editId = searchParams.get('editId'); 
  const isEditMode = !!editId;
  
  const [currentStep, setCurrentStep] = useState(1); 
  const [isLoadingTrf, setIsLoadingTrf] = useState(false); 
  const [trfLoadError, setTrfLoadError] = useState<string | null>(null);
  
  const [requestorInfo, setRequestorInfo] = useState<RequestorInformation>(initialRequestorData);
  const [travelDetails, setTravelDetails] = useState<OverseasTravelSpecificDetails>(initialTravelDetailsData);
  const [approvalData, setApprovalData] = useState<ApprovalSubmissionData>(initialApprovalData);
  const [approvalWorkflow, setApprovalWorkflow] = useState<ApprovalStep[]>(createInitialApprovalWorkflow(initialRequestorData.requestorName));

  const [initialRequestorInfoForForm, setInitialRequestorInfoForForm] = useState<RequestorInformation | undefined>(undefined);
  const [initialTravelDetailsForForm, setInitialTravelDetailsForForm] = useState<OverseasTravelSpecificDetails | undefined>(undefined);
  const [initialApprovalDataForForm, setInitialApprovalDataForForm] = useState<ApprovalSubmissionData | undefined>(undefined);

  useEffect(() => {
    if (isEditMode && editId) {
      setIsLoadingTrf(true); 
      setTrfLoadError(null);
      const fetchTrfForEdit = async () => {
        try {
          const response = await fetch(`/api/trf/${editId}`);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || errorData.details || `Failed to fetch TRF ${editId}: ${response.statusText}`);
          }
          const result = await response.json();
          const fetchedTrf = parseDatesInHomeLeaveTRFData(result.trf) as TravelRequestForm;

          if (fetchedTrf && fetchedTrf.travelType === 'Home Leave Passage') {
             const reqInfo: RequestorInformation = {
              requestorName: fetchedTrf.requestorName || "", staffId: fetchedTrf.staffId || "", department: fetchedTrf.department || "",
              position: fetchedTrf.position || "", costCenter: fetchedTrf.costCenter || "", telEmail: fetchedTrf.telEmail || "", email: fetchedTrf.email || ""
            };
            setRequestorInfo(reqInfo);
            setInitialRequestorInfoForForm(reqInfo);

            if (fetchedTrf.overseasTravelDetails) { // Home Leave uses overseas structure
              setTravelDetails(fetchedTrf.overseasTravelDetails);
              setInitialTravelDetailsForForm(fetchedTrf.overseasTravelDetails);
            }
            const appData: ApprovalSubmissionData = {
              additionalComments: fetchedTrf.additionalComments || "",
              confirmPolicy: false, 
              confirmManagerApproval: false,
              confirmTermsAndConditions: false,
            };
            setApprovalData(appData);
            setInitialApprovalDataForForm(appData);
            setApprovalWorkflow(fetchedTrf.approvalWorkflow || createInitialApprovalWorkflow(reqInfo.requestorName));
          } else {
            throw new Error(`TRF ${editId} is not a Home Leave Passage TRF or data is invalid.`);
          }
        } catch (err: any) {
          console.error("Error fetching TRF for edit:", err);
          setTrfLoadError(err.message);
          toast({ title: "Error Loading TRF", description: err.message, variant: "destructive" });
        } finally {
          setIsLoadingTrf(false);
        }
      };
      fetchTrfForEdit();
    } else {
      setRequestorInfo(initialRequestorData);
      setTravelDetails(initialTravelDetailsData);
      setApprovalData(initialApprovalData);
      setApprovalWorkflow(createInitialApprovalWorkflow(initialRequestorData.requestorName));
      setInitialRequestorInfoForForm(initialRequestorData);
      setInitialTravelDetailsForForm(initialTravelDetailsData);
      setInitialApprovalDataForForm(initialApprovalData);
    }
  }, [editId, isEditMode, toast]);

  const handleNextStep = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
  const handlePrevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  
  const handleRequestorSubmit = (data: RequestorInformation) => { 
    setRequestorInfo(data); 
    setApprovalWorkflow(createInitialApprovalWorkflow(data.requestorName));
    handleNextStep(); 
  };
  
  const handleTravelDetailsSubmit = (data: OverseasTravelSpecificDetails) => { 
    setTravelDetails(data); 
    handleNextStep(); 
  };

  const handleFinalSubmit = async (data: ApprovalSubmissionData) => {
    setApprovalData(data);
    const finalTRFData = {
      requestorName: requestorInfo.requestorName,
      staffId: requestorInfo.staffId,
      department: requestorInfo.department,
      position: requestorInfo.position,
      costCenter: requestorInfo.costCenter,
      telEmail: requestorInfo.telEmail,
      email: requestorInfo.email,

      travelType: 'Home Leave Passage',
      status: isEditMode ? 'Editing' : 'Submitted',
      overseasTravelDetails: { // Home Leave uses overseas structure
        ...travelDetails,
        itinerary: (travelDetails.itinerary || []).map(seg => ({ 
          ...seg, 
          date: seg.date ? formatISO(seg.date, { representation: 'date' }) : null 
        })),
        advanceAmountRequested: (travelDetails.advanceAmountRequested || []).map(item => ({ 
          ...item, 
          dateFrom: item.dateFrom ? formatISO(item.dateFrom, { representation: 'date' }) : null,
          dateTo: item.dateTo ? formatISO(item.dateTo, { representation: 'date' }) : null 
        })),
      },
      additionalComments: data.additionalComments,
      confirmPolicy: data.confirmPolicy,
      confirmManagerApproval: data.confirmManagerApproval,
      confirmTermsAndConditions: data.confirmTermsAndConditions,
      approvalWorkflow: approvalWorkflow, // Include the approval workflow
      estimatedCost: 3000, // Mock estimated cost
    };

    const endpoint = isEditMode && editId ? `/api/trf/${editId}` : '/api/trf';
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const response = await fetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalTRFData),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = errorData.error || errorData.details || `Failed to ${isEditMode ? 'update' : 'submit'} TRF. Server responded with status ${response.status}.`;
         if (typeof errorData.details === 'object' && errorData.details.fieldErrors) {
             errorMessage = Object.values(errorData.details.fieldErrors).flat().join('; ') || "Validation failed with multiple errors.";
        } else if (typeof errorData.details === 'object' && errorData.details.formErrors) {
            errorMessage = errorData.details.formErrors.join('; ') || "A form-level error occurred.";
        }
        throw new Error(errorMessage);
      }
      const result = await response.json();
      toast({ 
        title: `Home Leave TRF ${isEditMode ? 'Updated' : 'Submitted'}!`, 
        description: `TRF ID ${result.trf?.id || editId || result.trfId} processed successfully.`, 
        variant: "default", 
      });
      router.push('/trf');
    } catch (err: any) {
      toast({ 
        title: `Error ${isEditMode ? 'Updating' : 'Submitting'} TRF`, 
        description: err.message || "An unexpected error occurred.", 
        variant: "destructive" 
      });
    }
  };

  const trfDataForSummary: TravelRequestForm = { 
    id: editId || 'temp-home-leave-id', 
    status: isEditMode ? 'Editing' : 'Draft', 
    requestorName: requestorInfo.requestorName,
    staffId: requestorInfo.staffId,
    department: requestorInfo.department,
    position: requestorInfo.position,
    costCenter: requestorInfo.costCenter,
    telEmail: requestorInfo.telEmail,
    email: requestorInfo.email,
    travelType: 'Home Leave Passage', 
    overseasTravelDetails: travelDetails, 
    additionalComments: approvalData.additionalComments, 
    confirmPolicy: approvalData.confirmPolicy, 
    confirmManagerApproval: approvalData.confirmManagerApproval, 
    confirmTermsAndConditions: approvalData.confirmTermsAndConditions,
    approvalWorkflow: approvalWorkflow,
    estimatedCost: 3000, // Mock
  };
  
  if (isEditMode && isLoadingTrf) { return (<div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="w-12 h-12 text-primary animate-spin mb-4" /><p className="text-muted-foreground">Loading TRF for editing...</p></div>); }
  if (isEditMode && trfLoadError) { return (<div className="container mx-auto py-8 px-4 text-center"><Card className="max-w-lg mx-auto shadow-lg"><CardHeader><CardTitle className="flex items-center justify-center gap-2 text-destructive"><AlertTriangle className="w-6 h-6" /> Error Loading TRF</CardTitle></CardHeader><CardContent><p>{trfLoadError}</p><Button onClick={() => router.push('/trf')} className="mt-4">Back to TRF List</Button></CardContent></Card></div>); }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="mb-8 shadow-xl">
        <CardHeader className="bg-muted/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <HomeIconLucide className="w-7 h-7 text-primary" />
                {isEditMode ? 'Edit Home Leave Passage Request' : 'New Home Leave Passage Request'}
              </CardTitle>
              <CardDescription>Follow the steps to complete your home leave passage request form.</CardDescription>
            </div>
            <p className="text-sm text-muted-foreground mt-2 sm:mt-0">Step {currentStep} of {STEPS.length}</p>
          </div>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          <TrfStepper currentStep={currentStep} steps={STEPS} onStepClick={(step) => { if (step <= currentStep) { setCurrentStep(step); } }} />
        </CardContent>
      </Card>
      
      {currentStep === 1 && (
        <RequestorInformationForm 
          initialData={initialRequestorInfoForForm} 
          onSubmit={handleRequestorSubmit} 
        />
      )}
      {currentStep === 2 && (
        <OverseasTravelDetailsForm 
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
