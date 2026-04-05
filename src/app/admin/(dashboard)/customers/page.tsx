'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Eye, Phone, Mail, Edit, Trash2 } from 'lucide-react';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import AddCustomerModal from '@/components/customers/AddCustomerModal';
import CustomerDetailsModal from '@/components/customers/CustomerDetailsModal';
import { Customer } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { customersService } from '@/services/customers';
import { useToast } from '@/context/ToastContext';

export default function CustomersPage() {
    const { showToast } = useToast();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        fetchCustomers();
    }, [searchQuery]);

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            let result;
            if (searchQuery) {
                const data = await customersService.searchCustomers(searchQuery);
                result = data;
            } else {
                const response = await customersService.getCustomers();
                result = response.data;
            }

            // Map Supabase snake_case to camelCase
            const mappedCustomers = (result || []).map((c: any) => ({
                id: c.id,
                name: c.name,
                phone: c.phone,
                email: c.email,
                gender: c.gender,
                totalVisits: c.total_visits || 0,
                totalSpent: c.total_spent || 0,
                lastVisit: c.last_visit,
                createdAt: c.created_at,
                preferences: c.preferences
            }));

            setCustomers(mappedCustomers);
        } catch (error) {
            console.error('Error fetching customers:', error);
            showToast('Failed to load customers', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        setSelectedCustomer(null);
        setShowAddModal(true);
    };

    const handleEdit = (customer: Customer) => {
        setSelectedCustomer(customer);
        setShowAddModal(true);
    };

    const handleView = (customer: Customer) => {
        setSelectedCustomer(customer);
        setShowDetailsModal(true);
    };

    const handleDeleteClick = (customer: Customer) => {
        setSelectedCustomer(customer);
        setShowDeleteDialog(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedCustomer) return;

        setDeleteLoading(true);
        try {
            await customersService.deleteCustomer(selectedCustomer.id);
            showToast('Customer deleted successfully', 'success');
            setShowDeleteDialog(false);
            setSelectedCustomer(null);
            fetchCustomers();
        } catch (error: any) {
            console.error('Error deleting customer:', error);
            showToast(error.message || 'Failed to delete customer', 'error');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleModalSuccess = () => {
        fetchCustomers();
        setShowAddModal(false);
        setSelectedCustomer(null);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Customers</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Manage customer database</p>
                </div>
                <Button
                    variant="primary"
                    leftIcon={<Plus className="h-5 w-5" />}
                    onClick={handleAdd}
                >
                    Add Customer
                </Button>
            </div>

            {/* Search */}
            <div className="card p-4 surface-panel">
                <Input
                    type="text"
                    placeholder="Search by name, phone, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leftIcon={<Search className="h-5 w-5" />}
                />
            </div>

            {/* Customer Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                <div className="card p-6 surface-panel">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Customers</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{customers.length}</p>
                </div>
                <div className="card p-6 surface-panel">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">This Month</p>
                    <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                        +{customers.filter(c => new Date(c.createdAt).getMonth() === new Date().getMonth()).length}
                    </p>
                </div>
                <div className="card p-6 surface-panel">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active This Week</p>
                    <p className="text-3xl font-bold text-success-600 dark:text-success-400">
                        {customers.filter(c => {
                            if (!c.lastVisit) return false;
                            const lastVisit = new Date(c.lastVisit);
                            const oneWeekAgo = new Date();
                            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                            return lastVisit > oneWeekAgo;
                        }).length}
                    </p>
                </div>
            </div>

            {/* Customers List */}
            <div className="space-y-4">
                {customers.map((customer, index) => (
                    <motion.div
                        key={customer.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="card p-6 surface-panel"
                    >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="flex items-start gap-4 flex-1">
                                <div className="flex-shrink-0 w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center">
                                    <span className="text-xl font-bold text-primary-600">
                                        {customer.name.split(' ').map(n => n[0]).join('')}
                                    </span>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{customer.name}</h3>
                                        {customer.gender && (
                                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-lg">
                                                {customer.gender}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400 mb-2">
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
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-3">
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-500">Total Visits</p>
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{customer.totalVisits}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-500">Total Spent</p>
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                {formatCurrency(customer.totalSpent)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-500">Last Visit</p>
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                {customer.lastVisit ? formatDate(customer.lastVisit) : 'Never'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    leftIcon={<Eye className="h-4 w-4" />}
                                    onClick={() => handleView(customer)}
                                >
                                    View
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    leftIcon={<Edit className="h-4 w-4" />}
                                    onClick={() => handleEdit(customer)}
                                >
                                    Edit
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    leftIcon={<Trash2 className="h-4 w-4 text-danger-600" />}
                                    onClick={() => handleDeleteClick(customer)}
                                >
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Add/Edit Modal */}
            <AddCustomerModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSuccess={handleModalSuccess}
                customerToEdit={selectedCustomer}
            />

            {/* View Details Modal */}
            <CustomerDetailsModal
                isOpen={showDetailsModal}
                onClose={() => setShowDetailsModal(false)}
                customer={selectedCustomer}
            />

            {/* Delete Confirmation */}
            <ConfirmationDialog
                isOpen={showDeleteDialog}
                onClose={() => setShowDeleteDialog(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Customer?"
                message={`Are you sure you want to delete "${selectedCustomer?.name}"? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
                loading={deleteLoading}
            />
        </div>
    );
}
