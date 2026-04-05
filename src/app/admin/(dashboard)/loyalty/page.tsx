'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Gift, CreditCard, Star, Users, Plus, Loader, Package, Search, RefreshCw } from 'lucide-react';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import { loyaltyService, LoyaltySettings, LoyaltyCard } from '@/services/loyalty';
import { customersService } from '@/services/customers';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/context/ToastContext';
import { formatCurrency } from '@/lib/utils';

export default function LoyaltyPage() {
    const { hasRole } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<LoyaltySettings | null>(null);
    const [inventory, setInventory] = useState<{ available: number; sold: number; expired: number; total: number; cards: LoyaltyCard[] }>({
        available: 0, sold: 0, expired: 0, total: 0, cards: []
    });
    const [generatingCards, setGeneratingCards] = useState(false);
    const [cardsToGenerate, setCardsToGenerate] = useState(10);

    // Customer lookup
    const [customerSearch, setCustomerSearch] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [customerLoyalty, setCustomerLoyalty] = useState<any>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [settingsData, inventoryData] = await Promise.all([
                loyaltyService.getSettings(),
                loyaltyService.getCardInventory()
            ]);
            setSettings(settingsData);
            setInventory(inventoryData);
        } catch (error) {
            console.error('Error fetching loyalty data:', error);
            showToast('Failed to load loyalty data', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleGenerateCards = async () => {
        if (cardsToGenerate < 1) {
            showToast('Please enter a valid number', 'warning');
            return;
        }
        setGeneratingCards(true);
        try {
            const cards = await loyaltyService.generateCards(cardsToGenerate);
            showToast(`Generated ${cards.length} new loyalty cards!`, 'success');
            fetchData();
        } catch (error: any) {
            console.error('Error generating cards:', error);
            showToast(error.message || 'Failed to generate cards', 'error');
        } finally {
            setGeneratingCards(false);
        }
    };

    const handleSearchCustomer = async () => {
        if (customerSearch.length < 2) return;
        try {
            const results = await customersService.searchCustomers(customerSearch);
            setSearchResults(results || []);
        } catch (error) {
            console.error('Error searching customers:', error);
        }
    };

    const handleSelectCustomer = async (customer: any) => {
        setSelectedCustomer(customer);
        setSearchResults([]);
        setCustomerSearch('');
        try {
            const info = await loyaltyService.getCustomerLoyaltyInfo(customer.id);
            setCustomerLoyalty(info);
        } catch (error) {
            console.error('Error fetching customer loyalty:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader className="h-8 w-8 animate-spin text-primary-600" />
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">Loyalty settings not configured. Go to Settings to set up.</p>
            </div>
        );
    }

    const programMode = settings.option_card_enabled
        ? 'card'
        : settings.option_points_enabled
            ? 'points'
            : settings.option_visits_enabled
                ? 'visits'
                : 'none';
    const noOptionsEnabled = programMode === 'none';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Loyalty Program</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        {programMode === 'none'
                            ? 'Choose one program in Settings → Loyalty Program'
                            : `Active: ${programMode === 'card' ? 'Loyalty cards' : programMode === 'points' ? 'Points' : 'Visit rewards'} — sell cards at POS when using cards`}
                    </p>
                </div>
                <Button variant="outline" onClick={fetchData} leftIcon={<RefreshCw className="h-4 w-4" />}>
                    Refresh
                </Button>
            </div>

            {noOptionsEnabled && (
                <div className="p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-center">
                    <Gift className="h-12 w-12 text-amber-500 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-300">No Loyalty Options Enabled</h3>
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                        Go to Settings → Loyalty Program to enable cards, points, or visit rewards.
                    </p>
                </div>
            )}

            {/* Stats Cards */}
            {!noOptionsEnabled && (
                <div className={`grid grid-cols-1 gap-4 ${programMode === 'card' ? 'md:grid-cols-2' : 'md:grid-cols-4'}`}>
                    {settings.option_card_enabled && (
                        <>
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className="card p-4 surface-panel">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                        <CreditCard className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Available Cards</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{inventory.available}</p>
                                    </div>
                                </div>
                            </motion.div>
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                                className="card p-4 surface-panel">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                        <Package className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Cards Sold</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{inventory.sold}</p>
                                    </div>
                                </div>
                            </motion.div>
                        </>
                    )}
                    {settings.option_points_enabled && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                            className="card p-4 surface-panel">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                    <Star className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Points Rate</p>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white">Rs {settings.points_threshold_amount} = 1 pt</p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                    {settings.option_visits_enabled && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                            className="card p-4 surface-panel">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                    <Users className="h-5 w-5 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Visit Reward</p>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white">Every {settings.visit_reward_frequency}th • {settings.visit_reward_discount_percent}%</p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Card Management */}
                {settings.option_card_enabled && (
                    <div className="card p-6 surface-panel">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <CreditCard className="h-5 w-5" /> Card Inventory
                        </h2>

                        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <Input
                                    type="number"
                                    value={cardsToGenerate}
                                    onChange={(e) => setCardsToGenerate(parseInt(e.target.value) || 0)}
                                    min="1"
                                    max="100"
                                    className="w-24"
                                />
                                <Button
                                    variant="primary"
                                    onClick={handleGenerateCards}
                                    disabled={generatingCards}
                                    leftIcon={generatingCards ? <Loader className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                >
                                    {generatingCards ? 'Generating...' : 'Generate Cards'}
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                Each card: {formatCurrency(settings.card_price)} • {settings.card_discount_percent}% discount • {settings.card_validity_days} days
                            </p>
                        </div>

                        {/* Available Cards List */}
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {inventory.cards.filter(c => c.status === 'available').length === 0 ? (
                                <p className="text-center text-gray-500 py-4">No available cards. Generate some above.</p>
                            ) : (
                                inventory.cards.filter(c => c.status === 'available').slice(0, 10).map(card => (
                                    <div key={card.id} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                        <span className="font-mono text-sm text-gray-900 dark:text-white">{card.card_number}</span>
                                        <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded">Available</span>
                                    </div>
                                ))
                            )}
                            {inventory.cards.filter(c => c.status === 'available').length > 10 && (
                                <p className="text-xs text-gray-500 text-center">+{inventory.cards.filter(c => c.status === 'available').length - 10} more</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Customer Lookup */}
                <div className="card p-6 surface-panel">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Users className="h-5 w-5" /> Customer Loyalty Lookup
                    </h2>

                    <div className="relative mb-4">
                        <Input
                            placeholder="Search customer by name or phone..."
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            onKeyUp={(e) => e.key === 'Enter' && handleSearchCustomer()}
                            leftIcon={<Search className="h-4 w-4" />}
                        />
                        {searchResults.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {searchResults.map(customer => (
                                    <button
                                        key={customer.id}
                                        onClick={() => handleSelectCustomer(customer)}
                                        className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
                                    >
                                        <p className="font-medium text-gray-900 dark:text-white">{customer.name}</p>
                                        <p className="text-sm text-gray-500">{customer.phone}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {selectedCustomer && customerLoyalty && (
                        <div className="space-y-3">
                            <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                                <p className="font-semibold text-gray-900 dark:text-white">{selectedCustomer.name}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedCustomer.phone}</p>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                                {settings?.option_card_enabled && (
                                    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <span>🎫</span>
                                            <span className="text-sm">Card Status</span>
                                        </div>
                                        <span className={`text-sm font-medium ${customerLoyalty.cardValid ? 'text-green-600' : 'text-gray-500'}`}>
                                            {customerLoyalty.cardValid ? `Valid • ${customerLoyalty.cardDiscount}% off` : 'No card'}
                                        </span>
                                    </div>
                                )}
                                {settings?.option_points_enabled && (
                                    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <span>⭐</span>
                                            <span className="text-sm">Points</span>
                                        </div>
                                        <span className="text-sm font-medium text-blue-600">
                                            {customerLoyalty.availablePoints} pts ({formatCurrency(customerLoyalty.pointsValue)})
                                        </span>
                                    </div>
                                )}
                                {settings?.option_visits_enabled && (
                                    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <span>🎯</span>
                                            <span className="text-sm">Visits</span>
                                        </div>
                                        <span className="text-sm font-medium text-purple-600">
                                            {customerLoyalty.totalVisits} visits • {customerLoyalty.eligibleForVisitReward ? '🎉 Reward eligible!' : `${customerLoyalty.nextRewardVisit} to next`}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
