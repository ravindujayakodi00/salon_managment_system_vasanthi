'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';

interface QuickCustomerFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (customerData: {
        name: string;
        phone: string;
        email?: string;
        gender?: string;
    }) => void;
    initialPhone?: string;
}

// Phone validation helper
const validatePhone = (phone: string): { isValid: boolean; message: string; country?: string } => {
    const cleaned = phone.replace(/\D/g, '');

    // Sri Lanka numbers start with 94 or 0 and have 10-12 digits total
    if (cleaned.startsWith('94')) {
        if (cleaned.length === 11) {
            return { isValid: true, message: 'Valid Sri Lankan number', country: 'LK 🇱🇰' };
        }
        return { isValid: false, message: 'Sri Lankan numbers should be 11 digits (94XXXXXXXXXX)' };
    } else if (cleaned.startsWith('0')) {
        if (cleaned.length === 10) {
            return { isValid: true, message: 'Valid Sri Lankan number', country: 'LK 🇱🇰' };
        }
        return { isValid: false, message: 'Sri Lankan numbers should be 10 digits (07XXXXXXXX)' };
    } else if (cleaned.length >= 9) {
        // Assume local number
        if (cleaned.length === 9) {
            return { isValid: true, message: 'Valid local number', country: 'LK 🇱🇰' };
        }
        return { isValid: false, message: 'Please enter a valid phone number' };
    }

    return { isValid: false, message: 'Phone number too short' };
};

export default function QuickCustomerForm({
    isOpen,
    onClose,
    onSubmit,
    initialPhone = ''
}: QuickCustomerFormProps) {
    const [formData, setFormData] = useState({
        name: '',
        phone: initialPhone,
        email: '',
        gender: ''
    });

    // Update phone when initialPhone changes
    useEffect(() => {
        if (initialPhone) {
            setFormData(prev => ({ ...prev, phone: initialPhone }));
        }
    }, [initialPhone]);

    const phoneValidation = validatePhone(formData.phone);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim() || !phoneValidation.isValid) {
            return;
        }

        onSubmit({
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            email: formData.email.trim() || undefined,
            gender: 'Female'
        });

        // Reset form
        setFormData({ name: '', phone: '', email: '', gender: 'Female' });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Create Walk-in Customer
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Name - Required */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Customer Name <span className="text-danger-500">*</span>
                        </label>
                        <Input
                            type="text"
                            placeholder="Enter customer name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            autoFocus
                        />
                    </div>

                    {/* Phone - Required */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Phone Number <span className="text-danger-500">*</span>
                        </label>
                        <div className="relative">
                            <Input
                                type="tel"
                                placeholder="07XXXXXXXX or 94XXXXXXXXXX"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                required
                                className={
                                    formData.phone.length > 0
                                        ? phoneValidation.isValid
                                            ? 'border-success-500 focus:ring-success-500'
                                            : 'border-danger-500 focus:ring-danger-500'
                                        : ''
                                }
                            />
                            {formData.phone.length > 0 && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {phoneValidation.country && (
                                        <span className="text-xs font-medium text-gray-500">
                                            {phoneValidation.country}
                                        </span>
                                    )}
                                    {phoneValidation.isValid ? (
                                        <CheckCircle className="h-5 w-5 text-success-500" />
                                    ) : (
                                        <AlertCircle className="h-5 w-5 text-danger-500" />
                                    )}
                                </div>
                            )}
                        </div>
                        {formData.phone.length > 0 && (
                            <p className={`text-xs mt-1 ${phoneValidation.isValid ? 'text-success-600' : 'text-danger-600'}`}>
                                {phoneValidation.message}
                            </p>
                        )}
                    </div>

                    {/* Email - Optional */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Email <span className="text-gray-400 text-xs">(Optional)</span>
                        </label>
                        <Input
                            type="email"
                            placeholder="customer@example.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>


                    {/* Buttons */}
                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="flex-1"
                            disabled={!formData.name.trim() || !phoneValidation.isValid}
                        >
                            Create Customer
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
