// Supabase Client for SalonFlow Website
// Direct connection to Supabase for public booking functionality

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================
// DATABASE TYPES
// ============================================

export interface DbService {
    id: string;
    name: string;
    category: 'Hair' | 'Beard' | 'Facial' | 'Bridal' | 'Kids' | 'Spa' | 'Other';
    price: number;
    duration: number;
    gender: 'Male' | 'Female' | 'Unisex' | null;
    is_active: boolean;
    description: string | null;
    created_at: string;
}

export interface DbStaff {
    id: string;
    profile_id: string | null;
    name: string;
    email: string | null;
    phone: string;
    system_role: 'Owner' | 'Manager' | 'Receptionist' | 'Stylist';
    branch_id: string | null;
    specializations: string[]; // Array of service IDs
    working_days: string[];
    working_hours: { start: string; end: string } | null;
    is_active: boolean;
    created_at: string;
    is_emergency_unavailable: boolean;
}

export interface DbAppointment {
    id: string;
    customer_id: string;
    stylist_id: string;
    branch_id: string;
    services: string[]; // Array of service IDs
    appointment_date: string;
    start_time: string;
    duration: number;
    status: 'Pending' | 'Confirmed' | 'InService' | 'Completed' | 'Cancelled' | 'NoShow';
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface DbCustomer {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    gender: 'Male' | 'Female' | 'Other' | null;
    date_of_birth: string | null;
    total_visits: number;
    total_spent: number;
    last_visit: string | null;
    preferences: string | null;
    created_at: string;
    segment_tags: string[];
    last_visit_date: string | null;
    preferred_services: string[];
    is_active: boolean;
}

export interface DbSalonSettings {
    id: string;
    slot_interval: 15 | 30 | 60;
    booking_window_days: number;
    booking_buffer_minutes: number;
    default_start_time: string;
    default_end_time: string;
    created_at: string;
    updated_at: string;
}

export interface DbStylistBreak {
    id: string;
    stylist_id: string;
    day_of_week: number | null; // 0-6, null means applies to all days
    start_time: string;
    end_time: string;
    break_type: 'Lunch' | 'Short' | 'Personal' | 'Other';
    is_recurring: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface DbStylistUnavailability {
    id: string;
    stylist_id: string;
    unavailable_date: string;
    reason: string | null;
    created_at: string;
    updated_at: string;
}

export interface DbBranch {
    id: string;
    name: string;
    address: string;
    phone: string;
    is_active: boolean;
    created_at: string;
}
