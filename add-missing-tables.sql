-- Add missing trf_advance_amount_requested_items table
CREATE TABLE IF NOT EXISTS trf_advance_amount_requested_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    trf_id TEXT NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
    date_from DATE,
    date_to DATE,
    lh NUMERIC(12, 2) DEFAULT 0, -- Lodging/Hotel
    ma NUMERIC(12, 2) DEFAULT 0, -- Meal Allowance
    oa NUMERIC(12, 2) DEFAULT 0, -- Other Allowances
    tr NUMERIC(12, 2) DEFAULT 0, -- Transportation
    oe NUMERIC(12, 2) DEFAULT 0, -- Other Expenses
    usd NUMERIC(12, 2) DEFAULT 0, -- USD amount
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add flight_number and flight_class columns to trf_itinerary_segments if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'trf_itinerary_segments' AND column_name = 'flight_number') THEN
        ALTER TABLE trf_itinerary_segments ADD COLUMN flight_number TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'trf_itinerary_segments' AND column_name = 'flight_class') THEN
        ALTER TABLE trf_itinerary_segments ADD COLUMN flight_class TEXT;
    END IF;
END$$;

-- Add additional_data column to travel_requests if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'travel_requests' AND column_name = 'additional_data') THEN
        ALTER TABLE travel_requests ADD COLUMN additional_data JSONB;
    END IF;
END$$;
