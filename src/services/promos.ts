import { supabase } from '@/lib/supabase';
import { getCurrentOrganizationId } from '@/lib/org-scope';

export interface PromoCodeInput {
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    min_spend?: number;
    start_date: string;
    end_date: string;
    usage_limit?: number;
    description?: string;
    is_active?: boolean;
}

export interface PromoCode {
    id: string;
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    min_spend: number;
    start_date: string;
    end_date: string;
    usage_limit: number | null;
    used_count: number;
    is_active: boolean;
    description: string | null;
    created_at: string;
}

export const promosService = {
    /**
     * Get all promo codes with optional filtering
     */
    async getPromoCodes(filters?: { isActive?: boolean }): Promise<PromoCode[]> {
        const organizationId = await getCurrentOrganizationId();
        let query = supabase
            .from('promo_codes')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false });

        if (filters?.isActive !== undefined) {
            query = query.eq('is_active', filters.isActive);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    },

    /**
     * Get single promo code by ID
     */
    async getPromoCodeById(id: string): Promise<PromoCode | null> {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('promo_codes')
            .select('*')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Create a new promo code
     */
    async createPromoCode(promoData: PromoCodeInput): Promise<PromoCode> {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('promo_codes')
            .insert({
                code: promoData.code.toUpperCase(),
                type: promoData.type,
                value: promoData.value,
                min_spend: promoData.min_spend || 0,
                start_date: promoData.start_date,
                end_date: promoData.end_date,
                usage_limit: promoData.usage_limit || null,
                used_count: 0,
                description: promoData.description || null,
                is_active: promoData.is_active !== undefined ? promoData.is_active : true,
                organization_id: organizationId,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update an existing promo code
     */
    async updatePromoCode(id: string, promoData: Partial<PromoCodeInput>): Promise<PromoCode> {
        const updateData: any = {};

        if (promoData.code !== undefined) updateData.code = promoData.code.toUpperCase();
        if (promoData.type !== undefined) updateData.type = promoData.type;
        if (promoData.value !== undefined) updateData.value = promoData.value;
        if (promoData.min_spend !== undefined) updateData.min_spend = promoData.min_spend;
        if (promoData.start_date !== undefined) updateData.start_date = promoData.start_date;
        if (promoData.end_date !== undefined) updateData.end_date = promoData.end_date;
        if (promoData.usage_limit !== undefined) updateData.usage_limit = promoData.usage_limit || null;
        if (promoData.description !== undefined) updateData.description = promoData.description || null;
        if (promoData.is_active !== undefined) updateData.is_active = promoData.is_active;

        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('promo_codes')
            .update(updateData)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Toggle promo code active status
     */
    async togglePromoCodeStatus(id: string, isActive: boolean): Promise<PromoCode> {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('promo_codes')
            .update({ is_active: isActive })
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Delete a promo code
     */
    async deletePromoCode(id: string): Promise<void> {
        const organizationId = await getCurrentOrganizationId();
        const { error } = await supabase
            .from('promo_codes')
            .delete()
            .eq('id', id)
            .eq('organization_id', organizationId);

        if (error) throw error;
    }
};
