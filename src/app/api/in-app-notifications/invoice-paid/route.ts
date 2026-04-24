import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assertBranchInOrganization } from '@/lib/public-tenant';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getBearerToken(request: NextRequest) {
    const header = request.headers.get('Authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match?.[1] || null;
}

async function getAuthedProfileId(request: NextRequest) {
    const token = getBearerToken(request);
    if (!token) return null;

    const supabaseAuthed = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error } = await supabaseAuthed.auth.getUser();
    if (error || !user) return null;
    return user.id as string;
}

export async function POST(request: NextRequest) {
    try {
        const authedProfileId = await getAuthedProfileId(request);
        if (!authedProfileId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const { invoiceId, branchId, customerId, total } = body || {};

        if (!invoiceId || !branchId || !customerId || total === undefined) {
            return NextResponse.json(
                { success: false, error: 'invoiceId, branchId, customerId, total are required' },
                { status: 400 }
            );
        }

        const supabaseAdmin = createClient(supabaseUrl, adminKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        const { data: invoiceRow, error: invoiceLookupError } = await supabaseAdmin
            .from('invoices')
            .select('organization_id')
            .eq('id', invoiceId)
            .single();

        if (invoiceLookupError || !invoiceRow?.organization_id) {
            return NextResponse.json(
                { success: false, error: invoiceLookupError?.message || 'Invoice not found' },
                { status: 404 }
            );
        }

        const branchOk = await assertBranchInOrganization(
            supabaseAdmin,
            branchId,
            invoiceRow.organization_id
        );
        if (!branchOk) {
            return NextResponse.json(
                { success: false, error: 'branchId does not belong to invoice organization' },
                { status: 400 }
            );
        }

        const { data: customer, error: customerError } = await supabaseAdmin
            .from('customers')
            .select('name')
            .eq('id', customerId)
            .eq('organization_id', invoiceRow.organization_id)
            .single();

        if (customerError || !customer) {
            return NextResponse.json(
                { success: false, error: customerError?.message || 'Customer not found' },
                { status: 404 }
            );
        }

        const title = 'Invoice paid';
        const message = `${customer.name} paid Rs ${Number(total).toLocaleString()}.`;

        // All active staff in the branch
        const { data: staffRecipients, error: recipientsError } = await supabaseAdmin
            .from('staff')
            .select('id')
            .eq('branch_id', branchId)
            .eq('organization_id', invoiceRow.organization_id)
            .eq('is_active', true);

        if (recipientsError) {
            return NextResponse.json(
                { success: false, error: recipientsError.message || 'Failed to fetch recipients' },
                { status: 500 }
            );
        }

        if (!staffRecipients || staffRecipients.length === 0) {
            return NextResponse.json({ success: true, created: false, message: 'No recipients found' });
        }

        const { data: notificationRow, error: notificationError } = await supabaseAdmin
            .from('in_app_notifications')
            .insert({
                type: 'InvoicePaid',
                title,
                message,
                branch_id: branchId,
                organization_id: invoiceRow.organization_id,
                invoice_id: invoiceId,
                created_by: authedProfileId
            })
            .select('id')
            .single();

        if (notificationError || !notificationRow?.id) {
            return NextResponse.json(
                { success: false, error: notificationError?.message || 'Failed to create notification' },
                { status: 500 }
            );
        }

        const notificationId = notificationRow.id;

        const { error: recipientsInsertError } = await supabaseAdmin
            .from('in_app_notification_recipients')
            .insert(
                staffRecipients.map((s: any) => ({
                    notification_id: notificationId,
                    staff_id: s.id
                }))
            );

        if (recipientsInsertError) {
            return NextResponse.json(
                { success: false, error: recipientsInsertError.message || 'Failed to insert recipients' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, created: true });
    } catch (error: any) {
        console.error('invoice-paid in-app notification error:', error);
        return NextResponse.json(
            { success: false, error: error?.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

