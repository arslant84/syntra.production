
export type VisaPurpose = 'Business Trip' | 'Expatriate Relocation' | '';

export type RequestType = 'LOI' | 'VISA' | 'WORK_PERMIT';

export type VisaEntryType = 'Multiple' | 'Single' | 'Double';

export type WorkVisitCategory =
  | 'CEO' | 'TLS' | 'TSE' | 'TKA'
  | 'TKA-ME' | 'TKA-PE' | 'TKA-TE' | 'TKA-OE'
  | 'TPD' | 'TSS' | 'TWD' | 'TFA'
  | 'TPM' | 'TBE' | 'TBE-IT' | 'TRA'
  | 'TSM' | 'THR' | 'THR-CM' | 'Company Guest';

export type ApplicationFeesBorneBy = 'PC(T)SB Dept' | 'OPU' | 'Myself';

export type VisaStatus =
  | 'Draft'
  | 'Pending Department Focal'
  | 'Pending Line Manager'
  | 'Pending HOD'
  | 'Processing with Visa Admin'  // Updated from "Pending Visa Clerk" and "Processing with Embassy"
  | 'Processed'                   // Updated from "Approved" to match transport/claims workflow
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

  // Section A: Particulars of Applicant (from LOI Form)
  dateOfBirth?: Date | null;
  placeOfBirth?: string;
  citizenship?: string;
  passportNumber: string;
  passportPlaceOfIssuance?: string;
  passportDateOfIssuance?: Date | null;
  passportExpiryDate: Date | null;
  contactTelephone?: string;
  homeAddress?: string;
  educationDetails?: string;
  currentEmployerName?: string;
  currentEmployerAddress?: string;
  maritalStatus?: string;
  familyInformation?: string;

  // Section B: Type of Request (from LOI Form)
  requestType?: RequestType;
  travelPurpose: VisaPurpose;
  destination?: string;
  approximatelyArrivalDate?: Date | null;
  durationOfStay?: string;
  visaEntryType?: VisaEntryType; // Multiple/Single/Double
  workVisitCategory?: WorkVisitCategory;
  applicationFeesBorneBy?: ApplicationFeesBorneBy;
  costCentreNumber?: string;

  // Trip details
  tripStartDate: Date | null;
  tripEndDate: Date | null;
  visaType?: string;
  itineraryDetails: string;
  additionalComments?: string;
  supportingDocumentsNotes?: string;
  passportCopy?: any;

  // Approval workflow fields (from LOI Form)
  lineFocalPerson?: string;
  lineFocalDept?: string;
  lineFocalContact?: string;
  lineFocalDate?: Date | null;
  sponsoringDeptHead?: string;
  sponsoringDeptHeadDept?: string;
  sponsoringDeptHeadContact?: string;
  sponsoringDeptHeadDate?: Date | null;
  ceoApprovalName?: string;
  ceoApprovalDate?: Date | null;

  // System fields
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
