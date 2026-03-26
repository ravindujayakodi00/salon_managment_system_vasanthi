'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Wallet } from 'lucide-react';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import Modal from '@/components/shared/Modal';
import { useAuth } from '@/lib/auth';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/context/ToastContext';
import { financialService, type StylistFinancialRow } from '@/services/financial';

function getTodayISO() {
    return new Date().toISOString().split('T')[0];
}

function getFirstDayOfMonthISO() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
}

export default function FinancialPage() {
    const { user } = useAuth();
    const { showToast } = useToast();

    const [dateRange, setDateRange] = useState({
        start: getFirstDayOfMonthISO(),
        end: getTodayISO(),
    });

    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<StylistFinancialRow[]>([]);
    const [totals, setTotals] = useState({
        initial_salary: 0,
        commission_sum: 0,
        advances_sum: 0,
        available_for_advance: 0,
    });

    const [advanceOpen, setAdvanceOpen] = useState(false);
    const [advanceStaffId, setAdvanceStaffId] = useState<string>('');
    const [advanceAmount, setAdvanceAmount] = useState<string>('');
    const [advanceDescription, setAdvanceDescription] = useState<string>('');
    const [advanceMax, setAdvanceMax] = useState<number>(0);
    const [advanceProcessing, setAdvanceProcessing] = useState(false);

    const canCreateAdvance = user?.role === 'Owner' || user?.role === 'Manager';

    const fetchFinancials = async () => {
        if (!user?.id || !user?.role) return;

        try {
            setLoading(true);
            const res = await financialService.getStylistsFinancials({
                startDate: dateRange.start,
                endDate: dateRange.end,
                branchId: user.branchId || null,
                requesterId: user.id,
                requesterRole: user.role,
            });

            setRows(res.rows);
            setTotals(res.totals);
        } catch (error: any) {
            console.error('Error fetching financials:', error);
            showToast(error.message || 'Failed to load financials', 'error');
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFinancials();
    }, [dateRange.start, dateRange.end, user?.id, user?.role, user?.branchId]);

    const selectedRow = useMemo(() => rows.find((r) => r.staff_id === advanceStaffId) || null, [rows, advanceStaffId]);

    const openAdvanceModal = (staffId: string, maxAvailable: number) => {
        setAdvanceStaffId(staffId);
        setAdvanceAmount('');
        setAdvanceDescription('');
        setAdvanceMax(maxAvailable);
        setAdvanceOpen(true);
    };

    const submitAdvance = async () => {
        if (!user?.id) {
            showToast('User not authenticated', 'error');
            return;
        }

        if (!advanceStaffId) {
            showToast('Select a stylist first', 'error');
            return;
        }

        const amount = Number(advanceAmount);
        if (!amount || amount <= 0) {
            showToast('Enter a valid advance amount', 'error');
            return;
        }

        if (amount > advanceMax) {
            showToast('Amount exceeds available salary for advance', 'error');
            return;
        }

        try {
            setAdvanceProcessing(true);
            await financialService.createCashAdvance({
                staffId: advanceStaffId,
                amount,
                description: advanceDescription.trim() ? advanceDescription.trim() : undefined,
                createdByUserId: user.id,
            });

            setAdvanceOpen(false);
            showToast('Cash advance recorded', 'success');
            await fetchFinancials();
        } catch (error: any) {
            console.error('Error creating cash advance:', error);
            showToast(error.message || 'Failed to record cash advance', 'error');
        } finally {
            setAdvanceProcessing(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Financial</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Stylists: initial salary, commission totals, advances, and available balance
                    </p>
                </div>

                {/* Date Range Filter */}
                <div className="flex flex-wrap gap-2 items-center">
                    <div className="relative">
                        <Input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            leftIcon={<Calendar className="h-4 w-4" />}
                        />
                    </div>
                    <div className="relative">
                        <Input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setDateRange({ start: getFirstDayOfMonthISO(), end: getTodayISO() })}>
                        This month
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card p-6 bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-2xl shadow-xl"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-primary-100 text-sm">Initial Salary</p>
                            <h3 className="text-2xl font-bold mt-1">{formatCurrency(totals.initial_salary)}</h3>
                        </div>
                    </div>
                </motion.div>

                <div className="card p-6 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl">
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Commission</p>
                    <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{formatCurrency(totals.commission_sum)}</h3>
                </div>

                <div className="card p-6 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl">
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Advances</p>
                    <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{formatCurrency(totals.advances_sum)}</h3>
                </div>

                <div className="card p-6 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl">
                    <div className="flex items-center gap-3">
                        <Wallet className="h-8 w-8 text-secondary-500" />
                        <div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Current Salary Balance</p>
                            <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{formatCurrency(totals.available_for_advance)}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card p-4 sm:p-6 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Stylists</h2>

                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading financial data...</div>
                ) : rows.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">No stylists found for this period.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left py-3 px-3 sm:px-4 font-semibold text-gray-700 dark:text-gray-300">Stylist</th>
                                    <th className="text-right py-3 px-3 sm:px-4 font-semibold text-gray-700 dark:text-gray-300">Initial Salary</th>
                                    <th className="text-right py-3 px-3 sm:px-4 font-semibold text-gray-700 dark:text-gray-300">Commission</th>
                                    <th className="hidden lg:table-cell text-right py-3 px-3 sm:px-4 font-semibold text-gray-700 dark:text-gray-300">Advances</th>
                                    <th className="text-right py-3 px-3 sm:px-4 font-semibold text-gray-700 dark:text-gray-300">Current Salary</th>
                                    <th className="text-right py-3 px-3 sm:px-4 font-semibold text-gray-700 dark:text-gray-300">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => {
                                    const available = r.available_for_advance;
                                    const canAdvanceRow = canCreateAdvance && available > 0;

                                    return (
                                        <tr key={r.staff_id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                            <td className="py-4 px-3 sm:px-4 text-gray-900 dark:text-white font-medium">
                                                <div>{r.staff_name}</div>
                                                {r.last_advances.length > 0 && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        Last advance: {formatCurrency(r.last_advances[0].amount)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-4 px-3 sm:px-4 text-right text-gray-700 dark:text-gray-300">
                                                {formatCurrency(r.initial_salary)}
                                            </td>
                                            <td className="py-4 px-3 sm:px-4 text-right text-success-600 dark:text-success-400">
                                                {formatCurrency(r.commission_sum)}
                                            </td>
                                            <td className="hidden lg:table-cell py-4 px-3 sm:px-4 text-right text-gray-700 dark:text-gray-300">
                                                {formatCurrency(r.advances_sum)}
                                            </td>
                                            <td className="py-4 px-3 sm:px-4 text-right font-semibold text-gray-900 dark:text-white">
                                                {formatCurrency(available)}
                                            </td>
                                            <td className="py-4 px-3 sm:px-4 text-right">
                                                <Button
                                                    size="sm"
                                                    variant={canAdvanceRow ? 'primary' : 'outline'}
                                                    disabled={!canAdvanceRow}
                                                    onClick={() => openAdvanceModal(r.staff_id, available)}
                                                >
                                                    Cash Advance
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Cash Advance Modal */}
            <Modal
                isOpen={advanceOpen}
                onClose={() => {
                    if (!advanceProcessing) setAdvanceOpen(false);
                }}
                title="Cash Advance"
                size="md"
            >
                {selectedRow ? (
                    <div className="space-y-4">
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                            Stylist: <span className="font-medium text-gray-900 dark:text-white">{selectedRow.staff_name}</span>
                        </div>

                        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/20 border border-gray-100 dark:border-gray-700">
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                Current salary balance: <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(advanceMax)}</span>
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Amount (Rs)
                            </label>
                            <Input
                                type="number"
                                value={advanceAmount}
                                onChange={(e) => setAdvanceAmount(e.target.value)}
                                placeholder="0"
                                min="0"
                                step="100"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Description (optional)
                            </label>
                            <Input
                                value={advanceDescription}
                                onChange={(e) => setAdvanceDescription(e.target.value)}
                                placeholder="e.g., advance for expenses"
                            />
                        </div>

                        <div className="flex gap-3">
                            <Button
                                onClick={submitAdvance}
                                isLoading={advanceProcessing}
                                className="flex-1"
                            >
                                Record Advance
                            </Button>
                            <Button
                                onClick={() => setAdvanceOpen(false)}
                                variant="outline"
                                className="flex-1"
                                disabled={advanceProcessing}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="text-gray-500 text-sm">Select a stylist to continue.</div>
                )}
            </Modal>
        </div>
    );
}

