-- RPC Functions for Hammonia Taxi (Clean Version - No Type Creation)
-- Run this AFTER your main schema is set up

-- Function to delete a user completely (auth + profile + cascade shifts)
CREATE OR REPLACE FUNCTION delete_user(user_id UUID)
RETURNS void AS $$
BEGIN
  -- Check if the caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;
  
  -- Check if trying to delete an admin
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Cannot delete admin users';
  END IF;
  
  -- Delete from auth.users (this will cascade to profiles and shifts)
  DELETE FROM auth.users WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a driver with auth user
CREATE OR REPLACE FUNCTION create_driver(
  user_email TEXT,
  user_password TEXT,
  first_name TEXT,
  last_name TEXT,
  employee_type_param TEXT DEFAULT 'Vollzeit Mitarbeiter'
)
RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Check if the caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Only admins can create drivers';
  END IF;
  
  -- Generate a new UUID for the user
  new_user_id := gen_random_uuid();
  
  -- Insert into auth.users
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    instance_id,
    aud,
    role
  ) VALUES (
    new_user_id,
    user_email,
    crypt(user_password, gen_salt('bf')),
    NOW(),
    jsonb_build_object(
      'first_name', first_name,
      'last_name', last_name,
      'employee_type', employee_type_param,
      'is_admin', false
    ),
    NOW(),
    NOW(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated'
  );
  
  -- The profile will be created automatically by the trigger
  -- But let's ensure it's created if the trigger doesn't fire
  INSERT INTO profiles (
    id,
    email,
    first_name,
    last_name,
    employee_type,
    is_admin
  ) VALUES (
    new_user_id,
    user_email,
    first_name,
    last_name,
    employee_type_param::employee_type,
    false
  ) ON CONFLICT (id) DO NOTHING;
  
  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update driver email in auth
CREATE OR REPLACE FUNCTION update_driver_email(
  user_id UUID,
  new_email TEXT
)
RETURNS void AS $$
BEGIN
  -- Check if the caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Only admins can update driver emails';
  END IF;
  
  -- Update email in auth.users
  UPDATE auth.users 
  SET email = new_email,
      updated_at = NOW()
  WHERE id = user_id;
  
  -- Update email in profiles
  UPDATE profiles 
  SET email = new_email,
      updated_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for driver shift conflicts
CREATE OR REPLACE FUNCTION check_driver_availability(
  p_driver_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_exclude_shift_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Return TRUE if driver is available (no conflicts)
  -- Return FALSE if driver has a conflict
  RETURN NOT EXISTS (
    SELECT 1 FROM shifts
    WHERE driver_id = p_driver_id
    AND (p_exclude_shift_id IS NULL OR id != p_exclude_shift_id)
    AND (p_start_time, p_end_time) OVERLAPS (start_time, end_time)
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check for taxi availability
CREATE OR REPLACE FUNCTION check_taxi_availability(
  p_taxi_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_exclude_shift_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Return TRUE if taxi is available (no conflicts)
  -- Return FALSE if taxi has a conflict
  RETURN NOT EXISTS (
    SELECT 1 FROM shifts
    WHERE taxi_id = p_taxi_id
    AND (p_exclude_shift_id IS NULL OR id != p_exclude_shift_id)
    AND (p_start_time, p_end_time) OVERLAPS (start_time, end_time)
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on these functions
GRANT EXECUTE ON FUNCTION delete_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_driver(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_driver_email(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_driver_availability(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_taxi_availability(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;

-- Now update the shift overlap trigger to check both taxi and driver conflicts
DROP TRIGGER IF EXISTS prevent_shift_overlap ON shifts;
DROP FUNCTION IF EXISTS check_shift_overlap();

-- Create enhanced overlap check function
CREATE OR REPLACE FUNCTION check_shift_overlap()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if taxi is already booked for this time
  IF EXISTS (
    SELECT 1 FROM shifts
    WHERE taxi_id = NEW.taxi_id
    AND id != COALESCE(NEW.id, gen_random_uuid())
    AND (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
  ) THEN
    RAISE EXCEPTION 'Taxi is already booked for this time period';
  END IF;
  
  -- Check if driver already has a shift at this time (prevent double booking)
  IF EXISTS (
    SELECT 1 FROM shifts
    WHERE driver_id = NEW.driver_id
    AND id != COALESCE(NEW.id, gen_random_uuid())
    AND (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
  ) THEN
    RAISE EXCEPTION 'Driver already has a shift scheduled for this time period';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger with enhanced checks
CREATE TRIGGER prevent_shift_overlap
  BEFORE INSERT OR UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION check_shift_overlap();

-- Add index for better performance on conflict checks
CREATE INDEX IF NOT EXISTS idx_shifts_driver_time 
ON shifts(driver_id, start_time, end_time);