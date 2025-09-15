-- Add profile photo column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT;

-- Add phone column as well for better profile management  
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;