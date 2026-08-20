import { send } from '@vercel/queue';

export const CAMPAIGN_DELIVERY_TOPIC = 'campaign-delivery';

export interface CampaignDeliveryMessage {
    campaignId: string;
    runId: string;
    batchNumber: number;
}

interface EnqueueCampaignDeliveryOptions {
    runId?: string;
    batchNumber?: number;
    delaySeconds?: number;
}

export async function enqueueCampaignDelivery(
    campaignId: string,
    options: EnqueueCampaignDeliveryOptions = {}
) {
    const runId = options.runId || crypto.randomUUID();
    const batchNumber = options.batchNumber || 0;

    return send<CampaignDeliveryMessage>(
        CAMPAIGN_DELIVERY_TOPIC,
        { campaignId, runId, batchNumber },
        {
            idempotencyKey: `campaign-delivery-${runId}-${batchNumber}`,
            retentionSeconds: 604800,
            delaySeconds: options.delaySeconds || 0,
        }
    );
}
