'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StatCard from '@/components/shared/StatCard';
import { reportsService } from '@/services/reports';
import { availabilityService } from '@/services/availability';
import { staffService } from '@/services/staff';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getLocalDateString } from '@/lib/utils';
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
    }, []);

    useEffect(() => {
        if (user?.role === 'Stylist') {
            fetchStaffIdAndStatus();
        }
    }, [user]);

    const fetchStaffIdAndStatus = async () => {
        if (!user?.email) return;
        try {
            const staff = await staffService.getStaffByEmail(user.email);
            if (staff) {
                setStaffId(staff.id);
                const status = await availabilityService.getEmergencyStatus(staff.id);
                setIsEmergencyUnavailable(status);
            }
        } catch (error) {
            console.error('Error fetching staff info:', error);
        }
    };

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const today = getLocalDateString();

            // Fetch basic stats
            const basicStats = await reportsService.getDashboardStats();

            // Fetch top services and stylists for today
            const topServices = await reportsService.getTopServices(today + 'T00:00:00', today + 'T23:59:59');
            const topStylists = await reportsService.getStaffPerformance(today, today);

            // Get revenue for last 7 days (mock data for now)
            const revenueTrend = await fetchRevenueTrend();

            // Get recent activity (mock data for now)
            const recentActivity = await fetchRecentActivity();

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
                topStylists: topStylists.slice(0, 5).map(s => ({
                    name: s.stylistName,
                    revenue: s.revenue,
                    appointments: s.appointmentCount
                })),
                revenueWeek: revenueTrend,
                recentActivity: recentActivity,
            });
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchRevenueTrend = async () => {
        try {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const today = new Date();
            const revenueData = [];

            // Fetch revenue for each of the last 7 days
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD

                try {
                    // Query invoices for this specific day
                    const { data: invoices, error } = await supabase
                        .from('invoices')
                        .select('total')
                        .gte('created_at', `${dateString}T00:00:00`)
                        .lte('created_at', `${dateString}T23:59:59`);

                    if (error) throw error;

                    const dailyRevenue = invoices?.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0) || 0;

                    revenueData.push({
                        day: days[date.getDay()],
                        revenue: dailyRevenue
                    });
                } catch (error) {
                    console.error(`Error fetching revenue for ${dateString}:`, error);
                    revenueData.push({
                        day: days[date.getDay()],
                        revenue: 0
                    });
                }
            }

            return revenueData;
        } catch (error) {
            console.error('Error in fetchRevenueTrend:', error);
            // Fallback to empty data
            return Array.from({ length: 7 }, (_, i) => ({
                day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
                revenue: 0
            }));
        }
    };

    const fetchRecentActivity = async () => {
        try {
            const activities: { time: string; action: string; customer: string; amount?: number }[] = [];

            // Fetch recent invoices (payments)
            const { data: invoices, error: invoicesError } = await supabase
                .from('invoices')
                .select(`
                    id,
                    total,
                    created_at,
                    customers (name)
                `)
                .order('created_at', { ascending: false })
                .limit(5);

            if (!invoicesError && invoices) {
                invoices.forEach((invoice: any) => {
                    const createdAt = new Date(invoice.created_at);
                    const now = new Date();
                    const diffMs = now.getTime() - createdAt.getTime();
                    const diffMins = Math.floor(diffMs / 60000);

                    let timeAgo = '';
                    if (diffMins < 1) timeAgo = 'Just now';
                    else if (diffMins < 60) timeAgo = `${diffMins} min ago`;
                    else if (diffMins < 1440) timeAgo = `${Math.floor(diffMins / 60)} hr ago`;
                    else timeAgo = `${Math.floor(diffMins / 1440)} day ago`;

                    activities.push({
                        time: timeAgo,
                        action: 'Payment received',
                        customer: invoice.customers?.name || 'Unknown Customer',
                        amount: invoice.total
                    });
                });
            }

            // Sort by time (most recent first)
            return activities.slice(0, 5);
        } catch (error) {
            console.error('Error fetching recent activity:', error);
            return [];
        }
    };

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
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Welcome back! Here&apos;s what&apos;s happening today.</p>
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
                    title="Today's Revenue"
                    value={`Rs ${stats.todayRevenue.toLocaleString()}`}
                    icon={DollarSign}
                    trend={{ value: Math.abs(revenueTrendDelta), isPositive: revenueTrendDelta >= 0 }}
                />
                <StatCard
                    title="Today's Appointments"
                    value={stats.todayAppointments}
                    icon={Calendar}
                    trend={{ value: Math.abs(appointmentsTrendDelta), isPositive: appointmentsTrendDelta >= 0 }}
                />
                <StatCard
                    title="Completed"
                    value={stats.completed}
                    icon={CheckCircle2}
                />
                <StatCard
                    title="Cancelled/No-Show"
                    value={stats.cancelled + stats.noShow}
                    icon={XCircle}
                />
            </div>

            {/* Revenue Trend Chart */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="card p-6 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
                        <TrendingUp className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Revenue Trend</h2>
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
                    className="card p-6 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-secondary-100 dark:bg-secondary-900/30 rounded-xl">
                            <Calendar className="h-5 w-5 text-secondary-600 dark:text-secondary-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Appointment Status</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Today&apos;s breakdown</p>
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
                    className="card p-6 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-secondary-100 dark:bg-secondary-900/30 rounded-xl">
                            <Scissors className="h-5 w-5 text-secondary-600 dark:text-secondary-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Services</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">By revenue today</p>
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

            {/* Recent Activity & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="card p-6 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
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

                {/* Quick Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="card p-6 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                >
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {user?.role !== 'Stylist' && (
                            <a
                                href="/appointments"
                                className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-200 group"
                            >
                                <Calendar className="h-8 w-8 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 mb-2" />
                                <h3 className="font-medium text-gray-900 dark:text-white text-sm">New Appointment</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Book a customer</p>
                            </a>
                        )}
                        <a
                            href="/pos"
                            className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-200 group"
                        >
                            <DollarSign className="h-8 w-8 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 mb-2" />
                            <h3 className="font-medium text-gray-900 dark:text-white text-sm">Process Payment</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Generate invoice</p>
                        </a>
                        <a
                            href="/customers"
                            className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-200 group"
                        >
                            <Users className="h-8 w-8 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 mb-2" />
                            <h3 className="font-medium text-gray-900 dark:text-white text-sm">Add Customer</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">New customer record</p>
                        </a>
                        <a
                            href="/reports"
                            className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-200 group"
                        >
                            <Scissors className="h-8 w-8 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 mb-2" />
                            <h3 className="font-medium text-gray-900 dark:text-white text-sm">View Reports</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Analytics &amp; insights</p>
                        </a>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
