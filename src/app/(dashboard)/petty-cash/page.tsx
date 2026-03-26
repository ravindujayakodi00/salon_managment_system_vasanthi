'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, Wallet, TrendingUp, TrendingDown, Search, Download } from 'lucide-react';
import { pettyCashService, PettyCashTransaction } from '@/services/petty-cash';
import { useAuth } from '@/lib/auth';
import Input from '@/components/shared/Input';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { useToast } from '@/context/ToastContext';

export default function PettyCashPage() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<PettyCashTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddCash, setShowAddCash] = useState(false);
    const [showRecordExpense, setShowRecordExpense] = useState(false);

    // Form states
    const [depositAmount, setDepositAmount] = useState('');
    const [depositDescription, setDepositDescription] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseDescription, setExpenseDescription] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [currentBalance, { data: txns }] = await Promise.all([
                pettyCashService.getCurrentBalance(),
                pettyCashService.getTransactions(0, 50)
            ]);
            setBalance(currentBalance);
            setTransactions(txns);
        } catch (error) {
            console.error('Error fetching petty cash data:', error);
            showToast('Failed to load petty cash data', 'error');
        } finally {
            setLoading(false);
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

        if (!user?.id) {
            showToast('User not authenticated', 'error');
            return;
        }

        try {
            setProcessing(true);
            await pettyCashService.addDeposit(
                parseFloat(depositAmount),
                depositDescription,
                user.id,
                user.branchId || null
            );
            showToast('Cash added successfully', 'success');
            setDepositAmount('');
            setDepositDescription('');
            setShowAddCash(false);
            fetchData();
        } catch (error: any) {
            showToast(error.message || 'Failed to add cash', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const handleRecordExpense = async () => {
        if (!expenseAmount || parseFloat(expenseAmount) <= 0) {
            showToast('Please enter a valid amount', 'error');
            return;
        }

        if (!expenseDescription.trim()) {
            showToast('Please enter a description', 'error');
            return;
        }

        if (parseFloat(expenseAmount) > balance) {
            showToast('Insufficient balance', 'error');
            return;
        }

        if (!user?.id) {
            showToast('User not authenticated', 'error');
            return;
        }

        try {
            setProcessing(true);
            await pettyCashService.recordExpense(
                parseFloat(expenseAmount),
                expenseDescription,
                user.id,
                user.branchId || null
            );
            showToast('Expense recorded successfully', 'success');
            setExpenseAmount('');
            setExpenseDescription('');
            setShowRecordExpense(false);
            fetchData();
        } catch (error: any) {
            showToast(error.message || 'Failed to record expense', 'error');
        } finally {
            setProcessing(false);
        }
    };

    const formatCurrency = (amount: number) => `Rs ${amount.toLocaleString()}`;
    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const canAddCash = user?.role === 'Owner' || user?.role === 'Manager';

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Petty Cash</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Manage salon petty cash fund</p>
                </div>
            </div>

            {/* Balance Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl p-5 sm:p-8 text-white shadow-xl"
            >
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
                        onClick={() => setShowRecordExpense(true)}
                        className="flex items-center gap-2 px-5 py-3 bg-white/20 text-white rounded-xl font-semibold hover:bg-white/30 transition-colors backdrop-blur-sm"
                    >
                        <Minus className="h-5 w-5" />
                        Record Expense
                    </button>
                </div>
            </motion.div>

            {/* Transactions */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="card p-6"
            >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Recent Transactions</h2>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-gray-200 dark:border-gray-700">
                            <tr className="text-left">
                                <th className="pb-3 pr-4 text-sm font-medium text-gray-500 dark:text-gray-400">Date & Time</th>
                                <th className="pb-3 pr-4 text-sm font-medium text-gray-500 dark:text-gray-400">Type</th>
                                <th className="pb-3 pr-4 text-sm font-medium text-gray-500 dark:text-gray-400">Description</th>
                                <th className="pb-3 pr-4 text-sm font-medium text-gray-500 dark:text-gray-400">Amount</th>
                                <th className="hidden md:table-cell pb-3 pr-4 text-sm font-medium text-gray-500 dark:text-gray-400">Balance After</th>
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
                                                Expense
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
                                    <td className="hidden md:table-cell py-4 pr-4 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                                        {formatCurrency(txn.balance_after)}
                                    </td>
                                    <td className="hidden lg:table-cell py-4 text-sm text-gray-600 dark:text-gray-400">
                                        {txn.profiles?.name || 'Unknown'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {transactions.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            No transactions yet
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Add Cash Modal */}
            <Modal
                isOpen={showAddCash}
                onClose={() => setShowAddCash(false)}
                title="Add Cash to Petty Cash"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Amount (Rs)
                        </label>
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
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Description
                        </label>
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
                        <Button
                            onClick={handleAddDeposit}
                            isLoading={processing}
                            className="flex-1"
                        >
                            Add Cash
                        </Button>
                        <Button
                            onClick={() => setShowAddCash(false)}
                            variant="outline"
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Record Expense Modal */}
            <Modal
                isOpen={showRecordExpense}
                onClose={() => setShowRecordExpense(false)}
                title="Record Expense"
            >
                <div className="space-y-4">
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
                            Description
                        </label>
                        <Input
                            value={expenseDescription}
                            onChange={(e) => setExpenseDescription(e.target.value)}
                            placeholder="e.g., Cleaning supplies, Electricity bill"
                        />
                    </div>
                    {expenseAmount && (
                        <div className={`p-4 rounded-lg ${parseFloat(expenseAmount) > balance ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                            <p className={`text-sm ${parseFloat(expenseAmount) > balance ? 'text-red-800 dark:text-red-300' : 'text-blue-800 dark:text-blue-300'}`}>
                                {parseFloat(expenseAmount) > balance ? (
                                    'Insufficient balance'
                                ) : (
                                    `Remaining Balance: ${formatCurrency(balance - parseFloat(expenseAmount || '0'))}`
                                )}
                            </p>
                        </div>
                    )}
                    <div className="flex gap-3">
                        <Button
                            onClick={handleRecordExpense}
                            isLoading={processing}
                            className="flex-1"
                            disabled={parseFloat(expenseAmount) > balance}
                        >
                            Record Expense
                        </Button>
                        <Button
                            onClick={() => setShowRecordExpense(false)}
                            variant="outline"
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
