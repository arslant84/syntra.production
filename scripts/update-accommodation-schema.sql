-- Script to update the trf_accommodation_details table to add missing columns for External Parties
-- This script adds the place_of_stay and estimated_cost_per_night columns if they don't exist

-- Check if place_of_stay column exists and add it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'trf_accommodation_details' 
        AND column_name = 'place_of_stay'
    ) THEN
        ALTER TABLE trf_accommodation_details 
        ADD COLUMN place_of_stay TEXT;
        
        RAISE NOTICE 'Added place_of_stay column to trf_accommodation_details table';
    ELSE
        RAISE NOTICE 'place_of_stay column already exists in trf_accommodation_details table';
    END IF;
END
$$;

-- Check if estimated_cost_per_night column exists and add it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'trf_accommodation_details' 
        AND column_name = 'estimated_cost_per_night'
    ) THEN
        ALTER TABLE trf_accommodation_details 
        ADD COLUMN estimated_cost_per_night NUMERIC(10, 2);
        
        RAISE NOTICE 'Added estimated_cost_per_night column to trf_accommodation_details table';
    ELSE
        RAISE NOTICE 'estimated_cost_per_night column already exists in trf_accommodation_details table';
    END IF;
END
$$;

-- Check if check_in_time column exists and add it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'trf_accommodation_details' 
        AND column_name = 'check_in_time'
    ) THEN
        ALTER TABLE trf_accommodation_details 
        ADD COLUMN check_in_time TEXT;
        
        RAISE NOTICE 'Added check_in_time column to trf_accommodation_details table';
    ELSE
        RAISE NOTICE 'check_in_time column already exists in trf_accommodation_details table';
    END IF;
END
$$;

-- Check if check_out_time column exists and add it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'trf_accommodation_details' 
        AND column_name = 'check_out_time'
    ) THEN
        ALTER TABLE trf_accommodation_details 
        ADD COLUMN check_out_time TEXT;
        
        RAISE NOTICE 'Added check_out_time column to trf_accommodation_details table';
    ELSE
        RAISE NOTICE 'check_out_time column already exists in trf_accommodation_details table';
    END IF;
END
$$;

-- Check if other_type_description column exists and add it if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'trf_accommodation_details' 
        AND column_name = 'other_type_description'
    ) THEN
        ALTER TABLE trf_accommodation_details 
        ADD COLUMN other_type_description TEXT;
        
        RAISE NOTICE 'Added other_type_description column to trf_accommodation_details table';
    ELSE
        RAISE NOTICE 'other_type_description column already exists in trf_accommodation_details table';
    END IF;
END
$$;
