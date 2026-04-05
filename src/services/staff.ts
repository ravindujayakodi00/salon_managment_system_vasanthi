import { supabase } from '@/lib/supabase';
import { createStaffAction, deleteStaffAction } from '@/app/actions/staff';
import { randomBytes } from 'crypto';
import { getCurrentOrganizationId } from '@/lib/org-scope';

// Utility to generate cryptographically secure random password
function generatePassword(): string {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const bytes = randomBytes(length);
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset[bytes[i] % charset.length];
    }
    return password;
}

export const staffService = {
    /**
     * Get all staff members
     */
    async getStaff(branchId?: string) {
        const organizationId = await getCurrentOrganizationId();
        let query = supabase
            .from('staff')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .order('name');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data;
    },

    /**
     * Get stylists only (optionally filtered by availability on a specific date)
     */
    async getStylists(branchId?: string, date?: string) {
        const organizationId = await getCurrentOrganizationId();
        let query = supabase
            .from('staff')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('role', 'Stylist')
            .eq('is_active', true)
            .order('name');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) throw error;

        // If date is provided, filter out unavailable stylists
        if (date && data?.length) {
            const stylistIds = data.map(s => s.id);
            const { data: unavailable } = await supabase
                .from('stylist_unavailability')
                .select('stylist_id')
                .eq('unavailable_date', date)
                .in('stylist_id', stylistIds);

            const unavailableIds = new Set((unavailable || []).map(u => u.stylist_id));
            return data.filter(stylist => !unavailableIds.has(stylist.id));
        }

        return data;
    },

    /**
     * Get staff member by ID
     */
    async getStaffById(id: string) {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('staff')
            .select('*')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Get staff member by email
     */
    async getStaffByEmail(email: string) {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('staff')
            .select('*')
            .eq('email', email)
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Check stylist availability for a given date/time
     */
    async checkAvailability(stylistId: string, date: string, startTime: string, duration: number) {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('stylist_id', stylistId)
            .eq('appointment_date', date)
            .in('status', ['Pending', 'Confirmed', 'InService']);

        if (error) throw error;

        // Check for time conflicts
        // This is a simple check; you might want more sophisticated logic
        return data?.length === 0;
    },

    /**
     * Create new staff member with auto auth account creation
     */
    async createStaff(staffData: {
        name: string;
        email: string;
        phone: string;
        role: 'Manager' | 'Receptionist' | 'Stylist';
        branch_id: string;
        specializations?: string[];
        working_days?: string[];
        working_hours?: { start: string; end: string };
        salary?: number;
        commission?: number;
    }): Promise<{ success: boolean; message: string; credentials?: { email: string; password: string } }> {
        return await createStaffAction(staffData);
    },

    /**
     * Update staff member details - Uses API route to bypass RLS
     */
    async updateStaff(id: string, updates: {
        name?: string;
        phone?: string;
        role?: string;
        branch_id?: string;
        specializations?: string[];
        working_days?: string[];
        working_hours?: { start: string; end: string };
        salary?: number;
        commission?: number;
    }): Promise<{ success: boolean; message: string }> {
        try {
            console.log('Updating staff via API:', id, updates);
            const organizationId = await getCurrentOrganizationId();

            const response = await fetch('/api/staff/update', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id, updates, organization_id: organizationId }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                console.error('Staff update failed:', result);
                return {
                    success: false,
                    message: result.error || 'Failed to update staff member',
                };
            }

            console.log('Staff updated successfully:', result);
            return {
                success: true,
                message: 'Staff member updated successfully',
            };
        } catch (error: any) {
            console.error('Error updating staff:', error);
            return {
                success: false,
                message: error.message || 'Failed to update staff member',
            };
        }
    },

    /**
     * Deactivate staff member (soft delete)
     */
    async deactivateStaff(id: string): Promise<{ success: boolean; message: string }> {
        try {
            const organizationId = await getCurrentOrganizationId();
            const { error } = await supabase
                .from('staff')
                .update({ is_active: false })
                .eq('id', id)
                .eq('organization_id', organizationId);

            if (error) throw error;

            return {
                success: true,
                message: 'Staff member deactivated successfully',
            };
        } catch (error: any) {
            console.error('Error deactivating staff:', error);
            return {
                success: false,
                message: error.message || 'Failed to deactivate staff member',
            };
        }
    },

    /**
     * Delete staff member permanently
     */
    async deleteStaff(id: string): Promise<{ success: boolean; message: string }> {
        return await deleteStaffAction(id);
    },

    /**
     * Get stylists who can perform a specific service (have it in their specializations)
     */
    async getStylistsByService(serviceId: string, branchId?: string, date?: string) {
        const organizationId = await getCurrentOrganizationId();
        let query = supabase
            .from('staff')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('role', 'Stylist')
            .eq('is_active', true)
            .contains('specializations', [serviceId])
            .order('name');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) throw error;

        // If date is provided, filter out unavailable stylists
        if (date && data?.length) {
            const stylistIds = data.map(s => s.id);
            const { data: unavailable } = await supabase
                .from('stylist_unavailability')
                .select('stylist_id')
                .eq('unavailable_date', date)
                .in('stylist_id', stylistIds);

            const unavailableIds = new Set((unavailable || []).map(u => u.stylist_id));

            // Also filter out emergency unavailable stylists
            return data.filter(stylist =>
                !unavailableIds.has(stylist.id) && !stylist.is_emergency_unavailable
            );
        }

        return data;
    },

    /**
     * Get all stylists with their specialization details (service names)
     */
    async getStylistsWithSkills(branchId?: string) {
        const organizationId = await getCurrentOrganizationId();
        let query = supabase
            .from('staff')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('role', 'Stylist')
            .eq('is_active', true)
            .order('name');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data: stylists, error: staffError } = await query;
        if (staffError) throw staffError;

        // Get all services to map UUIDs to names
        const { data: services, error: servicesError } = await supabase
            .from('services')
            .select('id, name, category')
            .eq('organization_id', organizationId)
            .eq('is_active', true);

        if (servicesError) throw servicesError;

        // Create a map for quick lookup
        const serviceMap = new Map(services?.map(s => [s.id, s]) || []);

        // Enrich stylists with their skill details
        return (stylists || []).map(stylist => ({
            ...stylist,
            skillDetails: (stylist.specializations || [])
                .map((id: string) => serviceMap.get(id))
                .filter(Boolean)
        }));
    },
};
