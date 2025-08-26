-- Script to remove the uses_daily_selection column from trf_meal_provisions table
-- This column is no longer needed as day-by-day meal selection is now the default and only method

-- Remove the uses_daily_selection column
ALTER TABLE trf_meal_provisions DROP COLUMN IF EXISTS uses_daily_selection;

-- Verify the column has been removed
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'trf_meal_provisions' 
ORDER BY ordinal_position;