import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { createTextLkService } from '@/services/textlk';

const AUDIENCE_PAGE_SIZE = 1000;
const INSERT_BATCH_SIZE = 500;
const DELIVERY_BATCH_SIZE = 20;
const DELIVERY_CONCURRENCY = 5;
const MAX_DELIVERY_ATTEMPTS = 3;

type CampaignChannel = 'sms' | 'email' | 'both';

interface CampaignRow {
    id: string;
    organization_id: string;
    name: string;
    template_id: string | null;
    custom_message: string | null;
    custom_subject: string | null;
    target_segments: string[];
    target_all_customers: boolean;
    channel: CampaignChannel;
    status: string;
}

interface AudienceCustomer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
}

interface ClaimedSend {
    send_id: string;
    organization_id: string;
    customer_id: string;
    channel: CampaignChannel;
    message_content: string;
    subject_content: string | null;
    retry_count: number;
    customer_name: string;
    customer_phone: string | null;
    customer_email: string | null;
}

interface CampaignProgress {
    campaign_status: string;
    target_count: number;
    sent_count: number;
    failed_count: number;
    pending_count: number;
}

export function getCampaignAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Supabase server credentials are missing');
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

export function getCampaignWorkerSecret(): string {
    const secret = process.env.CAMPAIGN_WORKER_SECRET || process.env.CRON_SECRET;
    if (!secret) {
        throw new Error('CAMPAIGN_WORKER_SECRET or CRON_SECRET is not configured');
    }
    return secret;
}

function replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
}

function messageToHtml(message: string): string {
    const escaped = message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    return `<p>${escaped.replace(/\n/g, '<br>')}</p>`;
}

async function loadAllActiveCustomers(
    admin: SupabaseClient,
    organizationId: string
): Promise<AudienceCustomer[]> {
    const customers: AudienceCustomer[] = [];
    let from = 0;

    while (true) {
        const { data, error } = await admin
            .from('customers')
            .select('id, name, email, phone')
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .order('id')
            .range(from, from + AUDIENCE_PAGE_SIZE - 1);

        if (error) throw error;
        customers.push(...((data || []) as AudienceCustomer[]));
        if (!data || data.length < AUDIENCE_PAGE_SIZE) break;
        from += AUDIENCE_PAGE_SIZE;
    }

    return customers;
}

async function loadSegmentCustomers(
    admin: SupabaseClient,
    organizationId: string,
    segmentNames: string[]
): Promise<AudienceCustomer[]> {
    if (segmentNames.length === 0) return [];

    const { data: segments, error: segmentError } = await admin
        .from('customer_segments')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .in('name', segmentNames);

    if (segmentError) throw segmentError;
    const segmentIds = (segments || []).map(segment => segment.id as string);
    if (segmentIds.length === 0) return [];

    const customerIds = new Set<string>();
    let from = 0;
    while (true) {
        const { data, error } = await admin
            .from('customer_customer_segments_mapping')
            .select('customer_id')
            .eq('organization_id', organizationId)
            .in('segment_id', segmentIds)
            .order('id')
            .range(from, from + AUDIENCE_PAGE_SIZE - 1);

        if (error) throw error;
        for (const mapping of data || []) customerIds.add(mapping.customer_id as string);
        if (!data || data.length < AUDIENCE_PAGE_SIZE) break;
        from += AUDIENCE_PAGE_SIZE;
    }

    const ids = Array.from(customerIds);
    const customers: AudienceCustomer[] = [];
    for (let index = 0; index < ids.length; index += INSERT_BATCH_SIZE) {
        const { data, error } = await admin
            .from('customers')
            .select('id, name, email, phone')
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .in('id', ids.slice(index, index + INSERT_BATCH_SIZE));

        if (error) throw error;
        customers.push(...((data || []) as AudienceCustomer[]));
    }

    return customers;
}

function filterCustomersForChannel(
    customers: AudienceCustomer[],
    channel: CampaignChannel
): AudienceCustomer[] {
    const uniqueCustomers = Array.from(new Map(customers.map(customer => [customer.id, customer])).values());
    if (channel === 'sms') return uniqueCustomers.filter(customer => Boolean(customer.phone));
    if (channel === 'email') return uniqueCustomers.filter(customer => Boolean(customer.email));
    return uniqueCustomers.filter(customer => Boolean(customer.phone || customer.email));
}

export async function enqueueCampaignRecipients(
    admin: SupabaseClient,
    campaign: CampaignRow
): Promise<number> {
    let messageTemplate = campaign.custom_message?.trim() || '';
    let subjectTemplate = campaign.custom_subject?.trim() || campaign.name;

    if (campaign.template_id) {
        const { data: template, error } = await admin
            .from('notification_templates')
            .select('message, subject')
            .eq('id', campaign.template_id)
            .eq('organization_id', campaign.organization_id)
            .single();

        if (error || !template) throw new Error('Notification template was not found');
        if (!messageTemplate) messageTemplate = template.message;
        if (!campaign.custom_subject?.trim() && template.subject) subjectTemplate = template.subject;
    }

    if (!messageTemplate) throw new Error('Campaign message is empty');

    const { data: organization, error: organizationError } = await admin
        .from('organizations')
        .select('name, display_name, timezone')
        .eq('id', campaign.organization_id)
        .single();
    if (organizationError || !organization) throw new Error('Campaign organization was not found');

    const customers = campaign.target_all_customers
        ? await loadAllActiveCustomers(admin, campaign.organization_id)
        : await loadSegmentCustomers(admin, campaign.organization_id, campaign.target_segments || []);
    const audience = filterCustomersForChannel(customers, campaign.channel);

    const timeZone = organization.timezone || 'Asia/Colombo';
    const now = new Date();
    const date = new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
    const time = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
    }).format(now);
    const salonName = organization.display_name || organization.name;

    const rows = audience.map(customer => {
        const variables = {
            customer_name: customer.name,
            date,
            time,
            salon_name: salonName,
        };
        return {
            campaign_id: campaign.id,
            customer_id: customer.id,
            channel: campaign.channel,
            message_content: replaceVariables(messageTemplate, variables),
            subject_content: replaceVariables(subjectTemplate, variables),
            status: 'pending',
            retry_count: 0,
            organization_id: campaign.organization_id,
            updated_at: new Date().toISOString(),
        };
    });

    for (let index = 0; index < rows.length; index += INSERT_BATCH_SIZE) {
        const { error } = await admin
            .from('campaign_sends')
            .upsert(rows.slice(index, index + INSERT_BATCH_SIZE), {
                onConflict: 'organization_id,campaign_id,customer_id',
                ignoreDuplicates: true,
            });
        if (error) throw error;
    }

    return audience.length;
}

async function sendSms(phone: string, message: string) {
    const simulate = process.env.NODE_ENV !== 'production' && process.env.SMS_MODE !== 'production';
    if (simulate) return { providerId: `campaign-dev-sms-${Date.now()}` };

    const apiKey = process.env.TEXT_LK_API_KEY;
    const senderId = process.env.TEXT_LK_SENDER_ID;
    if (!apiKey || !senderId) throw new Error('Text.lk credentials are missing');

    const result = await createTextLkService(apiKey, senderId).sendSMS(phone, message);
    if (result.status !== 'success') throw new Error(result.message || 'SMS delivery failed');
    return { providerId: result.data?.uid || null };
}

async function sendEmail(email: string, subject: string, message: string) {
    const simulate = process.env.NODE_ENV !== 'production' && process.env.EMAIL_MODE !== 'production';
    if (simulate) return { providerId: `campaign-dev-email-${Date.now()}` };

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('Resend credentials are missing');

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: [email],
        subject,
        html: messageToHtml(message),
    });
    if (error) throw new Error(error.message || 'Email delivery failed');
    return { providerId: data?.id || null };
}

function isRetryableError(error: unknown): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return ['timeout', 'temporar', 'network', 'fetch failed', 'too many', 'rate limit'].some(value =>
        message.includes(value)
    );
}

async function processSend(admin: SupabaseClient, send: ClaimedSend): Promise<void> {
    try {
        const providerIds: string[] = [];
        let attempted = false;

        if ((send.channel === 'sms' || send.channel === 'both') && send.customer_phone) {
            attempted = true;
            const result = await sendSms(send.customer_phone, send.message_content);
            if (result.providerId) providerIds.push(result.providerId);
        }
        if ((send.channel === 'email' || send.channel === 'both') && send.customer_email) {
            attempted = true;
            const result = await sendEmail(
                send.customer_email,
                send.subject_content || 'Notification',
                send.message_content
            );
            if (result.providerId) providerIds.push(result.providerId);
        }
        if (!attempted) throw new Error('Customer has no contact details for the selected channel');

        const { error } = await admin
            .from('campaign_sends')
            .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                provider_message_id: providerIds.join(',') || null,
                error_message: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', send.send_id)
            .eq('organization_id', send.organization_id);
        if (error) throw error;
    } catch (error) {
        const canRetry = send.channel !== 'both'
            && send.retry_count < MAX_DELIVERY_ATTEMPTS
            && isRetryableError(error);
        const message = error instanceof Error ? error.message : 'Unknown delivery error';

        const { error: updateError } = await admin
            .from('campaign_sends')
            .update({
                status: canRetry ? 'pending' : 'failed',
                error_message: message.slice(0, 1000),
                updated_at: new Date().toISOString(),
            })
            .eq('id', send.send_id)
            .eq('organization_id', send.organization_id);
        if (updateError) throw updateError;
    }
}

export async function processCampaignBatch(
    admin: SupabaseClient,
    campaignId: string
): Promise<{ processed: number; progress: CampaignProgress }> {
    const { data: claimed, error: claimError } = await admin.rpc('claim_campaign_send_batch', {
        p_campaign_id: campaignId,
        p_limit: DELIVERY_BATCH_SIZE,
    });
    if (claimError) throw claimError;

    const sends = (claimed || []) as ClaimedSend[];
    for (let index = 0; index < sends.length; index += DELIVERY_CONCURRENCY) {
        await Promise.all(
            sends.slice(index, index + DELIVERY_CONCURRENCY).map(send => processSend(admin, send))
        );
    }

    const { data: progressRows, error: progressError } = await admin.rpc(
        'refresh_campaign_delivery_counts',
        { p_campaign_id: campaignId }
    );
    if (progressError) throw progressError;

    const progress = (progressRows?.[0] || {
        campaign_status: 'completed',
        target_count: 0,
        sent_count: 0,
        failed_count: 0,
        pending_count: 0,
    }) as CampaignProgress;

    return { processed: sends.length, progress };
}

export type { CampaignRow };
