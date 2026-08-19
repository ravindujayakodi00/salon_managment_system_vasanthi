import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTextLkService } from '@/services/textlk';
import {
    DEFAULT_BIRTHDAY_MESSAGE,
    getDateInTimeZone,
    renderBirthdayMessage,
} from '@/lib/birthday';

export const dynamic = 'force-dynamic';

const TEST_CUSTOMER_ID = 'f8b907c5-45df-4eff-8ec1-669c8a081e21';
const TEST_CUSTOMER_NAME = 'Ravindu Jayakodi';

interface TestCustomerRow {
    id: string;
    organization_id: string;
    name: string;
    phone: string;
    date_of_birth: string;
    is_active: boolean;
}

interface OrganizationRow {
    id: string;
    name: string;
    display_name: string | null;
    timezone: string | null;
}

export async function GET(request: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json(
            { success: false, error: 'Supabase server credentials are missing' },
            { status: 500 }
        );
    }

    const simulateSms = process.env.NODE_ENV !== 'production' && process.env.SMS_MODE !== 'production';
    const apiKey = process.env.TEXT_LK_API_KEY;
    const senderId = process.env.TEXT_LK_SENDER_ID;
    if (!simulateSms && (!apiKey || !senderId)) {
        return NextResponse.json(
            { success: false, error: 'Text.lk credentials are missing' },
            { status: 500 }
        );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id, organization_id, name, phone, date_of_birth, is_active')
        .eq('id', TEST_CUSTOMER_ID)
        .single();

    if (customerError || !customerData) {
        return NextResponse.json(
            { success: false, error: customerError?.message || 'Test customer was not found' },
            { status: 500 }
        );
    }

    const customer = customerData as TestCustomerRow;
    if (customer.name.trim() !== TEST_CUSTOMER_NAME) {
        return NextResponse.json(
            { success: false, error: 'The test customer name does not match the configured customer' },
            { status: 500 }
        );
    }

    if (!customer.is_active || !customer.phone || !customer.date_of_birth) {
        return NextResponse.json({
            success: true,
            sent: 0,
            skipped: 1,
            customerId: customer.id,
            reason: 'The test customer is inactive or is missing a phone number or date of birth',
        });
    }

    const { data: organizationData, error: organizationError } = await supabase
        .from('organizations')
        .select('id, name, display_name, timezone')
        .eq('id', customer.organization_id)
        .eq('is_active', true)
        .single();

    if (organizationError || !organizationData) {
        return NextResponse.json(
            { success: false, error: organizationError?.message || 'Customer organization was not found' },
            { status: 500 }
        );
    }

    const organization = organizationData as OrganizationRow;
    const localDate = getDateInTimeZone(new Date(), organization.timezone || 'Asia/Colombo');
    if (customer.date_of_birth.slice(5) !== localDate.slice(5)) {
        return NextResponse.json({
            success: true,
            sent: 0,
            skipped: 1,
            customerId: customer.id,
            localDate,
            reason: 'Today is not the test customer birthday',
        });
    }

    const birthdayYear = Number(localDate.slice(0, 4));
    const { data: claimed, error: claimError } = await supabase.rpc('claim_birthday_message_send', {
        p_customer_id: customer.id,
        p_organization_id: organization.id,
        p_birthday_year: birthdayYear,
    });

    if (claimError) {
        return NextResponse.json({ success: false, error: claimError.message }, { status: 500 });
    }

    if (!claimed) {
        return NextResponse.json({
            success: true,
            sent: 0,
            skipped: 1,
            customerId: customer.id,
            localDate,
            reason: 'The birthday message was already sent or claimed for this customer this year',
        });
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
    const message = renderBirthdayMessage(template, customer.name, salonName);
    const textlk = simulateSms ? null : createTextLkService(apiKey!, senderId!);
    const result = simulateSms
        ? { status: 'success' as const, data: { uid: `birthday-test-${customer.id}-${birthdayYear}` } }
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
            return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            simulated: simulateSms,
            sent: 1,
            skipped: 0,
            customerId: customer.id,
            localDate,
        });
    }

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

    return NextResponse.json(
        {
            success: false,
            sent: 0,
            failed: 1,
            customerId: customer.id,
            localDate,
            error: result.message,
        },
        { status: 500 }
    );
}
