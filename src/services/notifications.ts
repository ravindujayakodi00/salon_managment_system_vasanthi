import { supabase } from '@/lib/supabase';


interface NotificationTemplate {
    id: string;
    name: string;
    type: 'appointment_confirmation' | 'appointment_reminder' | 'appointment_cancellation' | 'promotional';
    channel: 'sms' | 'email' | 'whatsapp' | 'both';
    subject?: string;
    message: string;
    whatsapp_template_name?: string;
    is_active: boolean;
    organization_id?: string;
}

interface TemplateVariables {
    customer_name?: string;
    date?: string;
    time?: string;
    service?: string;
    stylist?: string;
    [key: string]: string | undefined;
}

// Resend is now handled in the API route /api/send-email

export const notificationsService = {
    /**
     * Get all notification templates
     */
    async getTemplates(organizationId?: string) {
        try {
            let q = supabase.from('notification_templates').select('*').order('type');
            if (organizationId) {
                q = q.eq('organization_id', organizationId);
            }
            const { data, error } = await q;

            if (error) throw error;
            return data as NotificationTemplate[];
        } catch (error) {
            console.error('Error fetching templates:', error);
            throw error;
        }
    },

    /**
     * Get template by type (scoped to organization when organizationId is provided)
     */
    async getTemplateByType(type: string, organizationId?: string | null) {
        try {
            let q = supabase
                .from('notification_templates')
                .select('*')
                .eq('type', type)
                .eq('is_active', true);
            if (organizationId) {
                q = q.eq('organization_id', organizationId);
            }
            const { data, error } = await q.single();

            if (error) {
                // PGRST116 = no rows returned (template not found)
                if (error.code === 'PGRST116') {
                    console.warn(`No active template found for type: ${type}`);
                    return null;
                }
                console.error('Supabase error fetching template:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                return null; // Return null instead of throwing
            }
            return data as NotificationTemplate;
        } catch (error: any) {
            console.error('Error fetching template:', error.message || error);
            return null; // Return null instead of throwing
        }
    },

    /**
     * Create new template
     */
    async createTemplate(
        template: Omit<NotificationTemplate, 'id' | 'organization_id'> & { organization_id: string }
    ) {
        try {
            const { data, error } = await supabase
                .from('notification_templates')
                .insert(template)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating template:', error);
            throw error;
        }
    },

    /**
     * Update template
     */
    async updateTemplate(id: string, updates: Partial<NotificationTemplate>) {
        try {
            const { data, error } = await supabase
                .from('notification_templates')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating template:', error);
            throw error;
        }
    },

    /**
     * Delete template
     */
    async deleteTemplate(id: string) {
        try {
            const { error } = await supabase
                .from('notification_templates')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error deleting template:', error);
            throw error;
        }
    },

    /**
     * Replace variables in template message
     */
    replaceVariables(message: string, variables: TemplateVariables): string {
        let result = message;

        Object.entries(variables).forEach(([key, value]) => {
            if (value) {
                const placeholder = `{${key}}`;
                result = result.replace(new RegExp(placeholder, 'g'), value);
            }
        });

        return result;
    },

    /**
     * Preview template with variables
     */
    async previewTemplate(templateId: string, variables: TemplateVariables) {
        try {
            const { data: template, error } = await supabase
                .from('notification_templates')
                .select('*')
                .eq('id', templateId)
                .single();

            if (error) throw error;

            return {
                subject: template.subject ? this.replaceVariables(template.subject, variables) : undefined,
                message: this.replaceVariables(template.message, variables)
            };
        } catch (error) {
            console.error('Error previewing template:', error);
            throw error;
        }
    },

    /**
     * Send email using Resend (ACTUALLY SENDS)
     */
    /**
     * Send email using the API route (works from client & server)
     */
    async sendEmail(to: string, subject: string, message: string) {
        try {
            // Get base URL for server-side calls
            let apiUrl = '/api/send-email';
            if (typeof window === 'undefined') {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
                apiUrl = `${baseUrl}/api/send-email`;
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to,
                    subject,
                    html: `<p>${message.replace(/\n/g, '<br>')}</p>`
                }),
            });

            const result = await response.json();

            if (!result.success) {
                console.error('❌ Email send failed:', result.error);
                throw new Error(result.error);
            }


            return { success: true, data: result.data };
        } catch (error: any) {
            console.error('Error sending email:', error);
            // Fallback for logging if fetch fails (e.g. network error)
            return { success: false, error: error.message || 'Failed to send email' };
        }
    },

    /**
     * Get base URL for API calls (works in both development and production)
     */
    getBaseUrl(): string {
        // Server-side: use environment variable
        if (typeof window === 'undefined') {
            return process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : 'http://localhost:3000';
        }
        // Client-side: use window location
        return window.location.origin;
    },

    /**
     * Send SMS using Text.lk - uses direct service call for server, API route for client
     */
    async sendSMS(to: string, message: string) {
        try {
            // Use direct TextLK service for server-side (more reliable in production)
            if (typeof window === 'undefined') {
                // Server-side: directly use TextLK service
                const { createTextLkService } = await import('./textlk');

                const apiKey = process.env.TEXT_LK_API_KEY;
                const senderId = process.env.TEXT_LK_SENDER_ID;

                if (!apiKey || !senderId) {
                    console.error('❌ SMS config missing: TEXTLK_API_KEY or TEXTLK_SENDER_ID not set');
                    return { success: false, error: 'SMS service not configured' };
                }

                const textlk = createTextLkService(apiKey, senderId);
                const result = await textlk.sendSMS(to, message);

                if (result.status === 'error') {
                    return { success: false, error: result.message };
                }

                return { success: true, data: result.data };
            }

            // Client-side: use API route
            const response = await fetch('/api/send-sms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to,
                    message
                }),
            });

            const result = await response.json();

            if (!result.success) {
                console.error('❌ SMS send failed:', result.error);
                throw new Error(result.error);
            }


            return { success: true, data: result.data };
        } catch (error: any) {
            console.error('Error sending SMS:', error);
            // Return error instead of throwing to allow notification to continue
            return { success: false, error: error.message || 'Failed to send SMS' };
        }
    },

    /**
     * Send notification using template
     */
    async sendNotification(
        customerId: string,
        templateType: string,
        variables: TemplateVariables
    ) {
        try {
            // Get customer details
            const { data: customer, error: customerError } = await supabase
                .from('customers')
                .select('email, phone, name, organization_id')
                .eq('id', customerId)
                .single();

            if (customerError) {
                console.error('Supabase error fetching customer:', {
                    message: customerError.message,
                    details: customerError.details,
                    code: customerError.code
                });
                throw new Error(`Failed to fetch customer: ${customerError.message}`);
            }
            if (!customer) throw new Error('Customer not found');

            // Get template (tenant-scoped via customer's organization)
            const template = await this.getTemplateByType(
                templateType,
                (customer as { organization_id?: string }).organization_id
            );
            if (!template) {
                console.warn(`Template not found for type: ${templateType}. Skipping notification.`);
                return {
                    success: false,
                    message: `Template not found: ${templateType}`,
                    results: { email: null, sms: null, whatsapp: null }
                };
            }

            // Replace variables
            const message = this.replaceVariables(template.message, variables);
            const subject = template.subject
                ? this.replaceVariables(template.subject, variables)
                : 'Notification from SalonFlow';

            const results: any = {
                email: null,
                sms: null,
                whatsapp: null
            };

            // Send based on channel
            if (template.channel === 'email' || template.channel === 'both') {
                if (customer.email) {
                    try {
                        results.email = await this.sendEmail(customer.email, subject, message);
                    } catch (error: any) {
                        console.error('Email send failed:', error.message || error);
                        results.email = { success: false, error: error.message || 'Email send failed' };
                    }
                }
            }

            if (template.channel === 'whatsapp') {
                if (customer.phone) {
                    try {
                        const { whatsappService } = await import('./whatsapp');

                        // If it's a template message (required for business-initiated)
                        if (template.whatsapp_template_name) {
                            // Map variables to components based on your template structure
                            // This is a simplified example - you might need more complex mapping logic
                            const components = [
                                {
                                    type: 'body',
                                    parameters: Object.values(variables).map(value => ({
                                        type: 'text',
                                        text: value || ''
                                    }))
                                }
                            ];

                            results.whatsapp = await whatsappService.sendTemplate(
                                customer.phone,
                                template.whatsapp_template_name,
                                'en_US',
                                components
                            );
                        } else {
                            // Fallback to text message (only works within 24h window)
                            results.whatsapp = await whatsappService.sendText(customer.phone, message);
                        }
                    } catch (error: any) {
                        console.error('WhatsApp send failed:', error.message || error);
                        results.whatsapp = { success: false, error: error.message || 'WhatsApp send failed' };
                    }
                }
            }

            if (template.channel === 'sms' || template.channel === 'both') {
                if (customer.phone) {
                    try {
                        results.sms = await this.sendSMS(customer.phone, message);
                    } catch (error: any) {
                        console.error('SMS send failed:', error.message || error);
                        results.sms = { success: false, error: error.message || 'SMS send failed' };
                    }
                }
            }

            return {
                success: true,
                message: 'Notification sent',
                results
            };
        } catch (error: any) {
            console.error('Error sending notification:', error.message || error);
            throw error;
        }
    },

    /**
     * Send batched notifications for multiple appointments created together
     * Reduces SMS cost by sending one message per recipient instead of multiple
     */
    async sendBatchedAppointmentNotifications(
        appointments: any[],
        type: 'created' | 'updated' = 'created'
    ) {
        try {
            if (appointments.length === 0) return { success: true, message: 'No appointments to notify' };

            // If only one appointment, use regular notification
            if (appointments.length === 1) {
                console.log('Single appointment - using regular notification');
                return { success: true, message: 'Use regular notification for single appointment' };
            }

            const results: any = {
                customer: null,
                stylists: {},
                manager: null
            };

            // Get customer details (all appointments should have same customer)
            const customerId = appointments[0].customer_id;
            const { data: customer } = await supabase
                .from('customers')
                .select('name, phone, email')
                .eq('id', customerId)
                .single();

            if (!customer) {
                throw new Error('Customer not found');
            }

            // Send batched customer notification
            if (customer.phone) {
                const actionWord = type === 'created' ? 'booked' : 'updated';
                let message = `Hi ${customer.name}, you have ${appointments.length} appointments ${actionWord}:\n`;

                appointments.forEach((apt, index) => {
                    const aptDate = new Date(apt.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    message += `${index + 1}. ${apt.service_name} - ${aptDate}, ${apt.start_time}`;
                    if (apt.stylist_name) {
                        message += ` with ${apt.stylist_name}`;
                    }
                    message += '\n';
                });

                const totalPrice = appointments.reduce((sum, apt) => sum + (apt.service_price || 0), 0);
                message += `\nTotal: Rs ${totalPrice.toLocaleString()}\nSee you soon!`;

                try {
                    results.customer = await this.sendSMS(customer.phone, message);
                } catch (error) {
                    console.error('Failed to send customer SMS:', error);
                }
            }

            // Group appointments by stylist and send batched notifications
            const appointmentsByStylist = appointments.reduce((acc: any, apt) => {
                if (apt.stylist_id) {
                    if (!acc[apt.stylist_id]) {
                        acc[apt.stylist_id] = {
                            stylist_id: apt.stylist_id,
                            stylist_name: apt.stylist_name,
                            stylist_phone: apt.stylist_phone,
                            appointments: []
                        };
                    }
                    acc[apt.stylist_id].appointments.push(apt);
                }
                return acc;
            }, {});

            // Send notification to each stylist
            for (const [stylistId, data] of Object.entries(appointmentsByStylist) as [string, any][]) {
                if (data.stylist_phone) {
                    const actionWord = type === 'created' ? 'new' : 'updated';
                    let message = `You have ${data.appointments.length} ${actionWord} appointments:\n`;

                    data.appointments.forEach((apt: any, index: number) => {
                        const aptDate = new Date(apt.appointment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        message += `${index + 1}. ${apt.service_name} for ${customer.name} - ${aptDate}, ${apt.start_time}\n`;
                    });

                    try {
                        results.stylists[stylistId] = await this.sendSMS(data.stylist_phone, message);
                    } catch (error) {
                        console.error(`Failed to send stylist SMS to ${data.stylist_name}:`, error);
                    }
                }
            }

            // Send batched manager notification (if there's a branch manager)
            const branchId = appointments[0].branch_id;
            if (branchId) {
                const { data: managers } = await supabase
                    .from('staff')
                    .select('phone, name')
                    .eq('branch_id', branchId)
                    .eq('role', 'Manager')
                    .eq('is_active', true);

                if (managers && managers.length > 0) {
                    const manager = managers[0];
                    const actionWord = type === 'created' ? 'booked' : 'updated';
                    const totalRevenue = appointments.reduce((sum, apt) => sum + (apt.service_price || 0), 0);

                    let message = `${appointments.length} appointments ${actionWord} for ${customer.name}:\n`;
                    message += `Total services: ${appointments.length}\n`;
                    message += `Total revenue: Rs ${totalRevenue.toLocaleString()}`;

                    try {
                        results.manager = await this.sendSMS(manager.phone, message);
                    } catch (error) {
                        console.error('Failed to send manager SMS:', error);
                    }
                }
            }

            return {
                success: true,
                message: `Batched notifications sent for ${appointments.length} appointments`,
                results,
                savedSMS: (appointments.length - 1) * 3 // Shows how many SMS were saved
            };
        } catch (error: any) {
            console.error('Error sending batched notifications:', error);
            return {
                success: false,
                error: error.message || 'Failed to send batched notifications'
            };
        }
    }
};
