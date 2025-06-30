// This file contains helper functions to fix the itinerary segment mapping issues
// between the frontend and database

/**
 * Maps database column names to frontend field names for itinerary segments
 * @param dbSegment - The itinerary segment from the database
 * @returns The itinerary segment with frontend field names
 */
export function mapDbItineraryToFrontend(dbSegment: any) {
  return {
    id: dbSegment.id || "",
    date: dbSegment.segment_date || null,
    day: dbSegment.day_of_week || "",
    from: dbSegment.from_location || "",
    to: dbSegment.to_location || "",
    etd: dbSegment.departure_time || "",
    eta: dbSegment.arrival_time || "",
    flightNumber: dbSegment.flight_number || "",
    flightClass: dbSegment.flight_class || "",
    remarks: dbSegment.remarks || "",
    // Add any other fields needed by the frontend
  };
}

/**
 * Maps frontend field names to database column names for itinerary segments
 * @param frontendSegment - The itinerary segment from the frontend
 * @param trfId - The TRF ID to associate with this segment
 * @returns The itinerary segment with database column names
 */
export function mapFrontendItineraryToDb(frontendSegment: any, trfId: string) {
  return {
    trf_id: trfId,
    segment_date: frontendSegment.date,
    day_of_week: frontendSegment.day || "",
    from_location: frontendSegment.from || "",
    to_location: frontendSegment.to || "",
    departure_time: frontendSegment.etd || "",
    arrival_time: frontendSegment.eta || "",
    flight_number: frontendSegment.flightNumber || "",
    flight_class: frontendSegment.flightNumber || "",
    remarks: frontendSegment.remarks || "",
    purpose: null, // Set to null as it's not collected per segment from frontend
    // Add meal provision fields with default values
    breakfast: 0,
    lunch: 0,
    dinner: 0,
    supper: 0,
    refreshment: 0,
  };
}
