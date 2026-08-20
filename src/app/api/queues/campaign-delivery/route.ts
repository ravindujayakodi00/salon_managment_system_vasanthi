import { handleCallback } from '@vercel/queue';
import {
    CampaignDeliveryMessage,
    enqueueCampaignDelivery,
} from '@/lib/campaign-delivery-queue';
import { getCampaignAdminClient, processCampaignBatch } from '@/lib/campaign-queue';

export const maxDuration = 60;

const INVALID_MESSAGE = 'INVALID_CAMPAIGN_DELIVERY_MESSAGE';

export const POST = handleCallback<CampaignDeliveryMessage>(
    async message => {
        if (
            !message?.campaignId
            || typeof message.campaignId !== 'string'
            || !message.runId
            || typeof message.runId !== 'string'
            || !Number.isInteger(message.batchNumber)
            || message.batchNumber < 0
        ) {
            throw new Error(INVALID_MESSAGE);
        }

        const result = await processCampaignBatch(
            getCampaignAdminClient(),
            message.campaignId
        );

        if (result.progress.pending_count > 0) {
            await enqueueCampaignDelivery(message.campaignId, {
                runId: message.runId,
                batchNumber: message.batchNumber + 1,
                delaySeconds: 10,
            });
        }
    },
    {
        visibilityTimeoutSeconds: 300,
        retry: (error, metadata) => {
            const message = error instanceof Error ? error.message : String(error);
            if (message === INVALID_MESSAGE) return { acknowledge: true };

            return {
                afterSeconds: Math.min(300, 2 ** Math.min(metadata.deliveryCount, 6) * 5),
            };
        },
    }
);
