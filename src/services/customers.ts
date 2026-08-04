import { supabase } from '@/lib/supabase';
import { getCurrentOrganizationId } from '@/lib/org-scope';
import { isValidDateOfBirth } from '@/lib/birthday';

async function withInvoiceVisitStats(customers: any[], organizationId: string) {
    if (customers.length === 0) return customers;

    const customerIds = [...new Set(customers.map(customer => customer.id))];
    const { data, error } = await supabase.rpc('get_customer_invoice_stats', {
        p_organization_id: organizationId,
        p_customer_ids: customerIds,
    });

    if (error) throw error;

    const statsByCustomer = new Map(
        (data || []).map(stats => [stats.customer_id, stats])
    );

    return customers.map(customer => {
        const stats = statsByCustomer.get(customer.id);
        return {
            ...customer,
            total_visits: stats ? Number(stats.total_visits) : 0,
            last_visit: stats?.last_visit || null,
            last_services: stats?.last_services || 'None',
        };
    });
}

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
                .select('*')
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
                .limit(200);

            if (error) {
                console.error('Customer search error:', error);
                throw error;
            }

            return withInvoiceVisitStats(data || [], organizationId);
        } catch (error) {
            console.error('Error in searchCustomers:', error);
            return [];
        }
    },

    /**
     * Get all customers with pagination
     */
    async getCustomers(page = 0, limit = 200) {
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
        const customers = await withInvoiceVisitStats(data || [], organizationId);
        return { data: customers, count };
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
        dateOfBirth: string;
    }) {
        if (!isValidDateOfBirth(customer.dateOfBirth)) {
            throw new Error('Enter a valid date of birth that is not in the future');
        }

        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('customers')
            .insert({
                name: customer.name,
                phone: customer.phone,
                email: customer.email || null,
                gender: customer.gender || null,
                preferences: customer.preferences || null,
                date_of_birth: customer.dateOfBirth,
                organization_id: organizationId,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update customer information
     */
    async updateCustomer(id: string, updates: {
        name?: string;
        phone?: string;
        email?: string;
        gender?: 'Male' | 'Female' | 'Other';
        preferences?: string;
        dateOfBirth?: string;
    }) {
        if (updates.dateOfBirth && !isValidDateOfBirth(updates.dateOfBirth)) {
            throw new Error('Enter a valid date of birth that is not in the future');
        }

        const organizationId = await getCurrentOrganizationId();
        const rowUpdates: Record<string, string | null | undefined> = {};
        if ('name' in updates) rowUpdates.name = updates.name;
        if ('phone' in updates) rowUpdates.phone = updates.phone;
        if ('email' in updates) rowUpdates.email = updates.email || null;
        if ('gender' in updates) rowUpdates.gender = updates.gender;
        if ('preferences' in updates) rowUpdates.preferences = updates.preferences || null;
        if ('dateOfBirth' in updates) rowUpdates.date_of_birth = updates.dateOfBirth || null;
        const { data, error } = await supabase
            .from('customers')
            .update(rowUpdates)
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

        // Check for existing appointments before attempting delete
        const { count: apptCount } = await supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('customer_id', id)
            .eq('organization_id', organizationId);

        if (apptCount && apptCount > 0) {
            throw new Error(`Cannot delete this customer because they have ${apptCount} appointment${apptCount > 1 ? 's' : ''} on record. Please delete or reassign the appointments first.`);
        }

        // Delete related campaign sends first (foreign key constraint)
        await supabase
            .from('campaign_sends')
            .delete()
            .eq('customer_id', id)
            .eq('organization_id', organizationId);

        // Now delete the customer
        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id)
            .eq('organization_id', organizationId);

        if (error) {
            console.error('Supabase delete error:', error);
            throw new Error('Failed to delete customer. They may have related records that must be removed first.');
        }
        return true;
    }
};
