
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

export interface VisaApplication {
  id: string;
  userId: string;
  applicantName: string;
  employeeId: string;
  nationality?: string; // Optional since it doesn't exist in database
  travelPurpose: VisaPurpose;
  tripStartDate: Date | null;
  tripEndDate: Date | null;
  passportNumber: string;
  passportExpiryDate: Date | null;
  itineraryDetails: string;
  supportingDocumentsNotes?: string;
  status: string;
  submittedDate: Date;
  lastUpdatedDate: Date;
  approvalWorkflow?: VisaApprovalStep[];
  approvalHistory?: VisaApprovalStep[]; // Keep for backward compatibility
}

export interface VisaApprovalStep {
  role: string; // e.g., 'Requestor', 'Department Focal', 'Line Manager/HOD', 'Visa Clerk'
  name: string;
  status: 'Current' | 'Pending' | 'Approved' | 'Rejected' | 'Not Started' | 'Cancelled' | 'Submitted';
  date?: Date | string;
  comments?: string;
}
