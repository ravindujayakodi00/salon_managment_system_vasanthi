'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader, CheckCircle, Save } from 'lucide-react';
import { schedulingService } from '@/services/scheduling';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import { useAuth } from '@/lib/auth';

interface ShowMessage {
    (type: 'success' | 'error', text: string): void;
}

// Tax Settings Component
export default function TaxSettings({ showMessage }: { showMessage: ShowMessage }) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState<any>(null);

    const fetchSettings = useCallback(async () => {
        const data = await schedulingService.getSalonSettings(user?.organizationId ?? null);
        setSettings(data);
    }, [user?.organizationId]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleUpdate = async () => {
        if (!settings) return;
        setLoading(true);
        const result = await schedulingService.updateSalonSettings(settings, user?.organizationId);
        setLoading(false);

        if (result.success) {
            showMessage('success', result.message);
        } else {
            showMessage('error', result.message);
        }
    };

    if (!settings) return <Loader className="h-6 w-6 animate-spin" />;

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Tax Configuration
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Configure tax settings for your POS system
                </p>
            </div>

            {/* Enable Tax Toggle */}
            <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h4 className="text-base font-medium text-gray-900 dark:text-white mb-1">
                            Enable Tax in POS
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            When enabled, tax will be automatically calculated and displayed on all POS invoices
                        </p>
                    </div>
                    <button
                        onClick={() => setSettings({ ...settings, enable_tax: !settings.enable_tax })}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ml-4 ${settings.enable_tax ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                    >
                        <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${settings.enable_tax ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>

                {settings.enable_tax && (
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <span className="text-green-700 dark:text-green-400 font-medium">Tax is enabled</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Tax Rate Configuration */}
            <div className={`space-y-4 transition-opacity ${!settings.enable_tax ? 'opacity-50 pointer-events-none' : ''}`}>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tax Rate (%)
                    </label>
                    <div className="flex items-center gap-4">
                        <div className="flex-1 max-w-xs">
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={settings.tax_rate}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, tax_rate: parseFloat(e.target.value) || 0 })}
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    disabled={!settings.enable_tax}
                                    className="pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                                    %
                                </span>
                            </div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                            = ₹{((1000 * settings.tax_rate) / 100).toFixed(2)} tax on ₹1,000
                        </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                        This rate will be applied to all taxable items in POS
                    </p>
                </div>

                {/* Tax Preview */}
                {settings.enable_tax && settings.tax_rate > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h5 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-3">
                            Tax Calculation Preview
                        </h5>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-700 dark:text-gray-300">Subtotal:</span>
                                <span className="font-medium text-gray-900 dark:text-white">₹5,000.00</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-700 dark:text-gray-300">Tax ({settings.tax_rate}%):</span>
                                <span className="font-medium text-gray-900 dark:text-white">₹{((5000 * settings.tax_rate) / 100).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-blue-200 dark:border-blue-800">
                                <span className="text-gray-900 dark:text-white font-semibold">Total:</span>
                                <span className="font-bold text-primary-600 dark:text-primary-400">₹{(5000 + (5000 * settings.tax_rate) / 100).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Save Button */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <Button
                    variant="primary"
                    onClick={handleUpdate}
                    disabled={loading}
                    leftIcon={loading ? <Loader className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                >
                    {loading ? 'Saving...' : 'Save Tax Settings'}
                </Button>
            </div>
        </div>
    );
}
