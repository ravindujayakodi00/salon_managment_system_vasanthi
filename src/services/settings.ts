import { supabase } from '@/lib/supabase';

export const settingsService = {
    /**
     * Change staff member's password (Owner only)
     * Calls Supabase Edge Function with admin privileges
     */
    async changeStaffPassword(staffEmail: string, newPassword: string) {
        try {
            // Get current session
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('Not authenticated');
            }

            // Get Supabase URL from environment
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            if (!supabaseUrl) {
                throw new Error('Supabase URL not configured');
            }
            if (!anonKey) {
                throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
            }

            // Call edge function — Supabase requires `apikey` (anon) in addition to the user JWT.
            const response = await fetch(
                `${supabaseUrl}/functions/v1/change-password`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                        apikey: anonKey,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: staffEmail,
                        newPassword: newPassword
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to change password');
            }

            return result;
        } catch (error: any) {
            console.error('Error changing password:', error);
            throw error;
        }
    },

    /**
     * Get commission settings for the organization
     */
    async getCommissionSettings(organizationId: string) {
        try {
            const { data, error } = await supabase
                .from('commission_settings')
                .select('*')
                .eq('organization_id', organizationId)
                .order('role');

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching commission settings:', error);
            throw error;
        }
    },

    /**
     * Update commission settings (Owner only)
     */
    async updateCommissionSettings(organizationId: string, role: string, percentage: number) {
        try {
            const { data, error } = await supabase
                .from('commission_settings')
                .update({ commission_percentage: percentage })
                .eq('organization_id', organizationId)
                .eq('role', role)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating commission settings:', error);
            throw error;
        }
    },

    /**
     * Get salary settings for staff
     */
    async getSalarySettings(staffId: string) {
        try {
            const { data, error } = await supabase
                .from('salary_settings')
                .select('*')
                .eq('staff_id', staffId)
                .eq('is_active', true)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // Ignore "not found" error
            return data;
        } catch (error) {
            console.error('Error fetching salary settings:', error);
            throw error;
        }
    },

    /**
     * Update salary settings (Owner only)
     */
    async updateSalarySettings(staffId: string, salaryType: 'daily' | 'monthly', amount: number) {
        try {
            // Check if settings exist
            const existing = await this.getSalarySettings(staffId);

            if (existing) {
                // Update existing
                const { data, error } = await supabase
                    .from('salary_settings')
                    .update({
                        salary_type: salaryType,
                        amount,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            } else {
                // Create new
                const { data, error } = await supabase
                    .from('salary_settings')
                    .insert({
                        staff_id: staffId,
                        salary_type: salaryType,
                        amount,
                        effective_from: new Date().toISOString().split('T')[0],
                        is_active: true
                    })
                    .select()
                    .single();

                if (error) throw error;
                return data;
            }
        } catch (error) {
            console.error('Error updating salary settings:', error);
            throw error;
        }
    },

    /**
     * Get all staff for password management
     */
    async getAllStaff() {
        try {
            const { data, error } = await supabase
                .from('staff')
                .select('id, name, email, role, is_active')
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching staff:', error);
            throw error;
        }
    }
};
