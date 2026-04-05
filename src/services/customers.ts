import { supabase } from '@/lib/supabase';
import { Customer } from '@/lib/types';
import { getCurrentOrganizationId } from '@/lib/org-scope';

export const customersService = {
    async searchCustomers(searchQuery: string) {
        if (!searchQuery || searchQuery.trim() === '') {
            return [];
        }

        // Normalize phone number search for Sri Lankan numbers
        let phoneSearchPatterns: string[] = [];

        // Check if search query looks like a phone number (only digits)
        const isPhoneSearch = /^\d+$/.test(searchQuery.trim());

        if (isPhoneSearch) {
            const cleaned = searchQuery.trim();

            // Generate all possible phone number variations
            if (cleaned.startsWith('94')) {
                // Input: 94768689056 -> search for +94768689056, 0768689056, 768689056
                phoneSearchPatterns = [
                    `+${cleaned}`,
                    `0${cleaned.substring(2)}`,
                    cleaned.substring(2)
                ];
            } else if (cleaned.startsWith('0')) {
                // Input: 0768689056 -> search for +94768689056, 0768689056, 768689056
                phoneSearchPatterns = [
                    `+94${cleaned.substring(1)}`,
                    cleaned,
                    cleaned.substring(1)
                ];
            } else {
                // Input: 768689056 -> search for +94768689056, 0768689056, 768689056
                phoneSearchPatterns = [
                    `+94${cleaned}`,
                    `0${cleaned}`,
                    cleaned
                ];
            }
        }

        try {
            const organizationId = await getCurrentOrganizationId();
            // Build query
            let query = supabase
                .from('customers')
                .select(`
                    *,
                    invoices (
                        total,
                        created_at
                    )
                `)
                .eq('organization_id', organizationId);

            // Add search conditions
            if (isPhoneSearch && phoneSearchPatterns.length > 0) {
                // Use .in() to search for any of the phone number variations
                query = query.in('phone', phoneSearchPatterns);
            } else {
                // Name search (case-insensitive partial match)
                query = query.ilike('name', `%${searchQuery}%`);
            }

            const { data, error } = await query
                .order('name')
                .limit(10);

            if (error) {
                console.error('Customer search error:', error);
                throw error;
            }

            // Process data to get only the last invoice
            return data?.map(customer => ({
                ...customer,
                last_invoice: customer.invoices?.sort((a: any, b: any) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )[0]
            })) || [];
        } catch (error) {
            console.error('Error in searchCustomers:', error);
            return [];
        }
    },

    /**
     * Get all customers with pagination
     */
    async getCustomers(page = 0, limit = 50) {
        const from = page * limit;
        const to = from + limit - 1;
        const organizationId = await getCurrentOrganizationId();

        const { data, error, count } = await supabase
            .from('customers')
            .select('*', { count: 'exact' })
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;
        return { data, count };
    },

    /**
     * Get customer by ID with appointment history
     */
    async getCustomerById(id: string) {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('customers')
            .select(`
                *,
                appointments(*)
            `)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Get customer by phone number
     */
    async getCustomerByPhone(phone: string) {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('phone', phone)
            .eq('organization_id', organizationId)
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    /**
     * Create a new customer
     */
    async createCustomer(customer: {
        name: string;
        phone: string;
        email?: string;
        gender?: 'Male' | 'Female' | 'Other';
        preferences?: string;
    }) {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('customers')
            .insert({ ...customer, organization_id: organizationId })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update customer information
     */
    async updateCustomer(id: string, updates: Partial<Customer>) {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('customers')
            .update(updates)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Increment customer visit count and update last visit
     */
    async recordVisit(customerId: string, amount: number) {
        const organizationId = await getCurrentOrganizationId();
        const { data: customer } = await supabase
            .from('customers')
            .select('total_visits, total_spent')
            .eq('id', customerId)
            .eq('organization_id', organizationId)
            .single();

        if (customer) {
            const { error } = await supabase
                .from('customers')
                .update({
                    total_visits: customer.total_visits + 1,
                    total_spent: customer.total_spent + amount,
                    last_visit: new Date().toISOString()
                })
                .eq('id', customerId)
                .eq('organization_id', organizationId);

            if (error) throw error;
        }
    },

    /**
     * Delete a customer (and all related records)
     */
    async deleteCustomer(id: string) {
        const organizationId = await getCurrentOrganizationId();
        // Delete related campaign sends first (foreign key constraint)
        const { error: campaignSendsError } = await supabase
            .from('campaign_sends')
            .delete()
            .eq('customer_id', id)
            .eq('organization_id', organizationId);

        if (campaignSendsError) {
            console.error('Error deleting campaign sends:', campaignSendsError);
            // Continue anyway - customer might not have campaign sends
        }

        // Now delete the customer
        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id)
            .eq('organization_id', organizationId);

        if (error) {
            console.error('Supabase delete error:', error);
            throw new Error(error.message || 'Failed to delete customer. Please check if customer has related appointments or invoices.');
        }
        return true;
    }
};
