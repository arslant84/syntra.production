-- Accommodation Admin Database Setup Script
-- This script creates the necessary tables for the accommodation admin functionality

-- Staff Guests Table: Stores information about staff members who can be assigned to rooms
CREATE TABLE IF NOT EXISTS staff_guests (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female')),
    department TEXT,
    staff_id TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trigger for updated_at
CREATE TRIGGER set_timestamp_staff_guests
BEFORE UPDATE ON staff_guests
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Staff Houses Table: Stores information about staff houses and camps
CREATE TABLE IF NOT EXISTS accommodation_staff_houses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT NOT NULL CHECK (location IN ('Ashgabat', 'Kiyanly', 'Turkmenbashy')),
    address TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trigger for updated_at
CREATE TRIGGER set_timestamp_accommodation_staff_houses
BEFORE UPDATE ON accommodation_staff_houses
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Rooms Table: Stores information about rooms in staff houses and camps
CREATE TABLE IF NOT EXISTS accommodation_rooms (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_house_id TEXT NOT NULL REFERENCES accommodation_staff_houses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    room_type TEXT CHECK (room_type IN ('Single', 'Double', 'Suite', 'Tent')),
    capacity INTEGER DEFAULT 1,
    status TEXT DEFAULT 'Available' CHECK (status IN ('Available', 'Maintenance', 'Reserved')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trigger for updated_at
CREATE TRIGGER set_timestamp_accommodation_rooms
BEFORE UPDATE ON accommodation_rooms
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Bookings Table: Stores information about room bookings
CREATE TABLE IF NOT EXISTS accommodation_bookings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_house_id TEXT NOT NULL REFERENCES accommodation_staff_houses(id) ON DELETE CASCADE,
    room_id TEXT NOT NULL REFERENCES accommodation_rooms(id) ON DELETE CASCADE,
    staff_id TEXT REFERENCES staff_guests(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    trf_id TEXT REFERENCES travel_requests(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'Confirmed' CHECK (status IN ('Confirmed', 'Checked-in', 'Checked-out', 'Cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trigger for updated_at
CREATE TRIGGER set_timestamp_accommodation_bookings
BEFORE UPDATE ON accommodation_bookings
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Create unique constraint to prevent double bookings
ALTER TABLE accommodation_bookings 
ADD CONSTRAINT unique_room_date 
UNIQUE (room_id, date);

-- Insert sample data for staff houses
INSERT INTO accommodation_staff_houses (name, location) VALUES
    ('Staff House 41', 'Ashgabat'),
    ('Staff House 42', 'Ashgabat'),
    ('Kiyanly Camp A', 'Kiyanly')
ON CONFLICT DO NOTHING;

-- Insert sample rooms for Staff House 41
INSERT INTO accommodation_rooms (staff_house_id, name, room_type)
SELECT 
    id, 
    'Room #1', 
    'Single'
FROM accommodation_staff_houses 
WHERE name = 'Staff House 41'
ON CONFLICT DO NOTHING;

INSERT INTO accommodation_rooms (staff_house_id, name, room_type)
SELECT 
    id, 
    'Room #2', 
    'Single'
FROM accommodation_staff_houses 
WHERE name = 'Staff House 41'
ON CONFLICT DO NOTHING;

INSERT INTO accommodation_rooms (staff_house_id, name, room_type)
SELECT 
    id, 
    'Room #3', 
    'Single'
FROM accommodation_staff_houses 
WHERE name = 'Staff House 41'
ON CONFLICT DO NOTHING;

INSERT INTO accommodation_rooms (staff_house_id, name, room_type)
SELECT 
    id, 
    'Room #4', 
    'Single'
FROM accommodation_staff_houses 
WHERE name = 'Staff House 41'
ON CONFLICT DO NOTHING;

-- Insert sample rooms for Staff House 42
INSERT INTO accommodation_rooms (staff_house_id, name, room_type)
SELECT 
    id, 
    'Room #1', 
    'Single'
FROM accommodation_staff_houses 
WHERE name = 'Staff House 42'
ON CONFLICT DO NOTHING;

INSERT INTO accommodation_rooms (staff_house_id, name, room_type)
SELECT 
    id, 
    'Room #2', 
    'Single'
FROM accommodation_staff_houses 
WHERE name = 'Staff House 42'
ON CONFLICT DO NOTHING;

INSERT INTO accommodation_rooms (staff_house_id, name, room_type)
SELECT 
    id, 
    'Room #3', 
    'Single'
FROM accommodation_staff_houses 
WHERE name = 'Staff House 42'
ON CONFLICT DO NOTHING;

INSERT INTO accommodation_rooms (staff_house_id, name, room_type)
SELECT 
    id, 
    'Room #4', 
    'Single'
FROM accommodation_staff_houses 
WHERE name = 'Staff House 42'
ON CONFLICT DO NOTHING;

-- Insert sample rooms for Kiyanly Camp A
INSERT INTO accommodation_rooms (staff_house_id, name, room_type)
SELECT 
    id, 
    'Tent 101', 
    'Tent'
FROM accommodation_staff_houses 
WHERE name = 'Kiyanly Camp A'
ON CONFLICT DO NOTHING;

INSERT INTO accommodation_rooms (staff_house_id, name, room_type)
SELECT 
    id, 
    'Tent 102', 
    'Tent'
FROM accommodation_staff_houses 
WHERE name = 'Kiyanly Camp A'
ON CONFLICT DO NOTHING;

-- Insert sample staff guests
INSERT INTO staff_guests (name, gender, department, staff_id) VALUES
    ('E.K - Eziz Kemalov', 'Male', 'IT', 'EK001'),
    ('A.V - Arun', 'Male', 'Finance', 'AV001'),
    ('B.B - Batyr Byashimov', 'Male', 'HR', 'BB001'),
    ('A.H - Arazgeldi Hojayev', 'Male', 'Operations', 'AH001'),
    ('O.P - Oksana Petrovskaya', 'Female', 'Admin', 'OP001'),
    ('O.G - Oksana Gadjiyeva', 'Female', 'Finance', 'OG001'),
    ('O.A - Oksana Askerova', 'Female', 'HR', 'OA001'),
    ('M.H - Meretbibi Hydyrova', 'Female', 'Operations', 'MH001')
ON CONFLICT DO NOTHING;

-- Insert sample bookings for May 2024
-- Staff House 41, Room #1
INSERT INTO accommodation_bookings (staff_house_id, room_id, staff_id, date)
SELECT
    sh.id,
    r.id,
    sg.id,
    '2024-05-01'::DATE
FROM
    accommodation_staff_houses sh,
    accommodation_rooms r,
    staff_guests sg
WHERE
    sh.name = 'Staff House 41'
    AND r.name = 'Room #1'
    AND r.staff_house_id = sh.id
    AND sg.name = 'E.K - Eziz Kemalov'
ON CONFLICT DO NOTHING;

INSERT INTO accommodation_bookings (staff_house_id, room_id, staff_id, date)
SELECT
    sh.id,
    r.id,
    sg.id,
    '2024-05-02'::DATE
FROM
    accommodation_staff_houses sh,
    accommodation_rooms r,
    staff_guests sg
WHERE
    sh.name = 'Staff House 41'
    AND r.name = 'Room #1'
    AND r.staff_house_id = sh.id
    AND sg.name = 'A.H - Arazgeldi Hojayev'
ON CONFLICT DO NOTHING;

INSERT INTO accommodation_bookings (staff_house_id, room_id, staff_id, date)
SELECT
    sh.id,
    r.id,
    sg.id,
    '2024-05-03'::DATE
FROM
    accommodation_staff_houses sh,
    accommodation_rooms r,
    staff_guests sg
WHERE
    sh.name = 'Staff House 41'
    AND r.name = 'Room #1'
    AND r.staff_house_id = sh.id
    AND sg.name = 'O.A - Oksana Askerova'
ON CONFLICT DO NOTHING;

-- Staff House 42, Room #1
INSERT INTO accommodation_bookings (staff_house_id, room_id, staff_id, date)
SELECT
    sh.id,
    r.id,
    sg.id,
    '2024-05-07'::DATE
FROM
    accommodation_staff_houses sh,
    accommodation_rooms r,
    staff_guests sg
WHERE
    sh.name = 'Staff House 42'
    AND r.name = 'Room #1'
    AND r.staff_house_id = sh.id
    AND sg.name = 'M.H - Meretbibi Hydyrova'
ON CONFLICT DO NOTHING;

INSERT INTO accommodation_bookings (staff_house_id, room_id, staff_id, date)
SELECT
    sh.id,
    r.id,
    sg.id,
    '2024-05-08'::DATE
FROM
    accommodation_staff_houses sh,
    accommodation_rooms r,
    staff_guests sg
WHERE
    sh.name = 'Staff House 42'
    AND r.name = 'Room #1'
    AND r.staff_house_id = sh.id
    AND sg.name = 'O.A - Oksana Askerova'
ON CONFLICT DO NOTHING;

INSERT INTO accommodation_bookings (staff_house_id, room_id, staff_id, date)
SELECT
    sh.id,
    r.id,
    sg.id,
    '2024-05-09'::DATE
FROM
    accommodation_staff_houses sh,
    accommodation_rooms r,
    staff_guests sg
WHERE
    sh.name = 'Staff House 42'
    AND r.name = 'Room #1'
    AND r.staff_house_id = sh.id
    AND sg.name = 'O.P - Oksana Petrovskaya'
ON CONFLICT DO NOTHING;
