import { supabase } from '@/lib/supabase';
import { getCurrentOrganizationId } from '@/lib/org-scope';

// Types
export interface LoyaltySettings {
    id: string;
    organization_id?: string;
    option_card_enabled: boolean;
    option_points_enabled: boolean;
    option_visits_enabled: boolean;
    card_price: number;
    card_discount_percent: number;
    card_validity_days: number;
    points_threshold_amount: number;
    points_redemption_value: number;
    visit_reward_frequency: number;
    visit_reward_discount_percent: number;
}

export interface LoyaltyCard {
    id: string;
    organization_id?: string;
    card_number: string;
    status: 'available' | 'sold' | 'expired' | 'cancelled';
    customer_id: string | null;
    sold_at: string | null;
    sold_by: string | null;
    expiry_date: string | null;
    purchase_price: number;
    discount_percent: number;
    invoice_id: string | null;
    created_at: string;
}

export interface CustomerLoyalty {
    id: string;
    customer_id: string;
    loyalty_card_id: string | null;
    total_points: number;
    redeemed_points: number;
    total_visits: number;
    last_reward_visit: number;
}

export interface CustomerLoyaltyInfo {
    settings: LoyaltySettings;
    card: LoyaltyCard | null;
    cardValid: boolean;
    cardDiscount: number;
    availablePoints: number;
    pointsValue: number;
    totalVisits: number;
    eligibleForVisitReward: boolean;
    visitRewardDiscount: number;
    nextRewardVisit: number;
}

export interface LoyaltyDiscounts {
    cardDiscount: number;
    pointsRedemption: number;
    visitDiscount: number;
    totalDiscount: number;
    appliedType: 'card' | 'points' | 'visit' | 'none';
}

const DEFAULT_SETTINGS: Omit<LoyaltySettings, 'id'> = {
    option_card_enabled: false,
    option_points_enabled: false,
    option_visits_enabled: false,
    card_price: 15000,
    card_discount_percent: 10,
    card_validity_days: 365,
    points_threshold_amount: 200,
    points_redemption_value: 10,
    visit_reward_frequency: 5,
    visit_reward_discount_percent: 15
};

/** At most one program active: card > points > visits if legacy data had multiple. */
export function normalizeLoyaltyProgramFlags(s: LoyaltySettings): LoyaltySettings {
    const { option_card_enabled: c, option_points_enabled: p, option_visits_enabled: v } = s;
    const n = [c, p, v].filter(Boolean).length;
    if (n <= 1) return s;
    if (c) return { ...s, option_points_enabled: false, option_visits_enabled: false };
    if (p) return { ...s, option_card_enabled: false, option_visits_enabled: false };
    return { ...s, option_card_enabled: false, option_points_enabled: false };
}

export const loyaltyService = {
    // =====================
    // SETTINGS MANAGEMENT
    // =====================

    async getSettings(): Promise<LoyaltySettings> {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('loyalty_settings')
            .select('*')
            .eq('organization_id', organizationId)
            .maybeSingle();

        if (error || !data) {
            return normalizeLoyaltyProgramFlags({ id: '', organization_id: organizationId, ...DEFAULT_SETTINGS });
        }
        return normalizeLoyaltyProgramFlags(data as LoyaltySettings);
    },

    async updateSettings(updates: Partial<LoyaltySettings>): Promise<LoyaltySettings> {
        const organizationId = await getCurrentOrganizationId();
        const { data: existing } = await supabase
            .from('loyalty_settings')
            .select('*')
            .eq('organization_id', organizationId)
            .maybeSingle();

        const base: LoyaltySettings = existing
            ? (existing as LoyaltySettings)
            : { id: '', organization_id: organizationId, ...DEFAULT_SETTINGS };
        const merged = normalizeLoyaltyProgramFlags({ ...base, ...updates, organization_id: organizationId });

        if (existing?.id) {
            const { data, error } = await supabase
                .from('loyalty_settings')
                .update(merged)
                .eq('id', existing.id)
                .eq('organization_id', organizationId)
                .select()
                .single();

            if (error) throw error;
            return normalizeLoyaltyProgramFlags(data as LoyaltySettings);
        }

        const { id: _omit, ...insertPayload } = merged;
        const { data, error } = await supabase
            .from('loyalty_settings')
            .insert({
                ...DEFAULT_SETTINGS,
                ...insertPayload,
                organization_id: organizationId,
            })
            .select()
            .single();

        if (error) throw error;
        return normalizeLoyaltyProgramFlags(data as LoyaltySettings);
    },

    // =====================
    // CARD MANAGEMENT (Option 1)
    // =====================

    async generateCards(count: number): Promise<LoyaltyCard[]> {
        const organizationId = await getCurrentOrganizationId();
        const settings = await this.getSettings();
        const cards = [];
        const year = new Date().getFullYear();

        const { data: lastCard } = await supabase
            .from('loyalty_cards')
            .select('card_number')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        let startNum = 1;
        if (lastCard?.card_number) {
            const match = lastCard.card_number.match(/LC-\d{4}-(\d+)/);
            if (match) startNum = parseInt(match[1]) + 1;
        }

        for (let i = 0; i < count; i++) {
            cards.push({
                organization_id: organizationId,
                card_number: `LC-${year}-${String(startNum + i).padStart(5, '0')}`,
                status: 'available',
                customer_id: null,
                sold_at: null,
                sold_by: null,
                expiry_date: null,
                purchase_price: settings.card_price,
                discount_percent: settings.card_discount_percent,
                invoice_id: null
            });
        }

        const { data, error } = await supabase
            .from('loyalty_cards')
            .insert(cards)
            .select();

        if (error) throw error;
        return data || [];
    },

    async getCardInventory(): Promise<{ available: number; sold: number; expired: number; total: number; cards: LoyaltyCard[] }> {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('loyalty_cards')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const cards = data || [];
        return {
            available: cards.filter(c => c.status === 'available').length,
            sold: cards.filter(c => c.status === 'sold').length,
            expired: cards.filter(c => c.status === 'expired').length,
            total: cards.length,
            cards
        };
    },

    async getAvailableCards(): Promise<LoyaltyCard[]> {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('loyalty_cards')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('status', 'available')
            .order('card_number');

        if (error) throw error;
        return data || [];
    },

    async sellCard(cardId: string, customerId: string, soldBy: string, invoiceId?: string): Promise<LoyaltyCard> {
        const settings = await this.getSettings();
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + settings.card_validity_days);

        // Update card status
        const organizationId = await getCurrentOrganizationId();
        const { data: card, error: cardError } = await supabase
            .from('loyalty_cards')
            .update({
                status: 'sold',
                customer_id: customerId,
                sold_at: new Date().toISOString(),
                sold_by: soldBy,
                expiry_date: expiryDate.toISOString().split('T')[0],
                invoice_id: invoiceId || null
            })
            .eq('id', cardId)
            .eq('organization_id', organizationId)
            .eq('status', 'available')
            .select()
            .single();

        if (cardError) throw cardError;

        await this.ensureCustomerLoyalty(customerId);

        const { error: updateError } = await supabase
            .from('customer_loyalty')
            .update({ loyalty_card_id: cardId })
            .eq('customer_id', customerId)
            .eq('organization_id', organizationId);

        if (updateError) throw updateError;

        await this.recordTransaction(customerId, 'card_purchased', settings.card_price, invoiceId, `Loyalty card ${card.card_number} purchased`);

        return card;
    },

    /** Sell the next available card from org inventory (POS). */
    async sellNextAvailableCard(customerId: string, soldBy: string, invoiceId?: string): Promise<LoyaltyCard> {
        const available = await this.getAvailableCards();
        if (available.length === 0) {
            throw new Error('No loyalty cards in stock. Generate cards under Loyalty Program.');
        }
        return this.sellCard(available[0].id, customerId, soldBy, invoiceId);
    },

    async getCustomerCard(customerId: string): Promise<LoyaltyCard | null> {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('loyalty_cards')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('customer_id', customerId)
            .eq('status', 'sold')
            .single();

        if (error || !data) return null;

        // Check if expired
        if (data.expiry_date && new Date(data.expiry_date) < new Date()) {
            // Mark as expired
            await supabase
                .from('loyalty_cards')
                .update({ status: 'expired' })
                .eq('id', data.id)
                .eq('organization_id', organizationId);
            return null;
        }

        return data;
    },

    async isCardValid(customerId: string): Promise<boolean> {
        const card = await this.getCustomerCard(customerId);
        return card !== null;
    },

    // =====================
    // POINTS SYSTEM (Option 2)
    // =====================

    async calculatePoints(amount: number): Promise<number> {
        const settings = await this.getSettings();
        if (!settings.option_points_enabled) return 0;
        return Math.floor(amount / settings.points_threshold_amount);
    },

    async addPoints(customerId: string, amount: number, invoiceId?: string): Promise<number> {
        const settings = await this.getSettings();
        if (!settings.option_points_enabled) return 0;

        const pointsEarned = Math.floor(amount / settings.points_threshold_amount);
        if (pointsEarned <= 0) return 0;

        await this.ensureCustomerLoyalty(customerId);
        const organizationId = await getCurrentOrganizationId();

        const { error } = await supabase.rpc('increment_loyalty_points', {
            p_customer_id: customerId,
            p_points: pointsEarned
        });

        // Fallback if RPC doesn't exist
        if (error) {
            const { data: current } = await supabase
                .from('customer_loyalty')
                .select('total_points')
                .eq('customer_id', customerId)
                .eq('organization_id', organizationId)
                .single();

            await supabase
                .from('customer_loyalty')
                .update({ total_points: (current?.total_points || 0) + pointsEarned })
                .eq('customer_id', customerId)
                .eq('organization_id', organizationId);
        }

        await this.recordTransaction(customerId, 'points_earned', pointsEarned, invoiceId, `Earned ${pointsEarned} points from Rs ${amount} purchase`);

        return pointsEarned;
    },

    async redeemPoints(customerId: string, points: number, invoiceId?: string): Promise<number> {
        const settings = await this.getSettings();
        if (!settings.option_points_enabled) return 0;

        const balance = await this.getPointsBalance(customerId);
        if (points > balance) throw new Error('Insufficient points');

        const rsValue = points * settings.points_redemption_value;
        const organizationId = await getCurrentOrganizationId();

        const { data: current } = await supabase
            .from('customer_loyalty')
            .select('redeemed_points')
            .eq('customer_id', customerId)
            .eq('organization_id', organizationId)
            .single();

        await supabase
            .from('customer_loyalty')
            .update({ redeemed_points: (current?.redeemed_points || 0) + points })
            .eq('customer_id', customerId)
            .eq('organization_id', organizationId);

        await this.recordTransaction(customerId, 'points_redeemed', -points, invoiceId, `Redeemed ${points} points for Rs ${rsValue} discount`);

        return rsValue;
    },

    async getPointsBalance(customerId: string): Promise<number> {
        const organizationId = await getCurrentOrganizationId();
        const { data } = await supabase
            .from('customer_loyalty')
            .select('total_points, redeemed_points')
            .eq('customer_id', customerId)
            .eq('organization_id', organizationId)
            .single();

        if (!data) return 0;
        return (data.total_points || 0) - (data.redeemed_points || 0);
    },

    // =====================
    // VISIT REWARDS (Option 3)
    // =====================

    async recordVisit(customerId: string, invoiceId?: string): Promise<{ visitNumber: number; rewardEarned: boolean }> {
        await this.ensureCustomerLoyalty(customerId);
        const organizationId = await getCurrentOrganizationId();

        const { data: current } = await supabase
            .from('customer_loyalty')
            .select('total_visits, last_reward_visit')
            .eq('customer_id', customerId)
            .eq('organization_id', organizationId)
            .single();

        const newVisitCount = (current?.total_visits || 0) + 1;

        await supabase
            .from('customer_loyalty')
            .update({ total_visits: newVisitCount })
            .eq('customer_id', customerId)
            .eq('organization_id', organizationId);

        // Check if this visit earns a reward
        const settings = await this.getSettings();
        const rewardEarned = settings.option_visits_enabled &&
            newVisitCount % settings.visit_reward_frequency === 0;

        return { visitNumber: newVisitCount, rewardEarned };
    },

    async checkVisitReward(customerId: string): Promise<{ eligible: boolean; discount: number; currentVisit: number; nextRewardVisit: number }> {
        const settings = await this.getSettings();
        if (!settings.option_visits_enabled) {
            return { eligible: false, discount: 0, currentVisit: 0, nextRewardVisit: 0 };
        }

        const organizationId = await getCurrentOrganizationId();
        const { data } = await supabase
            .from('customer_loyalty')
            .select('total_visits, last_reward_visit')
            .eq('customer_id', customerId)
            .eq('organization_id', organizationId)
            .single();

        const totalVisits = data?.total_visits || 0;
        const lastReward = data?.last_reward_visit || 0;
        const visitsSinceReward = totalVisits - lastReward;
        const nextRewardAt = settings.visit_reward_frequency;

        // Next visit (totalVisits + 1) will be eligible if it's the Nth visit since last reward
        const eligible = (visitsSinceReward + 1) % settings.visit_reward_frequency === 0;

        return {
            eligible,
            discount: eligible ? settings.visit_reward_discount_percent : 0,
            currentVisit: visitsSinceReward,
            nextRewardVisit: nextRewardAt - (visitsSinceReward % nextRewardAt)
        };
    },

    async applyVisitReward(customerId: string, invoiceId?: string): Promise<void> {
        const organizationId = await getCurrentOrganizationId();
        const { data: current } = await supabase
            .from('customer_loyalty')
            .select('total_visits')
            .eq('customer_id', customerId)
            .eq('organization_id', organizationId)
            .single();

        const settings = await this.getSettings();

        await supabase
            .from('customer_loyalty')
            .update({ last_reward_visit: current?.total_visits || 0 })
            .eq('customer_id', customerId)
            .eq('organization_id', organizationId);

        await this.recordTransaction(customerId, 'visit_reward', settings.visit_reward_discount_percent, invoiceId, `Visit reward: ${settings.visit_reward_discount_percent}% discount applied`);
    },

    // =====================
    // COMBINED FOR POS
    // =====================

    async getCustomerLoyaltyInfo(customerId: string): Promise<CustomerLoyaltyInfo> {
        const settings = await this.getSettings();
        const card = await this.getCustomerCard(customerId);
        const pointsBalance = await this.getPointsBalance(customerId);
        const visitReward = await this.checkVisitReward(customerId);

        const organizationId = await getCurrentOrganizationId();
        const { data: loyalty } = await supabase
            .from('customer_loyalty')
            .select('total_visits')
            .eq('customer_id', customerId)
            .eq('organization_id', organizationId)
            .single();

        return {
            settings,
            card,
            cardValid: card !== null,
            cardDiscount: card ? card.discount_percent : 0,
            availablePoints: pointsBalance,
            pointsValue: pointsBalance * settings.points_redemption_value,
            totalVisits: loyalty?.total_visits || 0,
            eligibleForVisitReward: visitReward.eligible,
            visitRewardDiscount: visitReward.discount,
            nextRewardVisit: visitReward.nextRewardVisit
        };
    },

    async calculateLoyaltyDiscounts(customerId: string, subtotal: number): Promise<LoyaltyDiscounts> {
        const info = await this.getCustomerLoyaltyInfo(customerId);

        let cardDiscount = 0;
        let visitDiscount = 0;
        let pointsRedemption = 0;

        // Card discount (percentage of subtotal)
        if (info.settings.option_card_enabled && info.cardValid) {
            cardDiscount = (subtotal * info.cardDiscount) / 100;
        }

        // Visit reward (percentage of subtotal)
        if (info.settings.option_visits_enabled && info.eligibleForVisitReward) {
            visitDiscount = (subtotal * info.visitRewardDiscount) / 100;
        }

        // Points (actual Rs value)
        if (info.settings.option_points_enabled) {
            pointsRedemption = info.pointsValue;
        }

        // Determine best single discount (don't stack by default)
        let appliedType: 'card' | 'points' | 'visit' | 'none' = 'none';
        let totalDiscount = 0;

        if (cardDiscount >= visitDiscount && cardDiscount >= pointsRedemption && cardDiscount > 0) {
            appliedType = 'card';
            totalDiscount = cardDiscount;
        } else if (visitDiscount >= cardDiscount && visitDiscount >= pointsRedemption && visitDiscount > 0) {
            appliedType = 'visit';
            totalDiscount = visitDiscount;
        } else if (pointsRedemption > 0) {
            appliedType = 'points';
            totalDiscount = Math.min(pointsRedemption, subtotal); // Can't exceed subtotal
        }

        return {
            cardDiscount,
            pointsRedemption,
            visitDiscount,
            totalDiscount,
            appliedType
        };
    },

    // =====================
    // HELPER METHODS
    // =====================

    async ensureCustomerLoyalty(customerId: string): Promise<void> {
        const organizationId = await getCurrentOrganizationId();
        const { data: existing } = await supabase
            .from('customer_loyalty')
            .select('id')
            .eq('customer_id', customerId)
            .eq('organization_id', organizationId)
            .maybeSingle();

        if (existing) return;

        const { data: customer, error: custErr } = await supabase
            .from('customers')
            .select('organization_id')
            .eq('id', customerId)
            .eq('organization_id', organizationId)
            .single();

        if (custErr || !customer?.organization_id) {
            throw new Error('Customer not found or missing organization');
        }

        await supabase.from('customer_loyalty').insert({
            organization_id: customer.organization_id,
            customer_id: customerId,
            loyalty_card_id: null,
            total_points: 0,
            redeemed_points: 0,
            total_visits: 0,
            last_reward_visit: 0
        });
    },

    async recordTransaction(
        customerId: string,
        type: string,
        amount: number,
        invoiceId?: string,
        description?: string
    ): Promise<void> {
        const organizationId = await getCurrentOrganizationId();
        await supabase.from('loyalty_transactions').insert({
            organization_id: organizationId,
            customer_id: customerId,
            type,
            amount,
            invoice_id: invoiceId || null,
            description: description || ''
        });
    },

    async getTransactionHistory(customerId: string, limit = 20): Promise<any[]> {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('loyalty_transactions')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }
};
