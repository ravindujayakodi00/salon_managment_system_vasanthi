'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Users, Scissors, Sparkles, Palette, Crown, UserPlus, UserX,
    RefreshCw, ChevronRight, TrendingUp, DollarSign
} from 'lucide-react';
import Button from '@/components/shared/Button';
import { useAuth } from '@/lib/auth';
import { segmentationService } from '@/services/segmentation';
import Link from 'next/link';

const iconMap: Record<string, any> = {
    'users': Users,
    'scissors': Scissors,
    'sparkles': Sparkles,
    'palette': Palette,
    'crown': Crown,
    'user-plus': UserPlus,
    'user-x': UserX,
};

export default function SegmentsPage() {
    const { hasRole } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [segments, setSegments] = useState<any[]>([]);
    const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
    const [customers, setCustomers] = useState<any[]>([]);

    useEffect(() => {
        fetchSegments();
    }, []);

    useEffect(() => {
        if (selectedSegment) {
            fetchCustomers(selectedSegment);
        }
    }, [selectedSegment]);

    const fetchSegments = async () => {
        try {
            setLoading(true);
            const data = await segmentationService.getSegmentStats();
            setSegments(data || []);
        } catch (error) {
            console.error('Error fetching segments:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomers = async (segmentName: string) => {
        try {
            const data = await segmentationService.getCustomersBySegment(segmentName);
            setCustomers(data || []);
        } catch (error) {
            console.error('Error fetching customers:', error);
        }
    };

    const handleRefreshSegments = async () => {
        try {
            setRefreshing(true);
            await segmentationService.categorizeAllCustomers();
            await fetchSegments();
            if (selectedSegment) {
                await fetchCustomers(selectedSegment);
            }
        } catch (error) {
            console.error('Error refreshing segments:', error);
        } finally {
            setRefreshing(false);
        }
    };

    if (!hasRole(['Owner', 'Manager'])) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Access Restricted
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        Only owners and managers can view customer segments
                    </p>
                </div>
            </div>
        );
    }

    const totalCustomers = segments.reduce((sum, s) => sum + s.customer_count, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Customer Segments</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Smart categorization based on service preferences and behavior
                    </p>
                </div>
                <Button
                    variant="outline"
                    leftIcon={refreshing ? <RefreshCw className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                    onClick={handleRefreshSegments}
                    disabled={refreshing}
                >
                    {refreshing ? 'Categorizing...' : 'Refresh Segments'}
                </Button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-6 bg-gradient-to-br from-primary-500 to-primary-600 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-primary-100 text-sm">Total Customers</p>
                            <h3 className="text-3xl font-bold mt-1">{totalCustomers}</h3>
                        </div>
                        <Users className="h-10 w-10 text-primary-200" />
                    </div>
                </div>

                <div className="card p-6 surface-panel">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Active Segments</p>
                            <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                                {segments.filter(s => s.customer_count > 0).length}
                            </h3>
                        </div>
                        <TrendingUp className="h-10 w-10 text-success-500" />
                    </div>
                </div>

                <div className="card p-6 surface-panel">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Avg Segment Size</p>
                            <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                                {Math.round(totalCustomers / (segments.length || 1))}
                            </h3>
                        </div>
                        <DollarSign className="h-10 w-10 text-warning-500" />
                    </div>
                </div>
            </div>

            {/* Segments Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Segment Cards */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Customer Categories</h2>

                    {loading ? (
                        <div className="text-center py-12 text-gray-500">Loading segments...</div>
                    ) : segments.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">No segments found</div>
                    ) : (
                        segments.map((segment) => {
                            const Icon = iconMap[segment.icon] || Users;
                            const isSelected = selectedSegment === segment.name;

                            return (
                                <motion.div
                                    key={segment.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onClick={() => setSelectedSegment(segment.name)}
                                    className={`card p-5 cursor-pointer transition-all ${isSelected
                                            ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-500 shadow-lg'
                                            : 'surface-panel hover:shadow-md'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div
                                                className="p-3 rounded-xl"
                                                style={{ backgroundColor: `${segment.color}20` }}
                                            >
                                                <Icon className="h-6 w-6" style={{ color: segment.color }} />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                                    {segment.name}
                                                </h3>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                                                    {segment.description}
                                                </p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                                        {segment.customer_count} customers
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight className={`h-5 w-5 transition-transform ${isSelected ? 'rotate-90 text-primary-600' : 'text-gray-400'
                                            }`} />
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>

                {/* Customer List */}
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        {selectedSegment ? `${selectedSegment} Customers` : 'Select a segment'}
                    </h2>

                    {selectedSegment ? (
                        <div className="card p-6 surface-panel">
                            {customers.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    No customers in this segment yet
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {customers.map((customer) => (
                                        <Link
                                            key={customer.id}
                                            href={`/customers/${customer.id}`}
                                            className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                        >
                                            <div>
                                                <h4 className="font-medium text-gray-900 dark:text-white">
                                                    {customer.name}
                                                </h4>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    {customer.email || customer.phone}
                                                </p>
                                                <div className="flex gap-2 mt-1">
                                                    <span className="text-xs text-gray-500">
                                                        {customer.total_visits || 0} visits
                                                    </span>
                                                    <span className="text-xs text-gray-500">•</span>
                                                    <span className="text-xs text-gray-500">
                                                        LKR {customer.total_spent || 0}
                                                    </span>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-gray-400" />
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="card p-12 surface-panel text-center">
                            <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-500 dark:text-gray-400">
                                Select a segment to view customers
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Help Text */}
            <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>💡 Tip:</strong> Segments are automatically updated based on customer behavior.
                    Click "Refresh Segments" to re-categorize all customers based on their latest activity.
                </p>
            </div>
        </div>
    );
}
