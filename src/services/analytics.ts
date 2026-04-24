import { supabase } from '@/lib/supabase';
import { getCurrentOrganizationId } from '@/lib/org-scope';

export interface AnalyticsSummary {
    total_campaigns: number;
    total_sent: number;
    total_delivered: number;
    total_failed: number;
    total_cost: number;
    delivery_rate: number;
    avg_cost_per_campaign: number;
}

export interface DailyStats {
    date: string;
    sent: number;
    cost: number;
}

export const analyticsService = {
    /**
     * Get overall campaign analytics summary
     */
    async getSummary(): Promise<AnalyticsSummary> {
        try {
            const organizationId = await getCurrentOrganizationId();
            const { data: campaigns, error } = await supabase
                .from('campaigns')
                .select('sent_count, delivered_count, failed_count, actual_cost')
                .eq('organization_id', organizationId)
                .eq('status', 'completed');

            if (error) throw error;

            const total_campaigns = campaigns?.length || 0;
            const total_sent = campaigns?.reduce((sum, c) => sum + (c.sent_count || 0), 0) || 0;
            const total_delivered = campaigns?.reduce((sum, c) => sum + (c.delivered_count || 0), 0) || 0;
            const total_failed = campaigns?.reduce((sum, c) => sum + (c.failed_count || 0), 0) || 0;
            const total_cost = campaigns?.reduce((sum, c) => sum + (c.actual_cost || 0), 0) || 0;

            const delivery_rate = total_sent > 0 ? Math.round((total_delivered / total_sent) * 100) : 0;
            const avg_cost_per_campaign = total_campaigns > 0 ? Math.round(total_cost / total_campaigns) : 0;

            return {
                total_campaigns,
                total_sent,
                total_delivered,
                total_failed,
                total_cost,
                delivery_rate,
                avg_cost_per_campaign
            };
        } catch (error) {
            console.error('Error fetching analytics summary:', error);
            throw error;
        }
    },

    /**
     * Get daily sending stats for charts
     */
    async getDailyStats(days: number = 7): Promise<DailyStats[]> {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            const organizationId = await getCurrentOrganizationId();

            const { data: sends, error } = await supabase
                .from('campaign_sends')
                .select('sent_at, status')
                .eq('organization_id', organizationId)
                .gte('sent_at', startDate.toISOString())
                .order('sent_at', { ascending: true });

            if (error) throw error;

            // Group by date
            const statsMap = new Map<string, { sent: number, cost: number }>();

            // Initialize all days
            for (let i = 0; i < days; i++) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toLocaleDateString();
                statsMap.set(dateStr, { sent: 0, cost: 0 });
            }

            // Fill with data
            sends?.forEach(send => {
                if (!send.sent_at) return;
                const dateStr = new Date(send.sent_at).toLocaleDateString();
                const current = statsMap.get(dateStr) || { sent: 0, cost: 0 };

                if (send.status === 'sent' || send.status === 'delivered') {
                    current.sent++;
                    current.cost += 2; // LKR 2 per message
                }
                statsMap.set(dateStr, current);
            });

            // Convert to array and sort
            return Array.from(statsMap.entries())
                .map(([date, stats]) => ({
                    date,
                    sent: stats.sent,
                    cost: stats.cost
                }))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        } catch (error) {
            console.error('Error fetching daily stats:', error);
            throw error;
        }
    }
};
