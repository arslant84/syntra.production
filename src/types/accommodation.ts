
export type LocationType = 'Ashgabat' | 'Kiyanly' | 'Turkmenbashy';
export type GuestGender = 'Male' | 'Female';
export type BookingStatus = "Available" | "Reserved" | "Occupied" | "Blocked";

export interface StaffGuest {
  id: string;
  initials: string;
  name: string;
  gender: GuestGender;
}

export interface RoomData {
  id: string;
  name: string; // e.g., "Room #1"
  genderRestriction?: GuestGender; // Optional: for gender-specific rooms
}

export interface StaffHouseData {
  id: string;
  name: string; // e.g., "Staff house 41"
  location: LocationType;
  rooms: RoomData[];
}

export interface BookingData {
  id: string; // Unique booking ID
  roomId: string;
  staffHouseId: string;
  date: string; // YYYY-MM-DD
  staffId: string; // ID of the StaffGuest
}

// Represents the structure for the calendar display
export interface CalendarCellData extends BookingData {
  guest?: StaffGuest;
}

export interface AccommodationRequestDetails {
  id: string;
  trfId: string;
  requestorName: string;
  requestorId: string;
  requestorGender: GuestGender;
  department: string;
  location: LocationType;
  requestedCheckInDate: Date;
  requestedCheckOutDate: Date;
  requestedRoomType?: string; // e.g., "Single Room", "Shared - Male"
  status: BookingStatus;
  assignedRoomId?: string;
  assignedRoomName?: string;
  assignedStaffHouseId?: string;
  assignedStaffHouseName?: string;
  specialRequests?: string;
  notes?: string; // For admin or system notes
  submittedDate: Date;
  lastUpdatedDate: Date;
  flightArrivalTime?: string; // HH:MM
  flightDepartureTime?: string; // HH:MM
}

