-- Sample Activity Data Insert Script
-- This script inserts test data into activity-related tables to debug empty recent activities section
-- Generated based on the API code in src/app/api/dashboard/activities/route.ts

-- Use this script to populate test data for debugging the recent activities functionality
-- Make sure to replace 'test@example.com' and 'staff123' with actual test user credentials

-- =============================================================================
-- TRAVEL REQUESTS TABLE
-- =============================================================================

INSERT INTO travel_requests (
  id, 
  purpose, 
  status, 
  created_at, 
  updated_at, 
  staff_id, 
  requestor_name,
  travel_type
) VALUES 
  (
    gen_random_uuid(),
    'Business conference in Dubai - Annual Technology Summit',
    'Pending Approval',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '1 day',
    'staff123',
    'test@example.com',
    'International'
  ),
  (
    gen_random_uuid(),
    'Client meeting in Lagos for project kickoff',
    'Draft',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '4 days',
    'staff123',
    'test@example.com',
    'Domestic'
  ),
  (
    gen_random_uuid(),
    'Training workshop in Abuja - Leadership Development',
    'Approved',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '3 days',
    'staff123',
    'test@example.com',
    'Domestic'
  ),
  (
    gen_random_uuid(),
    'Vendor assessment visit to Port Harcourt',
    'Rejected',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '7 days',
    'staff123',
    'test@example.com',
    'Domestic'
  ),
  (
    gen_random_uuid(),
    'International conference in London - FinTech Summit',
    'Pending Approval',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '2 days',
    'staff123',
    'test@example.com',
    'International'
  );

-- =============================================================================
-- EXPENSE CLAIMS TABLE
-- =============================================================================

INSERT INTO expense_claims (
  id,
  purpose_of_claim,
  status,
  created_at,
  updated_at,
  staff_no,
  staff_name
) VALUES 
  (
    gen_random_uuid(),
    'Hotel and meal expenses for Dubai conference',
    'Pending Approval',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day',
    'staff123',
    'test@example.com'
  ),
  (
    gen_random_uuid(),
    'Transportation and accommodation for Lagos client meeting',
    'Draft',
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '5 days',
    'staff123',
    'test@example.com'
  ),
  (
    gen_random_uuid(),
    'Training materials and accommodation expenses',
    'Approved',
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '4 days',
    'staff123',
    'test@example.com'
  ),
  (
    gen_random_uuid(),
    'Office supplies and equipment purchase',
    'Completed',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '18 days',
    'staff123',
    'test@example.com'
  );

-- =============================================================================
-- VISA APPLICATIONS TABLE
-- =============================================================================

INSERT INTO visa_applications (
  id,
  travel_purpose,
  status,
  created_at,
  updated_at,
  user_id,
  staff_id,
  email
) VALUES 
  (
    gen_random_uuid(),
    'Business visa for Dubai Technology Summit',
    'Pending Approval',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '2 days',
    'staff123',
    'staff123',
    'test@example.com'
  ),
  (
    gen_random_uuid(),
    'UK business visa for London FinTech Summit',
    'Draft',
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '3 days',
    'staff123',
    'staff123',
    'test@example.com'
  ),
  (
    gen_random_uuid(),
    'Schengen visa for European client visits',
    'Approved',
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '10 days',
    'staff123',
    'staff123',
    'test@example.com'
  ),
  (
    gen_random_uuid(),
    'US business visa for New York conference',
    'Blocked',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '20 days',
    'staff123',
    'staff123',
    'test@example.com'
  );

-- =============================================================================
-- ACCOMMODATION TRAVEL REQUESTS (for accommodation bookings)
-- =============================================================================

-- Insert accommodation-specific travel requests
INSERT INTO travel_requests (
  id, 
  purpose, 
  status, 
  created_at, 
  updated_at, 
  staff_id, 
  requestor_name,
  travel_type
) VALUES 
  (
    'acc-' || gen_random_uuid()::text,
    'Hotel booking for Dubai conference',
    'Confirmed',
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '1 day',
    'staff123',
    'test@example.com',
    'Accommodation'
  ),
  (
    'acc-' || gen_random_uuid()::text,
    'Guest house reservation for Abuja training',
    'Pending Approval',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '3 days',
    'staff123',
    'test@example.com',
    'Accommodation'
  );

-- Insert corresponding accommodation details for the accommodation requests above
-- Note: You'll need to replace the trf_id values with the actual IDs from the accommodation travel requests inserted above
INSERT INTO trf_accommodation_details (
  id,
  trf_id,
  accommodation_type,
  hotel_name,
  check_in_date,
  check_out_date,
  number_of_nights,
  room_type,
  created_at,
  updated_at
) VALUES 
  (
    gen_random_uuid(),
    (SELECT id FROM travel_requests WHERE purpose = 'Hotel booking for Dubai conference' AND travel_type = 'Accommodation' LIMIT 1),
    'Hotel',
    'Burj Al Arab Dubai',
    CURRENT_DATE + INTERVAL '10 days',
    CURRENT_DATE + INTERVAL '13 days',
    3,
    'Executive Suite',
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    gen_random_uuid(),
    (SELECT id FROM travel_requests WHERE purpose = 'Guest house reservation for Abuja training' AND travel_type = 'Accommodation' LIMIT 1),
    'Guest House',
    'Government Guest House Abuja',
    CURRENT_DATE + INTERVAL '5 days',
    CURRENT_DATE + INTERVAL '7 days',
    2,
    'Standard Room',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '3 days'
  );

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Run these queries to verify the data was inserted correctly:

-- Check travel requests
-- SELECT id, purpose, status, created_at, updated_at, staff_id, travel_type FROM travel_requests WHERE staff_id = 'staff123' OR requestor_name ILIKE '%test@example.com%';

-- Check expense claims  
-- SELECT id, purpose_of_claim, status, created_at, updated_at, staff_no, staff_name FROM expense_claims WHERE staff_no = 'staff123' OR staff_name ILIKE '%test@example.com%';

-- Check visa applications
-- SELECT id, travel_purpose, status, created_at, updated_at, user_id, staff_id, email FROM visa_applications WHERE user_id = 'staff123' OR staff_id = 'staff123' OR email = 'test@example.com';

-- Check accommodation details
-- SELECT tr.id, tr.purpose, tr.status, tad.hotel_name, tad.accommodation_type 
-- FROM travel_requests tr 
-- INNER JOIN trf_accommodation_details tad ON tad.trf_id = tr.id 
-- WHERE tr.staff_id = 'staff123' OR tr.requestor_name ILIKE '%test@example.com%';

-- =============================================================================
-- NOTES
-- =============================================================================

/*
IMPORTANT NOTES FOR TESTING:

1. Replace 'staff123' with your actual test user's staff ID
2. Replace 'test@example.com' with your actual test user's email
3. The script uses realistic Nigerian business contexts (Lagos, Abuja, Port Harcourt)
4. All dates are relative to NOW() to ensure recent activity data
5. Various status values are included to test different display scenarios
6. UUIDs are generated automatically using gen_random_uuid()

DEBUGGING TIPS:

If activities still don't show up, check:
1. User identifier matching - ensure the staff_id/email in database matches your session
2. Date filters - all sample data is within the last 30 days
3. Status filtering - included common statuses like 'Pending Approval', 'Draft', 'Approved'
4. Query permissions - verify the user has access to read these tables

The API code shows it looks for these user identifiers:
- For travel_requests: staff_id, requestor_name (email match)
- For expense_claims: staff_no, staff_name (email match) 
- For visa_applications: user_id, staff_id, email

Make sure your test user credentials match at least one of these fields in each table.
*/