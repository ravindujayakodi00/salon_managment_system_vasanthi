'use client';

import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Calendar, User, Receipt } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { earningsService } from '@/services/earnings';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

function todayStr() {
    return new Date().toISOString().split('T')[0];
}
function yesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
}
function thisWeekStart() {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
}
function thisMonthStart() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

const PRESETS = [
    { label: 'Today', getRange: () => ({ start: todayStr(), end: todayStr() }) },
    { label: 'Yesterday', getRange: () => ({ start: yesterdayStr(), end: yesterdayStr() }) },
    { label: 'This Week', getRange: () => ({ start: thisWeekStart(), end: todayStr() }) },
    { label: 'This Month', getRange: () => ({ start: thisMonthStart(), end: todayStr() }) },
];

export default function EarningsPage() {
    const { user, hasRole } = useAuth();
    const { effectiveBranchId } = useWorkspace();
    const [loading, setLoading] = useState(true);
    const [earnings, setEarnings] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [activePreset, setActivePreset] = useState<string | null>('This Month');
    const [dateRange, setDateRange] = useState({
        start: thisMonthStart(),
        end: todayStr(),
    });

    const isStaff = user?.systemRole === 'Stylist' || user?.systemRole === 'Receptionist' || user?.systemRole === 'Manager';
    const isOwner = hasRole(['Owner', 'Manager']);

    useEffect(() => {
        fetchEarnings();
    }, [dateRange, effectiveBranchId]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) fetchEarnings();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [dateRange]);

    const fetchEarnings = async () => {
        try {
            setLoading(true);

            if (isStaff && !isOwner) {
                const { data: staffRow, error: staffLookupError } = await supabase
                    .from('staff')
                    .select('id')
                    .eq('profile_id', user?.id || '')
                    .eq('is_active', true)
                    .single();

                if (staffLookupError || !staffRow?.id) {
                    console.warn('Staff record not found for current user:', staffLookupError);
                    setEarnings([]);
                    setSummary({ total_revenue: 0, total_earnings: 0, total_commission: 0, total_salary: 0, appointments_count: 0 });
                    return;
                }

                const staffData = await earningsService.getStaffEarnings(staffRow.id, dateRange.start, dateRange.end);
                setEarnings(staffData || []);

                const total_revenue = staffData?.reduce((sum: number, e: any) => sum + (e.service_revenue || 0), 0) || 0;
                const total_earnings = staffData?.reduce((sum: number, e: any) => sum + (e.total_earnings || 0), 0) || 0;
                const total_commission = staffData?.reduce((sum: number, e: any) => sum + (e.commission_amount || 0), 0) || 0;
                const total_salary = staffData?.reduce((sum: number, e: any) => sum + (e.salary_amount || 0), 0) || 0;
                const appointments_count = staffData?.reduce((sum: number, e: any) => sum + (e.appointments_count || 0), 0) || 0;
                setSummary({ total_revenue, total_earnings, total_commission, total_salary, appointments_count });
            } else if (isOwner) {
                const summaryData = await earningsService.getEarningsSummaryByStaff(dateRange.start, dateRange.end);
                setEarnings(summaryData || []);
            }
        } catch (error) {
            console.error('Error fetching earnings:', error);
        } finally {
            setLoading(false);
        }
    };

    const applyPreset = (preset: typeof PRESETS[number]) => {
        setActivePreset(preset.label);
        setDateRange(preset.getRange());
    };

    const handleDateChange = (field: 'start' | 'end', value: string) => {
        setActivePreset(null);
        setDateRange(prev => ({ ...prev, [field]: value }));
    };

    // Totals derived from the loaded earnings data — always equals the sum of the table columns
    const ownerTotals = isOwner ? {
        total_revenue: earnings.reduce((sum, e) => sum + (e.total_revenue || 0), 0),
        total_commission: earnings.reduce((sum, e) => sum + (e.total_commission || 0), 0),
        total_salary: earnings.reduce((sum, e) => sum + (e.total_salary || 0), 0),
        total_earnings: earnings.reduce((sum, e) => sum + (e.total_earnings || 0), 0),
        appointments_count: earnings.reduce((sum, e) => sum + (e.appointments_count || 0), 0),
    } : null;

    const renderRevenueBanner = (totalRevenue: number, totalAppointments: number) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card p-6 surface-panel">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Total Revenue</p>
                        <h3 className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{formatCurrency(totalRevenue)}</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                            {dateRange.start === dateRange.end ? dateRange.start : `${dateRange.start} — ${dateRange.end}`}
                        </p>
                    </div>
                    <Receipt className="h-12 w-12 text-emerald-500 opacity-70" />
                </div>
            </div>
            <div className="card p-6 surface-panel">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Total Appointments</p>
                        <h3 className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{totalAppointments}</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Across selected period</p>
                    </div>
                    <Calendar className="h-12 w-12 text-emerald-500 opacity-70" />
                </div>
            </div>
        </div>
    );

    const renderStaffView = () => (
        <div className="space-y-6">
            {renderRevenueBanner(summary?.total_revenue || 0, summary?.appointments_count || 0)}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="card p-6 bg-gradient-to-br from-primary-500 to-primary-600 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-primary-100 text-sm">Total Earnings</p>
                            <h3 className="text-2xl font-bold mt-1">{formatCurrency(summary?.total_earnings || 0)}</h3>
                        </div>
                        <DollarSign className="h-10 w-10 text-primary-200" />
                    </div>
                </div>
                <div className="card p-6 surface-panel">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Commission</p>
                            <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{formatCurrency(summary?.total_commission || 0)}</h3>
                        </div>
                        <TrendingUp className="h-10 w-10 text-success-500" />
                    </div>
                </div>
                <div className="card p-6 surface-panel">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Salary</p>
                            <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{formatCurrency(summary?.total_salary || 0)}</h3>
                        </div>
                        <Calendar className="h-10 w-10 text-secondary-500" />
                    </div>
                </div>
                <div className="card p-6 surface-panel">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Appointments</p>
                            <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{summary?.appointments_count || 0}</h3>
                        </div>
                        <User className="h-10 w-10 text-warning-500" />
                    </div>
                </div>
            </div>

            <div className="card p-6 surface-panel">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Daily Breakdown</h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left py-3 px-3 sm:px-4 font-semibold text-gray-700 dark:text-gray-300">Date</th>
                                <th className="text-right py-3 px-3 sm:px-4 font-semibold text-gray-700 dark:text-gray-300">Revenue</th>
                                <th className="text-right py-3 px-3 sm:px-4 font-semibold text-gray-700 dark:text-gray-300">Commission</th>
                                <th className="hidden md:table-cell text-right py-3 px-3 sm:px-4 font-semibold text-gray-700 dark:text-gray-300">Salary</th>
                                <th className="text-right py-3 px-3 sm:px-4 font-semibold text-gray-700 dark:text-gray-300">Total</th>
                                <th className="hidden md:table-cell text-right py-3 px-3 sm:px-4 font-semibold text-gray-700 dark:text-gray-300">Appointments</th>
                            </tr>
                        </thead>
                        <tbody>
                            {earnings.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-gray-500 dark:text-gray-400">No earnings data for this period</td>
                                </tr>
                            ) : earnings.map((earning: any) => (
                                <tr key={earning.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                    <td className="py-3 px-3 sm:px-4 text-gray-900 dark:text-white">{new Date(earning.date).toLocaleDateString()}</td>
                                    <td className="py-3 px-3 sm:px-4 text-right text-gray-700 dark:text-gray-300">{formatCurrency(earning.service_revenue)}</td>
                                    <td className="py-3 px-3 sm:px-4 text-right text-success-600 dark:text-success-400">{formatCurrency(earning.commission_amount)}</td>
                                    <td className="hidden md:table-cell py-3 px-3 sm:px-4 text-right text-secondary-600 dark:text-secondary-400">{formatCurrency(earning.salary_amount)}</td>
                                    <td className="py-3 px-3 sm:px-4 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(earning.total_earnings)}</td>
                                    <td className="hidden md:table-cell py-3 px-3 sm:px-4 text-right text-gray-700 dark:text-gray-300">{earning.appointments_count}</td>
                                </tr>
                            ))}
                        </tbody>
                        {earnings.length > 0 && (
                            <tfoot>
                                <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 font-semibold">
                                    <td className="py-3 px-3 sm:px-4 text-gray-900 dark:text-white">Total</td>
                                    <td className="py-3 px-3 sm:px-4 text-right text-gray-900 dark:text-white">{formatCurrency(summary?.total_revenue || 0)}</td>
                                    <td className="py-3 px-3 sm:px-4 text-right text-success-700 dark:text-success-300">{formatCurrency(summary?.total_commission || 0)}</td>
                                    <td className="hidden md:table-cell py-3 px-3 sm:px-4 text-right text-secondary-700 dark:text-secondary-300">{formatCurrency(summary?.total_salary || 0)}</td>
                                    <td className="py-3 px-3 sm:px-4 text-right text-gray-900 dark:text-white">{formatCurrency(summary?.total_earnings || 0)}</td>
                                    <td className="hidden md:table-cell py-3 px-3 sm:px-4 text-right text-gray-900 dark:text-white">{summary?.appointments_count || 0}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );

    const renderOwnerView = () => (
        <div className="space-y-6">
            {renderRevenueBanner(ownerTotals?.total_revenue || 0, ownerTotals?.appointments_count || 0)}

            <div className="card p-6 surface-panel">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Staff Earnings Summary</h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left py-3 px-3 sm:px-4 font-semibold text-gray-700 dark:text-gray-300">Staff</th>
                                <th className="hidden md:table-cell text-left py-3 px-3 sm:px-4 font-semibold text-gray-700 dark:text-gray-300">Role</th>
                                <th className="text-right py-3 px-3 sm:px-4 font-semibold text-gray-700 dark:text-gray-300">Revenue</th>
                                <th className="text-right py-3 px-3 sm:px-4 font-semibold text-gray-700 dark:text-gray-300">Commission</th>
                                <th className="hidden md:table-cell text-right py-3 px-3 sm:px-4 font-semibold text-gray-700 dark:text-gray-300">Salary</th>
                                <th className="text-right py-3 px-3 sm:px-4 font-semibold text-gray-700 dark:text-gray-300">Total Earnings</th>
                                <th className="hidden md:table-cell text-right py-3 px-3 sm:px-4 font-semibold text-gray-700 dark:text-gray-300">Appointments</th>
                            </tr>
                        </thead>
                        <tbody>
                            {earnings.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-gray-500 dark:text-gray-400">No earnings data for this period</td>
                                </tr>
                            ) : earnings.map((earning: any) => (
                                <tr key={earning.staff_id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                    <td className="py-3 px-3 sm:px-4 font-medium text-gray-900 dark:text-white">{earning.staff_name}</td>
                                    <td className="hidden md:table-cell py-3 px-3 sm:px-4 text-gray-700 dark:text-gray-300">{earning.staff_role}</td>
                                    <td className="py-3 px-3 sm:px-4 text-right text-gray-700 dark:text-gray-300">{formatCurrency(earning.total_revenue)}</td>
                                    <td className="py-3 px-3 sm:px-4 text-right text-success-600 dark:text-success-400">{formatCurrency(earning.total_commission)}</td>
                                    <td className="hidden md:table-cell py-3 px-3 sm:px-4 text-right text-secondary-600 dark:text-secondary-400">{formatCurrency(earning.total_salary)}</td>
                                    <td className="py-3 px-3 sm:px-4 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(earning.total_earnings)}</td>
                                    <td className="hidden md:table-cell py-3 px-3 sm:px-4 text-right text-gray-700 dark:text-gray-300">{earning.appointments_count}</td>
                                </tr>
                            ))}
                        </tbody>
                        {earnings.length > 0 && (
                            <tfoot>
                                <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 font-semibold">
                                    <td className="py-3 px-3 sm:px-4 text-gray-900 dark:text-white">Total</td>
                                    <td className="hidden md:table-cell py-3 px-3 sm:px-4" />
                                    <td className="py-3 px-3 sm:px-4 text-right text-gray-900 dark:text-white">{formatCurrency(ownerTotals?.total_revenue || 0)}</td>
                                    <td className="py-3 px-3 sm:px-4 text-right text-success-700 dark:text-success-300">{formatCurrency(ownerTotals?.total_commission || 0)}</td>
                                    <td className="hidden md:table-cell py-3 px-3 sm:px-4 text-right text-secondary-700 dark:text-secondary-300">{formatCurrency(ownerTotals?.total_salary || 0)}</td>
                                    <td className="py-3 px-3 sm:px-4 text-right text-gray-900 dark:text-white">{formatCurrency(ownerTotals?.total_earnings || 0)}</td>
                                    <td className="hidden md:table-cell py-3 px-3 sm:px-4 text-right text-gray-900 dark:text-white">{ownerTotals?.appointments_count || 0}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Earnings</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                            {isOwner ? 'View revenue and staff earnings' : 'Track your revenue and performance'}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => handleDateChange('start', e.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                        <span className="text-gray-500 dark:text-gray-400 text-sm">to</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => handleDateChange('end', e.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {PRESETS.map(preset => (
                        <button
                            key={preset.label}
                            onClick={() => applyPreset(preset)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                activePreset === preset.label
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400">Loading earnings...</p>
                </div>
            ) : isOwner ? renderOwnerView() : renderStaffView()}
        </div>
    );
}
