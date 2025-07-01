"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TrfStepper from '@/components/trf/TrfStepper';
import RequestorInformationForm from '@/components/trf/RequestorInformationForm';
import DomesticTravelDetailsForm from '@/components/trf/DomesticTravelDetailsForm';
import ApprovalSubmissionForm from '@/components/trf/ApprovalSubmissionForm';
import type { RequestorInformation, DomesticTravelSpecificDetails, ApprovalSubmissionData, TravelRequestForm, ApprovalStep, ItinerarySegment, AccommodationDetail, CompanyTransportDetail } from '@/types/trf';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileEdit, Loader2, AlertTriangle, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatISO, parseISO, isValid } from 'date-fns';

const STEPS = ["Requestor Information", "Travel Details", "Approval & Submission"];

const initialRequestorData: RequestorInformation = {
  requestorName: "", staffId: "", department: "", position: "", costCenter: "", telEmail: "", email: "",
};

const initialTravelDetailsData: DomesticTravelSpecificDetails = {
  purpose: "",
  itinerary: [{ date: null, day: "", from: "", to: "", etd: "", eta: "", flightNumber: "", remarks: "" }],
  mealProvision: { dateFromTo: "", breakfast: 0, lunch: 0, dinner: 0, supper: 0, refreshment: 0 },
  accommodationDetails: [],
  companyTransportDetails: [],
};

const initialApprovalData: ApprovalSubmissionData = {
  additionalComments: "", confirmPolicy: false, confirmManagerApproval: false,
};

// Placeholder for actual approval workflow steps
const createInitialApprovalWorkflow = (requestorName?: string): ApprovalStep[] => [
    { role: "Requestor", name: requestorName || "Requestor", status: "Current", date: new Date() },
    { role: "Department Focal", name: "Pending Department Focal", status: "Pending" },
    { role: "Line Manager", name: "Pending Line Manager", status: "Pending" },
    { role: "HOD", name: "Pending HOD", status: "Pending" },
];

const parseDatesInDomesticTRFData = (data: any): Partial<TravelRequestForm> => {
  if (!data) return {};
  const parsed = { ...data };

  // Helper to parse date or return null
  const parseDateOrNull = (dateStr: string | Date | undefined | null): Date | null => {
    if (!dateStr) return null;
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    return isValid(date) ? date : null;
  };
  
  if (parsed.domesticTravelDetails) {
    if (parsed.domesticTravelDetails.itinerary) {
      parsed.domesticTravelDetails.itinerary = parsed.domesticTravelDetails.itinerary.map((seg: any) => ({
        ...seg,
        date: parseDateOrNull(seg.date),
      }));
    }
    if (parsed.domesticTravelDetails.accommodationDetails) {
      parsed.domesticTravelDetails.accommodationDetails = parsed.domesticTravelDetails.accommodationDetails.map((acc: any) => ({
        ...acc,
        checkInDate: parseDateOrNull(acc.checkInDate),
        checkOutDate: parseDateOrNull(acc.checkOutDate),
        location: acc.location,
        placeOfStay: acc.placeOfStay,
        estimatedCostPerNight: acc.estimatedCostPerNight,
        remarks: acc.remarks,
      }));
    }
    if (parsed.domesticTravelDetails.companyTransportDetails) {
      parsed.domesticTravelDetails.companyTransportDetails = parsed.domesticTravelDetails.companyTransportDetails.map((trans: any) => ({
        ...trans,
        date: parseDateOrNull(trans.date),
        remarks: trans.remarks, // Ensure remarks is passed
      }));
    }
    // Added mealProvision parsing
    if (parsed.domesticTravelDetails.mealProvision) {
      parsed.domesticTravelDetails.mealProvision = {
        ...parsed.domesticTravelDetails.mealProvision,
        breakfast: Number(parsed.domesticTravelDetails.mealProvision.breakfast || 0),
        lunch: Number(parsed.domesticTravelDetails.mealProvision.lunch || 0),
        dinner: Number(parsed.domesticTravelDetails.mealProvision.dinner || 0),
        supper: Number(parsed.domesticTravelDetails.mealProvision.supper || 0),
        refreshment: Number(parsed.domesticTravelDetails.mealProvision.refreshment || 0),
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


export default function NewDomesticTRFPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const editId = searchParams.get('editId');
  const isEditMode = !!editId;

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoadingTrf, setIsLoadingTrf] = useState(false);
  const [trfLoadError, setTrfLoadError] = useState<string | null>(null);
  
  const [requestorInfo, setRequestorInfo] = useState<RequestorInformation>(initialRequestorData);
  const [travelDetails, setTravelDetails] = useState<DomesticTravelSpecificDetails>(initialTravelDetailsData);
  const [approvalData, setApprovalData] = useState<ApprovalSubmissionData>(initialApprovalData);
  const [approvalWorkflow, setApprovalWorkflow] = useState<ApprovalStep[]>(createInitialApprovalWorkflow(initialRequestorData.requestorName));

  // For pre-filling forms when in edit mode - these are passed to child forms
  const [initialRequestorInfoForForm, setInitialRequestorInfoForForm] = useState<RequestorInformation | undefined>(undefined);
  const [initialTravelDetailsForForm, setInitialTravelDetailsForForm] = useState<DomesticTravelSpecificDetails | undefined>(undefined);
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
          const fetchedTrf = parseDatesInDomesticTRFData(result.trf) as TravelRequestForm;

          if (fetchedTrf && fetchedTrf.travelType === 'Domestic') {
            const reqInfo: RequestorInformation = {
              requestorName: fetchedTrf.requestorName || "", staffId: fetchedTrf.staffId || "", department: fetchedTrf.department || "",
              position: fetchedTrf.position || "", costCenter: fetchedTrf.costCenter || "", telEmail: fetchedTrf.telEmail || "", email: fetchedTrf.email || ""
            };
            setRequestorInfo(reqInfo); // Update page state
            setInitialRequestorInfoForForm(reqInfo); // For child form pre-fill

            if (fetchedTrf.domesticTravelDetails) {
              setTravelDetails(fetchedTrf.domesticTravelDetails); // Update page state
              setInitialTravelDetailsForForm(fetchedTrf.domesticTravelDetails); // For child form pre-fill
            }
            const appData: ApprovalSubmissionData = {
              additionalComments: fetchedTrf.additionalComments || "",
              confirmPolicy: false, // Re-confirm on edit
              confirmManagerApproval: false, // Re-confirm
            };
            setApprovalData(appData); // Update page state
            setInitialApprovalDataForForm(appData); // For child form pre-fill
            setApprovalWorkflow(fetchedTrf.approvalWorkflow || createInitialApprovalWorkflow(reqInfo.requestorName));


          } else {
            throw new Error(`TRF ${editId} is not a Domestic TRF or data is invalid.`);
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
      // Reset to default for new TRF
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
  
  const handleTravelDetailsSubmit = (data: DomesticTravelSpecificDetails) => { 
    setTravelDetails(data); 
    // Force update the current step to ensure proper progression
    if (isEditMode) {
      console.log('Domestic edit flow: forcing step progression to approval step');
      setCurrentStep(3); // Force set to approval step
    } else {
      handleNextStep(); // Normal progression for new requests
    }
  };

  const handleFinalSubmit = async (data: ApprovalSubmissionData) => {
    setApprovalData(data); 

    // Create the base data structure
    let finalTRFData: any = {
      travelType: 'Domestic',
      additionalComments: data.additionalComments,
      confirmPolicy: data.confirmPolicy,
      confirmManagerApproval: data.confirmManagerApproval,
      estimatedCost: 500, // Mock estimated cost
    };

    // For new submissions, use nested structure as expected by the POST endpoint
    if (!isEditMode) {
      finalTRFData = {
        ...finalTRFData,
        requestorInfo: {
          requestorName: requestorInfo.requestorName,
          staffId: requestorInfo.staffId,
          department: requestorInfo.department,
          position: requestorInfo.position,
          costCenter: requestorInfo.costCenter,
          telEmail: requestorInfo.telEmail,
          email: requestorInfo.email
        },
        domesticTravelDetails: {
          purpose: travelDetails.purpose,
          itinerary: (travelDetails.itinerary || []).map(seg => ({
            ...seg,
            date: seg.date ? formatISO(seg.date, { representation: 'date' }) : null,
          })),
          mealProvision: travelDetails.mealProvision,
          accommodationDetails: (travelDetails.accommodationDetails || []).map(acc => ({
            ...acc,
            checkInDate: acc.checkInDate ? formatISO(acc.checkInDate, {representation: 'date'}) : null,
            checkOutDate: acc.checkOutDate ? formatISO(acc.checkOutDate, {representation: 'date'}) : null,
          })),
          companyTransportDetails: (travelDetails.companyTransportDetails || []).map(trans => ({
            ...trans,
            date: trans.date ? formatISO(trans.date, {representation: 'date'}) : null,
          })),
        },
      };
    } 
    // For edits, use flat structure as expected by the PUT endpoint
    else {
      finalTRFData = {
        ...finalTRFData,
        // Requestor info fields
        requestorName: requestorInfo.requestorName,
        staffId: requestorInfo.staffId,
        department: requestorInfo.department,
        position: requestorInfo.position,
        costCenter: requestorInfo.costCenter,
        telEmail: requestorInfo.telEmail,
        email: requestorInfo.email,
        
        // Travel details fields
        purpose: travelDetails.purpose,
        
        // Format itinerary with proper date handling
        itinerary: (travelDetails.itinerary || []).map(seg => ({
          ...seg,
          date: seg.date ? formatISO(seg.date, { representation: 'date' }) : null,
        })),
        
        // Format meal provision
        mealProvision: travelDetails.mealProvision,
        
        // Format accommodation details with proper date handling
        accommodationDetails: (travelDetails.accommodationDetails || []).map(acc => ({
          ...acc,
          checkInDate: acc.checkInDate ? formatISO(acc.checkInDate, {representation: 'date'}) : null,
          checkOutDate: acc.checkOutDate ? formatISO(acc.checkOutDate, {representation: 'date'}) : null,
        })),
        
        // Format company transport details with proper date handling
        companyTransportDetails: (travelDetails.companyTransportDetails || []).map(trans => ({
          ...trans,
          date: trans.date ? formatISO(trans.date, {representation: 'date'}) : null,
        })),
      };
    }

    const endpoint = isEditMode && editId ? `/api/trf/${editId}` : '/api/trf';
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      // Log the exact data being sent to help with debugging
      console.log('Submitting TRF data:', JSON.stringify(finalTRFData));
      
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
        title: `Domestic TRF ${isEditMode ? 'Updated' : 'Submitted'}!`,
        description: `TRF ID ${result.trf?.id || editId || result.trfId} processed successfully.`,
        variant: "default"
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

  // Construct TRFData for summary, using page-level state
  const trfDataForSummary: TravelRequestForm = {
    id: editId || 'temp-id',
    status: isEditMode ? 'Pending Department Focal' : 'Draft', // Using a valid TrfStatus value
    // Requestor Info
    requestorName: requestorInfo.requestorName,
    staffId: requestorInfo.staffId,
    department: requestorInfo.department,
    position: requestorInfo.position,
    costCenter: requestorInfo.costCenter,
    telEmail: requestorInfo.telEmail,
    email: requestorInfo.email,
    // Travel Details
    travelType: 'Domestic',
    domesticTravelDetails: travelDetails,
    // Approval Data
    additionalComments: approvalData.additionalComments,
    confirmPolicy: approvalData.confirmPolicy,
    confirmManagerApproval: approvalData.confirmManagerApproval,
    approvalWorkflow: approvalWorkflow, // Use state for workflow
  };

  if (isEditMode && isLoadingTrf) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading TRF for editing...</p>
      </div>
    );
  }
  if (isEditMode && trfLoadError) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <Card className="max-w-lg mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 text-destructive">
              <AlertTriangle className="w-6 h-6" /> Error Loading TRF
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{trfLoadError}</p>
            <Button onClick={() => router.push('/trf')} className="mt-4">Back to TRF List</Button>
          </CardContent>
        </Card>
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
                <Building className="w-7 h-7 text-primary" />
                {isEditMode ? 'Edit Domestic Travel Request' : 'New Domestic Travel Request'}
              </CardTitle>
              <CardDescription>Follow the steps to complete your domestic travel request form.</CardDescription>
            </div>
            <p className="text-sm text-muted-foreground mt-2 sm:mt-0">Step {currentStep} of {STEPS.length}</p>
          </div>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          <TrfStepper currentStep={currentStep} steps={STEPS} onStepClick={(step) => {
            if (step <= currentStep) {
              setCurrentStep(step);
            }
          }} />
        </CardContent>
      </Card>

      {currentStep === 1 && (
        <div className="w-full">
          <RequestorInformationForm
            initialData={initialRequestorInfoForForm}
            onSubmit={handleRequestorSubmit}
          />
        </div>
      )}
      {currentStep === 2 && (
        <div className="w-full">
          <DomesticTravelDetailsForm
            initialData={initialTravelDetailsForForm}
            onSubmit={handleTravelDetailsSubmit}
            onBack={handlePrevStep}
          />
        </div>
      )}
      {currentStep === 3 && (
        <div className="w-full">
          <ApprovalSubmissionForm
            isEditMode={isEditMode}
            trfData={trfDataForSummary}
            approvalWorkflowSteps={approvalWorkflow}
            initialData={initialApprovalDataForForm}
            onSubmit={handleFinalSubmit}
            onBack={handlePrevStep}
          />
        </div>
      )}
    </div>
  );
}
