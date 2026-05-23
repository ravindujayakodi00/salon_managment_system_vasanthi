import { supabase } from '@/lib/supabase';
import { getCurrentOrganizationId } from '@/lib/org-scope';

interface StaffEarningRow {
    id: string;
    staff_id: string;
    invoice_id: string | null;
    appointment_id: string | null;
    date: string;
    service_revenue: number;
    commission_amount: number;
    salary_amount: number;
    total_earnings: number;
    appointments_count: number;
}

/** Daily aggregate returned to callers — groups per-invoice rows by date */
export interface DailyEarning {
    id: string; // = date string used as key
    date: string;
    service_revenue: number;
    commission_amount: number;
    salary_amount: number;
    total_earnings: number;
    appointments_count: number;
}

function groupByDate(rows: StaffEarningRow[]): DailyEarning[] {
    const map = new Map<string, DailyEarning>();
    for (const r of rows) {
        if (!map.has(r.date)) {
            map.set(r.date, {
                id: r.date,
                date: r.date,
                service_revenue: 0,
                commission_amount: 0,
                salary_amount: 0,
                total_earnings: 0,
                appointments_count: 0,
            });
        }
        const day = map.get(r.date)!;
        day.service_revenue += r.service_revenue;
        day.commission_amount += r.commission_amount;
        day.salary_amount += r.salary_amount;
        day.total_earnings += r.total_earnings;
        day.appointments_count += r.appointments_count;
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export const earningsService = {
    /**
     * Calculate and update earnings for a stylist based on a single invoice.
     * Inserts one row per invoice per stylist (idempotent via DELETE + INSERT).
     */
    async updateEarningsForInvoice(invoiceId: string) {
        try {
            const organizationId = await getCurrentOrganizationId();

            const { data: invoice, error: invoiceError } = await supabase
                .from('invoices')
                .select(`
                    *,
                    appointment:appointments(
                        id,
                        stylist_id,
                        appointment_date
                    )
                `)
                .eq('id', invoiceId)
                .eq('organization_id', organizationId)
                .single();

            if (invoiceError) throw invoiceError;
            if (!invoice?.appointment) {
                console.warn('Invoice has no appointment linked:', invoiceId);
                return;
            }

            const stylistId = invoice.appointment.stylist_id;
            const appointmentId = invoice.appointment.id;
            const date = invoice.appointment.appointment_date;

            if (!stylistId) {
                console.warn('Appointment has no stylist assigned:', invoice.appointment_id);
                return;
            }

            const { data: commissionSettings } = await supabase
                .from('commission_settings')
                .select('*')
                .eq('organization_id', organizationId)
                .eq('role', 'Stylist')
                .eq('is_active', true)
                .single();

            const commissionRate = commissionSettings?.commission_percentage || 40;

            const items = invoice.items as any[];
            const serviceRevenue = items
                .filter((item: any) => item.type === 'service')
                .reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

            if (serviceRevenue === 0) {
                console.warn('Service revenue is 0, skipping earnings update');
                return;
            }

            const commissionAmount = (serviceRevenue * commissionRate) / 100;

            // Delete any existing row for this invoice + stylist, then insert fresh
            await supabase
                .from('staff_earnings')
                .delete()
                .eq('staff_id', stylistId)
                .eq('invoice_id', invoiceId)
                .eq('organization_id', organizationId);

            await supabase
                .from('staff_earnings')
                .insert({
                    staff_id: stylistId,
                    invoice_id: invoiceId,
                    appointment_id: appointmentId,
                    date,
                    service_revenue: serviceRevenue,
                    commission_amount: commissionAmount,
                    salary_amount: 0,
                    total_earnings: commissionAmount,
                    appointments_count: 1,
                    organization_id: organizationId,
                });
        } catch (error) {
            console.error('Error updating earnings for invoice:', error);
            throw error;
        }
    },

    /**
     * Calculate daily salary for non-stylist staff.
     * Salary rows have invoice_id = NULL. One row per staff per date.
     */
    async calculateDailySalary(staffId: string, date: string) {
        try {
            const organizationId = await getCurrentOrganizationId();

            const { data: staff } = await supabase
                .from('staff')
                .select('system_role')
                .eq('id', staffId)
                .eq('organization_id', organizationId)
                .single();

            if (staff?.system_role === 'Stylist') return;

            const { data: salarySettings } = await supabase
                .from('salary_settings')
                .select('*')
                .eq('staff_id', staffId)
                .eq('is_active', true)
                .single();

            if (!salarySettings) return;

            const salaryAmount = salarySettings.salary_type === 'daily'
                ? salarySettings.amount
                : salarySettings.amount / 30;

            // Salary row: invoice_id IS NULL, unique per (org, staff, date)
            const { data: existing } = await supabase
                .from('staff_earnings')
                .select('id, commission_amount')
                .eq('staff_id', staffId)
                .eq('date', date)
                .eq('organization_id', organizationId)
                .is('invoice_id', null)
                .maybeSingle();

            if (existing) {
                await supabase
                    .from('staff_earnings')
                    .update({
                        salary_amount: salaryAmount,
                        total_earnings: (existing.commission_amount || 0) + salaryAmount,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id)
                    .eq('organization_id', organizationId);
            } else {
                await supabase
                    .from('staff_earnings')
                    .insert({
                        staff_id: staffId,
                        invoice_id: null,
                        appointment_id: null,
                        date,
                        service_revenue: 0,
                        commission_amount: 0,
                        salary_amount: salaryAmount,
                        total_earnings: salaryAmount,
                        appointments_count: 0,
                        organization_id: organizationId,
                    });
            }
        } catch (error) {
            console.error('Error calculating daily salary:', error);
            throw error;
        }
    },

    /**
     * Get staff earnings for a date range, grouped by date for daily breakdown.
     */
    async getStaffEarnings(staffId: string, startDate: string, endDate: string): Promise<DailyEarning[]> {
        try {
            const organizationId = await getCurrentOrganizationId();

            const { data: staffRow } = await supabase
                .from('staff')
                .select('id')
                .eq('id', staffId)
                .eq('organization_id', organizationId)
                .maybeSingle();
            if (!staffRow) return [];

            const { data, error } = await supabase
                .from('staff_earnings')
                .select('*')
                .eq('staff_id', staffId)
                .eq('organization_id', organizationId)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: false })
                .limit(10000);

            if (error) throw error;
            return groupByDate((data || []) as StaffEarningRow[]);
        } catch (error) {
            console.error('Error fetching staff earnings:', error);
            throw error;
        }
    },

    /**
     * Get all staff earnings rows for a date range (raw, for internal use).
     */
    async getAllStaffEarnings(startDate: string, endDate: string) {
        try {
            const organizationId = await getCurrentOrganizationId();
            const { data: orgStaff, error: staffIdsError } = await supabase
                .from('staff')
                .select('id')
                .eq('organization_id', organizationId);
            if (staffIdsError) throw staffIdsError;
            const staffIds = (orgStaff || []).map(s => s.id);
            if (staffIds.length === 0) return [];

            const { data, error } = await supabase
                .from('staff_earnings')
                .select(`
                    *,
                    staff:staff(id, name, system_role)
                `)
                .in('staff_id', staffIds)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: false })
                .limit(10000);

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error fetching all staff earnings:', error);
            throw error;
        }
    },

    /**
     * Get earnings summary grouped by staff member (for owner/manager view).
     */
    async getEarningsSummaryByStaff(startDate: string, endDate: string) {
        try {
            const organizationId = await getCurrentOrganizationId();

            const { data: allStaff, error: staffError } = await supabase
                .from('staff')
                .select('id, name, system_role, salary')
                .eq('organization_id', organizationId)
                .eq('is_active', true)
                .order('name');

            if (staffError) throw staffError;

            // Calculate how many full months the date range spans (for monthly salary)
            const startD = new Date(startDate);
            const endD = new Date(endDate);
            const monthsSpanned = Math.max(
                1,
                (endD.getFullYear() - startD.getFullYear()) * 12 +
                (endD.getMonth() - startD.getMonth()) + 1
            );

            const earnings = await this.getAllStaffEarnings(startDate, endDate);

            const earningsMap = new Map<string, {
                total_revenue: number;
                total_commission: number;
                total_salary: number;
                total_earnings: number;
                appointments_count: number;
            }>();

            earnings?.forEach((earning: any) => {
                const staffId = earning.staff_id;
                if (!earningsMap.has(staffId)) {
                    earningsMap.set(staffId, {
                        total_revenue: 0,
                        total_commission: 0,
                        total_salary: 0,
                        total_earnings: 0,
                        appointments_count: 0,
                    });
                }
                const summary = earningsMap.get(staffId)!;
                summary.total_revenue += earning.service_revenue || 0;
                summary.total_commission += earning.commission_amount || 0;
                summary.total_salary += earning.salary_amount || 0;
                summary.total_earnings += earning.total_earnings || 0;
                summary.appointments_count += earning.appointments_count || 0;
            });

            return allStaff?.map(staff => {
                const fromEarnings = earningsMap.get(staff.id) || {
                    total_revenue: 0,
                    total_commission: 0,
                    total_salary: 0,
                    total_earnings: 0,
                    appointments_count: 0,
                };
                // Salary comes from staff.salary (monthly), not from staff_earnings rows
                const monthlySalary = Number(staff.salary || 0);
                const total_salary = monthlySalary * monthsSpanned;
                const total_earnings = fromEarnings.total_commission + total_salary;
                return {
                    staff_id: staff.id,
                    staff_name: staff.name,
                    staff_role: staff.system_role,
                    ...fromEarnings,
                    total_salary,
                    total_earnings,
                };
            });
        } catch (error) {
            console.error('Error getting earnings summary:', error);
            throw error;
        }
    },

    /**
     * Update earnings for multiple appointments in a single invoice (from POS).
     * Inserts one row per appointment per stylist, linked to the invoice.
     */
    async updateEarningsForMultipleAppointments(
        appointmentIds: string[],
        invoiceItems: any[],
        invoiceId: string
    ) {
        try {
            const organizationId = await getCurrentOrganizationId();

            const { data: appointments, error: appointmentsError } = await supabase
                .from('appointments')
                .select(`
                    id,
                    stylist_id,
                    appointment_date,
                    services,
                    stylist:staff!stylist_id(id, commission)
                `)
                .eq('organization_id', organizationId)
                .in('id', appointmentIds);

            if (appointmentsError) throw appointmentsError;
            if (!appointments || appointments.length === 0) {
                console.warn('No appointments found for earnings update');
                return;
            }

            const { data: invoiceRow } = await supabase
                .from('invoices')
                .select('organization_id')
                .eq('id', invoiceId)
                .eq('organization_id', organizationId)
                .single();
            const invoiceOrganizationId = (invoiceRow?.organization_id as string | undefined) || organizationId;

            const DEFAULT_COMMISSION = 40;

            // Delete any existing earnings rows for this invoice first (idempotent)
            await supabase
                .from('staff_earnings')
                .delete()
                .eq('invoice_id', invoiceId)
                .eq('organization_id', organizationId);

            for (const appointment of appointments) {
                const stylistId = appointment.stylist_id;
                const date = appointment.appointment_date;

                if (!stylistId) {
                    console.warn(`Appointment ${appointment.id} has no stylist assigned`);
                    continue;
                }

                let commissionRate = DEFAULT_COMMISSION;
                const stylistData = appointment.stylist as any;

                if (stylistData?.commission) {
                    commissionRate = stylistData.commission;
                } else {
                    const { data: commissionSettings } = await supabase
                        .from('commission_settings')
                        .select('*')
                        .eq('organization_id', invoiceOrganizationId)
                        .eq('role', 'Stylist')
                        .eq('is_active', true)
                        .maybeSingle();
                    if (commissionSettings?.commission_percentage) {
                        commissionRate = commissionSettings.commission_percentage;
                    }
                }

                let serviceRevenue = 0;
                let additionalFeesTotal = 0;

                for (const item of invoiceItems) {
                    if (item.appointmentId === appointment.id) {
                        if (item.type === 'service' || item.type === 'appointment') {
                            serviceRevenue += (item.price || 0) * (item.quantity || 1);
                            additionalFeesTotal += item.additionalFee || 0;
                        }
                    }
                }

                if (serviceRevenue === 0 && additionalFeesTotal === 0) continue;

                const totalRevenue = serviceRevenue + additionalFeesTotal;
                const commissionAmount = (totalRevenue * commissionRate) / 100;

                await supabase
                    .from('staff_earnings')
                    .insert({
                        staff_id: stylistId,
                        invoice_id: invoiceId,
                        appointment_id: appointment.id,
                        date,
                        service_revenue: totalRevenue,
                        commission_amount: commissionAmount,
                        salary_amount: 0,
                        total_earnings: commissionAmount,
                        appointments_count: 1,
                        organization_id: organizationId,
                    });
            }
        } catch (error: any) {
            console.error('Error updating earnings for multiple appointments:', error);
            throw error;
        }
    },

    /**
     * Calculate and update earnings for walk-in services (no appointment).
     * One row per invoice per stylist, with invoice_id but no appointment_id.
     */
    async updateEarningsForWalkIn(
        invoiceId: string,
        items: any[],
        invoiceDate: string
    ) {
        try {
            const organizationId = await getCurrentOrganizationId();

            const { data: invOrg } = await supabase
                .from('invoices')
                .select('organization_id')
                .eq('id', invoiceId)
                .eq('organization_id', organizationId)
                .single();
            if (!invOrg) {
                console.warn('Walk-in earnings: invoice not found in tenant');
                return;
            }

            const walkInItems = items.filter((item: any) =>
                (item.type === 'walk-in-service' || item.type === 'manual') && item.stylistId
            );
            if (walkInItems.length === 0) return;

            const date = invoiceDate.split('T')[0];

            // Group items by stylist
            const itemsByStylist = new Map<string, any[]>();
            walkInItems.forEach((item: any) => {
                if (!itemsByStylist.has(item.stylistId)) {
                    itemsByStylist.set(item.stylistId, []);
                }
                itemsByStylist.get(item.stylistId)!.push(item);
            });

            // Delete any existing walk-in earnings for this invoice (idempotent)
            await supabase
                .from('staff_earnings')
                .delete()
                .eq('invoice_id', invoiceId)
                .eq('organization_id', organizationId);

            for (const [stylistId, stylistItems] of itemsByStylist) {
                const { data: stylist } = await supabase
                    .from('staff')
                    .select('commission')
                    .eq('id', stylistId)
                    .eq('organization_id', organizationId)
                    .single();

                const commissionRate = stylist?.commission || 40;
                const serviceRevenue = stylistItems.reduce(
                    (sum: number, item: any) => sum + (item.price * item.quantity), 0
                );
                const commissionAmount = (serviceRevenue * commissionRate) / 100;

                await supabase
                    .from('staff_earnings')
                    .insert({
                        staff_id: stylistId,
                        invoice_id: invoiceId,
                        appointment_id: null, // walk-ins have no appointment
                        date,
                        service_revenue: serviceRevenue,
                        commission_amount: commissionAmount,
                        salary_amount: 0,
                        total_earnings: commissionAmount,
                        appointments_count: 0,
                        organization_id: organizationId,
                    });
            }
        } catch (error: any) {
            console.error('Error updating earnings for walk-in services:', error);
            throw error;
        }
    },
};
