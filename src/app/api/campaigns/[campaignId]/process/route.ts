import { NextRequest, NextResponse } from 'next/server';
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
