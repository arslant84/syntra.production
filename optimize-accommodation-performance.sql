-- Performance optimization indices for accommodation admin tables
-- Run this script to improve query performance

-- Indices for travel_requests table (accommodation queries)
DO $$ 
BEGIN
    -- Index for status filtering
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'travel_requests' AND indexname = 'idx_travel_requests_status') THEN
        CREATE INDEX idx_travel_requests_status ON travel_requests(status);
    END IF;
    
    -- Index for submitted_at ordering
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'travel_requests' AND indexname = 'idx_travel_requests_submitted_at') THEN
        CREATE INDEX idx_travel_requests_submitted_at ON travel_requests(submitted_at DESC);
    END IF;
    
    -- Composite index for common filters
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'travel_requests' AND indexname = 'idx_travel_requests_status_submitted') THEN
        CREATE INDEX idx_travel_requests_status_submitted ON travel_requests(status, submitted_at DESC);
    END IF;
    
    -- Index for text search
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'travel_requests' AND indexname = 'idx_travel_requests_search') THEN
        CREATE INDEX idx_travel_requests_search ON travel_requests USING gin(to_tsvector('english', requestor_name || ' ' || purpose));
    END IF;
END $$;

-- Indices for trf_accommodation_details table
DO $$ 
BEGIN
    -- Index for trf_id foreign key (for joins)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'trf_accommodation_details' AND indexname = 'idx_trf_accommodation_trf_id') THEN
        CREATE INDEX idx_trf_accommodation_trf_id ON trf_accommodation_details(trf_id);
    END IF;
    
    -- Index for check-in/check-out date filtering
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'trf_accommodation_details' AND indexname = 'idx_trf_accommodation_dates') THEN
        CREATE INDEX idx_trf_accommodation_dates ON trf_accommodation_details(check_in_date, check_out_date);
    END IF;
    
    -- Index for location filtering
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'trf_accommodation_details' AND indexname = 'idx_trf_accommodation_location') THEN
        CREATE INDEX idx_trf_accommodation_location ON trf_accommodation_details(location);
    END IF;
END $$;

-- Indices for accommodation_bookings table
DO $$ 
BEGIN
    -- Index for trf_id foreign key
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'accommodation_bookings' AND indexname = 'idx_accommodation_bookings_trf_id') THEN
        CREATE INDEX idx_accommodation_bookings_trf_id ON accommodation_bookings(trf_id);
    END IF;
    
    -- Index for room_id foreign key
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'accommodation_bookings' AND indexname = 'idx_accommodation_bookings_room_id') THEN
        CREATE INDEX idx_accommodation_bookings_room_id ON accommodation_bookings(room_id);
    END IF;
    
    -- Index for staff_house_id foreign key
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'accommodation_bookings' AND indexname = 'idx_accommodation_bookings_staff_house_id') THEN
        CREATE INDEX idx_accommodation_bookings_staff_house_id ON accommodation_bookings(staff_house_id);
    END IF;
    
    -- Index for status filtering
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'accommodation_bookings' AND indexname = 'idx_accommodation_bookings_status') THEN
        CREATE INDEX idx_accommodation_bookings_status ON accommodation_bookings(status);
    END IF;
    
    -- Composite index for active bookings
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'accommodation_bookings' AND indexname = 'idx_accommodation_bookings_active') THEN
        CREATE INDEX idx_accommodation_bookings_active ON accommodation_bookings(trf_id, status) WHERE status != 'Cancelled';
    END IF;
END $$;

-- Indices for accommodation_rooms table
DO $$ 
BEGIN
    -- Index for staff_house_id foreign key
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'accommodation_rooms' AND indexname = 'idx_accommodation_rooms_staff_house_id') THEN
        CREATE INDEX idx_accommodation_rooms_staff_house_id ON accommodation_rooms(staff_house_id);
    END IF;
    
    -- Index for status filtering
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'accommodation_rooms' AND indexname = 'idx_accommodation_rooms_status') THEN
        CREATE INDEX idx_accommodation_rooms_status ON accommodation_rooms(status);
    END IF;
    
    -- Composite index for room queries
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'accommodation_rooms' AND indexname = 'idx_accommodation_rooms_house_name') THEN
        CREATE INDEX idx_accommodation_rooms_house_name ON accommodation_rooms(staff_house_id, name);
    END IF;
END $$;

-- Indices for accommodation_staff_houses table
DO $$ 
BEGIN
    -- Index for location filtering
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'accommodation_staff_houses' AND indexname = 'idx_accommodation_staff_houses_location') THEN
        CREATE INDEX idx_accommodation_staff_houses_location ON accommodation_staff_houses(location);
    END IF;
    
    -- Index for name searches
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'accommodation_staff_houses' AND indexname = 'idx_accommodation_staff_houses_name') THEN
        CREATE INDEX idx_accommodation_staff_houses_name ON accommodation_staff_houses(name);
    END IF;
    
    -- Composite index for location and name ordering
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'accommodation_staff_houses' AND indexname = 'idx_accommodation_staff_houses_location_name') THEN
        CREATE INDEX idx_accommodation_staff_houses_location_name ON accommodation_staff_houses(location, name);
    END IF;
END $$;

-- Update table statistics for better query planning
ANALYZE travel_requests;
ANALYZE trf_accommodation_details;
ANALYZE accommodation_bookings;
ANALYZE accommodation_rooms;
ANALYZE accommodation_staff_houses;

-- Log completion
DO $$ 
BEGIN 
    RAISE NOTICE 'Accommodation performance optimization indices created successfully!';
    RAISE NOTICE 'Tables analyzed and statistics updated.';
END $$;