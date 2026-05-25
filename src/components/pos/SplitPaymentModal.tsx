'use client';

import { useState } from 'react';
import { PaymentMethod, PaymentBreakdown } from '@/lib/types';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import { Banknote, CreditCard, Building, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface SplitPaymentModalProps {
    total: number;
    onConfirm: (breakdown: PaymentBreakdown[], primaryMethod: PaymentMethod) => void;
    onCancel: () => void;
}

const paymentMethodIcons: Record<PaymentMethod, any> = {
    'Cash': Banknote,
    'Card': CreditCard,
    'BankTransfer': Building,
    'Other': DollarSign
};

export default function SplitPaymentModal({ total, onConfirm, onCancel }: SplitPaymentModalProps) {
    const [payments, setPayments] = useState<PaymentBreakdown[]>([
        { method: 'Cash', amount: 0 },
        { method: 'Card', amount: 0 }
    ]);

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = total - totalPaid;
    // Match invoice total; unused lines can be $0 (e.g. full amount on cash only).
    const isValid =
        Math.abs(remaining) < 0.01 &&
        payments.some(p => p.amount > 0) &&
        payments.every(p => p.amount >= 0 && !Number.isNaN(p.amount));

    const updatePaymentAmount = (index: number, amount: number) => {
        const newPayments = [...payments];
        newPayments[index].amount = amount;
        setPayments(newPayments);
    };

    const updatePaymentMethod = (index: number, method: PaymentMethod) => {
        const newPayments = [...payments];
        newPayments[index].method = method;
        setPayments(newPayments);
    };

    const addPaymentMethod = () => {
        if (payments.length < 4) { // Max 4 payment methods
            setPayments([...payments, { method: 'BankTransfer', amount: 0 }]);
        }
    };

    const removePaymentMethod = (index: number) => {
        if (payments.length > 1) {
            setPayments(payments.filter((_, i) => i !== index));
        }
    };

    const handleConfirm = () => {
        const breakdown = payments.filter(p => p.amount > 0.001);
        const primaryMethod = breakdown.reduce((max, p) =>
            p.amount > max.amount ? p : max
        ).method;
        onConfirm(breakdown, primaryMethod);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Split Payment
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Total Bill: <span className="font-semibold text-lg">{formatCurrency(total)}</span>
                </p>

                <div className="space-y-3 mb-6">
                    {payments.map((payment, index) => {
                        const Icon = paymentMethodIcons[payment.method];
                        return (
                            <div key={index} className="flex items-center gap-2">
                                <div className="flex-1">
                                    <select
                                        value={payment.method}
                                        onChange={(e) => updatePaymentMethod(index, e.target.value as PaymentMethod)}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                    >
                                        <option value="Cash">💵 Cash</option>
                                        <option value="Card">💳 Card</option>
                                        <option value="BankTransfer">🏦 Bank Transfer</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <Input
                                        type="number"
                                        placeholder="Amount"
                                        value={payment.amount || ''}
                                        onChange={(e) => updatePaymentAmount(index, parseFloat(e.target.value) || 0)}
                                        min="0"
                                        step="0.01"
                                        className="text-right"
                                    />
                                </div>
                                {payments.length > 1 && (
                                    <button
                                        onClick={() => removePaymentMethod(index)}
                                        className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {payments.length < 4 && (
                    <button
                        onClick={addPaymentMethod}
                        className="w-full py-2 text-sm text-primary-600 hover:text-primary-700 font-medium mb-4"
                    >
                        + Add Payment Method
                    </button>
                )}

                <div className={`p-4 rounded-xl mb-6 ${remaining > 0.01
                    ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
                    : remaining < -0.01
                        ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                        : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    }`}>
                    <div className="flex justify-between items-center text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Total Paid:</span>
                        <span className="font-semibold">{formatCurrency(totalPaid)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm mt-1">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Remaining:</span>
                        <span className={`font-bold ${Math.abs(remaining) < 0.01 ? 'text-green-600' : 'text-orange-600'
                            }`}>
                            {formatCurrency(remaining)}
                        </span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!isValid}
                        className="flex-1"
                    >
                        Confirm Payment
                    </Button>
                </div>

                {!isValid && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                        {remaining > 0.01
                            ? `Add ${formatCurrency(remaining)} more to complete payment`
                            : remaining < -0.01
                                ? `Reduce payment by ${formatCurrency(Math.abs(remaining))}`
                                : totalPaid <= 0
                                    ? 'Enter amounts that add up to the total (one method is fine; leave others at 0)'
                                    : 'Amounts cannot be negative'
                        }
                    </p>
                )}
            </div>
        </div>
    );
}
