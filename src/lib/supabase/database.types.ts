export type EmployeeType = 'Vollzeit Mitarbeiter' | 'Aushilfe' | 'Sonstiges';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          employee_type: EmployeeType;
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          employee_type?: EmployeeType;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          last_name?: string;
          email?: string;
          employee_type?: EmployeeType;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      taxis: {
        Row: {
          id: string;
          license_plate: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          license_plate: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          license_plate?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      shifts: {
        Row: {
          id: string;
          driver_id: string;
          taxi_id: string;
          start_time: string;
          end_time: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          driver_id: string;
          taxi_id: string;
          start_time: string;
          end_time: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          driver_id?: string;
          taxi_id?: string;
          start_time?: string;
          end_time?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      employee_type: EmployeeType;
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Taxi = Database['public']['Tables']['taxis']['Row'];
export type Shift = Database['public']['Tables']['shifts']['Row'];

export interface ShiftWithDetails extends Shift {
  taxi?: Taxi;
  driver?: Profile;
}