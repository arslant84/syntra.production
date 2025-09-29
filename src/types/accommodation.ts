
export type LocationType = 'Ashgabat' | 'Kiyanly' | 'Turkmenbashy';
export type GuestGender = 'Male' | 'Female';

// Accommodation request workflow statuses
export type AccommodationRequestStatus = 
  | 'Draft' 
  | 'Pending Department Focal' 
  | 'Pending Line Manager' 
  | 'Pending HOD' 
  | 'Approved' 
  | 'Processing'
  | 'Completed'
  | 'Rejected' 
  | 'Cancelled'
  | 'Pending Assignment'
  | 'Accommodation Assigned'
  | 'Checked-in'
  | 'Checked-out'
  | 'Confirmed'
  | 'Blocked';

// Database booking statuses from accommodation_bookings table
export type BookingStatus = 
  | 'Confirmed'
  | 'Checked-in'
  | 'Checked-out' 
  | 'Cancelled'
  | 'Blocked';

// Room types from accommodation_rooms table
export type RoomType = 'Single' | 'Double' | 'Suite' | 'Tent';

// Room availability status from accommodation_rooms table
export type RoomStatus = 'Available' | 'Maintenance' | 'Reserved';

export interface StaffGuest {
  id: string;
  initials: string;
  name: string;
  gender: GuestGender;
}

export interface RoomData {
  id: string;
  name: string; // e.g., "Room #1"
  staff_house_id: string;
  room_type?: RoomType; // Single, Double, Suite, Tent
  capacity?: number; // Default 1
  status?: RoomStatus; // Available, Maintenance, Reserved
}

export interface StaffHouseData {
  id: string;
  name: string; // e.g., "Staff house 41"
  location: LocationType;
  rooms: RoomData[];
}

export interface BookingData {
  id: string; // Unique booking ID
  guestName: string; // Name of the guest
  staffHouseId: string;
  staffHouseName?: string;
  roomId: string;
  roomName?: string;
  bookingDate: string | Date; // YYYY-MM-DD
  gender: 'Male' | 'Female';
  status: 'Active' | 'Blocked';
  reason?: string;
  trfId?: string;
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
  status: AccommodationRequestStatus;
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

