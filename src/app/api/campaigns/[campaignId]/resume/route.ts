import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { enqueueCampaignDelivery } from '@/lib/campaign-delivery-queue';
import { getCampaignAdminClient } from '@/lib/campaign-queue';

export const dynamic = 'force-dynamic';

export async function POST(
    _request: NextRequest,
    context: { params: Promise<{ campaignId: string }> }
) {
    try {
        const { campaignId } = await context.params;
        const supabaseAuthed = await getSupabaseServerClient();
        const { data: { user }, error: authError } = await supabaseAuthed.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile, error: profileError } = await supabaseAuthed
            .from('profiles')
            .select('organization_id, system_role, is_active')
            .eq('id', user.id)
            .single();
        if (profileError || !profile || !profile.is_active) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        if (!['Owner', 'Manager'].includes(profile.system_role)) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const admin = getCampaignAdminClient();
        const { data: campaign, error: campaignError } = await admin
            .from('campaigns')
            .select('id, organization_id, status')
            .eq('id', campaignId)
            .eq('organization_id', profile.organization_id)
            .single();
        if (campaignError || !campaign) {
            return NextResponse.json({ success: false, error: 'Campaign was not found' }, { status: 404 });
        }
        if (campaign.status !== 'sending') {
            return NextResponse.json(
                { success: false, error: 'Only a campaign currently sending can be resumed' },
                { status: 409 }
            );
        }

        const { count: pendingCount, error: countError } = await admin
            .from('campaign_sends')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)
            .eq('organization_id', campaign.organization_id)
            .in('status', ['pending', 'processing']);
        if (countError) throw countError;
        if (!pendingCount) {
            return NextResponse.json(
                { success: false, error: 'This campaign has no pending recipients' },
                { status: 400 }
            );
        }

        const queued = await enqueueCampaignDelivery(campaign.id);
        return NextResponse.json(
            {
                success: true,
                campaignId: campaign.id,
                pendingCount,
                queueMessageId: queued.messageId,
            },
            { status: 202 }
        );
    } catch (error) {
        console.error('Failed to resume campaign delivery:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to resume campaign delivery',
            },
            { status: 500 }
        );
    }
}
