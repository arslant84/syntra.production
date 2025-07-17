-- Script to create the trf_flight_bookings table
-- This table stores detailed flight booking information for TRFs

-- Check if the table exists and create it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'trf_flight_bookings'
    ) THEN
        CREATE TABLE trf_flight_bookings (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
            trf_id TEXT NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
            pnr TEXT, -- Passenger Name Record
            airline TEXT, -- Airline name
            flight_number TEXT, -- Flight number
            departure_airport TEXT, -- Departure airport code
            arrival_airport TEXT, -- Arrival airport code
            departure_date_time TIMESTAMPTZ, -- Departure date and time
            arrival_date_time TIMESTAMPTZ, -- Arrival date and time
            cost NUMERIC(12, 2), -- Flight cost
            flight_notes TEXT, -- Additional notes about the flight
            booking_status TEXT DEFAULT 'Confirmed', -- Status: Confirmed, Pending, Cancelled, etc.
            booked_by TEXT, -- Admin who made the booking
            booked_at TIMESTAMPTZ DEFAULT NOW(),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        RAISE NOTICE 'Created trf_flight_bookings table successfully';
    ELSE
        RAISE NOTICE 'trf_flight_bookings table already exists';
    END IF;
END
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trf_flight_bookings_trf_id ON trf_flight_bookings(trf_id);
CREATE INDEX IF NOT EXISTS idx_trf_flight_bookings_airline ON trf_flight_bookings(airline);
CREATE INDEX IF NOT EXISTS idx_trf_flight_bookings_departure_date ON trf_flight_bookings(departure_date_time);
CREATE INDEX IF NOT EXISTS idx_trf_flight_bookings_booking_status ON trf_flight_bookings(booking_status);

-- Create trigger to auto-update updated_at timestamp
DROP TRIGGER IF EXISTS update_trf_flight_bookings_updated_at ON trf_flight_bookings;
CREATE TRIGGER update_trf_flight_bookings_updated_at
    BEFORE UPDATE ON trf_flight_bookings
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Add comments to the table and columns for documentation
COMMENT ON TABLE trf_flight_bookings IS 'Stores detailed flight booking information for travel requests';
COMMENT ON COLUMN trf_flight_bookings.id IS 'Unique identifier for the flight booking';
COMMENT ON COLUMN trf_flight_bookings.trf_id IS 'Reference to the travel request';
COMMENT ON COLUMN trf_flight_bookings.pnr IS 'Passenger Name Record from the airline';
COMMENT ON COLUMN trf_flight_bookings.airline IS 'Name of the airline';
COMMENT ON COLUMN trf_flight_bookings.flight_number IS 'Flight number';
COMMENT ON COLUMN trf_flight_bookings.departure_airport IS 'Departure airport code (e.g., ASB)';
COMMENT ON COLUMN trf_flight_bookings.arrival_airport IS 'Arrival airport code (e.g., IST)';
COMMENT ON COLUMN trf_flight_bookings.departure_date_time IS 'Scheduled departure date and time';
COMMENT ON COLUMN trf_flight_bookings.arrival_date_time IS 'Scheduled arrival date and time';
COMMENT ON COLUMN trf_flight_bookings.cost IS 'Cost of the flight booking';
COMMENT ON COLUMN trf_flight_bookings.flight_notes IS 'Additional notes about the flight booking';
COMMENT ON COLUMN trf_flight_bookings.booking_status IS 'Status of the booking (Confirmed, Pending, Cancelled, etc.)';
COMMENT ON COLUMN trf_flight_bookings.booked_by IS 'Admin who made the booking';
COMMENT ON COLUMN trf_flight_bookings.booked_at IS 'When the booking was made';
COMMENT ON COLUMN trf_flight_bookings.created_at IS 'When the record was created';
COMMENT ON COLUMN trf_flight_bookings.updated_at IS 'When the record was last updated'; 