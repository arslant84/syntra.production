-- Add profile photo support to users table
ALTER TABLE users ADD COLUMN profile_photo TEXT;

-- Add any additional profile fields that might be useful
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN staff_position TEXT;
ALTER TABLE users ADD COLUMN cost_center TEXT;

-- Update existing records to set default values
UPDATE users SET 
  profile_photo = NULL,
  phone = NULL
WHERE profile_photo IS NULL;

-- Display the updated table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;