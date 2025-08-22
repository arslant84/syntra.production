
export type DocumentType = "TR01" | "TB35" | "TB05" | "";
export type StaffType = "PERMANENT STAFF" | "CONTRACT STAFF" | "";
export type ExecutiveStatus = "EXECUTIVE" | "NON-EXECUTIVE" | "";
export type MedicalClaimApplicable = "Inpatient" | "Outpatient" | "" | undefined;

export type ClaimStatus = 
  | 'Pending Verification'
  | 'Pending Department Focal' 
  | 'Pending Line Manager' 
  | 'Pending HOD' 
  | 'Approved'
  | 'Processing with Claims Admin'
  | 'Processed'
  | 'Rejected' 
  | 'Cancelled';

export interface ClaimHeaderDetails {
  documentType: DocumentType;
  documentNumber: string;
  claimForMonthOf: Date | null;
  staffName: string;
  staffNo: string;
  gred: string; // Grade
  staffType: StaffType;
  executiveStatus: ExecutiveStatus;
  departmentCode: string;
  deptCostCenterCode: string;
  location: string;
  telExt: string;
  startTimeFromHome: string; // HH:MM
  timeOfArrivalAtHome: string; // HH:MM
}

export interface ClaimantBankDetails {
  bankName: string;
  accountNumber: string;
  purposeOfClaim: string;
}

export interface MedicalClaimDetails {
  isMedicalClaim: boolean;
  applicableMedicalType?: MedicalClaimApplicable;
  isForFamily: boolean;
  familyMemberSpouse: boolean;
  familyMemberChildren: boolean;
  familyMemberOther?: string; // Description for other
}

export interface ExpenseItem {
  id?: string;
  date: Date | null;
  claimOrTravelDetails: string; // From - To / Place of Stay
  officialMileageKM: string | number | null; // B
  transport: string | number | null; // C
  hotelAccommodationAllowance: string | number | null; // D
  outStationAllowanceMeal: string | number | null; // E
  miscellaneousAllowance10Percent: string | number | null; // F
  otherExpenses: string | number | null; // G
}

export interface ForeignExchangeRate {
  id?: string;
  date: Date | null;
  typeOfCurrency: string;
  sellingRateTTOD: string | number | null;
}

export interface ClaimFinancialSummary {
  totalAdvanceClaimAmount: string | number | null;
  lessAdvanceTaken: string | number | null;
  lessCorporateCreditCardPayment: string | number | null;
  balanceClaimRepayment: string | number | null; // Calculated
  chequeReceiptNo?: string;
}

export interface ClaimDeclaration {
  iDeclare: boolean;
  date: Date | null;
}

export interface ReimbursementDetails {
  paymentMethod?: string; // Bank Transfer, Cheque, etc.
  bankTransferReference?: string;
  chequeNumber?: string;
  paymentDate?: string;
  amountPaid?: number;
  taxDeducted?: number;
  netAmount?: number;
  processingNotes?: string;
  verifiedBy?: string;
  authorizedBy?: string;
}

export interface ExpenseClaim {
  id?: string; // For later use, e.g., when saving/fetching
  headerDetails: ClaimHeaderDetails;
  bankDetails: ClaimantBankDetails;
  medicalClaimDetails: MedicalClaimDetails;
  expenseItems: ExpenseItem[];
  // Totals for columns B-G will be calculated client-side for display
  // but not stored as separate fields in the main data model unless necessary
  informationOnForeignExchangeRate: ForeignExchangeRate[]; // For overseas claim
  financialSummary: ClaimFinancialSummary;
  declaration: ClaimDeclaration;
  // Status information
  status?: ClaimStatus;
  submittedAt?: string; // ISO date string
  // Claims Admin processing fields
  reimbursementDetails?: ReimbursementDetails;
  processingStartedAt?: string;
  reimbursementCompletedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  // Fields for "Verified By", "Approved By" are typically handled post-submission
}
