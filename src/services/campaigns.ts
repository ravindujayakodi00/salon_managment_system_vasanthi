import { supabase } from '@/lib/supabase';
import { notificationsService } from './notifications';
import { getCurrentOrganizationId } from '@/lib/org-scope';
import { SALON_NAME } from '@/config/salon';

interface Campaign {
    id: string;
    name: string;
    description?: string;
    template_id?: string;
    custom_message?: string;
    custom_subject?: string;
    target_segments: string[];
    target_all_customers: boolean;
    scheduled_for?: string;
    status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled' | 'failed';
    channel: 'sms' | 'email' | 'both';
    target_count: number;
    sent_count: number;
    delivered_count: number;
    failed_count: number;
    estimated_cost: number;
    actual_cost: number;
    created_at: string;
    sent_at?: string;
    completed_at?: string;
}

export const campaignService = {
    /**
     * Get all campaigns
     */
    async getCampaigns(scopedOrganizationId?: string) {
        try {
            const organizationId = scopedOrganizationId || await getCurrentOrganizationId();
            // First, try fetching campaigns without the join
            const { data, error } = await supabase
                .from('campaigns')
                .select('*')
                .eq('organization_id', organizationId)
                .order('created_at', { ascending: false })
                .limit(500);

            if (error) {
                console.error('Supabase error fetching campaigns:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code,
                    fullError: error
                });
                throw error;
            }



            // If campaigns have template_ids, try to fetch template details
            if (data && data.length > 0) {
                const templateIds = data
                    .map(c => c.template_id)
                    .filter(Boolean);

                if (templateIds.length > 0) {
                    try {
                        const { data: templates } = await supabase
                            .from('notification_templates')
                            .select('id, name, message')
                            .eq('organization_id', organizationId)
                            .in('id', templateIds);

                        if (templates) {
                            // Attach template data to campaigns
                            const templatesMap = new Map(templates.map(t => [t.id, t]));
                            data.forEach(campaign => {
                                if (campaign.template_id) {
                                    campaign.notification_templates = templatesMap.get(campaign.template_id);
                                }
                            });
                        }
                    } catch (templateError) {
                        // If templates can't be fetched, just continue without them
                        console.warn('Could not fetch notification templates:', templateError);
                    }
                }
            }

            return data || [];
        } catch (error: any) {
            console.error('Error fetching campaigns:', {
                message: error?.message || 'Unknown error',
                details: error?.details || 'No details available',
                hint: error?.hint || 'No hint available',
                code: error?.code || 'No code available',
                errorType: typeof error,
                errorConstructor: error?.constructor?.name,
                fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
            });
            throw error;
        }
    },

    /**
     * Get campaign by ID
     */
    async getCampaignById(id: string) {
        try {
            const organizationId = await getCurrentOrganizationId();
            // Fetch campaign without joins first
            const { data, error } = await supabase
                .from('campaigns')
                .select('*')
                .eq('id', id)
                .eq('organization_id', organizationId)
                .single();

            if (error) throw error;

            if (data) {
                // Try to fetch related data separately
                try {
                    if (data.template_id) {
                        const { data: template } = await supabase
                            .from('notification_templates')
                            .select('*')
                            .eq('id', data.template_id)
                            .eq('organization_id', organizationId)
                            .single();

                        if (template) {
                            data.notification_templates = template;
                        }
                    }

                    const { data: sends } = await supabase
                        .from('campaign_sends')
                        .select('*')
                        .eq('campaign_id', id)
                        .eq('organization_id', organizationId);

                    if (sends) {
                        data.campaign_sends = sends;
                    }
                } catch (relatedError) {
                    console.warn('Could not fetch related campaign data:', relatedError);
                }
            }

            return data;
        } catch (error: any) {
            console.error('Error fetching campaign:', {
                message: error?.message || 'Unknown error',
                details: error?.details || 'No details available',
                hint: error?.hint || 'No hint available',
                code: error?.code || 'No code available',
                errorType: typeof error,
                errorConstructor: error?.constructor?.name,
                fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
            });
            throw error;
        }
    },

    /**
     * Preview audience for selected segments
     */
    async previewAudience(
        segments: string[],
        channel: 'sms' | 'email' | 'both',
        targetAllCustomers = false,
        scopedOrganizationId?: string
    ) {
        try {
            if (!targetAllCustomers && (!segments || segments.length === 0)) {
                return { count: 0, estimatedCost: 0, customers: [] };
            }

            const organizationId = scopedOrganizationId || await getCurrentOrganizationId();
            const customers: any[] = [];
            const pageSize = 1000;
            if (targetAllCustomers) {
                let from = 0;
                while (true) {
                    const { data, error } = await supabase
                        .from('customers')
                        .select('id, name, email, phone')
                        .eq('organization_id', organizationId)
                        .eq('is_active', true)
                        .order('id')
                        .range(from, from + pageSize - 1);

                    if (error) throw error;
                    customers.push(...(data || []));
                    if (!data || data.length < pageSize) break;
                    from += pageSize;
                }
            } else {
                const { data: selectedSegments, error: segmentError } = await supabase
                    .from('customer_segments')
                    .select('id')
                    .eq('organization_id', organizationId)
                    .eq('is_active', true)
                    .in('name', segments);

                if (segmentError) throw segmentError;
                const segmentIds = (selectedSegments || []).map(segment => segment.id);
                if (segmentIds.length === 0) {
                    return { count: 0, estimatedCost: 0, customers: [] };
                }

                const customerIds = new Set<string>();
                let mappingFrom = 0;
                while (true) {
                    const { data: mappings, error: mappingError } = await supabase
                        .from('customer_customer_segments_mapping')
                        .select('customer_id')
                        .eq('organization_id', organizationId)
                        .in('segment_id', segmentIds)
                        .order('id')
                        .range(mappingFrom, mappingFrom + pageSize - 1);

                    if (mappingError) throw mappingError;
                    (mappings || []).forEach(mapping => customerIds.add(mapping.customer_id));
                    if (!mappings || mappings.length < pageSize) break;
                    mappingFrom += pageSize;
                }

                const ids = Array.from(customerIds);
                for (let index = 0; index < ids.length; index += 500) {
                    const { data, error } = await supabase
                        .from('customers')
                        .select('id, name, email, phone')
                        .eq('organization_id', organizationId)
                        .eq('is_active', true)
                        .in('id', ids.slice(index, index + 500));

                    if (error) throw error;
                    customers.push(...(data || []));
                }
            }

            // Filter by channel availability
            let filteredCustomers = customers || [];

            if (channel === 'email') {
                filteredCustomers = filteredCustomers.filter(c => c.email);
            } else if (channel === 'sms') {
                filteredCustomers = filteredCustomers.filter(c => c.phone);
            } else if (channel === 'both') {
                filteredCustomers = filteredCustomers.filter(c => c.email || c.phone);
            }

            const count = filteredCustomers.length;
            const costPerMessage = 2; // LKR per SMS/Email
            const estimatedCost = count * costPerMessage;

            return {
                count,
                estimatedCost,
                customers: filteredCustomers
            };
        } catch (error) {
            console.error('Error previewing audience:', error);

            throw error;
        }
    },

    /**
     * Create new campaign
     */
    async createCampaign(campaign: {
        name: string;
        description?: string;
        template_id?: string;
        custom_message?: string;
        custom_subject?: string;
        target_segments: string[];
        target_all_customers: boolean;
        scheduled_for?: string;
        channel: 'sms' | 'email' | 'both';
    }, context?: {
        organizationId?: string;
        createdBy?: string;
        audienceSummary?: { count: number; estimatedCost: number };
    }) {
        try {
            if (!campaign.template_id && !campaign.custom_message?.trim()) {
                throw new Error('Select a notification template or enter a custom message');
            }

            const organizationId = context?.organizationId || await getCurrentOrganizationId();
            let createdBy = context?.createdBy;
            if (!createdBy) {
                const { data: { user } } = await supabase.auth.getUser();
                createdBy = user?.id;
            }

            const preview = context?.audienceSummary || await this.previewAudience(
                campaign.target_segments,
                campaign.channel,
                campaign.target_all_customers,
                organizationId
            );

            const { data, error } = await supabase
                .from('campaigns')
                .insert({
                    ...campaign,
                    status: campaign.scheduled_for ? 'scheduled' : 'draft',
                    target_count: preview.count,
                    estimated_cost: preview.estimatedCost,
                    created_by: createdBy,
                    organization_id: organizationId,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error: any) {
            console.error('Error creating campaign:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            throw error;
        }
    },

    /**
     * Update campaign
     */
    async updateCampaign(id: string, updates: Partial<Campaign>, scopedOrganizationId?: string) {
        try {
            const organizationId = scopedOrganizationId || await getCurrentOrganizationId();
            const { data, error } = await supabase
                .from('campaigns')
                .update(updates)
                .eq('id', id)
                .eq('organization_id', organizationId)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error: any) {
            console.error('Error updating campaign:', {
                message: error?.message || 'Unknown error',
                details: error?.details || 'No details available',
                hint: error?.hint || 'No hint available',
                code: error?.code || 'No code available',
                errorType: typeof error,
                errorConstructor: error?.constructor?.name,
                fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
            });
            throw error;
        }
    },

    /**
     * Delete campaign
     */
    async deleteCampaign(id: string) {
        try {
            const organizationId = await getCurrentOrganizationId();
            const { error } = await supabase
                .from('campaigns')
                .delete()
                .eq('id', id)
                .eq('organization_id', organizationId);

            if (error) throw error;
        } catch (error) {
            console.error('Error deleting campaign:', error);
            throw error;
        }
    },

    /**
     * Send campaign immediately
     */
    async sendCampaignNow(
        campaignId: string,
        scopedOrganizationId?: string,
        resolvedCustomers?: Array<{ id: string; name: string; email?: string | null; phone?: string | null }>
    ) {
        let campaignClaimed = false;
        const orgId = scopedOrganizationId || await getCurrentOrganizationId();

        try {
            const { data: campaign, error: claimError } = await supabase
                .from('campaigns')
                .update({ status: 'sending', sent_at: new Date().toISOString() })
                .eq('id', campaignId)
                .eq('organization_id', orgId)
                .in('status', ['draft', 'scheduled', 'failed'])
                .select('*')
                .maybeSingle();

            if (claimError) throw claimError;
            if (!campaign) {
                throw new Error('Campaign is already sending or has already been completed');
            }
            campaignClaimed = true;

            let template: { message: string; subject?: string | null } | null = null;

            if (campaign.template_id) {
                const { data, error } = await supabase
                    .from('notification_templates')
                    .select('message, subject')
                    .eq('id', campaign.template_id)
                    .eq('organization_id', orgId)
                    .single();

                if (error || !data) {
                    throw new Error('Template not found for this campaign');
                }
                template = data;
            }

            const messageTemplate = campaign.custom_message?.trim() || template?.message;
            const subjectTemplate = campaign.custom_subject?.trim() || template?.subject || campaign.name;
            if (!messageTemplate) throw new Error('Campaign message is empty');

            const customers = resolvedCustomers || (await this.previewAudience(
                campaign.target_segments,
                campaign.channel,
                campaign.target_all_customers,
                orgId
            )).customers;



            let sent_count = 0;
            let failed_count = 0;

            // Send to each customer
            for (const customer of customers) {
                try {
                    const variables = {
                        customer_name: customer.name,
                        date: new Date().toLocaleDateString(),
                        time: new Date().toLocaleTimeString(),
                        salon_name: SALON_NAME
                    };
                    const message = notificationsService.replaceVariables(messageTemplate, variables);
                    const subject = notificationsService.replaceVariables(subjectTemplate, variables);

                    // Create campaign send record
                    const { data: sendRecord, error: insertError } = await supabase
                        .from('campaign_sends')
                        .insert({
                            campaign_id: campaignId,
                            customer_id: customer.id,
                            channel: campaign.channel,
                            message_content: message,
                            status: 'pending',
                            organization_id: campaign.organization_id,
                        })
                        .select()
                        .single();

                    if (insertError) {
                        console.error('Failed to create send record:', insertError);
                        failed_count++;
                        continue;
                    }

                    const deliveryResults: Array<{ success: boolean; error?: string }> = [];

                    if ((campaign.channel === 'sms' || campaign.channel === 'both') && customer.phone) {
                        deliveryResults.push(await notificationsService.sendSMS(customer.phone, message));
                    }
                    if ((campaign.channel === 'email' || campaign.channel === 'both') && customer.email) {
                        deliveryResults.push(await notificationsService.sendEmail(customer.email, subject, message));
                    }

                    if (deliveryResults.length === 0) {
                        throw new Error('Customer has no contact details for the selected channel');
                    }

                    const failedDelivery = deliveryResults.find(result => !result.success);
                    if (failedDelivery) {
                        throw new Error(failedDelivery.error || 'Message delivery failed');
                    }

                    // Update send record as sent
                    await supabase
                        .from('campaign_sends')
                        .update({
                            status: 'sent',
                            sent_at: new Date().toISOString()
                        })
                        .eq('id', sendRecord.id)
                        .eq('organization_id', orgId);

                    sent_count++;


                } catch (error) {
                    console.error(`❌ Failed to send to customer ${customer.name}:`, error);
                    failed_count++;

                    // Record failure if sendRecord was created
                    await supabase
                        .from('campaign_sends')
                        .update({
                            status: 'failed',
                            error_message: error instanceof Error ? error.message : 'Unknown error'
                        })
                        .eq('campaign_id', campaignId)
                        .eq('customer_id', customer.id)
                        .eq('organization_id', orgId);
                }
            }

            // Update campaign status and counts
            await this.updateCampaign(campaignId, {
                status: 'completed',
                completed_at: new Date().toISOString(),
                sent_count,
                failed_count
            }, orgId);



            return { success: true, sent_count, failed_count };
        } catch (error: any) {
            console.error('❌ Error sending campaign:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });

            if (campaignClaimed) {
                await this.updateCampaign(campaignId, { status: 'failed' }, orgId);
            }

            throw error;
        }
    },

    /**
     * Cancel scheduled campaign
     */
    async cancelCampaign(id: string) {
        try {
            const organizationId = await getCurrentOrganizationId();
            const { data, error } = await supabase
                .from('campaigns')
                .update({ status: 'cancelled' })
                .eq('id', id)
                .eq('organization_id', organizationId)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error cancelling campaign:', error);
            throw error;
        }
    }
};
