import { supabase } from '@/lib/supabase';
import { getLocalDateString } from '@/lib/utils';
import { calculatePaymentTotals } from '@/lib/payment-utils';

export const reportsService = {
    /**
     * Get basic dashboard stats for today
     */
    async getDashboardStats(branchId?: string, stylistStaffId?: string) {
        const today = getLocalDateString();

        let apptQuery = supabase.from('appointments').select('id, status').eq('appointment_date', today);
        if (branchId) apptQuery = apptQuery.eq('branch_id', branchId);
        if (stylistStaffId) apptQuery = apptQuery.eq('stylist_id', stylistStaffId);
        const { data: appointments, error: apptError } = await apptQuery;

        if (apptError) throw apptError;

        const aptRows = appointments || [];
        const todayAppointments = aptRows.length;
        const completedAppointments = aptRows.filter(a => a.status === 'Completed').length;
        const cancelledAppointments = aptRows.filter(a => a.status === 'Cancelled').length;
        const noShowAppointments = aptRows.filter(a => a.status === 'NoShow').length;

        let invQuery = supabase
            .from('invoices')
            .select('total, created_at, appointment_id')
            .gte('created_at', `${today}T00:00:00`)
            .lte('created_at', `${today}T23:59:59`);
        if (branchId) invQuery = invQuery.eq('branch_id', branchId);
        const { data: invoices, error: invoiceError } = await invQuery;

        if (invoiceError) throw invoiceError;

        let todayRevenue = 0;
        if (stylistStaffId) {
            const allowed = new Set(aptRows.map(a => a.id));
            todayRevenue =
                (invoices || []).reduce((sum, inv: { total?: number; appointment_id?: string | null }) => {
                    if (inv.appointment_id && allowed.has(inv.appointment_id)) {
                        return sum + (inv.total || 0);
                    }
                    return sum;
                }, 0) || 0;
        } else {
            todayRevenue = invoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
        }

        return {
            todayRevenue,
            todayAppointments,
            completedAppointments,
            cancelledAppointments,
            noShowAppointments
        };
    },

    /**
     * Get top performing services by revenue
     */
    async getTopServices(startDate: string, endDate: string, branchId?: string, stylistStaffId?: string) {
        let q = supabase
            .from('invoices')
            .select('items, appointment_id')
            .gte('created_at', startDate)
            .lte('created_at', endDate);
        if (branchId) q = q.eq('branch_id', branchId);
        const { data: invoices, error } = await q;

        if (error) throw error;

        let rows = invoices || [];
        if (stylistStaffId && rows.length > 0) {
            const aptIds = [...new Set(rows.map((i: { appointment_id?: string | null }) => i.appointment_id).filter(Boolean))] as string[];
            if (aptIds.length === 0) rows = [];
            else {
                const { data: apts } = await supabase
                    .from('appointments')
                    .select('id')
                    .in('id', aptIds)
                    .eq('stylist_id', stylistStaffId);
                const allowed = new Set((apts || []).map(a => a.id));
                rows = rows.filter((i: { appointment_id?: string | null }) => i.appointment_id && allowed.has(i.appointment_id));
            }
        }

        const serviceStats = new Map<string, { revenue: number; count: number }>();

        rows.forEach(invoice => {
            const items = invoice.items as any[];
            if (Array.isArray(items)) {
                items.forEach(item => {
                    const current = serviceStats.get(item.name) || { revenue: 0, count: 0 };
                    current.revenue += (item.price * item.quantity);
                    current.count += item.quantity;
                    serviceStats.set(item.name, current);
                });
            }
        });

        return Array.from(serviceStats.entries())
            .map(([serviceName, stats]) => ({
                serviceName,
                ...stats
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);
    },

    /**
     * Get staff performance (revenue and appointment count)
     */
    async getStaffPerformance(startDate: string, endDate: string, branchId?: string, stylistStaffId?: string) {
        let q = supabase
            .from('invoices')
            .select(`
                total,
                appointment:appointments(
                    stylist_id,
                    stylist:staff(name)
                )
            `)
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${endDate}T23:59:59`)
            .not('appointment', 'is', null);
        if (branchId) q = q.eq('branch_id', branchId);
        const { data: invoicesWithAppt, error: invError } = await q;

        if (invError) throw invError;

        const stylistStats = new Map<string, { revenue: number; appointmentCount: number }>();

        invoicesWithAppt?.forEach((inv: any) => {
            if (stylistStaffId && inv.appointment?.stylist_id !== stylistStaffId) return;
            const stylistName = inv.appointment?.stylist?.name;
            if (stylistName) {
                const current = stylistStats.get(stylistName) || { revenue: 0, appointmentCount: 0 };
                current.revenue += inv.total;
                current.appointmentCount += 1;
                stylistStats.set(stylistName, current);
            }
        });

        return Array.from(stylistStats.entries())
            .map(([stylistName, stats]) => ({
                stylistName,
                ...stats
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);
    },

    /**
     * Get monthly sales report data for PDF
     */
    async getSalesReportData(month: number, year: number) {
        const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        const { data: invoices, error } = await supabase
            .from('invoices')
            .select('*')
            .gte('created_at', `${startDate}T00:00:00`)
            .lte('created_at', `${endDate}T23:59:59`);

        if (error) throw error;

        const totalRevenue = invoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0;
        const totalDiscount = invoices?.reduce((sum, inv) => sum + (inv.discount || 0), 0) || 0;
        const totalTax = invoices?.reduce((sum, inv) => sum + (inv.tax || 0), 0) || 0;

        // NEW: Calculate payment totals with split payment support
        const paymentTotals = calculatePaymentTotals(invoices || []);

        const byService: { [key: string]: { revenue: number; count: number } } = {};
        invoices?.forEach(inv => {
            const items = inv.items as any[] || [];
            items.forEach(item => {
                const serviceName = item.name || 'Unknown Service';
                if (!byService[serviceName]) byService[serviceName] = { revenue: 0, count: 0 };
                byService[serviceName].revenue += (item.price || 0) * (item.quantity || 1);
                byService[serviceName].count += item.quantity || 1;
            });
        });

        const dailyStats: { [key: string]: { revenue: number; transactions: number } } = {};
        invoices?.forEach(inv => {
            const date = inv.created_at.split('T')[0];
            if (!dailyStats[date]) dailyStats[date] = { revenue: 0, transactions: 0 };
            dailyStats[date].revenue += inv.total || 0;
            dailyStats[date].transactions += 1;
        });

        return {
            month: new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' }),
            year,
            totalRevenue,
            totalTransactions: invoices?.length || 0,
            totalDiscount,
            totalTax,
            // NEW: Payment method totals
            totalCash: paymentTotals.totalCash,
            totalCard: paymentTotals.totalCard,
            totalBankTransfer: paymentTotals.totalBankTransfer,
            totalOther: paymentTotals.totalOther,
            splitPaymentCount: paymentTotals.splitPaymentCount,
            // Legacy format for backward compatibility
            byPaymentMethod: [
                { method: 'Cash', amount: paymentTotals.totalCash, count: 0 },
                { method: 'Card', amount: paymentTotals.totalCard, count: 0 },
                { method: 'Bank Transfer', amount: paymentTotals.totalBankTransfer, count: 0 },
                { method: 'Other', amount: paymentTotals.totalOther, count: 0 }
            ].filter(p => p.amount > 0),
            byService: Object.entries(byService)
                .map(([service, data]) => ({ service, revenue: data.revenue, count: data.count }))
                .sort((a, b) => b.revenue - a.revenue),
            dailyStats: Object.entries(dailyStats)
                .map(([date, data]) => ({ date, revenue: data.revenue, transactions: data.transactions }))
                .sort((a, b) => a.date.localeCompare(b.date))
        };
    },

    /**
     * Get customer growth report data for PDF
     */
    async getCustomerGrowthReportData() {
        const { data: customers, error } = await supabase
            .from('customers')
            .select('*')
            .order('total_spent', { ascending: false });

        if (error) throw error;

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        const newCustomersThisMonth = customers?.filter(c => new Date(c.created_at) >= thisMonthStart).length || 0;
        const newCustomersLastMonth = customers?.filter(c => {
            const createdDate = new Date(c.created_at);
            return createdDate >= lastMonthStart && createdDate <= lastMonthEnd;
        }).length || 0;

        const topCustomers = customers?.slice(0, 10).map(c => ({
            name: c.name,
            phone: c.phone,
            totalSpent: c.total_spent || 0,
            visits: c.total_visits || 0
        })) || [];

        const genderCounts: { [key: string]: number } = {};
        customers?.forEach(c => {
            const gender = c.gender || 'Unknown';
            genderCounts[gender] = (genderCounts[gender] || 0) + 1;
        });

        const totalCustomers = customers?.length || 1;
        const byGender = Object.entries(genderCounts).map(([gender, count]) => ({
            gender, count, percentage: (count / totalCustomers) * 100
        }));

        const segmentCounts: { [key: string]: number } = {};
        customers?.forEach(c => {
            const segments = c.segment_tags as string[] || [];
            segments.forEach(seg => segmentCounts[seg] = (segmentCounts[seg] || 0) + 1);
        });

        const bySegment = Object.entries(segmentCounts)
            .map(([segment, count]) => ({ segment, count }))
            .sort((a, b) => b.count - a.count);

        return {
            totalCustomers,
            newCustomersThisMonth,
            newCustomersLastMonth,
            topCustomers,
            byGender,
            bySegment
        };
    },

    /**
     * Get staff performance report data for PDF
     */
    async getStaffPerformanceReportData(startDate?: string, endDate?: string) {
        if (!startDate || !endDate) {
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        }

        const { data: staff, error: staffError } = await supabase
            .from('staff')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (staffError) throw staffError;

        const performanceData = await Promise.all(
            (staff || []).map(async (staffMember) => {
                const { data: appointments } = await supabase
                    .from('appointments')
                    .select('id')
                    .eq('stylist_id', staffMember.id)
                    .eq('status', 'Completed')
                    .gte('appointment_date', startDate!)
                    .lte('appointment_date', endDate!);

                const { data: earnings } = await supabase
                    .from('staff_earnings')
                    .select('service_revenue, commission_amount')
                    .eq('staff_id', staffMember.id)
                    .gte('date', startDate!)
                    .lte('date', endDate!);

                const totalRevenue = earnings?.reduce((sum, e) => sum + (e.service_revenue || 0), 0) || 0;
                const totalCommission = earnings?.reduce((sum, e) => sum + (e.commission_amount || 0), 0) || 0;

                return {
                    name: staffMember.name,
                    role: staffMember.role,
                    appointmentsCompleted: appointments?.length || 0,
                    totalRevenue,
                    commission: totalCommission,
                    avgServiceTime: 45
                };
            })
        );

        return {
            period: `${startDate} to ${endDate}`,
            staffPerformance: performanceData.filter(p => p.appointmentsCompleted > 0 || p.totalRevenue > 0)
        };
    },

    /**
     * Get inventory status report data for PDF
     */
    async getInventoryReportData() {
        const { data: products, error } = await supabase
            .from('inventory')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) throw error;

        const totalProducts = products?.length || 0;
        const totalValue = products?.reduce((sum, p) => sum + (p.current_stock * p.cost_per_unit), 0) || 0;

        // Low stock items
        const lowStockItems = products?.filter(p => p.current_stock <= p.min_stock_level) || [];

        // Out of stock items
        const outOfStockItems = products?.filter(p => p.current_stock === 0) || [];

        // Category breakdown
        const categoryStats: { [key: string]: { count: number; value: number } } = {};
        products?.forEach(p => {
            if (!categoryStats[p.category]) {
                categoryStats[p.category] = { count: 0, value: 0 };
            }
            categoryStats[p.category].count += 1;
            categoryStats[p.category].value += p.current_stock * p.cost_per_unit;
        });

        const byCategory = Object.entries(categoryStats).map(([category, stats]) => ({
            category,
            productCount: stats.count,
            totalValue: stats.value
        }));

        // Stock status breakdown
        const stockStatus = products?.map(p => ({
            name: p.name,
            category: p.category,
            currentStock: p.current_stock,
            minStock: p.min_stock_level,
            unit: p.unit,
            status: p.current_stock === 0 ? 'Out of Stock' :
                p.current_stock < p.min_stock_level ? 'Low Stock' :
                    p.current_stock === p.min_stock_level ? 'At Minimum' : 'In Stock'
        })) || [];

        return {
            totalProducts,
            totalValue,
            lowStockCount: lowStockItems.length,
            outOfStockCount: outOfStockItems.length,
            lowStockItems: lowStockItems.map(p => ({
                name: p.name,
                currentStock: p.current_stock,
                minStock: p.min_stock_level,
                unit: p.unit
            })),
            byCategory,
            stockStatus: stockStatus.slice(0, 20) // Top 20 for report
        };
    }
};
