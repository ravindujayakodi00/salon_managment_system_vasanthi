'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import AddServiceModal from '@/components/services/AddServiceModal';
import { Service } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { servicesService } from '@/services/services';
import { useToast } from '@/context/ToastContext';

export default function ServicesPage() {
    const { showToast } = useToast();
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const categories = ['All', 'Hair', 'Beard', 'Facial', 'Bridal', 'Kids', 'Spa', 'Other'];

    useEffect(() => {
        fetchServices();
    }, [selectedCategory, searchQuery]);

    const fetchServices = async () => {
        try {
            setLoading(true);
            let data;
            if (selectedCategory !== 'All') {
                data = await servicesService.getServicesByCategory(selectedCategory);
            } else {
                data = await servicesService.getServices();
            }

            // Map Supabase snake_case to camelCase
            let mappedServices = (data || []).map((s: any) => ({
                id: s.id,
                name: s.name,
                category: s.category,
                price: s.price,
                duration: s.duration,
                gender: s.gender,
                isActive: s.is_active,
                description: s.description,
            }));

            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                mappedServices = mappedServices.filter((s: Service) =>
                    s.name.toLowerCase().includes(query)
                );
            }

            setServices(mappedServices);
        } catch (error) {
            console.error('Error fetching services:', error);
            showToast('Failed to load services', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        setSelectedService(null);
        setShowModal(true);
    };

    const handleEdit = (service: Service) => {
        setSelectedService(service);
        setShowModal(true);
    };

    const handleDeleteClick = (service: Service) => {
        setSelectedService(service);
        setShowDeleteDialog(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedService) return;

        setDeleteLoading(true);
        try {
            await servicesService.deleteService(selectedService.id);
            showToast('Service deleted successfully', 'success');
            setShowDeleteDialog(false);
            setSelectedService(null);
            fetchServices();
        } catch (error: any) {
            console.error('Error deleting service:', error);
            showToast(error.message || 'Failed to delete service', 'error');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleModalSuccess = () => {
        fetchServices();
        setShowModal(false);
        setSelectedService(null);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Services</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Manage salon services and pricing</p>
                </div>
                <Button
                    variant="primary"
                    leftIcon={<Plus className="h-5 w-5" />}
                    onClick={handleAdd}
                >
                    Add Service
                </Button>
            </div>

            {/* Filters */}
            <div className="card p-4 surface-panel">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <Input
                            type="text"
                            placeholder="Search services..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            leftIcon={<Search className="h-5 w-5" />}
                        />
                    </div>
                </div>

                {/* Category Filters */}
                <div className="mt-4">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        Filter by Category
                    </label>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                        {categories.map((category) => {
                            const count = category === 'All'
                                ? services.length
                                : services.filter(s => s.category === category).length;

                            return (
                                <button
                                    key={category}
                                    onClick={() => setSelectedCategory(category)}
                                    className={cn(
                                        'px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-2 border-2',
                                        selectedCategory === category
                                            ? 'bg-primary-600 dark:bg-primary-700 text-white border-primary-600 dark:border-primary-700 shadow-md'
                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    )}
                                >
                                    <span>{category}</span>
                                    {count > 0 && (
                                        <span className={cn(
                                            'px-2 py-0.5 rounded-full text-xs font-semibold',
                                            selectedCategory === category
                                                ? 'bg-white/20 text-white'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                        )}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Services Grid - Full width on tablet, 3 cols on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {services.map((service, index) => (
                    <motion.div
                        key={service.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="card p-6 card-hover surface-panel"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{service.name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-medium rounded-lg">
                                        {service.category}
                                    </span>
                                    {service.gender && (
                                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-lg">
                                            {service.gender}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className={cn(
                                'w-2 h-2 rounded-full',
                                service.isActive ? 'bg-success-500' : 'bg-gray-400'
                            )}></div>
                        </div>

                        <div className="space-y-2 mb-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Price</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(service.price)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Duration</span>
                                <span className="text-sm text-gray-900 dark:text-white">{service.duration} min</span>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                leftIcon={<Edit className="h-4 w-4" />}
                                onClick={() => handleEdit(service)}
                            >
                                Edit
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                leftIcon={<Trash2 className="h-4 w-4 text-danger-600" />}
                                onClick={() => handleDeleteClick(service)}
                            >
                            </Button>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Add/Edit Modal */}
            <AddServiceModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={handleModalSuccess}
                serviceToEdit={selectedService}
            />

            {/* Delete Confirmation */}
            <ConfirmationDialog
                isOpen={showDeleteDialog}
                onClose={() => setShowDeleteDialog(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Service?"
                message={`Are you sure you want to delete "${selectedService?.name}"? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
                loading={deleteLoading}
            />
        </div>
    );
}
