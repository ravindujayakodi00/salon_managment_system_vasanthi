import { send } from '@vercel/queue';

export const CAMPAIGN_DELIVERY_TOPIC = 'campaign-delivery';

export interface CampaignDeliveryMessage {
    campaignId: string;
}

export async function enqueueCampaignDelivery(campaignId: string) {
    return send<CampaignDeliveryMessage>(
        CAMPAIGN_DELIVERY_TOPIC,
        { campaignId },
        { retentionSeconds: 604800 }
    );
}
