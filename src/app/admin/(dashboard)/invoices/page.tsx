'use client';

import { useState, useEffect } from 'react';
import { Receipt, Banknote, CreditCard, Building, ChevronDown, Printer, Pencil, Trash2, Plus, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { invoicesService } from '@/services/invoices';
import { formatCurrency } from '@/lib/utils';
import { calculatePaymentTotals } from '@/lib/payment-utils';
import ReceiptModal from '@/components/pos/ReceiptModal';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import { supabase } from '@/lib/supabase';
import { servicesService } from '@/services/services';

function localDateStr(d: Date) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`; }
function todayStr() { return localDateStr(new Date()); }
function yesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return localDateStr(d); }
function thisWeekStart() { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); return localDateStr(d); }
function thisWeekEnd() { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? 0 : 7 - day)); return localDateStr(d); }
function thisMonthStart() { const d = new Date(); return localDateStr(new Date(d.getFullYear(), d.getMonth(), 1)); }
function thisMonthEnd() { const d = new Date(); return localDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }

const PRESETS = [
    { label: 'Today', getRange: () => ({ start: todayStr(), end: todayStr() }) },
    { label: 'Yesterday', getRange: () => ({ start: yesterdayStr(), end: yesterdayStr() }) },
    { label: 'This Week', getRange: () => ({ start: thisWeekStart(), end: thisWeekEnd() }) },
    { label: 'This Month', getRange: () => ({ start: thisMonthStart(), end: thisMonthEnd() }) },
];

const PAYMENT_METHODS = ['All', 'Cash', 'Card', 'BankTransfer'];

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
    const [dateRange, setDateRange] = useState({ start: thisMonthStart(), end: thisMonthEnd() });
    const [receiptInvoice, setReceiptInvoice] = useState<any>(null);

    const isOwner = hasRole(['Owner', 'Manager', 'Receptionist']);
    const canEdit = hasRole(['Owner', 'Manager']);

    // Edit invoice state
    const [editingInvoice, setEditingInvoice] = useState<any>(null);
    const [editItems, setEditItems] = useState<any[]>([]);
    const [editDiscount, setEditDiscount] = useState('');
    const [editPaymentMethod, setEditPaymentMethod] = useState('Cash');
    const [editSplitPayments, setEditSplitPayments] = useState<Record<string, string>>({ Cash: '', Card: '', BankTransfer: '' });
    const [editUseSplit, setEditUseSplit] = useState(false);
    const [editSaving, setEditSaving] = useState(false);
    const [staffList, setStaffList] = useState<any[]>([]);
    const [servicesList, setServicesList] = useState<any[]>([]);
    const [newItemServiceId, setNewItemServiceId] = useState('');
    const [newItemName, setNewItemName] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');
    const [newItemQty, setNewItemQty] = useState('1');
    const [newItemStylistId, setNewItemStylistId] = useState('');

    // Delete state
    const [deletingInvoice, setDeletingInvoice] = useState<any>(null);
    const [deleteConfirming, setDeleteConfirming] = useState(false);

    const openEditInvoice = async (inv: any) => {
        setEditingInvoice(inv);
        setEditItems((inv.items || []).map((item: any) => ({ ...item })));
        setEditDiscount(String(inv.discount ?? 0));
        setEditPaymentMethod(inv.payment_method ?? 'Cash');
        setNewItemServiceId(''); setNewItemName(''); setNewItemPrice(''); setNewItemQty('1'); setNewItemStylistId('');
        const breakdown = inv.payment_breakdown;
        if (breakdown && breakdown.length > 1) {
            setEditUseSplit(true);
            const sp: Record<string, string> = { Cash: '', Card: '', BankTransfer: '' };
            breakdown.forEach((b: any) => { sp[b.method] = String(b.amount); });
            setEditSplitPayments(sp);
        } else {
            setEditUseSplit(false);
            setEditSplitPayments({ Cash: '', Card: '', BankTransfer: '' });
        }
        // Fetch staff and services in parallel
        const [{ data: staffData }, servicesData] = await Promise.all([
            supabase.from('staff').select('id, name, system_role, commission').eq('is_active', true).eq('system_role', 'Stylist').order('name'),
            servicesService.getServices(true),
        ]);
        setStaffList(staffData || []);
        setServicesList(servicesData || []);
    };

    const addNewItem = () => {
        if (!newItemName.trim() || !newItemPrice) return;
        const stylist = staffList.find(s => s.id === newItemStylistId);
        setEditItems(prev => [...prev, {
            type: 'manual',
            serviceId: newItemServiceId || undefined,
            description: newItemName.trim(),
            name: newItemName.trim(),
            price: parseFloat(newItemPrice) || 0,
            quantity: parseInt(newItemQty) || 1,
            stylistId: newItemStylistId || undefined,
            stylistName: stylist?.name || undefined,
        }]);
        setNewItemServiceId(''); setNewItemName(''); setNewItemPrice(''); setNewItemQty('1'); setNewItemStylistId('');
    };

    const removeItem = (index: number) => {
        setEditItems(prev => prev.filter((_, i) => i !== index));
    };

    const editSubtotal = editItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1), 0);
    const editTotal = Math.max(0, editSubtotal - (parseFloat(editDiscount) || 0));

    const handleEditSave = async () => {
        if (!editingInvoice) return;
        if (editItems.length === 0) { alert('Invoice must have at least one item'); return; }
        try {
            setEditSaving(true);
            const breakdown = editUseSplit
                ? ['Cash', 'Card', 'BankTransfer']
                    .map(m => ({ method: m, amount: parseFloat(editSplitPayments[m] || '0') }))
                    .filter(b => b.amount > 0)
                : null;

            await invoicesService.updateInvoice(editingInvoice.id, {
                items: editItems.map(item => ({
                    ...item,
                    price: parseFloat(item.price) || 0,
                    quantity: parseInt(item.quantity) || 1,
                })),
                subtotal: editSubtotal,
                discount: parseFloat(editDiscount) || 0,
                total: editTotal,
                payment_method: editPaymentMethod,
                payment_breakdown: breakdown,
            });
            setEditingInvoice(null);
            fetchInvoices(0, true);
        } catch (error: any) {
            console.error('Error updating invoice:', error);
            alert(error.message || 'Failed to update invoice');
        } finally {
            setEditSaving(false);
        }
    };

    const handleDeleteInvoice = async () => {
        if (!deletingInvoice) return;
        try {
            setDeleteConfirming(true);
            await invoicesService.deleteInvoice(deletingInvoice.id);
            setDeletingInvoice(null);
            fetchInvoices(0, true);
        } catch (error: any) {
            console.error('Error deleting invoice:', error);
            alert(error.message || 'Failed to delete invoice');
        } finally {
            setDeleteConfirming(false);
        }
    };

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
                            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{invoices.length} transactions</p>
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
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Bank Transfer</p>
                            <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{formatCurrency(paymentTotals.totalBankTransfer)}</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Bank transfer payments</p>
                        </div>
                        <Building className="h-10 w-10 text-purple-500 opacity-70" />
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
                                            <div className="flex items-center justify-end gap-1">
                                                {canEdit && (
                                                    <button
                                                        onClick={() => openEditInvoice(inv)}
                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
                                                        title="Edit invoice"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {canEdit && (
                                                    <button
                                                        onClick={() => setDeletingInvoice(inv)}
                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                                                        title="Delete invoice"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setReceiptInvoice(inv)}
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                                                    title="Print receipt"
                                                >
                                                    <Printer className="h-4 w-4" />
                                                </button>
                                            </div>
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

            {/* ── Delete Confirmation Modal ── */}
            <Modal isOpen={!!deletingInvoice} onClose={() => setDeletingInvoice(null)} title="Delete Invoice">
                <div className="space-y-4">
                    <p className="text-gray-700 dark:text-gray-300 text-sm">
                        Are you sure you want to delete invoice <span className="font-mono font-semibold">{deletingInvoice?.invoice_number?.slice(-12)}</span>?
                    </p>
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-xs text-red-700 dark:text-red-400">
                            This will permanently delete the invoice and all related staff earnings. This cannot be undone.
                        </p>
                    </div>
                    <div className="flex gap-3 pt-1">
                        <Button onClick={handleDeleteInvoice} isLoading={deleteConfirming} className="flex-1 !bg-red-600 hover:!bg-red-700">
                            Delete
                        </Button>
                        <Button onClick={() => setDeletingInvoice(null)} variant="outline" className="flex-1">Cancel</Button>
                    </div>
                </div>
            </Modal>

            {/* ── Edit Invoice Modal ── */}
            <Modal isOpen={!!editingInvoice} onClose={() => setEditingInvoice(null)} title={`Edit Invoice ${editingInvoice?.invoice_number?.slice(-12) ?? ''}`} size="xl">
                <div className="space-y-6">

                    {/* ── Services / Items ── */}
                    <div>
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Services / Items</p>
                        {editItems.length === 0 && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">No items — add one below.</p>
                        )}
                        <div className="space-y-3">
                            {editItems.map((item, i) => (
                                <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                                    {/* Row 1: Service name + remove */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 min-w-0">
                                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Service</label>
                                            <select
                                                value={item.serviceId || ''}
                                                onChange={e => {
                                                    const svc = servicesList.find(s => s.id === e.target.value);
                                                    const updated = [...editItems];
                                                    updated[i] = {
                                                        ...updated[i],
                                                        serviceId: e.target.value || undefined,
                                                        description: svc?.name || updated[i].description,
                                                        name: svc?.name || updated[i].name,
                                                        price: svc ? svc.price : updated[i].price,
                                                    };
                                                    setEditItems(updated);
                                                }}
                                                className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            >
                                                <option value="">{item.description || item.name || 'Select service...'}</option>
                                                {servicesList.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name} — Rs {(s.price ?? 0).toLocaleString()}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            onClick={() => removeItem(i)}
                                            className="mt-5 p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                                            title="Remove item"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                    {/* Row 2: Stylist + Price + Qty + Line total */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <div className="col-span-2 sm:col-span-1">
                                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Stylist</label>
                                            <select
                                                value={item.stylistId || ''}
                                                onChange={e => {
                                                    const s = staffList.find(st => st.id === e.target.value);
                                                    const updated = [...editItems];
                                                    updated[i] = { ...updated[i], stylistId: e.target.value || undefined, stylistName: s?.name || undefined };
                                                    setEditItems(updated);
                                                }}
                                                className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            >
                                                <option value="">No stylist</option>
                                                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Price (Rs)</label>
                                            <input
                                                type="number"
                                                value={item.price}
                                                onChange={e => {
                                                    const updated = [...editItems];
                                                    updated[i] = { ...updated[i], price: e.target.value };
                                                    setEditItems(updated);
                                                }}
                                                className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Qty</label>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={e => {
                                                    const updated = [...editItems];
                                                    updated[i] = { ...updated[i], quantity: e.target.value };
                                                    setEditItems(updated);
                                                }}
                                                className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                min="1"
                                            />
                                        </div>
                                        <div className="flex items-end">
                                            <div className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-semibold text-gray-900 dark:text-white text-right">
                                                {formatCurrency((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Add Service ── */}
                    <div className="border border-dashed border-primary-300 dark:border-primary-700 rounded-xl p-4 space-y-3 bg-primary-50/40 dark:bg-primary-900/10">
                        <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider">+ Add Service</p>
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Service</label>
                                    <select
                                        value={newItemServiceId}
                                        onChange={e => {
                                            const svc = servicesList.find(s => s.id === e.target.value);
                                            setNewItemServiceId(e.target.value);
                                            if (svc) {
                                                setNewItemName(svc.name);
                                                setNewItemPrice(String(svc.price ?? ''));
                                            } else {
                                                setNewItemName('');
                                                setNewItemPrice('');
                                            }
                                        }}
                                        className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    >
                                        <option value="">Select service...</option>
                                        {servicesList.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} — Rs {(s.price ?? 0).toLocaleString()}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Stylist</label>
                                    <select
                                        value={newItemStylistId}
                                        onChange={e => setNewItemStylistId(e.target.value)}
                                        className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    >
                                        <option value="">No stylist</option>
                                        {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Price (Rs)</label>
                                    <input
                                        type="number"
                                        value={newItemPrice}
                                        onChange={e => setNewItemPrice(e.target.value)}
                                        placeholder="0"
                                        className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Qty</label>
                                    <input
                                        type="number"
                                        value={newItemQty}
                                        onChange={e => setNewItemQty(e.target.value)}
                                        className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        min="1"
                                    />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <button
                                        onClick={addNewItem}
                                        disabled={!newItemServiceId || !newItemPrice}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <Plus className="h-4 w-4" /> Add Item
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Discount + Totals ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Discount (Rs)</label>
                            <input
                                type="number"
                                value={editDiscount}
                                onChange={e => setEditDiscount(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                min="0"
                            />
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1 text-sm">
                            <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                <span>Subtotal</span><span>{formatCurrency(editSubtotal)}</span>
                            </div>
                            {(parseFloat(editDiscount) || 0) > 0 && (
                                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                    <span>Discount</span><span>- {formatCurrency(parseFloat(editDiscount))}</span>
                                </div>
                            )}
                            <div className="flex justify-between font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
                                <span>Total</span><span>{formatCurrency(editTotal)}</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Payment Method ── */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Payment Method</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                            {['Cash', 'Card', 'BankTransfer'].map(m => (
                                <button
                                    key={m}
                                    onClick={() => { setEditPaymentMethod(m); setEditUseSplit(false); }}
                                    className={`py-2.5 text-sm rounded-lg border transition-colors ${
                                        editPaymentMethod === m && !editUseSplit
                                            ? 'bg-primary-600 text-white border-primary-600'
                                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    {m === 'BankTransfer' ? 'Bank Transfer' : m}
                                </button>
                            ))}
                            <button
                                onClick={() => setEditUseSplit(s => !s)}
                                className={`py-2.5 text-sm rounded-lg border transition-colors ${
                                    editUseSplit
                                        ? 'bg-purple-600 text-white border-purple-600'
                                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                            >
                                Split
                            </button>
                        </div>
                        {editUseSplit && (
                            <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                {['Cash', 'Card', 'BankTransfer'].map(m => (
                                    <div key={m} className="flex items-center gap-3">
                                        <span className="text-sm text-gray-600 dark:text-gray-400 w-28 shrink-0">{m}</span>
                                        <input
                                            type="number"
                                            value={editSplitPayments[m]}
                                            onChange={e => setEditSplitPayments(prev => ({ ...prev, [m]: e.target.value }))}
                                            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            placeholder="0"
                                            min="0"
                                        />
                                    </div>
                                ))}
                                {(() => {
                                    const splitTotal = ['Cash', 'Card', 'BankTransfer'].reduce((s, m) => s + (parseFloat(editSplitPayments[m] || '0')), 0);
                                    return Math.abs(splitTotal - editTotal) > 0.01 ? (
                                        <p className="text-xs text-red-500 mt-1">Split total {formatCurrency(splitTotal)} must equal invoice total {formatCurrency(editTotal)}</p>
                                    ) : null;
                                })()}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-1">
                        <Button onClick={handleEditSave} isLoading={editSaving} className="flex-1">Save Changes</Button>
                        <Button onClick={() => setEditingInvoice(null)} variant="outline" className="flex-1">Cancel</Button>
                    </div>
                </div>
            </Modal>

            <ReceiptModal
                isOpen={!!receiptInvoice}
                onClose={() => setReceiptInvoice(null)}
                invoice={receiptInvoice}
            />
        </div>
    );
}
