'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    className?: string;
}

export default function StatCard({
    title,
    value,
    icon: Icon,
    trend,
    className,
}: StatCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className={cn(
                'card card-hover surface-panel p-6',
                className
            )}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{title}</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
                    {trend && (
                        <div className="mt-2 flex items-center gap-1">
                            <span
                                className={cn(
                                    'text-sm font-medium',
                                    trend.isPositive ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'
                                )}
                            >
                                {trend.isPositive ? '+' : ''}{trend.value}%
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-500">vs last period</span>
                        </div>
                    )}
                </div>
                <div className="flex-shrink-0">
                    <div className="p-3 bg-gradient-to-br from-primary-100 to-secondary-50/80 dark:from-primary-900/45 dark:to-secondary-950/25 rounded-xl ring-1 ring-primary-200/60 dark:ring-primary-700/45 shadow-[var(--brand-shadow-xs)]">
                        <Icon className="h-6 w-6 text-primary-600 dark:text-primary-300" />
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
