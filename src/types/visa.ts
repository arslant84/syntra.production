
export type VisaPurpose = "Business Trip" | "Expatriate Relocation" | "";
export type VisaStatus = 
  | "Draft" 
  | "Pending Department Focal" 
  | "Pending Line Manager/HOD" 
  | "Pending Visa Clerk" 
  | "Processing with Embassy" 
  | "Approved" 
  | "Rejected" 
  | "";

export interface VisaApplication {
  id: string; // Auto-generated or from backend
  userId: string; // Link to the user submitting
  applicantName?: string; // Pre-filled or for display
  
  // Form Fields
  travelPurpose: VisaPurpose;
  destination?: string; // Required if travelPurpose is 'Business Trip'
  
  employeeId: string;
  nationality: string;
  passportCopy?: File | null; // For form handling, actual file is backend
  passportCopyFilename?: string; // To display uploaded file name

  tripStartDate: Date | null;
  tripEndDate: Date | null;
  itineraryDetails: string; // Could be detailed text or link to TSR itinerary
  
  supportingDocumentsNotes?: string; // Notes about uploaded documents
  // Placeholder for multiple document uploads
  uploadedDocumentFilenames?: string[];


  // Workflow & System Fields
  status: VisaStatus;
  submittedDate: Date;
  lastUpdatedDate: Date;
  approvalHistory?: VisaApprovalStep[];
  visaCopyFilename?: string; // For Visa Clerk to upload approved visa
  rejectionReason?: string;
  tsrReferenceNumber?: string; // BT Reference Number
}

export interface VisaApprovalStep {
  stepName: string; // e.g., "Department Focal Verification", "Line Manager Approval"
  approverName?: string;
  status: "Pending" | "Approved" | "Rejected";
  date?: Date;
  comments?: string;
}
