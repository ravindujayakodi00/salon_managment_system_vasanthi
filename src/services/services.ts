import { supabase } from '@/lib/supabase';
import { Service } from '@/lib/types';
import { getCurrentOrganizationId } from '@/lib/org-scope';

export const servicesService = {
    async getServices(activeOnly = true) {
        const organizationId = await getCurrentOrganizationId();
        let query = supabase
            .from('services')
            .select('*')
            .eq('organization_id', organizationId)
            .order('category')
            .order('name');

        if (activeOnly) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data;
    },

    async getServicesByCategory(category: string) {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('services')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('category', category)
            .eq('is_active', true)
            .order('name');

        if (error) throw error;
        return data;
    },

    async getServiceById(id: string) {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('services')
            .select('*')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single();

        if (error) throw error;
        return data;
    },

    async createService(service: {
        name: string;
        category: string;
        price: number;
        duration: number;
        gender?: 'Male' | 'Female' | 'Unisex';
        description?: string;
    }) {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('services')
            .insert({ ...service, organization_id: organizationId })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateService(id: string, updates: Partial<Service>) {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('services')
            .update(updates)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async toggleServiceStatus(id: string, isActive: boolean) {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('services')
            .update({ is_active: isActive })
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteService(id: string) {
        const organizationId = await getCurrentOrganizationId();
        const { error } = await supabase
            .from('services')
            .delete()
            .eq('id', id)
            .eq('organization_id', organizationId);

        if (error) throw error;
        return true;
    }
};
