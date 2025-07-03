
export interface RequestorInformation {
  requestorName: string;
  staffId: string;
  department: string; // Combined Department & Position from the form
  position: string;
  costCenter: string;
  telEmail: string; // Combined Tel. Ext. & E-Mail
  email?: string; 
}

export interface ExternalPartyRequestorInformation {
  externalFullName: string;
  externalOrganization: string;
  externalRefToAuthorityLetter: string;
  externalCostCenter: string;
}

export interface ItinerarySegment {
  id?: string; 
  date: Date | null;
  day: string; 
  from: string;
  to: string;
  etd: string; 
  eta: string; 
  flightNumber: string; 
  flightClass: string;
  remarks: string;
}

export interface MealProvisionDetails {
  dateFromTo: string;
  breakfast: number | string; 
  lunch: number | string;
  dinner: number | string;
  supper: number | string;
  refreshment: number | string;
}

export type AccommodationType = 'Hotel/Отели' | 'Staff House/PKC Kampung/Kiyanly camp' | 'Other';

export interface AccommodationDetail {
  id?: string; 
  accommodationType: AccommodationType | ''; 
  checkInDate: Date | null;
  checkInTime: string; 
  checkOutDate: Date | null;
  checkOutTime: string; 
  remarks: string;
  otherTypeDescription?: string;
  // Additional fields from DB schema
  location?: string;
  fromDate?: Date | null;
  toDate?: Date | null;
  fromLocation?: string;
  toLocation?: string;
  btNoRequired?: string;
  accommodationTypeN?: string;
  address?: string;
  placeOfStay?: string;
  estimatedCostPerNight?: number | string;
}

export interface ExternalPartyAccommodationDetail {
  id?: string; 
  checkInDate: Date | null;
  checkOutDate: Date | null;
  placeOfStay: string;
  estimatedCostPerNight: string | number;
  remarks: string;
}

export interface CompanyTransportDetail {
  id?: string; 
  date: Date | null;
  day: string;
  from: string;
  to: string;
  btNoRequired: string; 
  accommodationTypeN: string; 
  address: string; 
  remarks: string;
}

export interface DomesticTravelSpecificDetails {
  purpose: string;
  itinerary: ItinerarySegment[];
  mealProvision: MealProvisionDetails;
  accommodationDetails: AccommodationDetail[];
  companyTransportDetails: CompanyTransportDetail[];
}

export interface AdvanceBankDetails {
  bankName: string;
  accountNumber: string;
}

export interface AdvanceAmountRequestedItem {
  id?: string; 
  dateFrom: Date | null;
  dateTo: Date | null;
  lh: number | string; 
  ma: number | string; 
  oa: number | string; 
  tr: number | string; 
  oe: number | string; 
  usd: number | string; 
  remarks: string;
}

export interface OverseasTravelSpecificDetails {
  purpose: string;
  itinerary: ItinerarySegment[];
  advanceBankDetails: AdvanceBankDetails;
  advanceAmountRequested: AdvanceAmountRequestedItem[];
}

export interface ExternalPartiesTravelSpecificDetails {
  purpose: string;
  itinerary: ItinerarySegment[];
  accommodationDetails: ExternalPartyAccommodationDetail[];
  mealProvision: MealProvisionDetails; 
}


export type TravelType = 'Domestic' | 'Overseas' | 'Home Leave Passage' | 'External Parties' | '';

export type TrfStatus = 
  | 'Draft' 
  | 'Pending Department Focal' 
  | 'Pending Line Manager' 
  | 'Pending HOD' 
  | 'Approved' 
  | 'Rejected' 
  | 'Cancelled'
  | 'Processing Flights'
  | 'Processing Accommodation'
  | 'Awaiting Visa'
  | 'TRF Processed';


export interface TravelRequestData {
  requestorName?: string;
  staffId?: string;
  department?: string;
  position?: string;
  costCenter?: string;
  telEmail?: string;
  email?: string;
  externalPartyRequestorInfo?: ExternalPartyRequestorInformation;
  
  travelType: TravelType;
  domesticTravelDetails?: DomesticTravelSpecificDetails;
  overseasTravelDetails?: OverseasTravelSpecificDetails; 
  externalPartiesTravelDetails?: ExternalPartiesTravelSpecificDetails;
}

export interface ApprovalSubmissionData {
  additionalComments: string;
  confirmPolicy: boolean; 
  confirmManagerApproval: boolean; 
  confirmTermsAndConditions?: boolean; 
}

export interface TravelRequestForm extends TravelRequestData, ApprovalSubmissionData {
  id: string; 
  status: TrfStatus;
  approvalWorkflow: ApprovalStep[];
  submittedAt?: Date | string; // Add submittedAt from database
  updatedAt?: Date | string;   // Add updatedAt from database
}

export interface ApprovalStep {
  role: string; // e.g., 'Requestor', 'Line Manager', 'Department Focal', 'HOD'
  name: string;
  status: 'Current' | 'Pending' | 'Approved' | 'Rejected' | 'Not Started' | 'Cancelled';
  date?: Date | string;
  comments?: string;
}
