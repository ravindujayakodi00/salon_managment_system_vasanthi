import { after, NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import {
    CampaignRow,
    enqueueCampaignRecipients,
    getCampaignAdminClient,
    getCampaignWorkerSecret,
} from '@/lib/campaign-queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ campaignId: string }> }
) {
    try {
        const { campaignId } = await context.params;
        const workerSecret = getCampaignWorkerSecret();
        const supabaseAuthed = await getSupabaseServerClient();
        const { data: { user }, error: authError } = await supabaseAuthed.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile, error: profileError } = await supabaseAuthed
            .from('profiles')
            .select('id, organization_id, system_role, is_active')
            .eq('id', user.id)
            .single();
        if (profileError || !profile || !profile.is_active) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        if (!['Owner', 'Manager'].includes(profile.system_role)) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const admin = getCampaignAdminClient();
        const { data: campaignData, error: campaignError } = await admin
            .from('campaigns')
            .select('*')
            .eq('id', campaignId)
            .eq('organization_id', profile.organization_id)
            .single();
        if (campaignError || !campaignData) {
            return NextResponse.json({ success: false, error: 'Campaign was not found' }, { status: 404 });
        }

        const campaign = campaignData as CampaignRow;
        if (['completed', 'cancelled'].includes(campaign.status)) {
            return NextResponse.json(
                { success: false, error: 'This campaign can no longer be started' },
                { status: 409 }
            );
        }

        const targetCount = await enqueueCampaignRecipients(admin, campaign);
        if (targetCount === 0) {
            await admin
                .from('campaigns')
                .update({ status: 'failed', target_count: 0, failed_count: 0 })
                .eq('id', campaign.id)
                .eq('organization_id', campaign.organization_id);
            return NextResponse.json(
                { success: false, error: 'No customers have contact details for the selected channel' },
                { status: 400 }
            );
        }

        const { error: updateError } = await admin
            .from('campaigns')
            .update({
                status: 'sending',
                target_count: targetCount,
                sent_at: campaign.status === 'sending' ? campaignData.sent_at : new Date().toISOString(),
                completed_at: null,
            })
            .eq('id', campaign.id)
            .eq('organization_id', campaign.organization_id);
        if (updateError) throw updateError;

        const workerUrl = `${request.nextUrl.origin}/api/campaigns/${campaign.id}/process`;
        after(async () => {
            try {
                const response = await fetch(workerUrl, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${workerSecret}` },
                    cache: 'no-store',
                });
                if (!response.ok) {
                    console.error('Campaign worker failed to start:', await response.text());
                }
            } catch (error) {
                console.error('Campaign worker invocation failed:', error);
            }
        });

        return NextResponse.json(
            { success: true, campaignId: campaign.id, targetCount, status: 'sending' },
            { status: 202 }
        );
    } catch (error) {
        console.error('Failed to start campaign delivery:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to start campaign delivery',
            },
            { status: 500 }
        );
    }
}
