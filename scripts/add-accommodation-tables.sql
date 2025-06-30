-- Add accommodation tables to the SynTra database
-- This script creates the necessary tables for the accommodation management system

-- Staff Houses Table
CREATE TABLE IF NOT EXISTS accommodation_staff_houses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT,
    capacity INTEGER NOT NULL DEFAULT 0,
    amenities TEXT[],
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add timestamp trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_accommodation_staff_houses') THEN
    CREATE TRIGGER set_timestamp_accommodation_staff_houses
    BEFORE UPDATE ON accommodation_staff_houses
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END
$$;

-- Rooms Table
CREATE TABLE IF NOT EXISTS accommodation_rooms (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_house_id TEXT NOT NULL REFERENCES accommodation_staff_houses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    room_type TEXT NOT NULL, -- 'Single', 'Double', 'Suite'
    capacity INTEGER DEFAULT 1,
    floor TEXT,
    status TEXT NOT NULL DEFAULT 'Available', -- 'Available', 'Occupied', 'Under Maintenance'
    amenities TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add timestamp trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_accommodation_rooms') THEN
    CREATE TRIGGER set_timestamp_accommodation_rooms
    BEFORE UPDATE ON accommodation_rooms
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END
$$;

-- Bookings Table
CREATE TABLE IF NOT EXISTS accommodation_bookings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_house_id TEXT NOT NULL REFERENCES accommodation_staff_houses(id) ON DELETE CASCADE,
    room_id TEXT NOT NULL REFERENCES accommodation_rooms(id) ON DELETE CASCADE,
    guest_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Reserved', -- 'Available', 'Reserved', 'Occupied', 'Blocked'
    trf_id TEXT REFERENCES travel_requests(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add timestamp trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_accommodation_bookings') THEN
    CREATE TRIGGER set_timestamp_accommodation_bookings
    BEFORE UPDATE ON accommodation_bookings
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END
$$;

-- Add some sample data for testing
-- Sample Staff Houses
INSERT INTO accommodation_staff_houses (name, location, description, capacity, status, amenities)
VALUES 
    ('Main Staff House', 'Headquarters', 'Main staff accommodation facility', 20, 'Active', ARRAY['Wi-Fi', 'Parking', 'Security']),
    ('East Wing Camp', 'Eastern Field', 'Field workers accommodation', 50, 'Active', ARRAY['Canteen', 'Recreation Room']),
    ('Executive Suites', 'Headquarters', 'For senior management', 10, 'Active', ARRAY['Wi-Fi', 'Gym', 'Lounge', 'Parking'])
ON CONFLICT DO NOTHING;

-- Sample Rooms
INSERT INTO accommodation_rooms (staff_house_id, name, room_type, capacity, floor, status, amenities)
SELECT 
    sh.id,
    'Room 101',
    'Single',
    1,
    '1st Floor',
    'Available',
    'Air conditioning, Wi-Fi, Private bathroom'
FROM accommodation_staff_houses sh
WHERE sh.name = 'Main Staff House'
ON CONFLICT DO NOTHING;

INSERT INTO accommodation_rooms (staff_house_id, name, room_type, capacity, floor, status, amenities)
SELECT 
    sh.id,
    'Room 102',
    'Double',
    2,
    '1st Floor',
    'Available',
    'Air conditioning, Wi-Fi, Private bathroom, TV'
FROM accommodation_staff_houses sh
WHERE sh.name = 'Main Staff House'
ON CONFLICT DO NOTHING;

INSERT INTO accommodation_rooms (staff_house_id, name, room_type, capacity, floor, status, amenities)
SELECT 
    sh.id,
    'Suite A',
    'Suite',
    2,
    '2nd Floor',
    'Available',
    'Air conditioning, Wi-Fi, Private bathroom, Kitchen, Living room'
FROM accommodation_staff_houses sh
WHERE sh.name = 'Executive Suites'
ON CONFLICT DO NOTHING;

INSERT INTO accommodation_rooms (staff_house_id, name, room_type, capacity, floor, status, amenities)
SELECT 
    sh.id,
    'Cabin 1',
    'Double',
    4,
    'Ground Floor',
    'Available',
    'Bunk beds, Shared bathroom'
FROM accommodation_staff_houses sh
WHERE sh.name = 'East Wing Camp'
ON CONFLICT DO NOTHING;
