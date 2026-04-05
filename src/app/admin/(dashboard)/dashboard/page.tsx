'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StatCard from '@/components/shared/StatCard';
import { reportsService } from '@/services/reports';
import { availabilityService } from '@/services/availability';
import { staffService } from '@/services/staff';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { supabase } from '@/lib/supabase';
import { getLocalDateString } from '@/lib/utils';
import { adminHref } from '@/lib/admin-paths';
import {
    DollarSign,
    Calendar,
    CheckCircle2,
    XCircle,
    Scissors,
    Users,
    TrendingUp,
    Clock,
} from 'lucide-react';

interface DashboardStats {
    todayRevenue: number;
    todayAppointments: number;
    completed: number;
    cancelled: number;
    noShow: number;
    pending: number;
    topServices: { name: string; count: number; revenue: number }[];
    topStylists: { name: string; revenue: number; appointments: number }[];
    revenueWeek: { day: string; revenue: number }[];
    recentActivity: { time: string; action: string; customer: string; amount?: number }[];
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6b7280'];

export default function DashboardPage() {
    const { user } = useAuth();
    const { effectiveBranchId } = useWorkspace();
    const [stats, setStats] = useState<DashboardStats>({
        todayRevenue: 0,
        todayAppointments: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
        pending: 0,
        topServices: [],
        topStylists: [],
        revenueWeek: [],
        recentActivity: [],
    });
    const [loading, setLoading] = useState(true);
    const [isEmergencyUnavailable, setIsEmergencyUnavailable] = useState(false);
    const [togglingEmergency, setTogglingEmergency] = useState(false);
    const [staffId, setStaffId] = useState<string | null>(null);

    const revenueTrendDelta = (() => {
        if (!stats.revenueWeek || stats.revenueWeek.length < 2) return 0;
        const latest = stats.revenueWeek[stats.revenueWeek.length - 1]?.revenue || 0;
        const previous = stats.revenueWeek[stats.revenueWeek.length - 2]?.revenue || 0;
        if (previous === 0) return latest > 0 ? 100 : 0;
        return Number((((latest - previous) / previous) * 100).toFixed(1));
    })();

    const appointmentsTrendDelta = (() => {
        const todayTotal = stats.todayAppointments || 0;
        const doneToday = (stats.completed || 0) + (stats.cancelled || 0) + (stats.noShow || 0);
        if (doneToday === 0) return todayTotal > 0 ? 100 : 0;
        return Number((((todayTotal - doneToday) / doneToday) * 100).toFixed(1));
    })();

    useEffect(() => {
        fetchDashboardData();
    }, [effectiveBranchId, user?.role, user?.email]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            let stylistStaffId: string | undefined;
            if (user?.role === 'Stylist' && user?.email) {
                try {
                    const staff = await staffService.getStaffByEmail(user.email);
                    if (staff?.id) {
                        stylistStaffId = staff.id;
                        setStaffId(staff.id);
                        const status = await availabilityService.getEmergencyStatus(staff.id);
                        setIsEmergencyUnavailable(status);
                    } else {
                        setStaffId(null);
                    }
                } catch (error) {
                    console.error('Error fetching staff info:', error);
                    setStaffId(null);
                }
            } else {
                setStaffId(null);
                setIsEmergencyUnavailable(false);
            }

            const today = getLocalDateString();
            const b = effectiveBranchId;
            const [basicStats, topServices, revenueTrend, recentActivity] = await Promise.all([
                reportsService.getDashboardStats(b, stylistStaffId),
                reportsService.getTopServices(today + 'T00:00:00', today + 'T23:59:59', b, stylistStaffId),
                fetchRevenueTrend(b, stylistStaffId),
                fetchRecentActivity(b, stylistStaffId),
            ]);

            setStats({
                todayRevenue: basicStats.todayRevenue,
                todayAppointments: basicStats.todayAppointments,
                completed: basicStats.completedAppointments,
                cancelled: basicStats.cancelledAppointments,
                noShow: basicStats.noShowAppointments,
                pending: basicStats.todayAppointments - basicStats.completedAppointments - basicStats.cancelledAppointments - basicStats.noShowAppointments,
                topServices: topServices.slice(0, 5).map(s => ({
                    name: s.serviceName,
                    count: s.count,
                    revenue: s.revenue
                })),
                topStylists: [],
                revenueWeek: revenueTrend,
                recentActivity: recentActivity,
            });
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchRevenueTrend = async (branchId?: string, stylistStaffId?: string) => {
        try {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const today = new Date();
            const windowStart = new Date(today);
            windowStart.setDate(today.getDate() - 6);
            const startDate = windowStart.toISOString().split('T')[0];
            const endDate = today.toISOString().split('T')[0];

            let invQ = supabase
                .from('invoices')
                .select('total, created_at, appointment_id')
                .gte('created_at', `${startDate}T00:00:00`)
                .lte('created_at', `${endDate}T23:59:59`);
            if (branchId) invQ = invQ.eq('branch_id', branchId);
            const { data: invoices, error } = await invQ;

            if (error) throw error;

            let rows: any[] = invoices || [];
            if (stylistStaffId && rows.length > 0) {
                const aptIds = [...new Set(rows.map((i: any) => i.appointment_id).filter(Boolean))] as string[];
                if (aptIds.length === 0) rows = [];
                else {
                    const { data: apts } = await supabase
                        .from('appointments')
                        .select('id')
                        .in('id', aptIds)
                        .eq('stylist_id', stylistStaffId);
                    const allowed = new Set((apts || []).map(a => a.id));
                    rows = rows.filter((i: any) => i.appointment_id && allowed.has(i.appointment_id));
                }
            }

            const revenueByDate = new Map<string, number>();
            rows.forEach((inv: any) => {
                const dateKey = String(inv.created_at || '').split('T')[0];
                if (!dateKey) return;
                revenueByDate.set(dateKey, (revenueByDate.get(dateKey) || 0) + (inv.total || 0));
            });

            return Array.from({ length: 7 }, (_, offset) => {
                const date = new Date(windowStart);
                date.setDate(windowStart.getDate() + offset);
                const dateString = date.toISOString().split('T')[0];
                return {
                    day: days[date.getDay()],
                    revenue: revenueByDate.get(dateString) || 0,
                };
            });
        } catch (error) {
            console.error('Error in fetchRevenueTrend:', error);
            // Fallback to empty data
            return Array.from({ length: 7 }, (_, i) => ({
                day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
                revenue: 0
            }));
        }
    };

    const fetchRecentActivity = async (branchId?: string, stylistStaffId?: string) => {
        try {
            const activities: { createdAtMs: number; time: string; action: string; customer: string; amount?: number }[] = [];

            const toTimeAgo = (createdAt: string | Date) => {
                const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
                const now = new Date();
                const diffMs = now.getTime() - created.getTime();
                const diffMins = Math.floor(diffMs / 60000);

                if (!Number.isFinite(diffMins)) return 'Just now';
                if (diffMins < 1) return 'Just now';
                if (diffMins < 60) return `${diffMins} min ago`;
                if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hr ago`;
                return `${Math.floor(diffMins / 1440)} day ago`;
            };

            let invQuery = supabase
                .from('invoices')
                .select(`
                    id,
                    total,
                    created_at,
                    appointment_id,
                    customers (name)
                `)
                .order('created_at', { ascending: false })
                .limit(stylistStaffId ? 12 : 5);
            if (branchId) invQuery = invQuery.eq('branch_id', branchId);
            const { data: invoices, error: invoicesError } = await invQuery;

            if (!invoicesError && invoices) {
                let invRows: any[] = invoices;
                if (stylistStaffId && invRows.length > 0) {
                    const aptIds = [...new Set(invRows.map((i: any) => i.appointment_id).filter(Boolean))] as string[];
                    if (aptIds.length === 0) invRows = [];
                    else {
                        const { data: apts } = await supabase
                            .from('appointments')
                            .select('id')
                            .in('id', aptIds)
                            .eq('stylist_id', stylistStaffId);
                        const allowed = new Set((apts || []).map(a => a.id));
                        invRows = invRows.filter((i: any) => i.appointment_id && allowed.has(i.appointment_id));
                    }
                }
                invRows.slice(0, 5).forEach((invoice: any) => {
                    const createdAtMs = new Date(invoice.created_at).getTime();

                    activities.push({
                        createdAtMs,
                        time: toTimeAgo(invoice.created_at),
                        action: 'Payment received',
                        customer: invoice.customers?.name || 'Unknown Customer',
                        amount: invoice.total
                    });
                });
            }

            let aptQuery = supabase
                .from('appointments')
                .select(`
                    id,
                    status,
                    created_at,
                    customer:customers (name),
                    appointment_date,
                    start_time
                `)
                .order('created_at', { ascending: false })
                .limit(5);
            if (branchId) aptQuery = aptQuery.eq('branch_id', branchId);
            if (stylistStaffId) aptQuery = aptQuery.eq('stylist_id', stylistStaffId);
            const { data: appointments, error: appointmentsError } = await aptQuery;

            if (!appointmentsError && appointments) {
                appointments.forEach((apt: any) => {
                    const createdAtMs = new Date(apt.created_at).getTime();

                    let action = 'Appointment updated';
                    switch (apt.status) {
                        case 'Pending':
                        case 'Confirmed':
                            action = 'Appointment scheduled';
                            break;
                        case 'InService':
                            action = 'Appointment in service';
                            break;
                        case 'Completed':
                            action = 'Appointment completed';
                            break;
                        case 'Cancelled':
                            action = 'Appointment cancelled';
                            break;
                        case 'NoShow':
                            action = 'Customer no-show';
                            break;
                        default:
                            action = `Appointment: ${apt.status}`;
                    }

                    activities.push({
                        createdAtMs,
                        time: toTimeAgo(apt.created_at),
                        action,
                        customer: apt.customer?.name || 'Unknown Customer'
                    });
                });
            }

            // Sort by real timestamp (most recent first)
            return activities
                .sort((a, b) => b.createdAtMs - a.createdAtMs)
                .slice(0, 5)
                .map(({ createdAtMs: _createdAtMs, ...rest }) => rest);
        } catch (error) {
            console.error('Error fetching recent activity:', error);
            return [];
        }
    };

    // Keep "Recent Activity" fresh while the dashboard is open.
    useEffect(() => {
        let mounted = true;
        let intervalId: ReturnType<typeof setInterval> | null = null;
        let inFlight = false;

        const refresh = async () => {
            if (!mounted) return;
            if (inFlight) return;
            inFlight = true;
            try {
                const stylistOnly = user?.role === 'Stylist' ? staffId || undefined : undefined;
                const latest = await fetchRecentActivity(effectiveBranchId, stylistOnly);
                if (!mounted) return;
                setStats(prev => ({
                    ...prev,
                    recentActivity: latest
                }));
            } catch (e) {
                // Ignore polling errors to avoid breaking the dashboard.
                console.error('Recent Activity polling error:', e);
            } finally {
                inFlight = false;
            }
        };

        // First refresh after mount.
        refresh();
        // Poll every 45 seconds.
        intervalId = setInterval(refresh, 45_000);

        return () => {
            mounted = false;
            if (intervalId) clearInterval(intervalId);
        };
    }, [user?.id, user?.role, effectiveBranchId, staffId]);

    const handleEmergencyToggle = async () => {
        if (!staffId) {
            alert("Could not find your staff profile. Please contact admin.");
            return;
        }

        setTogglingEmergency(true);
        try {
            const newStatus = !isEmergencyUnavailable;
            await availabilityService.toggleEmergencyStatus(staffId, newStatus);
            setIsEmergencyUnavailable(newStatus);
        } catch (error: unknown) {
            console.error('Error toggling emergency status:', error);
            let errorMessage = 'Failed to update status. ';
            if (error && typeof error === 'object') {
                if ('message' in error) {
                    errorMessage += (error as Error).message;
                } else {
                    errorMessage += JSON.stringify(error);
                }
            } else {
                errorMessage += 'Please try again.';
            }
            alert(errorMessage);
        } finally {
            setTogglingEmergency(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    const isStylistView = user?.role === 'Stylist';

    const appointmentStatusData = [
        { name: 'Completed', value: stats.completed, color: '#10b981' },
        { name: 'Pending', value: stats.pending, color: '#f59e0b' },
        { name: 'Cancelled', value: stats.cancelled, color: '#ef4444' },
        { name: 'No-Show', value: stats.noShow, color: '#6b7280' },
    ].filter(item => item.value > 0);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        {isStylistView
                            ? `Hi${user?.name ? `, ${user.name.split(' ')[0]}` : ''} — here’s your day at a glance (only your appointments and payments).`
                            : "Welcome back! Here's what's happening today."}
                    </p>
                </div>

                {/* Emergency Toggle for Stylists */}
                {user?.role === 'Stylist' && (
                    <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-800">
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-red-800 dark:text-red-300">Emergency Mode</span>
                            <span className="text-xs text-red-600 dark:text-red-400">Stop new bookings</span>
                        </div>
                        <button
                            onClick={handleEmergencyToggle}
                            disabled={togglingEmergency}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${isEmergencyUnavailable ? 'bg-red-600' : 'bg-gray-200 dark:bg-gray-700'
                                }`}
                        >
                            <span
                                className={`${isEmergencyUnavailable ? 'translate-x-6' : 'translate-x-1'
                                    } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                            />
                        </button>
                    </div>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
                <StatCard
                    title={isStylistView ? 'Your revenue (today)' : "Today's Revenue"}
                    value={`Rs ${stats.todayRevenue.toLocaleString()}`}
                    icon={DollarSign}
                    trend={{ value: Math.abs(revenueTrendDelta), isPositive: revenueTrendDelta >= 0 }}
                />
                <StatCard
                    title={isStylistView ? 'Your appointments (today)' : "Today's Appointments"}
                    value={stats.todayAppointments}
                    icon={Calendar}
                    trend={{ value: Math.abs(appointmentsTrendDelta), isPositive: appointmentsTrendDelta >= 0 }}
                />
                <StatCard
                    title={isStylistView ? 'Your completed (today)' : 'Completed'}
                    value={stats.completed}
                    icon={CheckCircle2}
                />
                <StatCard
                    title={isStylistView ? 'Your cancelled / no-show' : 'Cancelled/No-Show'}
                    value={stats.cancelled + stats.noShow}
                    icon={XCircle}
                />
            </div>

            {/* Revenue Trend Chart */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="card p-6 surface-panel"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
                        <TrendingUp className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {isStylistView ? 'Your revenue trend' : 'Revenue Trend'}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Last 7 days</p>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={stats.revenueWeek}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                        <XAxis dataKey="day" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1f2937',
                                border: 'none',
                                borderRadius: '0.5rem',
                                color: '#fff'
                            }}
                            formatter={(value?: number) => value ? `Rs ${value.toLocaleString()}` : 'N/A'}
                        />
                        <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 4 }} />
                    </LineChart>
                </ResponsiveContainer>
            </motion.div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Appointment Status Pie Chart */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="card p-6 surface-panel"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-secondary-100 dark:bg-secondary-900/30 rounded-xl">
                            <Calendar className="h-5 w-5 text-secondary-600 dark:text-secondary-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Appointment Status</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {isStylistView ? 'Your appointments today' : "Today's breakdown"}
                            </p>
                        </div>
                    </div>
                    {appointmentStatusData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={appointmentStatusData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {appointmentStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1f2937',
                                        border: 'none',
                                        borderRadius: '0.5rem',
                                        color: '#fff'
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[300px] text-gray-500">
                            No appointments today
                        </div>
                    )}
                </motion.div>

                {/* Top Services Bar Chart */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="card p-6 surface-panel"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-secondary-100 dark:bg-secondary-900/30 rounded-xl">
                            <Scissors className="h-5 w-5 text-secondary-600 dark:text-secondary-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Services</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {isStylistView ? 'Your services by revenue today' : 'By revenue today'}
                            </p>
                        </div>
                    </div>
                    {stats.topServices.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={stats.topServices} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                                <XAxis type="number" stroke="#9ca3af" />
                                <YAxis dataKey="name" type="category" width={100} stroke="#9ca3af" />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#1f2937',
                                        border: 'none',
                                        borderRadius: '0.5rem',
                                        color: '#fff'
                                    }}
                                    formatter={(value?: number) => value ? `Rs ${value.toLocaleString()}` : 'N/A'}
                                />
                                <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[300px] text-gray-500">
                            No services data
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Recent Activity (& quick actions for non-stylists) */}
            <div className={`grid grid-cols-1 gap-6 ${isStylistView ? '' : 'lg:grid-cols-2'}`}>
                {/* Recent Activity */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="card p-6 surface-panel"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {isStylistView ? 'Your recent activity' : 'Recent Activity'}
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Latest updates</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {stats.recentActivity.map((activity, index) => (
                            <div key={index} className="flex items-start gap-3 pb-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary-500 mt-2"></div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.action}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{activity.customer}</p>
                                    {activity.amount && (
                                        <p className="text-sm font-semibold text-green-600 dark:text-green-400 mt-1">
                                            Rs {activity.amount.toLocaleString()}
                                        </p>
                                    )}
                                </div>
                                <span className="text-xs text-gray-400 flex-shrink-0">{activity.time}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {!isStylistView && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="card p-6 surface-panel"
                    >
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <a
                                href={adminHref('/appointments')}
                                className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-200 group"
                            >
                                <Calendar className="h-8 w-8 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 mb-2" />
                                <h3 className="font-medium text-gray-900 dark:text-white text-sm">New Appointment</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Book a customer</p>
                            </a>
                            <a
                                href={adminHref('/pos')}
                                className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-200 group"
                            >
                                <DollarSign className="h-8 w-8 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 mb-2" />
                                <h3 className="font-medium text-gray-900 dark:text-white text-sm">Process Payment</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Generate invoice</p>
                            </a>
                            <a
                                href={adminHref('/customers')}
                                className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-200 group"
                            >
                                <Users className="h-8 w-8 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 mb-2" />
                                <h3 className="font-medium text-gray-900 dark:text-white text-sm">Add Customer</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">New customer record</p>
                            </a>
                            <a
                                href={adminHref('/reports')}
                                className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-200 group"
                            >
                                <Scissors className="h-8 w-8 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 mb-2" />
                                <h3 className="font-medium text-gray-900 dark:text-white text-sm">View Reports</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Analytics &amp; insights</p>
                            </a>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
