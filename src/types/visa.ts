
export type VisaPurpose = 'Business Trip' | 'Expatriate Relocation' | '';
export type VisaStatus = 
  | 'Draft' 
  | 'Pending Department Focal' 
  | 'Pending Line Manager/HOD' 
  | 'Pending Visa Clerk' 
  | 'Processing with Embassy' 
  | 'Approved' 
  | 'Rejected' 
  | 'Cancelled'
  | '';

export interface VisaProcessingDetails {
  paymentMethod?: string;
  bankTransferReference?: string;
  chequeNumber?: string;
  paymentDate?: string | Date;
  applicationFee?: number;
  processingFee?: number;
  totalFee?: number;
  visaNumber?: string;
  visaValidFrom?: string | Date;
  visaValidTo?: string | Date;
  processingNotes?: string;
  verifiedBy?: string;
  authorizedBy?: string;
}

export interface VisaApplication {
  id: string;
  userId: string;
  applicantName: string;
  requestorName?: string;
  employeeId: string;
  staffId?: string;
  department?: string;
  position?: string;
  email?: string;
  nationality?: string; // Optional since it doesn't exist in database
  travelPurpose: VisaPurpose;
  destination?: string;
  visaType?: string;
  tripStartDate: Date | null;
  tripEndDate: Date | null;
  passportNumber: string;
  passportExpiryDate: Date | null;
  itineraryDetails: string;
  additionalComments?: string;
  supportingDocumentsNotes?: string;
  passportCopy?: any;
  status: string;
  submittedDate: Date;
  lastUpdatedDate: Date;
  approvalWorkflow?: VisaApprovalStep[];
  approvalHistory?: VisaApprovalStep[]; // Keep for backward compatibility
  processingDetails?: VisaProcessingDetails | null;
  processingStartedAt?: Date | null;
  processingCompletedAt?: Date | null;
}

export interface VisaApprovalStep {
  role: string; // e.g., 'Requestor', 'Department Focal', 'Line Manager/HOD', 'Visa Clerk'
  name: string;
  status: 'Current' | 'Pending' | 'Approved' | 'Rejected' | 'Not Started' | 'Cancelled' | 'Submitted';
  date?: Date | string;
  comments?: string;
}
