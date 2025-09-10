-- Debug script to check activity-related table data
-- Purpose: Investigate why recent activity section might be empty

-- =================================================================
-- SECTION 1: Count records in each activity-related table
-- =================================================================

SELECT 'TRAVEL REQUESTS COUNT' as table_name, COUNT(*) as record_count 
FROM travel_requests;

SELECT 'EXPENSE CLAIMS COUNT' as table_name, COUNT(*) as record_count 
FROM expense_claims;

SELECT 'VISA APPLICATIONS COUNT' as table_name, COUNT(*) as record_count 
FROM visa_applications;

SELECT 'TRF ACCOMMODATION DETAILS COUNT' as table_name, COUNT(*) as record_count 
FROM trf_accommodation_details;

-- =================================================================
-- SECTION 2: Sample records from travel_requests table
-- =================================================================

SELECT 
    'TRAVEL REQUESTS SAMPLE' as section,
    id,
    purpose,
    status,
    staff_id,
    requestor_name,
    travel_type,
    created_at,
    updated_at
FROM travel_requests 
ORDER BY created_at DESC 
LIMIT 5;

-- =================================================================
-- SECTION 3: Sample records from expense_claims table
-- =================================================================

SELECT 
    'EXPENSE CLAIMS SAMPLE' as section,
    id,
    purpose_of_claim as purpose,
    status,
    staff_no as staff_id,
    staff_name,
    created_at,
    updated_at
FROM expense_claims 
ORDER BY created_at DESC 
LIMIT 5;

-- =================================================================
-- SECTION 4: Sample records from visa_applications table
-- =================================================================

SELECT 
    'VISA APPLICATIONS SAMPLE' as section,
    id,
    travel_purpose as purpose,
    status,
    staff_id,
    user_id,
    email,
    created_at,
    updated_at
FROM visa_applications 
ORDER BY created_at DESC 
LIMIT 5;

-- =================================================================
-- SECTION 5: Sample records from accommodation details
-- =================================================================

SELECT 
    'ACCOMMODATION DETAILS SAMPLE' as section,
    tad.id as accommodation_id,
    tad.trf_id,
    tr.purpose,
    tr.status,
    tr.staff_id,
    tr.requestor_name,
    tad.created_at,
    tad.updated_at
FROM trf_accommodation_details tad
INNER JOIN travel_requests tr ON tr.id = tad.trf_id
ORDER BY tad.created_at DESC 
LIMIT 5;

-- =================================================================
-- SECTION 6: Recent activity analysis (last 30 days)
-- =================================================================

SELECT 
    'RECENT TRAVEL REQUESTS (30 days)' as activity_type,
    COUNT(*) as count,
    MIN(created_at) as earliest_date,
    MAX(created_at) as latest_date
FROM travel_requests 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

SELECT 
    'RECENT EXPENSE CLAIMS (30 days)' as activity_type,
    COUNT(*) as count,
    MIN(created_at) as earliest_date,
    MAX(created_at) as latest_date
FROM expense_claims 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

SELECT 
    'RECENT VISA APPLICATIONS (30 days)' as activity_type,
    COUNT(*) as count,
    MIN(created_at) as earliest_date,
    MAX(created_at) as latest_date
FROM visa_applications 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- =================================================================
-- SECTION 7: Status distribution analysis
-- =================================================================

SELECT 
    'TRAVEL REQUEST STATUS DISTRIBUTION' as analysis_type,
    status,
    COUNT(*) as count
FROM travel_requests 
GROUP BY status
ORDER BY count DESC;

SELECT 
    'EXPENSE CLAIMS STATUS DISTRIBUTION' as analysis_type,
    status,
    COUNT(*) as count
FROM expense_claims 
GROUP BY status
ORDER BY count DESC;

SELECT 
    'VISA APPLICATIONS STATUS DISTRIBUTION' as analysis_type,
    status,
    COUNT(*) as count
FROM visa_applications 
GROUP BY status
ORDER BY count DESC;

-- =================================================================
-- SECTION 8: Check for data integrity issues
-- =================================================================

-- Check for NULL or empty critical fields in travel_requests
SELECT 
    'TRAVEL REQUESTS DATA INTEGRITY' as check_type,
    'NULL or empty staff_id' as issue,
    COUNT(*) as count
FROM travel_requests 
WHERE staff_id IS NULL OR staff_id = '';

SELECT 
    'TRAVEL REQUESTS DATA INTEGRITY' as check_type,
    'NULL or empty purpose' as issue,
    COUNT(*) as count
FROM travel_requests 
WHERE purpose IS NULL OR purpose = '';

-- Check for NULL or empty critical fields in expense_claims
SELECT 
    'EXPENSE CLAIMS DATA INTEGRITY' as check_type,
    'NULL or empty staff_no' as issue,
    COUNT(*) as count
FROM expense_claims 
WHERE staff_no IS NULL OR staff_no = '';

-- Check for NULL or empty critical fields in visa_applications
SELECT 
    'VISA APPLICATIONS DATA INTEGRITY' as check_type,
    'NULL staff_id AND user_id' as issue,
    COUNT(*) as count
FROM visa_applications 
WHERE (staff_id IS NULL OR staff_id = '') AND (user_id IS NULL OR user_id = '');

-- =================================================================
-- SECTION 9: Check user identification patterns
-- =================================================================

-- Sample user identifiers from each table to understand the data pattern
SELECT DISTINCT 
    'TRAVEL REQUESTS USER IDS' as table_type,
    staff_id,
    LEFT(requestor_name, 50) as requestor_name_sample
FROM travel_requests 
WHERE staff_id IS NOT NULL AND staff_id != ''
LIMIT 10;

SELECT DISTINCT 
    'EXPENSE CLAIMS USER IDS' as table_type,
    staff_no as staff_id,
    LEFT(staff_name, 50) as staff_name_sample
FROM expense_claims 
WHERE staff_no IS NOT NULL AND staff_no != ''
LIMIT 10;

SELECT DISTINCT 
    'VISA APPLICATIONS USER IDS' as table_type,
    COALESCE(staff_id, user_id) as user_identifier,
    LEFT(email, 50) as email_sample
FROM visa_applications 
WHERE COALESCE(staff_id, user_id) IS NOT NULL AND COALESCE(staff_id, user_id) != ''
LIMIT 10;