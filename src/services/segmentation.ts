import { supabase } from '@/lib/supabase';
import { getCurrentOrganizationId } from '@/lib/org-scope';

export interface CustomerSegment {
    id: string;
    name: string;
    description: string | null;
    color: string;
    icon: string;
    is_active: boolean;
    customer_count: number;
}

export interface SegmentCustomer {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    total_visits?: number;
    total_spent?: number;
}

export interface SegmentCustomerCandidate {
    customer_id: string;
    customer_name: string;
    phone: string;
    email: string | null;
    is_mapped: boolean;
    total_count: number;
}

export const segmentationService = {
    async getSegments(): Promise<CustomerSegment[]> {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('customer_segments')
            .select('id, name, description, color, icon, is_active')
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .order('name');

        if (error) throw error;

        return Promise.all((data || []).map(async segment => {
            const { count, error: countError } = await supabase
                .from('customer_customer_segments_mapping')
                .select('id', { count: 'exact', head: true })
                .eq('organization_id', organizationId)
                .eq('segment_id', segment.id);

            if (countError) throw countError;
            return { ...segment, customer_count: count || 0 };
        }));
    },

    async getSegmentStats(): Promise<CustomerSegment[]> {
        return this.getSegments();
    },

    async getTotalCustomerCount(): Promise<number> {
        const organizationId = await getCurrentOrganizationId();
        const { count, error } = await supabase
            .from('customers')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', organizationId);

        if (error) throw error;
        return count || 0;
    },

    async createSegment(input: { name: string; description?: string }): Promise<CustomerSegment> {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('customer_segments')
            .insert({
                name: input.name.trim(),
                description: input.description?.trim() || null,
                color: '#6366f1',
                icon: 'users',
                is_active: true,
                organization_id: organizationId,
            })
            .select('id, name, description, color, icon, is_active')
            .single();

        if (error) throw error;
        return { ...data, customer_count: 0 };
    },

    async getSegmentMembers(segmentId: string, page = 0, limit = 6) {
        const organizationId = await getCurrentOrganizationId();
        const from = page * limit;
        const to = from + limit - 1;
        const { data, error, count } = await supabase
            .from('customer_customer_segments_mapping')
            .select('customer_id, customers!inner(id, name, phone, email, total_visits, total_spent)', { count: 'exact' })
            .eq('organization_id', organizationId)
            .eq('segment_id', segmentId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        const customers = (data || []).map(row => row.customers as unknown as SegmentCustomer);
        return { data: customers, count: count || 0 };
    },

    async getCustomerCandidates(input: {
        segmentId: string;
        search?: string;
        serviceCategory?: string;
        page?: number;
        limit?: number;
    }) {
        const organizationId = await getCurrentOrganizationId();
        const page = input.page || 0;
        const limit = input.limit || 10;
        const { data, error } = await supabase.rpc('get_segment_customer_candidates', {
            p_organization_id: organizationId,
            p_segment_id: input.segmentId,
            p_search: input.search?.trim() || null,
            p_service_category: input.serviceCategory || null,
            p_offset: page * limit,
            p_limit: limit,
        });

        if (error) throw error;
        const rows = (data || []) as SegmentCustomerCandidate[];
        return {
            data: rows,
            count: rows.length > 0 ? Number(rows[0].total_count) : 0,
        };
    },

    async getServiceCategoryFilterOptions(): Promise<string[]> {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase.rpc('get_customer_segment_category_options', {
            p_organization_id: organizationId,
        });

        if (error) throw error;
        return (data || [])
            .map((row: { service_category: string }) => row.service_category)
            .filter(Boolean);
    },

    async mapCustomers(segmentId: string, customerIds: string[]): Promise<number> {
        if (customerIds.length === 0) return 0;

        const organizationId = await getCurrentOrganizationId();
        const { data: { user } } = await supabase.auth.getUser();
        let mappedCount = 0;

        for (let index = 0; index < customerIds.length; index += 500) {
            const chunk = customerIds.slice(index, index + 500);
            const { data, error } = await supabase
                .from('customer_customer_segments_mapping')
                .upsert(
                    chunk.map(customerId => ({
                        organization_id: organizationId,
                        customer_id: customerId,
                        segment_id: segmentId,
                        created_by: user?.id,
                    })),
                    {
                        onConflict: 'organization_id,customer_id,segment_id',
                        ignoreDuplicates: true,
                    }
                )
                .select('id');

            if (error) throw error;
            mappedCount += data?.length || 0;
        }

        return mappedCount;
    },

    async mapAllFilteredCustomers(input: {
        segmentId: string;
        search?: string;
        serviceCategory?: string;
    }): Promise<number> {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase.rpc('map_filtered_customers_to_segment', {
            p_organization_id: organizationId,
            p_segment_id: input.segmentId,
            p_search: input.search?.trim() || null,
            p_service_category: input.serviceCategory || null,
        });

        if (error) throw error;
        return Number(data || 0);
    },

    async removeCustomerFromSegment(segmentId: string, customerId: string): Promise<void> {
        const organizationId = await getCurrentOrganizationId();
        const { error } = await supabase
            .from('customer_customer_segments_mapping')
            .delete()
            .eq('organization_id', organizationId)
            .eq('segment_id', segmentId)
            .eq('customer_id', customerId);

        if (error) throw error;
    },
};
