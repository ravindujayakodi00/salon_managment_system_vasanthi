'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Button from '@/components/shared/Button';
import PhoneInput from '@/components/shared/PhoneInput';
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

// Extract 9-digit local part from any phone format
function extractLocalDigits(phone: string): string {
    if (!phone) return '';
    if (phone.startsWith('+94')) return phone.substring(3);
    if (phone.startsWith('0')) return phone.substring(1);
    return phone;
}

export default function QuickCustomerForm({
    isOpen,
    onClose,
    onSubmit,
    initialPhone = ''
}: QuickCustomerFormProps) {
    const [formData, setFormData] = useState({
        name: '',
        phone: initialPhone ? `+94${extractLocalDigits(initialPhone)}` : '',
        email: '',
    });

    // Update phone when initialPhone changes
    useEffect(() => {
        if (initialPhone) {
            setFormData(prev => ({ ...prev, phone: `+94${extractLocalDigits(initialPhone)}` }));
        }
    }, [initialPhone]);

    const isPhoneValid = formData.phone.startsWith('+94') && formData.phone.length === 12; // +94 + 9 digits

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim() || !isPhoneValid) {
            return;
        }

        onSubmit({
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            email: formData.email.trim() || undefined,
            gender: 'Female'
        });

        // Reset form
        setFormData({ name: '', phone: '', email: '' });
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
                    <PhoneInput
                        label="Phone Number"
                        value={formData.phone}
                        onChange={(value) => setFormData({ ...formData, phone: value })}
                        required
                    />

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
                            disabled={!formData.name.trim() || !isPhoneValid}
                        >
                            Create Customer
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
