-- Script to create the missing trf_meal_provisions table

-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trf_meal_provisions table if it doesn't exist
CREATE TABLE IF NOT EXISTS trf_meal_provisions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    trf_id TEXT NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
    date_from_to TEXT,
    breakfast INTEGER DEFAULT 0,
    lunch INTEGER DEFAULT 0,
    dinner INTEGER DEFAULT 0,
    supper INTEGER DEFAULT 0,
    refreshment INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add index on trf_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_trf_meal_provisions_trf_id ON trf_meal_provisions(trf_id);

-- Add a trigger to update the updated_at column
DROP TRIGGER IF EXISTS update_trf_meal_provisions_updated_at ON trf_meal_provisions;
CREATE TRIGGER update_trf_meal_provisions_updated_at
BEFORE UPDATE ON trf_meal_provisions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
