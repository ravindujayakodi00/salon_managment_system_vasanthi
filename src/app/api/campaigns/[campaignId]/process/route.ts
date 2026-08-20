import { after, NextRequest, NextResponse } from 'next/server';
import {
    getCampaignAdminClient,
    getCampaignWorkerSecret,
    processCampaignBatch,
} from '@/lib/campaign-queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ campaignId: string }> }
) {
    const admin = getCampaignAdminClient();
    const { campaignId } = await context.params;

    try {
        const workerSecret = getCampaignWorkerSecret();
        if (request.headers.get('authorization') !== `Bearer ${workerSecret}`) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const result = await processCampaignBatch(admin, campaignId);
        if (result.processed > 0 && result.progress.pending_count > 0) {
            const workerUrl = `${request.nextUrl.origin}/api/campaigns/${campaignId}/process`;
            after(async () => {
                try {
                    const response = await fetch(workerUrl, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${workerSecret}` },
                        cache: 'no-store',
                    });
                    if (!response.ok) {
                        console.error('Next campaign batch failed to start:', await response.text());
                    }
                } catch (error) {
                    console.error('Next campaign batch invocation failed:', error);
                }
            });
        }

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error('Campaign batch processing failed:', error);
        await admin
            .from('campaigns')
            .update({ status: 'failed' })
            .eq('id', campaignId)
            .eq('status', 'sending');

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Campaign batch processing failed',
            },
            { status: 500 }
        );
    }
}
