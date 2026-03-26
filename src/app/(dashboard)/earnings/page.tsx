'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Calendar, User } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { earningsService } from '@/services/earnings';
import { formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function EarningsPage() {
    const { user, hasRole } = useAuth();
    const [loading, setLoading] = useState(true);
    const [earnings, setEarnings] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    const isStaff = user?.role === 'Stylist' || user?.role === 'Receptionist' || user?.role === 'Manager';
    const isOwner = hasRole(['Owner', 'Manager']);

    useEffect(() => {
        fetchEarnings();
    }, [dateRange]);

    // Auto-refresh when page becomes visible (e.g., after completing an appointment)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                console.log('Earnings page visible, refreshing data...');
                fetchEarnings();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [dateRange]);

    const fetchEarnings = async () => {
        try {
            setLoading(true);
            console.log('=== Fetching earnings ===');
            console.log('Date range:', dateRange);
            console.log('User role:', user?.role);
            console.log('Is owner:', isOwner);

            if (isStaff && !isOwner) {
                // Fetch individual staff earnings by resolving staff.id from profile id
                const { data: staffRow, error: staffLookupError } = await supabase
                    .from('staff')
                    .select('id')
                    .eq('profile_id', user?.id || '')
                    .eq('is_active', true)
                    .single();

                if (staffLookupError || !staffRow?.id) {
                    console.warn('Staff record not found for current user:', staffLookupError);
                    setEarnings([]);
                    setSummary({
                        total_earnings: 0,
                        total_commission: 0,
                        total_salary: 0,
                        appointments_count: 0
                    });
                    return;
                }

                const staffData = await earningsService.getStaffEarnings(
                    staffRow.id,
                    dateRange.start,
                    dateRange.end
                );
                console.log('Staff earnings fetched:', staffData?.length, 'records');
                setEarnings(staffData || []);

                // Calculate summary
                const total = staffData?.reduce((sum: number, e: any) => sum + e.total_earnings, 0) || 0;
                const totalCommission = staffData?.reduce((sum: number, e: any) => sum + e.commission_amount, 0) || 0;
                const totalSalary = staffData?.reduce((sum: number, e: any) => sum + e.salary_amount, 0) || 0;
                const appointments = staffData?.reduce((sum: number, e: any) => sum + e.appointments_count, 0) || 0;

                setSummary({
                    total_earnings: total,
                    total_commission: totalCommission,
                    total_salary: totalSalary,
                    appointments_count: appointments
                });
            } else if (isOwner) {
                // Fetch all staff earnings summary
                const summaryData = await earningsService.getEarningsSummaryByStaff(
                    dateRange.start,
                    dateRange.end
                );
                console.log('Owner view - staff earnings fetched:', summaryData?.length, 'staff members');
                console.log('Earnings data:', summaryData);
                setEarnings(summaryData || []);
            }
        } catch (error) {
            console.error('Error fetching earnings:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderStaffView = () => (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="card p-6 bg-gradient-to-br from-primary-500 to-primary-600 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-primary-100 text-sm">Total Earnings</p>
                            <h3 className="text-2xl font-bold mt-1">
                                {formatCurrency(summary?.total_earnings || 0)}
                            </h3>
                        </div>
                        <DollarSign className="h-10 w-10 text-primary-200" />
                    </div>
                </div>

                <div className="card p-6 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Commission</p>
                            <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
                                {formatCurrency(summary?.total_commission || 0)}
                            </h3>
                        </div>
                        <TrendingUp className="h-10 w-10 text-success-500" />
                    </div>
                </div>

                <div className="card p-6 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Salary</p>
                            <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
                                {formatCurrency(summary?.total_salary || 0)}
                            </h3>
                        </div>
                        <Calendar className="h-10 w-10 text-secondary-500" />
                    </div>
                </div>

                <div className="card p-6 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Appointments</p>
                            <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
                                {summary?.appointments_count || 0}
                            </h3>
                        </div>
                        <User className="h-10 w-10 text-warning-500" />
                    </div>
                </div>
            </div>

            {/* Daily Earnings Table */}
            <div className="card p-6 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
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
                            {earnings.map((earning: any) => (
                                <tr key={earning.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                    <td className="py-3 px-3 sm:px-4 text-gray-900 dark:text-white">
                                        {new Date(earning.date).toLocaleDateString()}
                                    </td>
                                    <td className="py-3 px-3 sm:px-4 text-right text-gray-700 dark:text-gray-300">
                                        {formatCurrency(earning.service_revenue)}
                                    </td>
                                    <td className="py-3 px-3 sm:px-4 text-right text-success-600 dark:text-success-400">
                                        {formatCurrency(earning.commission_amount)}
                                    </td>
                                    <td className="hidden md:table-cell py-3 px-3 sm:px-4 text-right text-secondary-600 dark:text-secondary-400">
                                        {formatCurrency(earning.salary_amount)}
                                    </td>
                                    <td className="py-3 px-3 sm:px-4 text-right font-semibold text-gray-900 dark:text-white">
                                        {formatCurrency(earning.total_earnings)}
                                    </td>
                                    <td className="hidden md:table-cell py-3 px-3 sm:px-4 text-right text-gray-700 dark:text-gray-300">
                                        {earning.appointments_count}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderOwnerView = () => (
        <div className="card p-6 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
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
                        {earnings.map((earning: any) => (
                            <tr key={earning.staff_id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                <td className="py-3 px-3 sm:px-4 font-medium text-gray-900 dark:text-white">
                                    {earning.staff_name}
                                </td>
                                <td className="hidden md:table-cell py-3 px-3 sm:px-4 text-gray-700 dark:text-gray-300">
                                    {earning.staff_role}
                                </td>
                                <td className="py-3 px-3 sm:px-4 text-right text-gray-700 dark:text-gray-300">
                                    {formatCurrency(earning.total_revenue)}
                                </td>
                                <td className="py-3 px-3 sm:px-4 text-right text-success-600 dark:text-success-400">
                                    {formatCurrency(earning.total_commission)}
                                </td>
                                <td className="hidden md:table-cell py-3 px-3 sm:px-4 text-right text-secondary-600 dark:text-secondary-400">
                                    {formatCurrency(earning.total_salary)}
                                </td>
                                <td className="py-3 px-3 sm:px-4 text-right font-semibold text-gray-900 dark:text-white">
                                    {formatCurrency(earning.total_earnings)}
                                </td>
                                <td className="hidden md:table-cell py-3 px-3 sm:px-4 text-right text-gray-700 dark:text-gray-300">
                                    {earning.appointments_count}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Earnings</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        {isOwner ? 'View staff earnings and commission' : 'Track your earnings and performance'}
                    </p>
                </div>

                {/* Date Range Filter */}
                <div className="flex flex-wrap gap-2">
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400">Loading earnings...</p>
                </div>
            ) : isOwner ? renderOwnerView() : renderStaffView()}
        </div>
    );
}
