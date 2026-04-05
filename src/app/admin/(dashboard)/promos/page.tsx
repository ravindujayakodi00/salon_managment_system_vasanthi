'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Edit, Copy, Trash2, RefreshCw } from 'lucide-react';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import PromoCodeModal from '@/components/promos/PromoCodeModal';
import { promosService, PromoCode } from '@/services/promos';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useToast } from '@/context/ToastContext';

export default function PromosPage() {
    const { showToast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [promoToEdit, setPromoToEdit] = useState<PromoCode | null>(null);

    // Fetch promo codes on mount
    useEffect(() => {
        fetchPromoCodes();
    }, []);

    const fetchPromoCodes = async () => {
        setLoading(true);
        try {
            const data = await promosService.getPromoCodes();
            setPromoCodes(data);
        } catch (error: any) {
            console.error('Error fetching promo codes:', error);
            showToast('Failed to load promo codes', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        showToast(`Code "${code}" copied to clipboard`, 'success');
    };

    const handleToggleStatus = async (promo: PromoCode) => {
        try {
            await promosService.togglePromoCodeStatus(promo.id, !promo.is_active);
            showToast(`Promo code ${promo.is_active ? 'deactivated' : 'activated'}`, 'success');
            fetchPromoCodes();
        } catch (error: any) {
            console.error('Error toggling promo status:', error);
            showToast('Failed to update promo code', 'error');
        }
    };

    const handleDelete = async (promo: PromoCode) => {
        if (!confirm(`Are you sure you want to delete promo code "${promo.code}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await promosService.deletePromoCode(promo.id);
            showToast('Promo code deleted successfully', 'success');
            fetchPromoCodes();
        } catch (error: any) {
            console.error('Error deleting promo code:', error);
            showToast('Failed to delete promo code', 'error');
        }
    };

    const handleEdit = (promo: PromoCode) => {
        setPromoToEdit(promo);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setPromoToEdit(null);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setPromoToEdit(null);
    };

    const handleModalSuccess = () => {
        fetchPromoCodes();
    };

    // Filter promo codes
    const filteredPromos = promoCodes.filter((promo) => {
        if (statusFilter === 'Active' && !promo.is_active) return false;
        if (statusFilter === 'Inactive' && promo.is_active) return false;
        if (searchQuery && !promo.code.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    // Check if promo is expired
    const isExpired = (endDate: string) => {
        return new Date(endDate) < new Date();
    };

    // Check if promo usage limit is reached
    const isLimitReached = (promo: PromoCode) => {
        return promo.usage_limit !== null && promo.used_count >= promo.usage_limit;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Promo Codes</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Create and manage promotional offers</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchPromoCodes} leftIcon={<RefreshCw className="h-4 w-4" />}>
                        Refresh
                    </Button>
                    <Button variant="primary" onClick={handleCreate} leftIcon={<Plus className="h-5 w-5" />}>
                        Create Promo Code
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="card p-4 surface-panel">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <Input
                            type="text"
                            placeholder="Search promo codes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            leftIcon={<Search className="h-5 w-5" />}
                        />
                    </div>
                    <div className="flex gap-2">
                        {['All', 'Active', 'Inactive'].map((status) => (
                            <Button
                                key={status}
                                variant={statusFilter === status ? 'primary' : 'outline'}
                                size="md"
                                onClick={() => setStatusFilter(status)}
                            >
                                {status}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Loading State */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    <span className="ml-3 text-gray-600 dark:text-gray-400">Loading promo codes...</span>
                </div>
            ) : filteredPromos.length === 0 ? (
                <div className="card p-12 surface-panel text-center">
                    <div className="text-gray-400 dark:text-gray-500 mb-4">
                        <Search className="h-12 w-12 mx-auto" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        {searchQuery || statusFilter !== 'All' ? 'No matching promo codes' : 'No promo codes yet'}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                        {searchQuery || statusFilter !== 'All'
                            ? 'Try adjusting your search or filter'
                            : 'Create your first promo code to get started'}
                    </p>
                    {!searchQuery && statusFilter === 'All' && (
                        <Button variant="primary" onClick={handleCreate} leftIcon={<Plus className="h-4 w-4" />}>
                            Create Promo Code
                        </Button>
                    )}
                </div>
            ) : (
                /* Promo Codes Grid */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredPromos.map((promo, index) => (
                        <motion.div
                            key={promo.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`card p-6 surface-panel ${isExpired(promo.end_date) || isLimitReached(promo) ? 'opacity-60' : ''
                                }`}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 rounded-xl font-mono font-bold text-primary-700 dark:text-primary-400">
                                            {promo.code}
                                        </div>
                                        <button
                                            onClick={() => handleCopyCode(promo.code)}
                                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                            title="Copy code"
                                        >
                                            <Copy className="h-4 w-4 text-gray-500" />
                                        </button>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{promo.description || 'No description'}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div className={`px-2 py-1 rounded-lg text-xs font-medium ${promo.is_active
                                        ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                        }`}>
                                        {promo.is_active ? 'Active' : 'Inactive'}
                                    </div>
                                    {isExpired(promo.end_date) && (
                                        <span className="text-xs text-danger-600 dark:text-danger-400">Expired</span>
                                    )}
                                    {isLimitReached(promo) && (
                                        <span className="text-xs text-warning-600 dark:text-warning-400">Limit reached</span>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3 mb-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Discount</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {promo.type === 'percentage' ? `${promo.value}%` : formatCurrency(promo.value)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Min. Spend</span>
                                    <span className="text-sm text-gray-900 dark:text-white">{formatCurrency(promo.min_spend)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Usage</span>
                                    <span className="text-sm text-gray-900 dark:text-white">
                                        {promo.used_count} / {promo.usage_limit ?? '∞'}
                                    </span>
                                </div>
                                {promo.usage_limit && (
                                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${isLimitReached(promo) ? 'bg-danger-500' : 'bg-primary-500'
                                                }`}
                                            style={{ width: `${Math.min((promo.used_count / promo.usage_limit) * 100, 100)}%` }}
                                        />
                                    </div>
                                )}
                                <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                                    <span className="text-xs text-gray-500">
                                        {formatDate(promo.start_date)} - {formatDate(promo.end_date)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    leftIcon={<Edit className="h-4 w-4" />}
                                    onClick={() => handleEdit(promo)}
                                >
                                    Edit
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleStatus(promo)}
                                >
                                    {promo.is_active ? 'Deactivate' : 'Activate'}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(promo)}
                                    className="text-danger-600 hover:text-danger-700 hover:bg-danger-50 dark:hover:bg-danger-900/20"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Promo Code Modal */}
            <PromoCodeModal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                onSuccess={handleModalSuccess}
                promoToEdit={promoToEdit}
            />
        </div>
    );
}
