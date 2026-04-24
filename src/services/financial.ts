import { supabase } from '@/lib/supabase';
import { getCurrentOrganizationId } from '@/lib/org-scope';

type SalaryType = 'daily' | 'monthly';

export interface StylistFinancialRow {
    staff_id: string;
    staff_name: string;
    initial_salary: number;
    commission_sum: number;
    advances_sum: number;
    available_for_advance: number;
    last_advances: Array<{
        id: string;
        amount: number;
        description: string | null;
        created_at: string;
    }>;
}

function parseISODateLocal(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map((v) => Number(v));
    return new Date(y, m - 1, d);
}

function daysInclusive(startDate: string, endDate: string): number {
    const start = parseISODateLocal(startDate);
    const end = parseISODateLocal(endDate);
    const ms = end.getTime() - start.getTime();
    const days = Math.floor(ms / 86400000) + 1;
    return Math.max(0, days);
}

function monthsInclusive(startDate: string, endDate: string): number {
    const start = parseISODateLocal(startDate);
    const end = parseISODateLocal(endDate);
    const startIndex = start.getFullYear() * 12 + start.getMonth(); // month is 0-based
    const endIndex = end.getFullYear() * 12 + end.getMonth();
    return Math.max(0, endIndex - startIndex + 1);
}

function calculateInitialSalary(args: {
    amount: number;
    salary_type: SalaryType;
    effective_from?: string | null;
    startDate: string;
    endDate: string;
}): number {
    const { amount, salary_type, effective_from, startDate, endDate } = args;
    if (!amount || amount <= 0) return 0;

    if (effective_from) {
        // If salary hasn't started yet for the period, treat as 0.
        if (effective_from > endDate) return 0;
    }

    if (salary_type === 'daily') {
        return amount * daysInclusive(startDate, endDate);
    }

    // monthly (default)
    return amount * monthsInclusive(startDate, endDate);
}

export const financialService = {
    /**
     * Get each stylist: initial salary (from salary_settings), commissions (from staff_earnings),
     * advances (from staff_salary_advances), and available balance.
     */
    async getStylistsFinancials(args: {
        startDate: string;
        endDate: string;
        branchId?: string | null;
        requesterId: string;
        requesterRole: string;
    }): Promise<{
        rows: StylistFinancialRow[];
        totals: {
            initial_salary: number;
            commission_sum: number;
            advances_sum: number;
            available_for_advance: number;
        };
    }> {
        const { startDate, endDate, branchId, requesterId, requesterRole } = args;
        const organizationId = await getCurrentOrganizationId();

        // 1) Select stylists based on who is requesting.
        let stylistsQuery = supabase
            .from('staff')
            .select('id, name, branch_id, profile_id, role')
            .eq('organization_id', organizationId)
            .eq('role', 'Stylist')
            .eq('is_active', true)
            .order('name');

        if (requesterRole === 'Stylist') {
            stylistsQuery = stylistsQuery.eq('profile_id', requesterId);
        } else if (branchId) {
            stylistsQuery = stylistsQuery.eq('branch_id', branchId);
        }

        const { data: stylists, error: stylistsError } = await stylistsQuery;
        if (stylistsError) throw stylistsError;
        const staffIds = (stylists || []).map((s) => s.id);

        if (!staffIds.length) {
            return {
                rows: [],
                totals: { initial_salary: 0, commission_sum: 0, advances_sum: 0, available_for_advance: 0 },
            };
        }

        // 2) Commission sums from staff_earnings.
        const { data: earnings, error: earningsError } = await supabase
            .from('staff_earnings')
            .select('staff_id, commission_amount')
            .in('staff_id', staffIds)
            .gte('date', startDate)
            .lte('date', endDate);

        if (earningsError) throw earningsError;

        const commissionByStaff = new Map<string, number>();
        (earnings || []).forEach((e) => {
            const commission = Number(e.commission_amount || 0);
            commissionByStaff.set(e.staff_id, (commissionByStaff.get(e.staff_id) || 0) + commission);
        });

        // 3) Initial/base salary from salary_settings.
        const { data: salarySettings, error: salaryError } = await supabase
            .from('salary_settings')
            .select('staff_id, amount, salary_type, effective_from, is_active')
            .in('staff_id', staffIds)
            .eq('is_active', true);

        if (salaryError) throw salaryError;

        const salaryByStaff = new Map<string, any>();
        (salarySettings || []).forEach((s) => salaryByStaff.set(s.staff_id, s));

        // 4) Advances sums and last advances.
        const startTs = `${startDate}T00:00:00`;
        const endTs = `${endDate}T23:59:59`;

        const { data: advances, error: advancesError } = await supabase
            .from('staff_salary_advances')
            .select('id, staff_id, amount, description, created_at')
            .in('staff_id', staffIds)
            .gte('created_at', startTs)
            .lte('created_at', endTs)
            .order('created_at', { ascending: false });

        if (advancesError) throw advancesError;

        const advancesByStaff = new Map<string, number>();
        const lastAdvancesByStaff = new Map<string, StylistFinancialRow['last_advances']>();

        (advances || []).forEach((adv) => {
            const amount = Number(adv.amount || 0);
            advancesByStaff.set(adv.staff_id, (advancesByStaff.get(adv.staff_id) || 0) + amount);

            const list = lastAdvancesByStaff.get(adv.staff_id) || [];
            if (list.length < 5) {
                list.push({
                    id: adv.id,
                    amount,
                    description: adv.description ?? null,
                    created_at: adv.created_at,
                });
            }
            lastAdvancesByStaff.set(adv.staff_id, list);
        });

        // 5) Build rows.
        const rows: StylistFinancialRow[] = (stylists || []).map((s) => {
            const commission_sum = commissionByStaff.get(s.id) || 0;
            const advances_sum = advancesByStaff.get(s.id) || 0;

            const setting = salaryByStaff.get(s.id);
            const initial_salary = setting
                ? calculateInitialSalary({
                    amount: Number(setting.amount || 0),
                    salary_type: setting.salary_type as SalaryType,
                    effective_from: setting.effective_from ?? null,
                    startDate,
                    endDate,
                })
                : 0;

            const available_for_advance = initial_salary + commission_sum - advances_sum;

            return {
                staff_id: s.id,
                staff_name: s.name,
                initial_salary,
                commission_sum,
                advances_sum,
                available_for_advance,
                last_advances: lastAdvancesByStaff.get(s.id) || [],
            };
        });

        const totals = rows.reduce(
            (acc, r) => {
                acc.initial_salary += r.initial_salary;
                acc.commission_sum += r.commission_sum;
                acc.advances_sum += r.advances_sum;
                acc.available_for_advance += r.available_for_advance;
                return acc;
            },
            { initial_salary: 0, commission_sum: 0, advances_sum: 0, available_for_advance: 0 }
        );

        return { rows, totals };
    },

    async createCashAdvance(args: {
        staffId: string;
        amount: number;
        description?: string;
        createdByUserId: string;
    }) {
        const { staffId, amount, description, createdByUserId } = args;
        const organizationId = await getCurrentOrganizationId();
        const { data: staffOk } = await supabase
            .from('staff')
            .select('id')
            .eq('id', staffId)
            .eq('organization_id', organizationId)
            .maybeSingle();
        if (!staffOk) {
            throw new Error('Staff not found in your organization');
        }

        const { data, error } = await supabase
            .from('staff_salary_advances')
            .insert({
                staff_id: staffId,
                amount,
                description: description || null,
                created_by: createdByUserId,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },
};

