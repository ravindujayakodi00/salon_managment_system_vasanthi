'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit, Trash2, X, Check, Loader, Copy, AlertCircle, Sparkles, DollarSign } from 'lucide-react';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import PhoneInput from '@/components/shared/PhoneInput';
import { Staff, Branch, Service } from '@/lib/types';
import { staffService } from '@/services/staff';
import { branchesService } from '@/services/branches';
import { servicesService } from '@/services/services';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';

export default function StaffPage() {
    const { hasRole, user } = useAuth();
    const { effectiveBranchId } = useWorkspace();
    const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showCredentialsModal, setShowCredentialsModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
    const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

    // Form states
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        role: 'Stylist' as 'Manager' | 'Receptionist' | 'Stylist',
        branch_id: '',
        specializations: [] as string[],
        working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as string[],
        working_hours: { start: '09:00', end: '18:00' },
        salary: '' as string,
        commission: '' as string,
    });
    const [formLoading, setFormLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const roles = ['All', 'Manager', 'Receptionist', 'Stylist'];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.organizationId, effectiveBranchId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [staffData, branchesData, servicesData] = await Promise.all([
                staffService.getStaff(effectiveBranchId),
                branchesService.getBranches(user?.organizationId),
                servicesService.getServices()
            ]);

            setBranches(branchesData || []);
            setServices(servicesData || []);

            // Auto-select a good default branch for the form
            // - Owner: effectiveBranchId is the header-selected branch (or undefined for “All”)
            // - Manager/Stylists: effectiveBranchId is always their branch
            if (branchesData && branchesData.length > 0) {
                const fallback = effectiveBranchId || branchesData[0].id;
                setFormData(prev => ({ ...prev, branch_id: fallback }));
            }

            const mappedStaff = (staffData || []).map((s: any) => ({
                id: s.id,
                name: s.name,
                email: s.email,
                phone: s.phone || '',
                role: s.role,
                branchId: s.branch_id,
                specializations: s.specializations || [],
                workingDays: s.working_days || [],
                workingHours: s.working_hours || { start: '09:00', end: '18:00' },
                salary: s.salary,
                commission: s.commission,
                isActive: s.is_active,
                createdAt: s.created_at,
            }));
            setStaffMembers(mappedStaff);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchStaff = async () => {
        // Kept for compatibility with existing calls, but fetchData handles everything
        try {
            const data = await staffService.getStaff(effectiveBranchId);
            const mappedStaff = (data || []).map((s: any) => ({
                id: s.id,
                name: s.name,
                email: s.email,
                phone: s.phone || '',
                role: s.role,
                branchId: s.branch_id,
                specializations: s.specializations || [],
                workingDays: s.working_days || [],
                workingHours: s.working_hours || { start: '09:00', end: '18:00' },
                isActive: s.is_active,
                createdAt: s.created_at,
            }));
            setStaffMembers(mappedStaff);
        } catch (error) {
            console.error('Error fetching staff:', error);
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const handleAddStaff = async () => {
        setFormLoading(true);
        const result = await staffService.createStaff({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            role: formData.role,
            branch_id: formData.branch_id || (branches.length > 0 ? branches[0].id : ''),
            specializations: formData.specializations,
            working_days: formData.working_days,
            working_hours: formData.working_hours,
            salary: formData.salary ? parseFloat(formData.salary) : undefined,
            commission: formData.role === 'Stylist' && formData.commission ? parseFloat(formData.commission) : undefined,
        });

        setFormLoading(false);

        if (result.success) {
            setCredentials(result.credentials || null);
            setShowAddModal(false);
            setShowCredentialsModal(true);
            fetchStaff();
            resetForm();
        } else {
            showMessage('error', result.message);
        }
    };

    const handleEditStaff = async () => {
        if (!selectedStaff) return;

        setFormLoading(true);
        const result = await staffService.updateStaff(selectedStaff.id, {
            name: formData.name,
            phone: formData.phone,
            role: formData.role,
            branch_id: formData.branch_id,
            specializations: formData.specializations,
            working_days: formData.working_days,
            working_hours: formData.working_hours,
            salary: formData.salary ? parseFloat(formData.salary) : undefined,
            commission: formData.role === 'Stylist' && formData.commission ? parseFloat(formData.commission) : undefined,
        });

        setFormLoading(false);

        if (result.success) {
            showMessage('success', result.message);
            setShowEditModal(false);
            fetchStaff();
            resetForm();
        } else {
            showMessage('error', result.message);
        }
    };

    const handleDeleteStaff = async () => {
        if (!selectedStaff) return;

        setFormLoading(true);
        const result = await staffService.deleteStaff(selectedStaff.id);
        setFormLoading(false);

        if (result.success) {
            showMessage('success', result.message);
            setShowDeleteModal(false);
            fetchStaff();
        } else {
            showMessage('error', result.message);
        }
    };

    const resetForm = () => {
        const defaultBranchId = effectiveBranchId || (branches.length > 0 ? branches[0].id : '');
        setFormData({
            name: '',
            email: '',
            phone: '',
            role: 'Stylist',
            branch_id: defaultBranchId,
            specializations: [],
            working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            working_hours: { start: '09:00', end: '18:00' },
            salary: '',
            commission: '',
        });
        setSelectedStaff(null);
    };

    const openEditModal = (staff: Staff) => {
        setSelectedStaff(staff);

        // Handle working hours - can be flat {start, end} or day-based {Monday: {start, end}, ...}
        let workingHours = { start: '09:00', end: '18:00' };
        if (staff.workingHours) {
            if (staff.workingHours.start && staff.workingHours.end) {
                // Flat structure
                workingHours = staff.workingHours;
            } else if (typeof staff.workingHours === 'object') {
                // Day-based structure - extract from first working day
                const firstDay = staff.workingDays?.[0] || 'Monday';
                const dayHours = (staff.workingHours as any)[firstDay];
                if (dayHours?.start && dayHours?.end) {
                    workingHours = { start: dayHours.start, end: dayHours.end };
                }
            }
        }

        setFormData({
            name: staff.name || '',
            email: staff.email || '',
            phone: staff.phone || '',
            role: (staff.role as any) || 'Stylist',
            branch_id: staff.branchId || '',
            specializations: staff.specializations || [],
            working_days: staff.workingDays || [],
            working_hours: workingHours,
            salary: staff.salary?.toString() || '',
            commission: staff.commission?.toString() || '',
        });
        setShowEditModal(true);
    };

    const filteredStaff = staffMembers.filter(staff => {
        const matchesRole = roleFilter === 'All' || staff.role === roleFilter;
        const q = searchQuery.toLowerCase();
        const matchesSearch =
            searchQuery === '' ||
            (staff.name?.toLowerCase() ?? '').includes(q) ||
            (staff.email?.toLowerCase() ?? '').includes(q);
        return matchesRole && matchesSearch;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Staff</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Manage salon team members</p>
                </div>
                {hasRole(['Owner']) && (
                    <Button
                        variant="primary"
                        leftIcon={<Plus className="h-5 w-5" />}
                        onClick={() => setShowAddModal(true)}
                    >
                        Add Staff Member
                    </Button>
                )}
            </div>

            {/* Message */}
            <AnimatePresence>
                {message && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`p-4 rounded-xl ${message.type === 'success'
                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                            }`}
                    >
                        {message.text}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Filters */}
            <div className="card p-4 surface-panel">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <Input
                            type="text"
                            placeholder="Search staff..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            leftIcon={<Search className="h-5 w-5" />}
                        />
                    </div>
                </div>

                <div className="flex gap-2 mt-4 overflow-x-auto">
                    {roles.map((role) => (
                        <button
                            key={role}
                            onClick={() => setRoleFilter(role)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${roleFilter === role
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            {role}
                        </button>
                    ))}
                </div>
            </div>

            {/* Staff List - Full width on tablet, 3 cols on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-full text-center py-12">
                        <Loader className="h-8 w-8 animate-spin mx-auto text-primary-600" />
                    </div>
                ) : filteredStaff.length === 0 ? (
                    <div className="col-span-full text-center py-12">
                        <p className="text-gray-500 dark:text-gray-400">No staff members found</p>
                    </div>
                ) : (
                    filteredStaff.map((staff) => (
                        <motion.div
                            key={staff.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="card p-6 surface-panel hover:shadow-lg transition-shadow"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{staff.name}</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{staff.role}</p>
                                </div>
                                {hasRole(['Owner']) && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openEditModal(staff)}
                                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            <Edit className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedStaff(staff);
                                                setShowDeleteModal(true);
                                            }}
                                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 text-sm">
                                <p className="text-gray-600 dark:text-gray-400">{staff.email}</p>
                                <p className="text-gray-600 dark:text-gray-400">{staff.phone}</p>
                                {staff.workingDays && staff.workingDays.length > 0 && (
                                    <p className="text-gray-500 dark:text-gray-500 text-xs">
                                        {staff.workingDays.join(', ')}
                                    </p>
                                )}

                                {/* Commission Badge - Only for Stylists */}
                                {staff.role === 'Stylist' && staff.commission !== undefined && staff.commission !== null && (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-xs font-semibold">
                                        <DollarSign className="w-3.5 h-3.5" />
                                        {staff.commission}% Commission
                                    </div>
                                )}

                                {staff.specializations && staff.specializations.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {staff.specializations.slice(0, 3).map((specId) => {
                                            const service = services.find(s => s.id === specId);
                                            return service ? (
                                                <span
                                                    key={specId}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full"
                                                >
                                                    <Sparkles className="w-3 h-3" />
                                                    {service.name}
                                                </span>
                                            ) : null;
                                        })}
                                        {staff.specializations.length > 3 && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                +{staff.specializations.length - 3} more
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Add/Edit Staff Modal */}
            <AnimatePresence>
                {(showAddModal || showEditModal) && (
                    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-2 sm:p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 max-w-2xl w-full max-h-[92dvh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {showAddModal ? 'Add Staff Member' : 'Edit Staff Member'}
                                </h2>
                                <button
                                    onClick={() => {
                                        setShowAddModal(false);
                                        setShowEditModal(false);
                                        resetForm();
                                    }}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <Input
                                    label="Name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Enter full name"
                                />

                                {showAddModal && (
                                    <Input
                                        label="Email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="email@example.com"
                                    />
                                )}

                                <PhoneInput
                                    label="Phone"
                                    value={formData.phone}
                                    onChange={(value) => setFormData({ ...formData, phone: value })}
                                />

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        Role
                                    </label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => {
                                            const newRole = e.target.value as any;
                                            setFormData({
                                                ...formData,
                                                role: newRole,
                                                // Set default commission when switching to Stylist (only for new staff)
                                                commission: showAddModal && newRole === 'Stylist' && !formData.commission
                                                    ? '40'
                                                    : formData.commission
                                            });
                                        }}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-gray-900 dark:text-white"
                                    >
                                        <option value="Stylist">Stylist</option>
                                        <option value="Receptionist">Receptionist</option>
                                        <option value="Manager">Manager</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        Branch
                                    </label>
                                    <select
                                        value={formData.branch_id}
                                        onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-gray-900 dark:text-white"
                                        required
                                    >
                                        <option value="" disabled>Select a branch</option>
                                        {branches.map((branch) => (
                                            <option key={branch.id} value={branch.id}>
                                                {branch.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Specializations/Skills - Only for Stylists */}
                                {formData.role === 'Stylist' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Skills / Services
                                            <span className="text-xs text-gray-500 ml-2">(Select services this stylist can perform)</span>
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                                            {services.map((service) => (
                                                <label key={service.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.specializations.includes(service.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setFormData({ ...formData, specializations: [...formData.specializations, service.id] });
                                                            } else {
                                                                setFormData({ ...formData, specializations: formData.specializations.filter(id => id !== service.id) });
                                                            }
                                                        }}
                                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                    />
                                                    <div className="flex-1">
                                                        <span className="text-sm text-gray-700 dark:text-gray-300">{service.name}</span>
                                                        <span className="text-xs text-gray-500 ml-2">({service.category})</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                        {formData.specializations.length > 0 && (
                                            <p className="text-xs text-primary-600 dark:text-primary-400 mt-2">
                                                {formData.specializations.length} service{formData.specializations.length !== 1 ? 's' : ''} selected
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Working Days
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {days.map((day) => (
                                            <label key={day} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.working_days.includes(day)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFormData({ ...formData, working_days: [...formData.working_days, day] });
                                                        } else {
                                                            setFormData({ ...formData, working_days: formData.working_days.filter(d => d !== day) });
                                                        }
                                                    }}
                                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                />
                                                <span className="text-sm text-gray-700 dark:text-gray-300">{day}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Input
                                        label="Start Time"
                                        type="time"
                                        value={formData.working_hours.start}
                                        onChange={(e) => setFormData({ ...formData, working_hours: { ...formData.working_hours, start: e.target.value } })}
                                    />
                                    <Input
                                        label="End Time"
                                        type="time"
                                        value={formData.working_hours.end}
                                        onChange={(e) => setFormData({ ...formData, working_hours: { ...formData.working_hours, end: e.target.value } })}
                                    />
                                </div>

                                {/* Salary and Commission */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Input
                                        label="Monthly Salary (Rs)"
                                        type="number"
                                        value={formData.salary}
                                        onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                                        placeholder="e.g., 50000"
                                    />
                                    {formData.role === 'Stylist' && (
                                        <div>
                                            <Input
                                                label="Commission Rate (%)"
                                                type="number"
                                                value={formData.commission}
                                                onChange={(e) => setFormData({ ...formData, commission: e.target.value })}
                                                placeholder="40 (default)"
                                                min="0"
                                                max="100"
                                                step="0.5"
                                            />
                                            <div className="mt-1.5 flex items-start gap-1.5 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                                <DollarSign className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                                <p className="text-xs text-green-700 dark:text-green-300">
                                                    Stylists earn this % from service revenue automatically
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setShowAddModal(false);
                                            setShowEditModal(false);
                                            resetForm();
                                        }}
                                        className="flex-1"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="primary"
                                        onClick={showAddModal ? handleAddStaff : handleEditStaff}
                                        disabled={formLoading || !formData.name || (showAddModal && !formData.email) || formData.working_days.length === 0}
                                        leftIcon={formLoading ? <Loader className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                                        className="flex-1"
                                    >
                                        {formLoading ? 'Saving...' : (showAddModal ? 'Create Staff' : 'Update Staff')}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Credentials Modal */}
            <AnimatePresence>
                {showCredentialsModal && credentials && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full"
                        >
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                    Staff Account Created!
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Save these credentials. Staff will also receive them via email.
                                </p>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3 mb-6">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Email</p>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 text-gray-900 dark:text-white font-mono text-sm bg-white dark:bg-gray-700 px-3 py-2 rounded-lg">
                                            {credentials.email}
                                        </code>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(credentials.email)}
                                            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Temporary Password</p>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 text-gray-900 dark:text-white font-mono text-sm bg-white dark:bg-gray-700 px-3 py-2 rounded-lg">
                                            {credentials.password}
                                        </code>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(credentials.password)}
                                            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg mb-6">
                                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-amber-800 dark:text-amber-200">
                                    Staff should change their password after first login for security.
                                </p>
                            </div>

                            <Button
                                variant="primary"
                                onClick={() => {
                                    setShowCredentialsModal(false);
                                    setCredentials(null);
                                }}
                                className="w-full"
                            >
                                Done
                            </Button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {showDeleteModal && selectedStaff && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full"
                        >
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                                Delete Staff Member?
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                                Are you sure you want to delete <strong>{selectedStaff.name}</strong>? This will permanently remove their account and cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowDeleteModal(false);
                                        setSelectedStaff(null);
                                    }}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={handleDeleteStaff}
                                    disabled={formLoading}
                                    leftIcon={formLoading ? <Loader className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                                    className="flex-1"
                                >
                                    {formLoading ? 'Deleting...' : 'Delete'}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
