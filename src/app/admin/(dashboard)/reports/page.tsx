'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart3, Send, CheckCircle, XCircle, DollarSign,
    TrendingUp, Calendar, ArrowUpRight, ArrowDownRight,
    Users, Target, FileSpreadsheet
} from 'lucide-react';
import { analyticsService, AnalyticsSummary, DailyStats } from '@/services/analytics';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import ReceiptModal from '@/components/pos/ReceiptModal';
import { RotateCcw } from 'lucide-react';
import { exportSalesReportToExcel } from '@/lib/excel-export';

export default function ReportsPage() {
    const { hasRole } = useAuth();
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
    const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
    const [activeTab, setActiveTab] = useState<'campaigns' | 'invoices' | 'system_reports'>('campaigns');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [summaryData, dailyData] = await Promise.all([
                analyticsService.getSummary(),
                analyticsService.getDailyStats(7)
            ]);
            setSummary(summaryData);
            setDailyStats(dailyData);
        } catch (error) {
            console.error('Error loading reports:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!hasRole(['Owner', 'Manager'])) {
        return <div className="text-center py-12">Access restricted</div>;
    }

    if (loading) {
        return <div className="text-center py-12">Loading analytics...</div>;
    }

    const maxSent = Math.max(...dailyStats.map(d => d.sent), 1);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Comprehensive insights into your business performance
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('campaigns')}
                    className={`px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'campaigns'
                        ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                >
                    Campaign Analytics
                </button>
                <button
                    onClick={() => setActiveTab('invoices')}
                    className={`px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'invoices'
                        ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                >
                    Invoices & Transactions
                </button>
                <button
                    onClick={() => setActiveTab('system_reports')}
                    className={`px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'system_reports'
                        ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                >
                    System Reports
                </button>
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {activeTab === 'campaigns' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                            <div className="card p-6 surface-panel">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                        <Send className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <span className="text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full flex items-center gap-1">
                                        <TrendingUp className="h-3 w-3" />
                                        Total
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.total_sent.toLocaleString()}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Messages Sent</p>
                            </div>

                            <div className="card p-6 surface-panel">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                        <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                                    </div>
                                    <span className={`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 ${(summary?.delivery_rate || 0) >= 90
                                        ? 'text-green-600 bg-green-50 dark:bg-green-900/20'
                                        : 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
                                        }`}>
                                        {summary?.delivery_rate}% Rate
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.total_delivered.toLocaleString()}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Delivered Successfully</p>
                            </div>

                            <div className="card p-6 surface-panel">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                        <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                                    </div>
                                    <span className="text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                                        {((summary?.total_failed || 0) / (summary?.total_sent || 1) * 100).toFixed(1)}% Rate
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.total_failed.toLocaleString()}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Failed Delivery</p>
                            </div>

                            <div className="card p-6 surface-panel">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                        <DollarSign className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <span className="text-xs font-medium text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-full">
                                        Avg LKR {summary?.avg_cost_per_campaign}
                                    </span>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">LKR {summary?.total_cost.toLocaleString()}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Spend</p>
                            </div>
                        </div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Weekly Volume Chart */}
                            <div className="card p-6 surface-panel">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Weekly Volume</h3>
                                    <select className="text-sm border-none bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-1">
                                        <option>Last 7 Days</option>
                                    </select>
                                </div>

                                <div className="h-64 flex items-end justify-between gap-2">
                                    {dailyStats.map((stat, index) => (
                                        <div key={stat.date} className="flex-1 flex flex-col items-center gap-2 group">
                                            <div className="relative w-full flex items-end justify-center h-full">
                                                <motion.div
                                                    initial={{ height: 0 }}
                                                    animate={{ height: `${(stat.sent / maxSent) * 100}%` }}
                                                    transition={{ duration: 0.5, delay: index * 0.1 }}
                                                    className="w-full max-w-[40px] bg-primary-500 rounded-t-lg group-hover:bg-primary-600 transition-colors relative"
                                                >
                                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                        {stat.sent} sent
                                                    </div>
                                                </motion.div>
                                            </div>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 rotate-0 truncate w-full text-center">
                                                {new Date(stat.date).toLocaleDateString('en-US', { weekday: 'short' })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Cost Efficiency */}
                            <div className="card p-6 surface-panel">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Cost Efficiency</h3>

                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                                <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">Cost per Message</p>
                                                <p className="text-xs text-gray-500">Standard rate</p>
                                            </div>
                                        </div>
                                        <span className="text-lg font-bold text-gray-900 dark:text-white">LKR 2.00</span>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                                <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">Avg Campaign Size</p>
                                                <p className="text-xs text-gray-500">Recipients per campaign</p>
                                            </div>
                                        </div>
                                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                                            {summary?.total_campaigns ? Math.round(summary.total_sent / summary.total_campaigns) : 0}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                                <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">Targeting Efficiency</p>
                                                <p className="text-xs text-gray-500">Savings vs broadcast</p>
                                            </div>
                                        </div>
                                        <span className="text-lg font-bold text-green-600 flex items-center gap-1">
                                            <ArrowUpRight className="h-4 w-4" />
                                            80%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'invoices' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <AllInvoices />
                    </div>
                )}

                {activeTab === 'system_reports' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <SystemReports />
                    </div>
                )}
            </div>
        </div>
    );
}

function SystemReports() {
    const [downloading, setDownloading] = useState<string | null>(null);
    const [exportingExcel, setExportingExcel] = useState<string | null>(null);

    const reports = [
        {
            id: 'sales_monthly',
            title: 'Monthly Sales Report',
            description: 'Detailed breakdown of sales, revenue, and taxes for the current month.',
            icon: DollarSign,
            color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
        },
        {
            id: 'customer_growth',
            title: 'Customer Growth Report',
            description: 'New customer acquisitions, retention rates, and segment analysis.',
            icon: Users,
            color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
        },
        {
            id: 'staff_performance',
            title: 'Staff Performance',
            description: 'Service completion rates, revenue generation, and customer feedback.',
            icon: Target,
            color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
        },
        {
            id: 'inventory_status',
            title: 'Inventory Status',
            description: 'Current stock levels, low stock alerts, and category breakdown.',
            icon: BarChart3,
            color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
        }
    ];

    const handleDownload = async (reportId: string) => {
        setDownloading(reportId);
        try {
            // Dynamic imports to reduce bundle size
            const { reportsService } = await import('@/services/reports');

            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentYear = now.getFullYear();

            if (reportId === 'sales_monthly') {
                const { generateSalesReportPDF } = await import('@/lib/pdf-generator');
                const data = await reportsService.getSalesReportData(currentMonth, currentYear);
                generateSalesReportPDF(data);
            } else if (reportId === 'customer_growth') {
                const { generateCustomerGrowthReportPDF } = await import('@/lib/pdf-generator');
                const data = await reportsService.getCustomerGrowthReportData();
                generateCustomerGrowthReportPDF(data);
            } else if (reportId === 'staff_performance') {
                const { generateStaffPerformanceReportPDF } = await import('@/lib/pdf-generator');
                const data = await reportsService.getStaffPerformanceReportData();
                generateStaffPerformanceReportPDF(data);
            } else if (reportId === 'inventory_status') {
                const { generateInventoryReportPDF } = await import('@/lib/pdf-generator');
                const data = await reportsService.getInventoryReportData();
                generateInventoryReportPDF(data);
            }
        } catch (error: any) {
            console.error('Error generating report:', error);
            alert(`Failed to generate report: ${error.message}`);
        } finally {
            setDownloading(null);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reports.map((report) => (
                <div key={report.id} className="card p-6 surface-panel hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                        <div className="flex gap-4">
                            <div className={`p-3 rounded-xl ${report.color}`}>
                                <report.icon className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                                    {report.title}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                                    {report.description}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 flex gap-2 justify-end">
                        <button
                            onClick={() => handleDownload(report.id)}
                            disabled={downloading === report.id}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 dark:text-primary-400 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {downloading === report.id ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-600 border-t-transparent"></div>
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <ArrowDownRight className="h-4 w-4" />
                                    Download PDF
                                </>
                            )}
                        </button>
                        {report.id === 'sales_monthly' && (
                            <button
                                onClick={async () => {
                                    setExportingExcel(report.id);
                                    try {
                                        const { reportsService } = await import('@/services/reports');
                                        const now = new Date();
                                        const data = await reportsService.getSalesReportData(now.getMonth() + 1, now.getFullYear());
                                        exportSalesReportToExcel(data);
                                        alert('Excel file downloaded successfully!');
                                    } catch (error) {
                                        console.error('Error exporting to Excel:', error);
                                        alert('Failed to export to Excel');
                                    } finally {
                                        setExportingExcel(null);
                                    }
                                }}
                                disabled={exportingExcel === report.id}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-900/20 dark:hover:bg-green-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {exportingExcel === report.id ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-600 border-t-transparent"></div>
                                        Exporting...
                                    </>
                                ) : (
                                    <>
                                        <FileSpreadsheet className="h-4 w-4" />
                                        Export Excel
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

function AllInvoices() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

    useEffect(() => {
        loadInvoices();
    }, []);

    const loadInvoices = async () => {
        try {
            // Fetch last 50 invoices for the report
            const { data, error } = await supabase
                .from('invoices')
                .select(`
                    *,
                    customer:customers(*)
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setInvoices(data || []);
        } catch (error: any) {
            console.error('Error loading invoices:', {
                message: error?.message,
                details: error?.details,
                hint: error?.hint,
                code: error?.code
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Transaction History</h2>
            <div className="card surface-panel overflow-hidden shadow-sm">
                <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center gap-2">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All Invoices</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Latest 50 transactions</p>
                    </div>
                    <button
                        onClick={loadInvoices}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <RotateCcw className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Invoice</th>
                                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                                <th className="hidden lg:table-cell px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Items</th>
                                <th className="hidden md:table-cell px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payment Method</th>
                                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                                <th className="hidden md:table-cell px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-3 sm:px-4 py-8 text-center text-sm text-gray-500">Loading invoices...</td>
                                </tr>
                            ) : invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-3 sm:px-4 py-8 text-center text-sm text-gray-500">No invoices found</td>
                                </tr>
                            ) : (
                                invoices.map((invoice) => (
                                    <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-3 sm:px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                            #{invoice.id.slice(0, 8)}
                                        </td>
                                        <td className="px-3 sm:px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(invoice.created_at).toLocaleDateString()}
                                            <span className="text-xs text-gray-400 ml-1">
                                                {new Date(invoice.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </td>
                                        <td className="px-3 sm:px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                            {invoice.customer?.name || 'Walk-in Customer'}
                                        </td>
                                        <td className="hidden lg:table-cell px-3 sm:px-4 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                            {/* Handle items as JSON array */}
                                            {Array.isArray(invoice.items) ? invoice.items.length : 0} items
                                        </td>
                                        <td className="hidden md:table-cell px-3 sm:px-4 py-4 whitespace-nowrap">
                                            {(() => {
                                                const method = invoice.payment_method || 'Cash';
                                                const badgeColors = {
                                                    'Cash': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
                                                    'Card': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
                                                    'BankTransfer': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
                                                    'UPI': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
                                                    'Other': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                                                };
                                                const displayNames = {
                                                    'Cash': 'Cash',
                                                    'Card': 'Card',
                                                    'BankTransfer': 'Online',
                                                    'UPI': 'UPI',
                                                    'Other': 'Other'
                                                };
                                                return (
                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${badgeColors[method as keyof typeof badgeColors] || badgeColors.Other}`}>
                                                        {displayNames[method as keyof typeof displayNames] || method}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-3 sm:px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                                            LKR {invoice.total.toLocaleString()}
                                        </td>
                                        <td className="hidden md:table-cell px-3 sm:px-4 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                                Paid
                                            </span>
                                        </td>
                                        <td className="px-3 sm:px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => setSelectedInvoice(invoice)}
                                                className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {selectedInvoice && (
                    <ReceiptModal
                        isOpen={!!selectedInvoice}
                        onClose={() => setSelectedInvoice(null)}
                        invoice={selectedInvoice}
                    />
                )}
            </div>
        </div>
    );
}
