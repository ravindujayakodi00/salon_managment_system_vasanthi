import { after, NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { getCampaignAdminClient, getCampaignWorkerSecret } from '@/lib/campaign-queue';

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
        if (!['completed', 'failed'].includes(campaign.status)) {
            return NextResponse.json(
                { success: false, error: 'Wait until the current campaign delivery has finished' },
                { status: 409 }
            );
        }

        const { count: failedCount, error: countError } = await admin
            .from('campaign_sends')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)
            .eq('organization_id', campaign.organization_id)
            .eq('status', 'failed');
        if (countError) throw countError;
        if (!failedCount) {
            return NextResponse.json(
                { success: false, error: 'This campaign has no failed recipients to retry' },
                { status: 400 }
            );
        }

        const { error: resetError } = await admin
            .from('campaign_sends')
            .update({
                status: 'pending',
                retry_count: 0,
                error_message: null,
                last_attempt_at: null,
                provider_message_id: null,
                sent_at: null,
                updated_at: new Date().toISOString(),
            })
            .eq('campaign_id', campaign.id)
            .eq('organization_id', campaign.organization_id)
            .eq('status', 'failed');
        if (resetError) throw resetError;

        const { error: campaignUpdateError } = await admin
            .from('campaigns')
            .update({
                status: 'sending',
                failed_count: 0,
                completed_at: null,
            })
            .eq('id', campaign.id)
            .eq('organization_id', campaign.organization_id);
        if (campaignUpdateError) throw campaignUpdateError;

        const workerUrl = `${request.nextUrl.origin}/api/campaigns/${campaign.id}/process`;
        after(async () => {
            try {
                const response = await fetch(workerUrl, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${workerSecret}` },
                    cache: 'no-store',
                });
                if (!response.ok) {
                    console.error('Campaign retry worker failed to start:', await response.text());
                }
            } catch (error) {
                console.error('Campaign retry worker invocation failed:', error);
            }
        });

        return NextResponse.json(
            { success: true, campaignId: campaign.id, retryCount: failedCount, status: 'sending' },
            { status: 202 }
        );
    } catch (error) {
        console.error('Failed to retry campaign deliveries:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to retry campaign deliveries',
            },
            { status: 500 }
        );
    }
}
