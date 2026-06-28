import { supabase } from '@/lib/supabase';
import { getCurrentOrganizationId } from '@/lib/org-scope';

export interface PettyCashTransaction {
    id: string;
    type: 'deposit' | 'withdrawal';
    entry_type: 'petty_cash' | 'expense';
    amount: number;
    description: string;
    balance_after: number;
    created_by: string;
    created_at: string;
    branch_id: string;
    expense_category_id?: string;
    profiles?: { name: string };
    expense_categories?: { name: string };
}

export interface ExpenseCategory {
    id: string;
    name: string;
    organization_id: string | null;
    is_active: boolean;
    created_at: string;
}

export const pettyCashService = {
    /**
     * Get current petty cash balance (only petty_cash entry_type affects balance)
     */
    async getCurrentBalance(branchId?: string | null): Promise<number> {
        const organizationId = await getCurrentOrganizationId();
        let query = supabase
            .from('petty_cash_transactions')
            .select('balance_after')
            .eq('organization_id', organizationId)
            .eq('entry_type', 'petty_cash');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query
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
     * Get all transactions with pagination (both petty cash and expenses)
     */
    async getTransactions(page = 0, limit = 100, entryType?: 'petty_cash' | 'expense', branchId?: string | null, startDate?: string, endDate?: string) {
        const from = page * limit;
        const to = from + limit - 1;
        const organizationId = await getCurrentOrganizationId();

        let query = supabase
            .from('petty_cash_transactions')
            .select(`
                *,
                profiles ( name ),
                expense_categories ( name )
            `, { count: 'exact' })
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (entryType) {
            query = query.eq('entry_type', entryType);
        }

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        if (startDate) {
            query = query.gte('created_at', `${startDate}T00:00:00`);
        }

        if (endDate) {
            query = query.lte('created_at', `${endDate}T23:59:59`);
        }

        const { data, error, count } = await query;
        if (error) throw error;
        return { data: data as PettyCashTransaction[], count };
    },

    /**
     * Add cash deposit to petty cash fund (Owner only)
     */
    async addDeposit(
        amount: number,
        description: string,
        userId: string,
        branchId: string | null,
        organizationId: string
    ) {
        const currentBalance = await this.getCurrentBalance(branchId);
        const newBalance = currentBalance + amount;

        const { data, error } = await supabase
            .from('petty_cash_transactions')
            .insert({
                type: 'deposit',
                entry_type: 'petty_cash',
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
     * Record a petty cash withdrawal (free-text description)
     */
    async recordPettyCash(
        amount: number,
        description: string,
        userId: string,
        branchId: string | null,
        organizationId: string
    ) {
        const currentBalance = await this.getCurrentBalance(branchId);

        if (currentBalance < amount) {
            throw new Error(`Insufficient balance. Available: Rs ${currentBalance.toLocaleString()}, Required: Rs ${amount.toLocaleString()}`);
        }

        const newBalance = currentBalance - amount;

        const { data, error } = await supabase
            .from('petty_cash_transactions')
            .insert({
                type: 'withdrawal',
                entry_type: 'petty_cash',
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
     * Record a formal expense linked to a category (does NOT affect petty cash balance)
     */
    async recordExpense(
        amount: number,
        description: string,
        expenseCategoryId: string,
        userId: string,
        branchId: string | null,
        organizationId: string
    ) {
        const { data, error } = await supabase
            .from('petty_cash_transactions')
            .insert({
                type: 'withdrawal',
                entry_type: 'expense',
                amount,
                description,
                balance_after: 0, // expenses don't affect petty cash balance
                expense_category_id: expenseCategoryId,
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
     * Update an expense entry (entry_type='expense' — no balance impact)
     */
    async updateExpense(
        id: string,
        amount: number,
        description: string,
        expenseCategoryId: string
    ) {
        const organizationId = await getCurrentOrganizationId();
        const { error } = await supabase
            .from('petty_cash_transactions')
            .update({ amount, description, expense_category_id: expenseCategoryId })
            .eq('id', id)
            .eq('organization_id', organizationId);
        if (error) throw error;
    },

    /**
     * Update a petty cash entry (entry_type='petty_cash') and recalculate the balance chain
     */
    async updatePettyCashEntry(
        id: string,
        newAmount: number,
        description: string,
        branchId: string
    ) {
        const organizationId = await getCurrentOrganizationId();

        const { data: txn, error: fetchError } = await supabase
            .from('petty_cash_transactions')
            .select('*')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single();
        if (fetchError) throw fetchError;

        const balanceDelta = txn.type === 'deposit'
            ? newAmount - txn.amount
            : txn.amount - newAmount;

        // Fetch this entry + all subsequent petty_cash entries for the branch
        const { data: chain, error: chainError } = await supabase
            .from('petty_cash_transactions')
            .select('id, balance_after')
            .eq('organization_id', organizationId)
            .eq('entry_type', 'petty_cash')
            .eq('branch_id', branchId)
            .gte('created_at', txn.created_at)
            .order('created_at', { ascending: true });
        if (chainError) throw chainError;

        for (const entry of chain || []) {
            const updateData: Record<string, unknown> = {
                balance_after: entry.balance_after + balanceDelta,
            };
            if (entry.id === id) {
                updateData.amount = newAmount;
                updateData.description = description;
            }
            await supabase
                .from('petty_cash_transactions')
                .update(updateData)
                .eq('id', entry.id)
                .eq('organization_id', organizationId);
        }
    },

    /**
     * Delete transaction (Owner/Manager only)
     */
    async deleteTransaction(id: string) {
        const organizationId = await getCurrentOrganizationId();
        const { error } = await supabase
            .from('petty_cash_transactions')
            .delete()
            .eq('id', id)
            .eq('organization_id', organizationId);

        if (error) throw error;
        return true;
    },

    /**
     * Get expense categories (global + org-specific)
     */
    async getExpenseCategories(): Promise<ExpenseCategory[]> {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('expense_categories')
            .select('*')
            .eq('is_active', true)
            .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
            .order('name');

        if (error) throw error;
        return data as ExpenseCategory[];
    },

    /**
     * Get summary for a date range
     */
    async getSummary(startDate: string, endDate: string) {
        const organizationId = await getCurrentOrganizationId();
        const { data, error } = await supabase
            .from('petty_cash_transactions')
            .select('type, amount, entry_type')
            .eq('organization_id', organizationId)
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${endDate}T23:59:59`);

        if (error) throw error;

        const summary = {
            totalDeposits: 0,
            totalPettyCash: 0,
            totalExpenses: 0,
            netChange: 0
        };

        data.forEach(t => {
            if (t.type === 'deposit') {
                summary.totalDeposits += t.amount;
            } else if (t.entry_type === 'expense') {
                summary.totalExpenses += t.amount;
            } else {
                summary.totalPettyCash += t.amount;
            }
        });

        summary.netChange = summary.totalDeposits - summary.totalPettyCash;
        return summary;
    },
};
