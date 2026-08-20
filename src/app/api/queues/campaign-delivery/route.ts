import { handleCallback } from '@vercel/queue';
import { CampaignDeliveryMessage } from '@/lib/campaign-delivery-queue';
import { getCampaignAdminClient, processCampaignBatch } from '@/lib/campaign-queue';

export const maxDuration = 60;

const CONTINUE_DELIVERY = 'CAMPAIGN_DELIVERY_HAS_PENDING_RECIPIENTS';
const INVALID_MESSAGE = 'INVALID_CAMPAIGN_DELIVERY_MESSAGE';

export const POST = handleCallback<CampaignDeliveryMessage>(
    async message => {
        if (!message?.campaignId || typeof message.campaignId !== 'string') {
            throw new Error(INVALID_MESSAGE);
        }

        const result = await processCampaignBatch(
            getCampaignAdminClient(),
            message.campaignId
        );

        if (result.progress.pending_count > 0) {
            throw new Error(CONTINUE_DELIVERY);
        }
    },
    {
        visibilityTimeoutSeconds: 300,
        retry: (error, metadata) => {
            const message = error instanceof Error ? error.message : String(error);
            if (message === INVALID_MESSAGE) return { acknowledge: true };
            if (message === CONTINUE_DELIVERY) return { afterSeconds: 10 };

            return {
                afterSeconds: Math.min(300, 2 ** Math.min(metadata.deliveryCount, 6) * 5),
            };
        },
    }
);
