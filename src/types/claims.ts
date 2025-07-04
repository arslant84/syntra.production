
export type DocumentType = "TR01" | "TB35" | "TB05" | "";
export type StaffType = "PERMANENT STAFF" | "CONTRACT STAFF" | "";
export type ExecutiveStatus = "EXECUTIVE" | "NON-EXECUTIVE" | "";
export type MedicalClaimApplicable = "Inpatient" | "Outpatient" | "" | undefined;

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
  status?: string; // e.g., 'Pending Verification', 'Approved', 'Rejected'
  submittedAt?: string; // ISO date string
  // Fields for "Verified By", "Approved By" are typically handled post-submission
}
