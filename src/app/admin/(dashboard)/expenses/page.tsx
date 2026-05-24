'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, Wallet, TrendingUp, TrendingDown, Receipt, ReceiptText } from 'lucide-react';
import { pettyCashService, PettyCashTransaction, ExpenseCategory } from '@/services/petty-cash';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import Input from '@/components/shared/Input';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useToast } from '@/context/ToastContext';

type Tab = 'expenses' | 'petty-cash';

export default function ExpensesPage() {
    const { user } = useAuth();
    const { effectiveBranchId, branches } = useWorkspace();
    const { showToast } = useToast();

    const [activeTab, setActiveTab] = useState<Tab>('expenses');
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<PettyCashTransaction[]>([]);
    const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
    const [loading, setLoading] = useState(true);

    // Expense modal state
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [expenseCategoryId, setExpenseCategoryId] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDescription, setExpenseDescription] = useState('');
    const [expenseBranchId, setExpenseBranchId] = useState(effectiveBranchId ?? '');

    // Petty cash modal state
    const [showAddCash, setShowAddCash] = useState(false);
    const [showPettyCashModal, setShowPettyCashModal] = useState(false);
    const [depositAmount, setDepositAmount] = useState('');
    const [depositDescription, setDepositDescription] = useState('');
    const [depositBranchId, setDepositBranchId] = useState(effectiveBranchId ?? '');
    const [pettyCashAmount, setPettyCashAmount] = useState('');
    const [pettyCashDescription, setPettyCashDescription] = useState('');
    const [pettyCashBranchId, setPettyCashBranchId] = useState(effectiveBranchId ?? '');

    const [processing, setProcessing] = useState(false);

    const canAddCash = user?.systemRole === 'Owner' || user?.systemRole === 'Manager';

    useEffect(() => {
        fetchData();
    }, [activeTab, effectiveBranchId]);

    useEffect(() => {
        if (effectiveBranchId) {
            setExpenseBranchId(effectiveBranchId);
            setDepositBranchId(effectiveBranchId);
            setPettyCashBranchId(effectiveBranchId);
        }
    }, [effectiveBranchId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const entryType = activeTab === 'expenses' ? 'expense' : 'petty_cash';
            const [currentBalance, { data: txns }, categories] = await Promise.all([
                pettyCashService.getCurrentBalance(effectiveBranchId),
                pettyCashService.getTransactions(0, 200, entryType, effectiveBranchId),
                activeTab === 'expenses' ? pettyCashService.getExpenseCategories() : Promise.resolve([]),
            ]);
            setBalance(currentBalance);
            setTransactions(txns);
            if (categories.length) setExpenseCategories(categories);
        } catch (error) {
            console.error('Error fetching data:', error);
            showToast('Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRecordExpense = async () => {
        if (!expenseCategoryId) {
            showToast('Please select an expense category', 'error');
            return;
        }
        if (!expenseAmount || parseFloat(expenseAmount) <= 0) {
            showToast('Please enter a valid amount', 'error');
            return;
        }
        if (!expenseBranchId) {
            showToast('Please select a branch', 'error');
            return;
        }
        if (!user?.id) return;

        try {
            setProcessing(true);
            const category = expenseCategories.find(c => c.id === expenseCategoryId);
            const description = expenseDescription.trim()
                ? `${category?.name} — ${expenseDescription.trim()}`
                : category?.name || '';

            await pettyCashService.recordExpense(
                parseFloat(expenseAmount),
                description,
                expenseCategoryId,
                user.id,
                expenseBranchId,
                user.organizationId
            );
            showToast('Expense recorded successfully', 'success');
            setExpenseCategoryId('');
            setExpenseAmount('');
            setExpenseDescription('');
            setExpenseBranchId('');
            setShowExpenseModal(false);
            fetchData();
        } catch (error: any) {
            showToast(error.message || 'Failed to record expense', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const handleAddDeposit = async () => {
        if (!depositAmount || parseFloat(depositAmount) <= 0) {
            showToast('Please enter a valid amount', 'error');
            return;
        }
        if (!depositDescription.trim()) {
            showToast('Please enter a description', 'error');
            return;
        }
        if (!depositBranchId) {
            showToast('Please select a branch', 'error');
            return;
        }
        if (!user?.id) return;

        try {
            setProcessing(true);
            await pettyCashService.addDeposit(
                parseFloat(depositAmount),
                depositDescription,
                user.id,
                depositBranchId,
                user.organizationId
            );
            showToast('Cash added successfully', 'success');
            setDepositAmount('');
            setDepositDescription('');
            setDepositBranchId('');
            setShowAddCash(false);
            fetchData();
        } catch (error: any) {
            showToast(error.message || 'Failed to add cash', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const handleRecordPettyCash = async () => {
        if (!pettyCashAmount || parseFloat(pettyCashAmount) <= 0) {
            showToast('Please enter a valid amount', 'error');
            return;
        }
        if (!pettyCashDescription.trim()) {
            showToast('Please enter a description', 'error');
            return;
        }
        if (!pettyCashBranchId) {
            showToast('Please select a branch', 'error');
            return;
        }
        if (parseFloat(pettyCashAmount) > balance) {
            showToast('Insufficient petty cash balance', 'error');
            return;
        }
        if (!user?.id) return;

        try {
            setProcessing(true);
            await pettyCashService.recordPettyCash(
                parseFloat(pettyCashAmount),
                pettyCashDescription,
                user.id,
                pettyCashBranchId,
                user.organizationId
            );
            showToast('Petty cash recorded successfully', 'success');
            setPettyCashAmount('');
            setPettyCashDescription('');
            setPettyCashBranchId('');
            setShowPettyCashModal(false);
            fetchData();
        } catch (error: any) {
            showToast(error.message || 'Failed to record petty cash', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const formatCurrency = (amount: number) => `Rs ${amount.toLocaleString()}`;
    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Expenses</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Track business expenses and manage petty cash</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('expenses')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'expenses'
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                >
                    <ReceiptText className="h-4 w-4" />
                    Expenses
                </button>
                <button
                    onClick={() => setActiveTab('petty-cash')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'petty-cash'
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                >
                    <Wallet className="h-4 w-4" />
                    Petty Cash
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center min-h-[300px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
            ) : (
                <>
                    {/* ── EXPENSES TAB ── */}
                    {activeTab === 'expenses' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                            <div className="card p-6 surface-panel flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Record a business expense against a specific category.</p>
                                </div>
                                <button
                                    onClick={() => setShowExpenseModal(true)}
                                    className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors whitespace-nowrap"
                                >
                                    <Receipt className="h-5 w-5" />
                                    Record Expense
                                </button>
                            </div>

                            <TransactionsTable
                                transactions={transactions}
                                formatCurrency={formatCurrency}
                                formatDateTime={formatDateTime}
                                showBalance={false}
                            />
                        </motion.div>
                    )}

                    {/* ── PETTY CASH TAB ── */}
                    {activeTab === 'petty-cash' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                            <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-5 sm:p-8 text-white shadow-xl">
                                <div className="flex items-center gap-3 mb-4">
                                    <Wallet className="h-8 w-8" />
                                    <h2 className="text-xl font-semibold">Available Balance</h2>
                                </div>
                                <div className="text-3xl sm:text-5xl font-bold mb-6">{formatCurrency(balance)}</div>
                                <div className="flex flex-wrap gap-3">
                                    {canAddCash && (
                                        <button
                                            onClick={() => setShowAddCash(true)}
                                            className="flex items-center gap-2 px-5 py-3 bg-white text-primary-600 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                                        >
                                            <Plus className="h-5 w-5" />
                                            Add Cash
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowPettyCashModal(true)}
                                        className="flex items-center gap-2 px-5 py-3 bg-white/20 text-white rounded-xl font-semibold hover:bg-white/30 transition-colors backdrop-blur-sm"
                                    >
                                        <Minus className="h-5 w-5" />
                                        Record Petty Cash
                                    </button>
                                </div>
                            </div>

                            <TransactionsTable
                                transactions={transactions}
                                formatCurrency={formatCurrency}
                                formatDateTime={formatDateTime}
                                showBalance={true}
                            />
                        </motion.div>
                    )}
                </>
            )}

            {/* ── Record Expense Modal ── */}
            <Modal isOpen={showExpenseModal} onClose={() => setShowExpenseModal(false)} title="Record Expense">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Branch</label>
                        <select
                            value={expenseBranchId}
                            onChange={(e) => setExpenseBranchId(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-gray-900 dark:text-white"
                        >
                            <option value="">Select branch...</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Expense Category
                        </label>
                        <select
                            value={expenseCategoryId}
                            onChange={(e) => setExpenseCategoryId(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-gray-900 dark:text-white"
                        >
                            <option value="">Select category...</option>
                            {expenseCategories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Amount (Rs)
                        </label>
                        <Input
                            type="number"
                            value={expenseAmount}
                            onChange={(e) => setExpenseAmount(e.target.value)}
                            placeholder="0"
                            min="0"
                            step="100"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Description <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <Input
                            value={expenseDescription}
                            onChange={(e) => setExpenseDescription(e.target.value)}
                            placeholder="e.g., Bill number, period, notes..."
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button onClick={handleRecordExpense} isLoading={processing} className="flex-1">
                            Record Expense
                        </Button>
                        <Button onClick={() => setShowExpenseModal(false)} variant="outline" className="flex-1">
                            Cancel
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ── Add Cash Modal ── */}
            <Modal isOpen={showAddCash} onClose={() => setShowAddCash(false)} title="Add Cash to Petty Cash">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Branch</label>
                        <select
                            value={depositBranchId}
                            onChange={(e) => setDepositBranchId(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-gray-900 dark:text-white"
                        >
                            <option value="">Select branch...</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Amount (Rs)</label>
                        <Input
                            type="number"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            placeholder="0"
                            min="0"
                            step="100"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                        <Input
                            value={depositDescription}
                            onChange={(e) => setDepositDescription(e.target.value)}
                            placeholder="e.g., Initial deposit, Monthly addition"
                        />
                    </div>
                    {depositAmount && (
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <p className="text-sm text-green-800 dark:text-green-300">
                                New Balance: {formatCurrency(balance + parseFloat(depositAmount || '0'))}
                            </p>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <Button onClick={handleAddDeposit} isLoading={processing} className="flex-1">Add Cash</Button>
                        <Button onClick={() => setShowAddCash(false)} variant="outline" className="flex-1">Cancel</Button>
                    </div>
                </div>
            </Modal>

            {/* ── Record Petty Cash Modal ── */}
            <Modal isOpen={showPettyCashModal} onClose={() => setShowPettyCashModal(false)} title="Record Petty Cash">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Branch</label>
                        <select
                            value={pettyCashBranchId}
                            onChange={(e) => setPettyCashBranchId(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-gray-900 dark:text-white"
                        >
                            <option value="">Select branch...</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Amount (Rs)</label>
                        <Input
                            type="number"
                            value={pettyCashAmount}
                            onChange={(e) => setPettyCashAmount(e.target.value)}
                            placeholder="0"
                            min="0"
                            step="100"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                        <Input
                            value={pettyCashDescription}
                            onChange={(e) => setPettyCashDescription(e.target.value)}
                            placeholder="e.g., Cleaning supplies, Office stationery"
                        />
                    </div>
                    {pettyCashAmount && (
                        <div className={`p-4 rounded-lg ${parseFloat(pettyCashAmount) > balance ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                            <p className={`text-sm ${parseFloat(pettyCashAmount) > balance ? 'text-red-800 dark:text-red-300' : 'text-blue-800 dark:text-blue-300'}`}>
                                {parseFloat(pettyCashAmount) > balance
                                    ? 'Insufficient balance'
                                    : `Remaining Balance: ${formatCurrency(balance - parseFloat(pettyCashAmount || '0'))}`}
                            </p>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <Button
                            onClick={handleRecordPettyCash}
                            isLoading={processing}
                            className="flex-1"
                            disabled={parseFloat(pettyCashAmount) > balance}
                        >
                            Record
                        </Button>
                        <Button onClick={() => setShowPettyCashModal(false)} variant="outline" className="flex-1">Cancel</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

// ── Shared transactions table ──
function TransactionsTable({
    transactions,
    formatCurrency,
    formatDateTime,
    showBalance,
}: {
    transactions: PettyCashTransaction[];
    formatCurrency: (n: number) => string;
    formatDateTime: (s: string) => string;
    showBalance: boolean;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card p-6"
        >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recent Records</h2>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="border-b border-gray-200 dark:border-gray-700">
                        <tr className="text-left">
                            <th className="pb-3 pr-4 text-sm font-medium text-gray-500 dark:text-gray-400">Date & Time</th>
                            <th className="pb-3 pr-4 text-sm font-medium text-gray-500 dark:text-gray-400">Type</th>
                            <th className="pb-3 pr-4 text-sm font-medium text-gray-500 dark:text-gray-400">Description</th>
                            <th className="pb-3 pr-4 text-sm font-medium text-gray-500 dark:text-gray-400">Amount</th>
                            {showBalance && (
                                <th className="hidden md:table-cell pb-3 pr-4 text-sm font-medium text-gray-500 dark:text-gray-400">Balance After</th>
                            )}
                            <th className="hidden lg:table-cell pb-3 text-sm font-medium text-gray-500 dark:text-gray-400">Recorded By</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {transactions.map((txn) => (
                            <tr key={txn.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="py-4 pr-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                    {formatDateTime(txn.created_at)}
                                </td>
                                <td className="py-4 pr-4">
                                    {txn.type === 'deposit' ? (
                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                            <TrendingUp className="h-4 w-4" />
                                            Deposit
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                            <TrendingDown className="h-4 w-4" />
                                            {txn.entry_type === 'expense' ? 'Expense' : 'Petty Cash'}
                                        </span>
                                    )}
                                </td>
                                <td className="py-4 pr-4 text-sm text-gray-900 dark:text-white">
                                    {txn.description}
                                </td>
                                <td className="py-4 pr-4 text-sm font-semibold whitespace-nowrap">
                                    <span className={txn.type === 'deposit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                        {txn.type === 'deposit' ? '+' : '-'}{formatCurrency(txn.amount)}
                                    </span>
                                </td>
                                {showBalance && (
                                    <td className="hidden md:table-cell py-4 pr-4 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                                        {formatCurrency(txn.balance_after)}
                                    </td>
                                )}
                                <td className="hidden lg:table-cell py-4 text-sm text-gray-600 dark:text-gray-400">
                                    {txn.profiles?.name || 'Unknown'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {transactions.length === 0 && (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        No records yet
                    </div>
                )}
            </div>
        </motion.div>
    );
}
