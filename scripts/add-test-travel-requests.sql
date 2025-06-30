-- Add test travel requests to the database

-- First check if the travel_requests table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'travel_requests') THEN
    -- Create the travel_requests table if it doesn't exist
    CREATE TABLE travel_requests (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      requestor_name TEXT NOT NULL,
      staff_id TEXT,
      department TEXT,
      position TEXT,
      cost_center TEXT,
      tel_email TEXT,
      email TEXT,
      travel_type TEXT NOT NULL, -- 'Domestic', 'Overseas', 'Home Leave Passage', 'External Parties'
      status TEXT NOT NULL DEFAULT 'Pending',
      purpose TEXT,
      estimated_cost NUMERIC(12, 2) DEFAULT 0,
      additional_comments TEXT,
      -- For external party info
      external_full_name TEXT,
      external_organization TEXT,
      external_ref_to_authority_letter TEXT,
      external_cost_center TEXT,
      -- Timestamps
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END
$$;

-- Add some test travel requests
INSERT INTO travel_requests (
  requestor_name,
  staff_id,
  department,
  position,
  travel_type,
  status,
  purpose,
  additional_comments,
  submitted_at
)
VALUES 
  (
    'John Smith',
    'EMP001',
    'Engineering',
    'Ashgabat',
    'Domestic',
    'Approved',
    'Site inspection',
    'Need accommodation for 5 nights',
    NOW() - INTERVAL '2 days'
  ),
  (
    'Sarah Johnson',
    'EMP002',
    'Operations',
    'Kiyanly',
    'Domestic',
    'Pending',
    'Training workshop',
    'Prefer single room if available',
    NOW() - INTERVAL '1 day'
  ),
  (
    'Michael Brown',
    'EMP003',
    'Management',
    'Turkmenbashy',
    'Domestic',
    'Approved',
    'Project review',
    'Need accommodation with internet access',
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Verify the data was inserted
SELECT COUNT(*) FROM travel_requests;
