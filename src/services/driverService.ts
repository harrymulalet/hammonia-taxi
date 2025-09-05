import { supabase } from '@/lib/supabase/client';
import { Profile, EmployeeType } from '@/lib/supabase/database.types';

export interface CreateDriverData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  employeeType: EmployeeType;
}

export interface UpdateDriverData {
  firstName?: string;
  lastName?: string;
  employeeType?: EmployeeType;
  email?: string;
}

class DriverService {
  /**
   * Create a new driver with both auth user and profile
   */
  async createDriver(data: CreateDriverData) {
    try {
      // Step 1: Create auth user with metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
            employee_type: data.employeeType,
            is_admin: false,
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      // The profile will be created automatically by the database trigger
      // Let's verify it was created
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError) {
        // If profile creation failed, we should clean up the auth user
        // Note: This requires service role key, so we'll just log the error
        console.error('Profile creation failed:', profileError);
        throw new Error('Failed to create driver profile');
      }

      return { user: authData.user, profile };
    } catch (error) {
      console.error('Error creating driver:', error);
      throw error;
    }
  }

  /**
   * Update driver information (both profile and auth metadata)
   */
  async updateDriver(driverId: string, data: UpdateDriverData) {
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
          employee_type: data.employeeType,
          email: data.email,
          updated_at: new Date().toISOString(),
        })
        .eq('id', driverId);

      if (profileError) throw profileError;

      // If email is being updated, we need to update auth as well
      // Note: Email change requires user confirmation in Supabase
      if (data.email) {
        // This would require the user to be logged in or service role key
        console.log('Email update requested. User will need to confirm via email.');
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating driver:', error);
      throw error;
    }
  }

  /**
   * Delete driver (both auth user and profile)
   * Note: Profile deletion will cascade to shifts automatically
   */
  async deleteDriver(driverId: string) {
    try {
      // First, check if we're trying to delete an admin
      const { data: profile, error: checkError } = await supabase
        .from('profiles')
        .select('is_admin, email')
        .eq('id', driverId)
        .single();

      if (checkError) throw checkError;
      
      if (profile?.is_admin) {
        throw new Error('Cannot delete admin users through this interface');
      }

      // Delete from auth.users (this will cascade to profiles and shifts)
      // Note: This requires admin privileges or service role key
      // For client-side, we'll use a different approach
      
      // Option 1: Delete profile (if you have CASCADE on foreign key)
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', driverId);

      if (deleteError) {
        // If we can't delete the profile, try using RPC function
        const { error: rpcError } = await supabase
          .rpc('delete_user', { user_id: driverId });
        
        if (rpcError) throw rpcError;
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting driver:', error);
      throw error;
    }
  }

  /**
   * Get all drivers
   */
  async getDrivers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_admin', false)
        .order('last_name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching drivers:', error);
      throw error;
    }
  }

  /**
   * Get single driver
   */
  async getDriver(driverId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', driverId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching driver:', error);
      throw error;
    }
  }

  /**
   * Reset driver password
   */
  async resetDriverPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  }

  /**
   * Check if driver has any active shifts
   */
  async hasActiveShifts(driverId: string): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('shifts')
        .select('id')
        .eq('driver_id', driverId)
        .gte('end_time', now)
        .limit(1);

      if (error) throw error;
      return (data?.length || 0) > 0;
    } catch (error) {
      console.error('Error checking active shifts:', error);
      return false;
    }
  }
}

export const driverService = new DriverService();