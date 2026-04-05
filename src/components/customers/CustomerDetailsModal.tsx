'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Calendar, DollarSign, Clock, Phone, Mail, User } from 'lucide-react';
import Modal from '@/components/shared/Modal';
import { Customer } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface CustomerDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: any;
}

export default function CustomerDetailsModal({ isOpen, onClose, customer }: CustomerDetailsModalProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');

    if (!customer) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Customer Details">
            <div className="space-y-6">
                {/* Header Profile */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl">
                    <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-2xl font-bold text-primary-600 dark:text-primary-400">
                        {customer.name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{customer.name}</h3>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                            <span className="flex items-center gap-1">
                                <Phone className="h-4 w-4" />
                                {customer.phone}
                            </span>
                            {customer.email && (
                                <span className="flex items-center gap-1">
                                    <Mail className="h-4 w-4" />
                                    {customer.email}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={cn(
                            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                            activeTab === 'overview'
                                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        )}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={cn(
                            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                            activeTab === 'history'
                                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        )}
                    >
                        History
                    </button>
                </div>

                {/* Content */}
                <div className="min-h-[200px]">
                    {activeTab === 'overview' ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 surface-panel rounded-xl">
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
                                        <Calendar className="h-4 w-4" />
                                        <span className="text-sm">Total Visits</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{customer.totalVisits}</p>
                                </div>
                                <div className="p-4 surface-panel rounded-xl">
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
                                        <DollarSign className="h-4 w-4" />
                                        <span className="text-sm">Total Spent</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(customer.totalSpent)}</p>
                                </div>
                            </div>

                            <div className="p-4 surface-panel rounded-xl">
                                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Additional Info</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Gender</span>
                                        <span className="font-medium text-gray-900 dark:text-white">{customer.gender || 'Not specified'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Member Since</span>
                                        <span className="font-medium text-gray-900 dark:text-white">{formatDate(customer.createdAt)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Last Visit</span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {customer.lastVisit ? formatDate(customer.lastVisit) : 'Never'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {customer.preferences && (
                                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Notes & Preferences</h4>
                                    <p className="text-sm text-yellow-700 dark:text-yellow-300">{customer.preferences}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>Appointment history coming soon...</p>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
