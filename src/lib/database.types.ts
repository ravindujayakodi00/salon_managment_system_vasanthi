// Database types matching Supabase schema
export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    email: string;
                    name: string;
                    system_role: 'Owner' | 'Manager' | 'Receptionist' | 'Stylist';
                    branch_id: string | null;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
            };
            customers: {
                Row: {
                    id: string;
                    name: string;
                    phone: string;
                    email: string | null;
                    gender: 'Male' | 'Female' | 'Other' | null;
                    total_visits: number;
                    total_spent: number;
                    last_visit: string | null;
                    preferences: string | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['customers']['Insert']>;
            };
            appointments: {
                Row: {
                    id: string;
                    customer_id: string;
                    stylist_id: string;
                    branch_id: string;
                    services: string[];
                    appointment_date: string;
                    start_time: string;
                    duration: number;
                    status: 'Pending' | 'Confirmed' | 'InService' | 'Completed' | 'Cancelled' | 'NoShow';
                    notes: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['appointments']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['appointments']['Insert']>;
            };
            services: {
                Row: {
                    id: string;
                    name: string;
                    category: string;
                    price: number;
                    duration: number;
                    gender: 'Male' | 'Female' | 'Unisex' | null;
                    is_active: boolean;
                    description: string | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['services']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['services']['Insert']>;
            };
        };
    };
}
