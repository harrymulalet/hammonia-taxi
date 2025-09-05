-- Hammonia Taxi Shift Planner Database Schema V2
-- This version includes proper auth sync and additional constraints

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for employee types
CREATE TYPE employee_type AS ENUM ('Vollzeit Mitarbeiter', 'Aushilfe', 'Sonstiges');

-- Create profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  employee_type employee_type NOT NULL DEFAULT 'Vollzeit Mitarbeiter',
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create taxis table
CREATE TABLE taxis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_plate TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create shifts table with enhanced constraints
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  taxi_id UUID NOT NULL REFERENCES taxis(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Add constraint to ensure end_time is after start_time
  CONSTRAINT valid_shift_times CHECK (end_time > start_time),
  
  -- Add constraint to ensure shift is max 10 hours (36000 seconds)
  CONSTRAINT max_shift_duration CHECK (
    EXTRACT(EPOCH FROM (end_time - start_time)) <= 36000
  )
);

-- Create indexes for faster queries
CREATE INDEX idx_shifts_driver_id ON shifts(driver_id);
CREATE INDEX idx_shifts_taxi_id ON shifts(taxi_id);
CREATE INDEX idx_shifts_start_time ON shifts(start_time);
CREATE INDEX idx_shifts_end_time ON shifts(end_time);
CREATE INDEX idx_shifts_driver_time ON shifts(driver_id, start_time, end_time);

-- Enhanced function to check for overlapping shifts (both taxi AND driver conflicts)
CREATE OR REPLACE FUNCTION check_shift_overlap()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if taxi is already booked for this time
  IF EXISTS (
    SELECT 1 FROM shifts
    WHERE taxi_id = NEW.taxi_id
    AND id != COALESCE(NEW.id, uuid_generate_v4())
    AND (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
  ) THEN
    RAISE EXCEPTION 'Taxi is already booked for this time period';
  END IF;
  
  -- Check if driver already has a shift at this time (prevent double booking)
  IF EXISTS (
    SELECT 1 FROM shifts
    WHERE driver_id = NEW.driver_id
    AND id != COALESCE(NEW.id, uuid_generate_v4())
    AND (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
  ) THEN
    RAISE EXCEPTION 'Driver already has a shift scheduled for this time period';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent overlapping shifts
CREATE TRIGGER prevent_shift_overlap
  BEFORE INSERT OR UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION check_shift_overlap();

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_taxis_updated_at BEFORE UPDATE ON taxis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle auth user deletion (deletes from auth when profile is deleted)
CREATE OR REPLACE FUNCTION handle_profile_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the user from auth.users (this will cascade delete the profile)
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle new user signup (creates profile)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create profile if metadata contains profile info
  IF NEW.raw_user_meta_data->>'first_name' IS NOT NULL THEN
    INSERT INTO public.profiles (
      id,
      email,
      first_name,
      last_name,
      employee_type,
      is_admin
    ) VALUES (
      NEW.id,
      NEW.email,
      NEW.raw_user_meta_data->>'first_name',
      NEW.raw_user_meta_data->>'last_name',
      COALESCE(
        (NEW.raw_user_meta_data->>'employee_type')::employee_type,
        'Vollzeit Mitarbeiter'
      ),
      COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, false)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxis ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles table
-- Everyone can view profiles
CREATE POLICY "Profiles are viewable by authenticated users" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can insert profiles
CREATE POLICY "Only admins can create profiles" ON profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = TRUE
    )
  );

-- Users can update their own profile, admins can update any
CREATE POLICY "Users can update own profile, admins can update any" ON profiles
  FOR UPDATE USING (
    id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = TRUE
    )
  );

-- Only admins can delete profiles
CREATE POLICY "Only admins can delete profiles" ON profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = TRUE
    )
  );

-- RLS Policies for taxis table
-- Everyone can view taxis
CREATE POLICY "Taxis are viewable by authenticated users" ON taxis
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can manage taxis
CREATE POLICY "Only admins can insert taxis" ON taxis
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = TRUE
    )
  );

CREATE POLICY "Only admins can update taxis" ON taxis
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = TRUE
    )
  );

CREATE POLICY "Only admins can delete taxis" ON taxis
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = TRUE
    )
  );

-- RLS Policies for shifts table
-- Drivers can only see their own shifts, admins can see all
CREATE POLICY "Drivers see own shifts, admins see all" ON shifts
  FOR SELECT USING (
    driver_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = TRUE
    )
  );

-- Drivers can create their own shifts, admins can create for anyone
CREATE POLICY "Drivers create own shifts, admins create any" ON shifts
  FOR INSERT WITH CHECK (
    driver_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = TRUE
    )
  );

-- Drivers can update their own shifts, admins can update any
CREATE POLICY "Drivers update own shifts, admins update any" ON shifts
  FOR UPDATE USING (
    driver_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = TRUE
    )
  );

-- Drivers can delete their own shifts, admins can delete any
CREATE POLICY "Drivers delete own shifts, admins delete any" ON shifts
  FOR DELETE USING (
    driver_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = TRUE
    )
  );

-- Add sample taxis (optional)
/*
INSERT INTO taxis (license_plate, is_active) VALUES 
  ('HH-QQ 701', true),
  ('HH-QQ 702', true),
  ('HH-QQ 703', true),
  ('HH-QQ 704', true),
  ('HH-QQ 705', true);
*/