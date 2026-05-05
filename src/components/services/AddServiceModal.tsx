'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/shared/Modal';
import Input from '@/components/shared/Input';
import Button from '@/components/shared/Button';
import { ServiceCategory } from '@/lib/types';
import { servicesService } from '@/services/services';
import { useToast } from '@/context/ToastContext';

interface AddServiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    serviceToEdit?: any;
}

interface ServiceFormData {
    name: string;
    category: ServiceCategory;
    price: string;
    duration: string;
    gender: 'Male' | 'Female' | 'Unisex';
    description: string;
    is_active: boolean;
}

export default function AddServiceModal({ isOpen, onClose, onSuccess, serviceToEdit }: AddServiceModalProps) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<ServiceFormData>({
        name: '',
        category: 'Hair',
        price: '',
        duration: '30',
        gender: 'Female' as 'Male' | 'Female' | 'Unisex',
        description: '',
        is_active: true
    });

    useEffect(() => {
        if (serviceToEdit) {
            setFormData({
                name: serviceToEdit.name,
                category: serviceToEdit.category,
                price: serviceToEdit.price.toString(),
                duration: serviceToEdit.duration.toString(),
                gender: 'Female' as 'Male' | 'Female' | 'Unisex',
                description: serviceToEdit.description || '',
                is_active: serviceToEdit.isActive !== undefined ? serviceToEdit.isActive : true
            });
        } else {
            setFormData({
                name: '',
                category: 'Hair',
                price: '',
                duration: '30',
                gender: 'Unisex',
                description: '',
                is_active: true
            });
        }
    }, [serviceToEdit, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const serviceData = {
                ...formData,
                price: parseFloat(formData.price),
                duration: parseInt(formData.duration),
            };

            if (serviceToEdit) {
                await servicesService.updateService(serviceToEdit.id, serviceData);
                showToast('Service updated successfully', 'success');
            } else {
                await servicesService.createService(serviceData);
                showToast('Service created successfully', 'success');
            }
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error saving service:', error);
            showToast(error.message || 'Failed to save service', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={serviceToEdit ? 'Edit Service' : 'Add New Service'}
            size="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Service Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        placeholder="e.g. Haircut"
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Category
                        </label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value as ServiceCategory })}
                            className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            <option value="Sugaring">Sugaring</option>
                            <option value="Hair">Hair</option>
                            <option value="Nails">Nails</option>
                            <option value="Facials">Facials</option>
                            <option value="Spa">Spa</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Price (Rs)"
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                        min="0"
                    />
                    <Input
                        label="Duration (min)"
                        type="number"
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        required
                        min="5"
                        step="5"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description
                    </label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[100px]"
                        placeholder="Service details..."
                    />
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" isLoading={loading}>
                        {serviceToEdit ? 'Update Service' : 'Create Service'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
