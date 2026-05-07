'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface PhoneInputProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    error?: string;
    className?: string;
}

// Parse a stored phone value back to the 9-digit local part
function extractLocalDigits(value: string): string {
    if (!value) return '';
    // Strip +94 prefix
    if (value.startsWith('+94')) {
        return value.substring(3);
    }
    // Strip leading 0 (old format)
    if (value.startsWith('0')) {
        return value.substring(1);
    }
    return value;
}

export default function PhoneInput({
    value,
    onChange,
    label,
    placeholder = '701234567',
    required = false,
    disabled = false,
    error,
    className,
}: PhoneInputProps) {
    const [localDigits, setLocalDigits] = useState(() => extractLocalDigits(value));

    // Sync when value changes externally (e.g. edit modal pre-fill)
    useEffect(() => {
        setLocalDigits(extractLocalDigits(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Keep only digits, strip leading zero
        let digits = e.target.value.replace(/\D/g, '');
        if (digits.startsWith('0')) {
            digits = digits.substring(1);
        }
        // Limit to 9 digits
        digits = digits.slice(0, 9);
        setLocalDigits(digits);
        onChange(digits ? `+94${digits}` : '');
    };

    return (
        <div className={cn('w-full', className)}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {label}
                    {required && <span className="text-danger-500 ml-1">*</span>}
                </label>
            )}
            <div className="flex">
                {/* Fixed +94 prefix */}
                <div
                    className={cn(
                        'flex items-center px-3 py-2.5 bg-gray-100 dark:bg-gray-700 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-xl text-sm font-medium select-none',
                        error && 'border-danger-500',
                        disabled && 'opacity-50'
                    )}
                >
                    <span className="text-lg mr-1">🇱🇰</span>
                    <span className="text-gray-700 dark:text-gray-300">+94</span>
                </div>

                {/* 9-digit number input */}
                <input
                    type="tel"
                    value={localDigits}
                    onChange={handleChange}
                    placeholder={placeholder}
                    disabled={disabled}
                    maxLength={9}
                    inputMode="numeric"
                    className={cn(
                        'flex-1 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-r-xl',
                        'focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors',
                        'text-gray-900 dark:text-white placeholder-gray-400',
                        disabled && 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-700',
                        error && 'border-danger-500 focus:ring-danger-500 focus:border-danger-500'
                    )}
                />
            </div>
            {error && (
                <p className="mt-1 text-sm text-danger-500">{error}</p>
            )}
        </div>
    );
}

// Helper to format phone for display (e.g., +94 77 123 4567)
export function formatPhoneDisplay(phone: string): string {
    if (!phone) return '';
    if (phone.startsWith('+94')) {
        const number = phone.substring(3);
        if (number.length >= 9) {
            return `+94 ${number.slice(0, 2)} ${number.slice(2, 5)} ${number.slice(5)}`;
        }
        return `+94 ${number}`;
    }
    return phone;
}
