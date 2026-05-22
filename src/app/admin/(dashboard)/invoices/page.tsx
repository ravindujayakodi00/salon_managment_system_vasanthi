'use client';

import { useState, useEffect } from 'react';
import { Receipt, Banknote, CreditCard, ShoppingBag, ChevronDown, Printer } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { invoicesService } from '@/services/invoices';
import { formatCurrency } from '@/lib/utils';
import { calculatePaymentTotals } from '@/lib/payment-utils';
import ReceiptModal from '@/components/pos/ReceiptModal';

function todayStr() { return new Date().toISOString().split('T')[0]; }
function yesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; }
function thisWeekStart() { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0]; }
function thisMonthStart() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; }

const PRESETS = [
    { label: 'Today', getRange: () => ({ start: todayStr(), end: todayStr() }) },
    { label: 'Yesterday', getRange: () => ({ start: yesterdayStr(), end: yesterdayStr() }) },
    { label: 'This Week', getRange: () => ({ start: thisWeekStart(), end: todayStr() }) },
    { label: 'This Month', getRange: () => ({ start: thisMonthStart(), end: todayStr() }) },
];

const PAYMENT_METHODS = ['All', 'Cash', 'Card', 'BankTransfer', 'Other'];

const paymentBadgeClass: Record<string, string> = {
    Cash: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    Card: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    BankTransfer: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    Other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const PAGE_SIZE = 100;

export default function InvoicesPage() {
    const { hasRole } = useAuth();
    const { effectiveBranchId } = useWorkspace();
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(0);
    const [activePreset, setActivePreset] = useState<string | null>('This Month');
    const [paymentFilter, setPaymentFilter] = useState('All');
    const [dateRange, setDateRange] = useState({ start: thisMonthStart(), end: todayStr() });
    const [receiptInvoice, setReceiptInvoice] = useState<any>(null);

    const isOwner = hasRole(['Owner', 'Manager']);

    useEffect(() => {
        setPage(0);
        setInvoices([]);
        fetchInvoices(0, true);
    }, [dateRange, effectiveBranchId, paymentFilter]);

    const fetchInvoices = async (pageNum: number, reset = false) => {
        try {
            if (pageNum === 0) setLoading(true); else setLoadingMore(true);

            const { data, count } = await invoicesService.getInvoices({
                startDate: dateRange.start,
                endDate: dateRange.end,
                branchId: effectiveBranchId,
                paymentMethod: paymentFilter !== 'All' ? paymentFilter : undefined,
                limit: PAGE_SIZE,
                page: pageNum,
            });

            setInvoices(prev => reset ? (data || []) : [...prev, ...(data || [])]);
            setTotalCount(count || 0);
        } catch (error) {
            console.error('Error fetching invoices:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const handleLoadMore = () => {
        const next = page + 1;
        setPage(next);
        fetchInvoices(next);
    };

    const applyPreset = (preset: typeof PRESETS[number]) => {
        setActivePreset(preset.label);
        setDateRange(preset.getRange());
    };

    const handleDateChange = (field: 'start' | 'end', value: string) => {
        setActivePreset(null);
        setDateRange(prev => ({ ...prev, [field]: value }));
    };

    // Compute totals from loaded invoices
    const paymentTotals = calculatePaymentTotals(invoices);
    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

    const itemsSummary = (items: any[]): string => {
        if (!Array.isArray(items) || items.length === 0) return '—';
        const first = items[0]?.description || items[0]?.name || 'Item';
        return items.length === 1 ? first : `${first} +${items.length - 1} more`;
    };

    if (!isOwner) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-gray-500 dark:text-gray-400">You don't have access to this page.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Invoices</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">View and filter all invoices</p>
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
                        {/* Payment method filter */}
                        <div className="relative">
                            <select
                                value={paymentFilter}
                                onChange={(e) => setPaymentFilter(e.target.value)}
                                className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm cursor-pointer"
                            >
                                {PAYMENT_METHODS.map(m => (
                                    <option key={m} value={m}>{m === 'All' ? 'All Methods' : m}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Preset buttons */}
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

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="card p-6 surface-panel">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Total Revenue</p>
                            <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{formatCurrency(totalRevenue)}</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{totalCount} invoice{totalCount !== 1 ? 's' : ''}</p>
                        </div>
                        <Receipt className="h-10 w-10 text-emerald-500 opacity-70" />
                    </div>
                </div>
                <div className="card p-6 surface-panel">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Cash</p>
                            <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{formatCurrency(paymentTotals.totalCash)}</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Cash payments</p>
                        </div>
                        <Banknote className="h-10 w-10 text-green-500 opacity-70" />
                    </div>
                </div>
                <div className="card p-6 surface-panel">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Card</p>
                            <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{formatCurrency(paymentTotals.totalCard)}</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Card payments</p>
                        </div>
                        <CreditCard className="h-10 w-10 text-blue-500 opacity-70" />
                    </div>
                </div>
                <div className="card p-6 surface-panel">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Transactions</p>
                            <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{invoices.length}</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Loaded of {totalCount}</p>
                        </div>
                        <ShoppingBag className="h-10 w-10 text-primary-500 opacity-70" />
                    </div>
                </div>
            </div>

            {/* Invoices Table */}
            <div className="card p-6 surface-panel">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invoice Details</h3>
                {loading ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500 dark:text-gray-400">Loading invoices...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">Invoice #</th>
                                    <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">Customer</th>
                                    <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">Date</th>
                                    <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">Payment</th>
                                    <th className="hidden md:table-cell text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">Items</th>
                                    <th className="hidden md:table-cell text-right py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">Subtotal</th>
                                    <th className="hidden md:table-cell text-right py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">Discount</th>
                                    <th className="text-right py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">Total</th>
                                    <th className="py-3 px-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-10 text-center text-gray-500 dark:text-gray-400">
                                            No invoices found for this period
                                        </td>
                                    </tr>
                                ) : invoices.map((inv: any) => (
                                    <tr key={inv.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                        <td className="py-3 px-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                                            {inv.invoice_number?.slice(-12) ?? inv.id.slice(0, 8)}
                                        </td>
                                        <td className="py-3 px-3 text-gray-900 dark:text-white">
                                            {inv.customer?.name ?? '—'}
                                        </td>
                                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                            {new Date(inv.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${paymentBadgeClass[inv.payment_method] ?? paymentBadgeClass.Other}`}>
                                                {inv.payment_method ?? 'Cash'}
                                            </span>
                                        </td>
                                        <td className="hidden md:table-cell py-3 px-3 text-gray-600 dark:text-gray-400 max-w-[180px] truncate">
                                            {itemsSummary(inv.items)}
                                        </td>
                                        <td className="hidden md:table-cell py-3 px-3 text-right text-gray-700 dark:text-gray-300">
                                            {formatCurrency(inv.subtotal ?? inv.total)}
                                        </td>
                                        <td className="hidden md:table-cell py-3 px-3 text-right text-gray-500 dark:text-gray-400">
                                            {(inv.discount ?? 0) > 0 ? `- ${formatCurrency(inv.discount)}` : '—'}
                                        </td>
                                        <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white">
                                            {formatCurrency(inv.total)}
                                        </td>
                                        <td className="py-3 px-3 text-right">
                                            <button
                                                onClick={() => setReceiptInvoice(inv)}
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                                                title="Print receipt"
                                            >
                                                <Printer className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {invoices.length > 0 && (
                                <tfoot>
                                    <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 font-semibold">
                                        <td colSpan={6} className="py-3 px-3 text-gray-900 dark:text-white">Total ({invoices.length} invoices)</td>
                                        <td className="hidden md:table-cell py-3 px-3 text-right text-gray-900 dark:text-white">
                                            {formatCurrency(invoices.reduce((s, i) => s + (i.subtotal ?? i.total ?? 0), 0))}
                                        </td>
                                        <td className="hidden md:table-cell py-3 px-3 text-right text-gray-500 dark:text-gray-400">
                                            {formatCurrency(invoices.reduce((s, i) => s + (i.discount ?? 0), 0))}
                                        </td>
                                        <td className="py-3 px-3 text-right text-gray-900 dark:text-white">
                                            {formatCurrency(totalRevenue)}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                )}

                {/* Load more */}
                {!loading && invoices.length < totalCount && (
                    <div className="mt-4 text-center">
                        <button
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            className="px-6 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                            {loadingMore ? 'Loading...' : `Load more (${totalCount - invoices.length} remaining)`}
                        </button>
                    </div>
                )}
            </div>

            <ReceiptModal
                isOpen={!!receiptInvoice}
                onClose={() => setReceiptInvoice(null)}
                invoice={receiptInvoice}
            />
        </div>
    );
}
