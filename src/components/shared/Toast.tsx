'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { Toast, ToastType } from '@/context/ToastContext';

interface ToastContainerProps {
    toasts: Toast[];
    onClose: (id: string) => void;
}

const icons = {
    success: <CheckCircle className="h-5 w-5 text-success-500" />,
    error: <AlertCircle className="h-5 w-5 text-danger-500" />,
    info: <Info className="h-5 w-5 text-primary-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-warning-500" />,
};

const bgColors = {
    success: 'bg-white dark:bg-gray-800 border-success-200 dark:border-success-900',
    error: 'bg-white dark:bg-gray-800 border-danger-200 dark:border-danger-900',
    info: 'bg-white dark:bg-gray-800 border-primary-200 dark:border-primary-900',
    warning: 'bg-white dark:bg-gray-800 border-warning-200 dark:border-warning-900',
};

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
    return (
        <div className="fixed left-4 right-4 bottom-4 sm:left-auto sm:right-4 z-50 flex flex-col gap-2 pointer-events-none">
            <AnimatePresence>
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.9 }}
                        layout
                        className={`pointer-events-auto w-full sm:w-auto sm:min-w-[300px] max-w-md p-4 rounded-xl shadow-lg border ${bgColors[toast.type]} flex items-start gap-3`}
                    >
                        <div className="flex-shrink-0 mt-0.5">
                            {icons[toast.type]}
                        </div>
                        <div className="flex-1 pt-0.5">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {toast.message}
                            </p>
                        </div>
                        <button
                            onClick={() => onClose(toast.id)}
                            className="flex-shrink-0 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
