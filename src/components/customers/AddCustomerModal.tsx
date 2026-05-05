'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/shared/Modal';
import Input from '@/components/shared/Input';
import PhoneInput from '@/components/shared/PhoneInput';
import Button from '@/components/shared/Button';
import { customersService } from '@/services/customers';
import { useToast } from '@/context/ToastContext';

interface AddCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    customerToEdit?: any;
}

export default function AddCustomerModal({ isOpen, onClose, onSuccess, customerToEdit }: AddCustomerModalProps) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        gender: 'Female' as 'Male' | 'Female' | 'Other',
        preferences: ''
    });

    useEffect(() => {
        if (customerToEdit) {
            setFormData({
                name: customerToEdit.name,
                phone: customerToEdit.phone,
                email: customerToEdit.email || '',
                gender: customerToEdit.gender || 'Female',
                preferences: customerToEdit.preferences || ''
            });
        } else {
            setFormData({
                name: '',
                phone: '',
                email: '',
                gender: 'Female',
                preferences: ''
            });
        }
    }, [customerToEdit, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (customerToEdit) {
                await customersService.updateCustomer(customerToEdit.id, formData);
                showToast('Customer updated successfully', 'success');
            } else {
                await customersService.createCustomer(formData);
                showToast('Customer created successfully', 'success');
            }
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error saving customer:', error);
            showToast(error.message || 'Failed to save customer', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={customerToEdit ? 'Edit Customer' : 'Add New Customer'}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Full Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="e.g. Jane Doe"
                />

                <PhoneInput
                    label="Phone Number"
                    value={formData.phone}
                    onChange={(value) => setFormData({ ...formData, phone: value })}
                    required
                />

                <Input
                    label="Email (Optional)"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. jane@example.com"
                />

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Preferences / Notes
                    </label>
                    <textarea
                        value={formData.preferences}
                        onChange={(e) => setFormData({ ...formData, preferences: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[100px]"
                        placeholder="Any specific preferences..."
                    />
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" isLoading={loading}>
                        {customerToEdit ? 'Update Customer' : 'Create Customer'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
