import { supabase } from '@/lib/supabase';

export interface PettyCashTransaction {
    id: string;
    type: 'deposit' | 'withdrawal';
    amount: number;
    description: string;
    balance_after: number;
    created_by: string;
    created_at: string;
    branch_id: string;
    profiles?: {
        name: string;
        role: string;
    };
}

export const pettyCashService = {
    /**
     * Get current petty cash balance
     */
    async getCurrentBalance(): Promise<number> {
        const { data, error } = await supabase
            .from('petty_cash_transactions')
            .select('balance_after')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Error fetching balance:', error);
            return 0;
        }

        return data?.balance_after || 0;
    },

    /**
     * Get all petty cash transactions with pagination
     */
    async getTransactions(page = 0, limit = 50) {
        const from = page * limit;
        const to = from + limit - 1;

        const { data, error, count } = await supabase
            .from('petty_cash_transactions')
            .select(`
                *,
                profiles (
                    name,
                    role
                )
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;
        return { data: data as PettyCashTransaction[], count };
    },

    /**
     * Add cash deposit (Owner only)
     */
    async addDeposit(
        amount: number,
        description: string,
        userId: string,
        branchId: string | null,
        organizationId: string
    ) {
        // Get current balance
        const currentBalance = await this.getCurrentBalance();
        const newBalance = currentBalance + amount;

        const { data, error } = await supabase
            .from('petty_cash_transactions')
            .insert({
                type: 'deposit',
                amount,
                description,
                balance_after: newBalance,
                created_by: userId,
                branch_id: branchId,
                organization_id: organizationId,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Record expense (withdrawal)
     */
    async recordExpense(
        amount: number,
        description: string,
        userId: string,
        branchId: string | null,
        organizationId: string
    ) {
        // Get current balance
        const currentBalance = await this.getCurrentBalance();

        // Check if sufficient balance
        if (currentBalance < amount) {
            throw new Error(`Insufficient balance. Available: Rs ${currentBalance.toLocaleString()}, Required: Rs ${amount.toLocaleString()}`);
        }

        const newBalance = currentBalance - amount;

        const { data, error } = await supabase
            .from('petty_cash_transactions')
            .insert({
                type: 'withdrawal',
                amount,
                description,
                balance_after: newBalance,
                created_by: userId,
                branch_id: branchId,
                organization_id: organizationId,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Delete transaction (Owner/Manager only)
     */
    async deleteTransaction(id: string) {
        const { error } = await supabase
            .from('petty_cash_transactions')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    },

    /**
     * Get transactions summary for date range
     */
    async getSummary(startDate: string, endDate: string) {
        const { data, error } = await supabase
            .from('petty_cash_transactions')
            .select('type, amount')
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${endDate}T23:59:59`);

        if (error) throw error;

        const summary = {
            totalDeposits: 0,
            totalWithdrawals: 0,
            netChange: 0
        };

        data.forEach(transaction => {
            if (transaction.type === 'deposit') {
                summary.totalDeposits += transaction.amount;
            } else {
                summary.totalWithdrawals += transaction.amount;
            }
        });

        summary.netChange = summary.totalDeposits - summary.totalWithdrawals;

        return summary;
    },

    /**
     * Search transactions by description
     */
    async searchTransactions(searchQuery: string) {
        const { data, error } = await supabase
            .from('petty_cash_transactions')
            .select(`
                *,
                profiles (
                    name,
                    role
                )
            `)
            .ilike('description', `%${searchQuery}%`)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;
        return data as PettyCashTransaction[];
    }
};
