import { supabase } from '@/lib/supabase';
import { getCurrentOrganizationId } from '@/lib/org-scope';

interface CustomerSegment {
    id: string;
    name: string;
    description: string;
    color: string;
    icon: string;
    auto_criteria: any;
    is_active: boolean;
    customer_count: number;
}

interface ServiceCategoryCount {
    [category: string]: number;
}

export const segmentationService = {
    /**
     * Get all customer segments
     */
    async getSegments(): Promise<CustomerSegment[]> {
        try {
            const organizationId = await getCurrentOrganizationId();
            const { data, error } = await supabase
                .from('customer_segments')
                .select('*')
                .eq('organization_id', organizationId)
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching segments:', error);
            throw error;
        }
    },

    /**
     * Get customers by segment
     */
    async getCustomersBySegment(segmentName: string) {
        try {
            const organizationId = await getCurrentOrganizationId();
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('organization_id', organizationId)
                .contains('segment_tags', [segmentName])
                .order('name');

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching customers by segment:', error);
            throw error;
        }
    },

    /**
     * Analyze customer's service preferences
     */
    async analyzeCustomerServices(customerId: string): Promise<ServiceCategoryCount> {
        try {
            const organizationId = await getCurrentOrganizationId();
            // Get all appointments for this customer
            const { data: appointments, error: aptError } = await supabase
                .from('appointments')
                .select('services')
                .eq('organization_id', organizationId)
                .eq('customer_id', customerId)
                .eq('status', 'Completed');

            if (aptError) throw aptError;

            // Get all service IDs from appointments
            const serviceIds = new Set<string>();
            (appointments || []).forEach(apt => {
                if (apt.services && Array.isArray(apt.services)) {
                    apt.services.forEach(sid => serviceIds.add(sid));
                }
            });

            if (serviceIds.size === 0) return {};

            // Fetch service details to get categories
            const { data: services, error: svcError } = await supabase
                .from('services')
                .select('id, category')
                .eq('organization_id', organizationId)
                .in('id', Array.from(serviceIds));

            if (svcError) throw svcError;

            // Count by category
            const categoryCounts: ServiceCategoryCount = {};
            (services || []).forEach(service => {
                const category = service.category;
                categoryCounts[category] = (categoryCounts[category] || 0) + 1;
            });

            return categoryCounts;
        } catch (error) {
            console.error('Error analyzing customer services:', error);
            return {};
        }
    },

    /**
     * Auto-categorize a customer based on their history and gender
     */
    async categorizeCustomer(customerId: string): Promise<void> {
        try {
            const organizationId = await getCurrentOrganizationId();
            // Get customer info
            const { data: customer, error: custError } = await supabase
                .from('customers')
                .select('gender, total_visits')
                .eq('id', customerId)
                .eq('organization_id', organizationId)
                .single();

            if (custError) throw custError;

            const newTags: string[] = [];

            // Only categorize if customer has visits
            if (customer.total_visits > 0) {
                // Analyze service preferences
                const serviceCounts = await this.analyzeCustomerServices(customerId);

                // Get top 2 service categories
                const topCategories = Object.entries(serviceCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 2)
                    .map(([category]) => category);

                // Add service-based tags
                topCategories.forEach(category => {
                    const segmentName = `${category} Services`;
                    newTags.push(segmentName);
                });
            }

            // Add gender-based tag
            if (customer.gender) {
                newTags.push(`${customer.gender} Customers`);
            }

            // Update customer segments
            const { error: updateError } = await supabase
                .from('customers')
                .update({ segment_tags: newTags })
                .eq('id', customerId)
                .eq('organization_id', organizationId);

            if (updateError) throw updateError;

        } catch (error) {
            console.error('Error categorizing customer:', error);
            throw error;
        }
    },

    /**
     * Auto-categorize ALL customers
     */
    async categorizeAllCustomers(): Promise<void> {
        try {
            // First, ensure default segments exist
            await this.initializeSegments();

            const organizationId = await getCurrentOrganizationId();
            // Get all customers
            const { data: customers, error } = await supabase
                .from('customers')
                .select('id, name')
                .eq('organization_id', organizationId);

            if (error) throw error;

            // Process each customer
            let successCount = 0;
            for (const customer of customers || []) {
                try {
                    await this.categorizeCustomer(customer.id);
                    successCount++;
                } catch (err) {
                    console.error(`Failed to categorize customer ${customer.name}:`, err);
                }
            }

            // Manually refresh segment counts
            await this.refreshSegmentCounts();

        } catch (error) {
            console.error('Error categorizing all customers:', error);
            throw error;
        }
    },

    /**
     * Manually refresh segment counts
     */
    async refreshSegmentCounts(): Promise<void> {
        try {
            const organizationId = await getCurrentOrganizationId();
            // Get all segments
            const { data: segments, error: segError } = await supabase
                .from('customer_segments')
                .select('id, name')
                .eq('organization_id', organizationId);

            if (segError) throw segError;

            // Count customers for each segment
            for (const segment of segments || []) {
                // Query customers that have this segment in their tags
                const { data: customers, error: countError } = await supabase
                    .from('customers')
                    .select('id')
                    .eq('organization_id', organizationId)
                    .contains('segment_tags', [segment.name]);

                if (countError) {
                    console.error(`Error counting for segment ${segment.name}:`, countError);
                    continue;
                }

                const count = customers?.length || 0;

                // Update segment count
                await supabase
                    .from('customer_segments')
                    .update({ customer_count: count })
                    .eq('id', segment.id)
                    .eq('organization_id', organizationId);
            }
        } catch (error) {
            console.error('Error refreshing segment counts:', error);
        }
    },

    async getSegmentStats(): Promise<any[]> {
        try {
            // Refresh counts first
            await this.refreshSegmentCounts();

            const organizationId = await getCurrentOrganizationId();
            const { data, error } = await supabase
                .from('customer_segments')
                .select('*')
                .eq('organization_id', organizationId)
                .eq('is_active', true)
                .order('customer_count', { ascending: false });

            if (error) {
                console.error('❌ [SEGMENTATION] Database error:', error);
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error('❌ [SEGMENTATION] Error fetching segment stats:', error);
            throw error;
        }
    },

    /**
     * Initialize default segments
     */
    async initializeSegments(): Promise<void> {
        try {
            const organizationId = await getCurrentOrganizationId();
            const defaultSegments = [
                { name: 'Hair Services', description: 'Customers who frequently use hair services', color: '#ec4899', icon: 'scissors' },
                { name: 'Facial Services', description: 'Customers who prefer facial treatments', color: '#8b5cf6', icon: 'sparkles' },
                { name: 'Beard Services', description: 'Customers using beard grooming', color: '#f59e0b', icon: 'palette' },
                { name: 'Bridal Services', description: 'Customers booking bridal packages', color: '#f472b6', icon: 'crown' },
                { name: 'Kids Services', description: 'Parents booking for children', color: '#10b981', icon: 'user-plus' },
                { name: 'Spa Services', description: 'Customers enjoying spa treatments', color: '#06b6d4', icon: 'sparkles' },
                { name: 'Male Customers', description: 'Male clientele', color: '#3b82f6', icon: 'users' },
                { name: 'Female Customers', description: 'Female clientele', color: '#ec4899', icon: 'users' },
            ];

            for (const segment of defaultSegments) {
                // Check if exists
                const { data: existing } = await supabase
                    .from('customer_segments')
                    .select('id')
                    .eq('organization_id', organizationId)
                    .eq('name', segment.name)
                    .maybeSingle();

                if (!existing) {
                    await supabase
                        .from('customer_segments')
                        .insert({
                            ...segment,
                            is_active: true,
                            customer_count: 0,
                            organization_id: organizationId,
                        });
                }
            }
        } catch (error) {
            console.error('Error initializing segments:', error);
        }
    },

    /**
     * Manually add customer to segment
     */
    async addCustomerToSegment(customerId: string, segmentName: string): Promise<void> {
        try {
            const organizationId = await getCurrentOrganizationId();
            // Get current segments
            const { data: customer } = await supabase
                .from('customers')
                .select('segment_tags')
                .eq('id', customerId)
                .eq('organization_id', organizationId)
                .single();

            const currentTags = customer?.segment_tags || [];

            if (!currentTags.includes(segmentName)) {
                const newTags = [...currentTags, segmentName];

                const { error } = await supabase
                    .from('customers')
                    .update({ segment_tags: newTags })
                    .eq('id', customerId)
                    .eq('organization_id', organizationId);

                if (error) throw error;
            }
        } catch (error) {
            console.error('Error adding customer to segment:', error);
            throw error;
        }
    },

    /**
     * Remove customer from segment
     */
    async removeCustomerFromSegment(customerId: string, segmentName: string): Promise<void> {
        try {
            const organizationId = await getCurrentOrganizationId();
            const { data: customer } = await supabase
                .from('customers')
                .select('segment_tags')
                .eq('id', customerId)
                .eq('organization_id', organizationId)
                .single();

            const currentTags = customer?.segment_tags || [];
            const newTags = currentTags.filter((tag: string) => tag !== segmentName);

            const { error } = await supabase
                .from('customers')
                .update({ segment_tags: newTags })
                .eq('id', customerId)
                .eq('organization_id', organizationId);

            if (error) throw error;
        } catch (error) {
            console.error('Error removing customer from segment:', error);
            throw error;
        }
    }
};
