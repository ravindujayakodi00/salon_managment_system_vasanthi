import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTextLkService } from '@/services/textlk';
import {
    DEFAULT_BIRTHDAY_MESSAGE,
    getDateInTimeZone,
    renderBirthdayMessage,
} from '@/lib/birthday';

export const dynamic = 'force-dynamic';

interface OrganizationRow {
    id: string;
    name: string;
    display_name: string | null;
    timezone: string | null;
}

interface BirthdayCustomerRow {
    id: string;
    name: string;
    phone: string;
    date_of_birth: string;
}

export async function GET(request: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ success: false, error: 'Supabase server credentials are missing' }, { status: 500 });
    }

    const simulateSms = process.env.NODE_ENV !== 'production' && process.env.SMS_MODE !== 'production';
    const apiKey = process.env.TEXT_LK_API_KEY;
    const senderId = process.env.TEXT_LK_SENDER_ID;
    if (!simulateSms && (!apiKey || !senderId)) {
        return NextResponse.json({ success: false, error: 'Text.lk credentials are missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const textlk = simulateSms ? null : createTextLkService(apiKey!, senderId!);
    const now = new Date();
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    const { data: organizations, error: organizationsError } = await supabase
        .from('organizations')
        .select('id, name, display_name, timezone')
        .eq('is_active', true);

    if (organizationsError) {
        return NextResponse.json({ success: false, error: organizationsError.message }, { status: 500 });
    }

    for (const organization of (organizations || []) as OrganizationRow[]) {
        const localDate = getDateInTimeZone(now, organization.timezone || 'Asia/Colombo');
        const birthdayYear = Number(localDate.slice(0, 4));

        const { data: customers, error: customersError } = await supabase.rpc('get_birthday_customers', {
            p_organization_id: organization.id,
            p_date: localDate,
        });

        if (customersError) {
            failed += 1;
            console.error('Failed to load birthday customers:', customersError);
            continue;
        }

        const { data: templates } = await supabase
            .from('notification_templates')
            .select('message')
            .eq('organization_id', organization.id)
            .eq('type', 'birthday')
            .eq('is_active', true)
            .limit(1);

        const template = templates?.[0]?.message || DEFAULT_BIRTHDAY_MESSAGE;
        const salonName = organization.display_name || organization.name;

        for (const customer of (customers || []) as BirthdayCustomerRow[]) {
            const { data: claimed, error: claimError } = await supabase.rpc('claim_birthday_message_send', {
                p_customer_id: customer.id,
                p_organization_id: organization.id,
                p_birthday_year: birthdayYear,
            });

            if (claimError) {
                failed += 1;
                console.error('Failed to claim birthday message:', claimError);
                continue;
            }

            if (!claimed) {
                skipped += 1;
                continue;
            }

            const message = renderBirthdayMessage(template, customer.name, salonName);
            const result = simulateSms
                ? { status: 'success' as const, data: { uid: `birthday-dev-${customer.id}-${birthdayYear}` } }
                : await textlk!.sendSMS(customer.phone, message);

            if (result.status === 'success') {
                const { error: updateError } = await supabase
                    .from('birthday_message_sends')
                    .update({
                        status: 'sent',
                        provider_message_id: result.data?.uid || null,
                        sent_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('customer_id', customer.id)
                    .eq('organization_id', organization.id)
                    .eq('birthday_year', birthdayYear);

                if (updateError) {
                    failed += 1;
                    console.error('Failed to record birthday SMS success:', updateError);
                } else {
                    sent += 1;
                }
            } else {
                failed += 1;
                await supabase
                    .from('birthday_message_sends')
                    .update({
                        status: 'failed',
                        error_message: result.message,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('customer_id', customer.id)
                    .eq('organization_id', organization.id)
                    .eq('birthday_year', birthdayYear);
            }
        }
    }

    return NextResponse.json(
        { success: failed === 0, simulated: simulateSms, sent, skipped, failed },
        { status: failed === 0 ? 200 : 500 }
    );
}
