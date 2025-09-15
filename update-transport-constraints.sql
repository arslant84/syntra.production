-- Update Transport Requests Constraints
-- This script removes foreign key constraints from transport_requests table

-- Drop existing foreign key constraints if they exist
DO $$
BEGIN
    -- Drop created_by foreign key constraint
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%transport_requests_created_by%' 
        AND conrelid = 'transport_requests'::regclass
    ) THEN
        ALTER TABLE transport_requests DROP CONSTRAINT IF EXISTS transport_requests_created_by_fkey;
    END IF;
    
    -- Drop updated_by foreign key constraint
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%transport_requests_updated_by%' 
        AND conrelid = 'transport_requests'::regclass
    ) THEN
        ALTER TABLE transport_requests DROP CONSTRAINT IF EXISTS transport_requests_updated_by_fkey;
    END IF;
END
$$;

-- Verify the changes by checking if foreign key constraints exist
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'transport_requests'
    AND kcu.column_name IN ('created_by', 'updated_by'); 