-- Fix the auth user creation trigger that might be causing signup failures

-- First, drop the existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create a more robust version of the handle_new_user function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create profile if the user doesn't already have one
  -- This prevents duplicate key errors
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    employee_type,
    is_admin
  ) 
  SELECT
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Unknown'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'User'),
    COALESCE(
      (NEW.raw_user_meta_data->>'employee_type')::employee_type,
      'Vollzeit Mitarbeiter'::employee_type
    ),
    COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, false)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = NEW.id
  );
  
  -- Always return NEW to allow the auth user creation to proceed
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION handle_new_user();

-- Also, let's update the RPC function to be more robust
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
  existing_user UUID;
BEGIN
  -- Check if the caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Only admins can create drivers';
  END IF;
  
  -- Check if user with this email already exists
  SELECT id INTO existing_user FROM auth.users WHERE email = user_email;
  IF existing_user IS NOT NULL THEN
    RAISE EXCEPTION 'A user with this email already exists';
  END IF;
  
  -- Generate a new UUID for the user
  new_user_id := gen_random_uuid();
  
  -- First create the profile (to avoid trigger issues)
  INSERT INTO profiles (
    id,
    email,
    first_name,
    last_name,
    employee_type,
    is_admin,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    user_email,
    first_name,
    last_name,
    employee_type_param::employee_type,
    false,
    NOW(),
    NOW()
  );
  
  -- Then create the auth user
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
    NOW(), -- Auto-confirm the email
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
  
  RETURN new_user_id;
EXCEPTION
  WHEN OTHERS THEN
    -- If auth user creation failed, clean up the profile
    DELETE FROM profiles WHERE id = new_user_id;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_driver(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Alternative: Simple function to just create profile for existing auth user
CREATE OR REPLACE FUNCTION create_driver_profile(
  user_id UUID,
  user_email TEXT,
  first_name TEXT,
  last_name TEXT,
  employee_type_param TEXT DEFAULT 'Vollzeit Mitarbeiter'
)
RETURNS void AS $$
BEGIN
  -- Check if the caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Only admins can create driver profiles';
  END IF;
  
  -- Create or update the profile
  INSERT INTO profiles (
    id,
    email,
    first_name,
    last_name,
    employee_type,
    is_admin
  ) VALUES (
    user_id,
    user_email,
    first_name,
    last_name,
    employee_type_param::employee_type,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    employee_type = EXCLUDED.employee_type,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_driver_profile(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;