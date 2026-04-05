import { supabase } from '@/lib/supabase';
import { notificationsService } from './notifications';
import { segmentationService } from './segmentation';

interface Campaign {
    id: string;
    name: string;
    description?: string;
    template_id: string;
    target_segments: string[];
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
    async getCampaigns() {
        try {
            // First, try fetching campaigns without the join
            const { data, error } = await supabase
                .from('campaigns')
                .select('*')
                .order('created_at', { ascending: false });

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
            // Fetch campaign without joins first
            const { data, error } = await supabase
                .from('campaigns')
                .select('*')
                .eq('id', id)
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
                            .single();

                        if (template) {
                            data.notification_templates = template;
                        }
                    }

                    const { data: sends } = await supabase
                        .from('campaign_sends')
                        .select('*')
                        .eq('campaign_id', id);

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
    async previewAudience(segments: string[], channel: 'sms' | 'email' | 'both') {
        try {
            if (!segments || segments.length === 0) {
                return { count: 0, estimatedCost: 0, customers: [] };
            }

            // Get customers that match any of the selected segments
            const { data: customers, error } = await supabase
                .from('customers')
                .select('id, name, email, phone, segment_tags')
                .overlaps('segment_tags', segments)
                .eq('is_active', true);

            if (error) throw error;

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
        template_id: string;
        target_segments: string[];
        scheduled_for?: string;
        channel: 'sms' | 'email' | 'both';
    }) {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Get audience preview for stats
            const preview = await this.previewAudience(campaign.target_segments, campaign.channel);

            const { data, error } = await supabase
                .from('campaigns')
                .insert({
                    ...campaign,
                    status: campaign.scheduled_for ? 'scheduled' : 'draft',
                    target_count: preview.count,
                    estimated_cost: preview.estimatedCost,
                    created_by: user?.id
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
    async updateCampaign(id: string, updates: Partial<Campaign>) {
        try {
            const { data, error } = await supabase
                .from('campaigns')
                .update(updates)
                .eq('id', id)
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
            const { error } = await supabase
                .from('campaigns')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error deleting campaign:', error);
            throw error;
        }
    },

    /**
     * Send campaign immediately
     */
    async sendCampaignNow(campaignId: string) {
        try {
            // Get campaign details
            const campaign = await this.getCampaignById(campaignId);
            if (!campaign) throw new Error('Campaign not found');

            // Get template details
            const { data: template, error: templateError } = await supabase
                .from('notification_templates')
                .select('*')
                .eq('id', campaign.template_id)
                .single();

            if (templateError || !template) {
                throw new Error('Template not found for this campaign');
            }

            // Update status to sending
            await this.updateCampaign(campaignId, { status: 'sending', sent_at: new Date().toISOString() });

            // Get target customers
            const { customers } = await this.previewAudience(campaign.target_segments, campaign.channel);



            let sent_count = 0;
            let failed_count = 0;

            // Send to each customer
            for (const customer of customers) {
                try {
                    // Create campaign send record
                    const { data: sendRecord, error: insertError } = await supabase
                        .from('campaign_sends')
                        .insert({
                            campaign_id: campaignId,
                            customer_id: customer.id,
                            channel: campaign.channel,
                            message_content: template.message,
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

                    // Send notification using template type


                    const result = await notificationsService.sendNotification(
                        customer.id,
                        template.type, // Use template type here
                        {
                            customer_name: customer.name,
                            date: new Date().toLocaleDateString(),
                            time: new Date().toLocaleTimeString()
                        }
                    );

                    // Update send record as sent
                    await supabase
                        .from('campaign_sends')
                        .update({
                            status: 'sent',
                            sent_at: new Date().toISOString()
                        })
                        .eq('id', sendRecord.id);

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
                        .eq('customer_id', customer.id);
                }
            }

            // Update campaign status and counts
            await this.updateCampaign(campaignId, {
                status: 'completed',
                completed_at: new Date().toISOString(),
                sent_count,
                failed_count
            });



            return { success: true, sent_count, failed_count };
        } catch (error: any) {
            console.error('❌ Error sending campaign:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });

            // Update campaign status to failed
            await this.updateCampaign(campaignId, { status: 'failed' });

            throw error;
        }
    },

    /**
     * Cancel scheduled campaign
     */
    async cancelCampaign(id: string) {
        try {
            const { data, error } = await supabase
                .from('campaigns')
                .update({ status: 'cancelled' })
                .eq('id', id)
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
