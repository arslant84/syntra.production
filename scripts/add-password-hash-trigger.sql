-- Add password hashing trigger to ensure all passwords are hashed
-- This trigger will automatically hash plaintext passwords when users are inserted or updated

-- First, we need to install the pgcrypto extension if not already installed
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a function to hash passwords
CREATE OR REPLACE FUNCTION hash_user_password()
RETURNS TRIGGER AS $$
BEGIN
  -- Only hash if password is not null and not already hashed (bcrypt hashes start with $2b$)
  IF NEW.password IS NOT NULL AND NOT (NEW.password LIKE '$2b$%') THEN
    -- Use pgcrypto's crypt function with bcrypt
    NEW.password := crypt(NEW.password, gen_salt('bf', 12));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT operations
DROP TRIGGER IF EXISTS hash_password_on_insert ON users;
CREATE TRIGGER hash_password_on_insert
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION hash_user_password();

-- Create trigger for UPDATE operations
DROP TRIGGER IF EXISTS hash_password_on_update ON users;
CREATE TRIGGER hash_password_on_update
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION hash_user_password();

-- Add a comment to document this trigger
COMMENT ON FUNCTION hash_user_password() IS 'Automatically hashes plaintext passwords using bcrypt when users are inserted or updated';
