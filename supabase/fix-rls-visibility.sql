-- Fix RLS Policies to Allow Drivers to See All Shifts (Read-Only)
-- Run this in Supabase SQL Editor

-- First, drop the existing SELECT policy for shifts
DROP POLICY IF EXISTS "Drivers see own shifts, admins see all" ON shifts;

-- Create new SELECT policy that allows ALL authenticated users to see ALL shifts
-- This is read-only access - they can see but not modify others' shifts
CREATE POLICY "All authenticated users can view all shifts" ON shifts
  FOR SELECT USING (auth.role() = 'authenticated');

-- Keep the existing INSERT policy - drivers can only create their own shifts
DROP POLICY IF EXISTS "Drivers create own shifts, admins create any" ON shifts;
CREATE POLICY "Drivers create own shifts, admins create any" ON shifts
  FOR INSERT WITH CHECK (
    driver_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = TRUE
    )
  );

-- Keep the existing UPDATE policy - drivers can only update their own shifts
DROP POLICY IF EXISTS "Drivers update own shifts, admins update any" ON shifts;
CREATE POLICY "Drivers update own shifts, admins update any" ON shifts
  FOR UPDATE USING (
    driver_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = TRUE
    )
  );

-- Keep the existing DELETE policy - drivers can only delete their own shifts
DROP POLICY IF EXISTS "Drivers delete own shifts, admins delete any" ON shifts;
CREATE POLICY "Drivers delete own shifts, admins delete any" ON shifts
  FOR DELETE USING (
    driver_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_admin = TRUE
    )
  );

-- Also ensure profiles table is readable by all authenticated users
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
CREATE POLICY "Profiles are viewable by authenticated users" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Ensure taxis table is readable by all authenticated users
DROP POLICY IF EXISTS "Taxis are viewable by authenticated users" ON taxis;
CREATE POLICY "Taxis are viewable by authenticated users" ON taxis
  FOR SELECT USING (auth.role() = 'authenticated');

-- Verify the policies are correct
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('shifts', 'profiles', 'taxis')
ORDER BY tablename, cmd;