'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Filter, Plus, Search } from 'lucide-react';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import CreateAppointmentModal from '@/components/appointments/CreateAppointmentModal';
import AppointmentDetailsModal from '@/components/appointments/AppointmentDetailsModal';
import EditAppointmentModal from '@/components/appointments/EditAppointmentModal';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import CalendarView from '@/components/appointments/CalendarView';
import { AppointmentStatus } from '@/lib/types';
import { formatTime, formatDate, cn, getLocalDateString } from '@/lib/utils';
import { appointmentsService } from '@/services/appointments';
import { useAuth } from '@/lib/auth';
import { staffService } from '@/services/staff';

const statusColors: Record<AppointmentStatus, string> = {
    Pending: 'bg-warning-100 text-warning-700 border-warning-200 dark:bg-warning-900/30 dark:text-warning-400',
    InProgress: 'bg-primary-100 text-primary-700 border-primary-200 dark:bg-primary-900/30 dark:text-primary-400',
    Completed: 'bg-success-100 text-success-700 border-success-200 dark:bg-success-900/30 dark:text-success-400',
    Cancelled: 'bg-danger-100 text-danger-700 border-danger-200 dark:bg-danger-900/30 dark:text-danger-400',
};

export default function AppointmentsPage() {
    const { user } = useAuth();
    const [view, setView] = useState<'list' | 'calendar'>('calendar');
    const [selectedStatus, setSelectedStatus] = useState<AppointmentStatus | 'All'>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState<string | 'all'>(getLocalDateString());
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [stylists, setStylists] = useState<any[]>([]);
    const [stylistsLoading, setStylistsLoading] = useState(false);
    const [selectedStylistId, setSelectedStylistId] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const statuses: (AppointmentStatus | 'All')[] = [
        'All',
        'Pending',
        'InProgress',
        'Completed',
        'Cancelled',
    ];

    const isStylist = user?.role === 'Stylist';

    // Fetch stylists for dropdown (Owner/Manager/Receptionist use-case)
    useEffect(() => {
        const fetchStylists = async () => {
            if (isStylist) return;
            try {
                setStylistsLoading(true);
                // If branchId is missing, intentionally fetch stylists across all branches
                const data = await staffService.getStylists(user?.branchId);
                setStylists(data || []);
            } catch (err) {
                console.error('Error fetching stylists:', err);
                setStylists([]);
            } finally {
                setStylistsLoading(false);
            }
        };

        fetchStylists();
    }, [user?.branchId, isStylist]);

    // Fetch appointments
    useEffect(() => {
        fetchAppointments();
    }, [selectedDate, selectedStatus, view, selectedStylistId]);

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            setError(null);
            const filters: any = {};

            // For list view, filter by selected date (unless 'all' is selected)
            // For calendar view, fetch all appointments (calendar will handle display)
            if (view === 'list' && selectedDate !== 'all') {
                filters.date = selectedDate;
            }

            if (selectedStatus !== 'All') {
                filters.status = selectedStatus;
            }
            if (selectedStylistId !== 'all') {
                filters.stylistId = selectedStylistId;
            }
            const data = await appointmentsService.getAppointments(filters);
            setAppointments(data || []);
        } catch (err: any) {
            console.error('Error fetching appointments:', err);
            setError(err.message || 'Failed to load appointments');
            setAppointments([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAppointmentCreated = () => {
        setShowCreateModal(false);
        fetchAppointments(); // Refresh list
    };

    const handleViewAppointment = (apt: any) => {
        setSelectedAppointment(apt);
        setShowDetailsModal(true);
    };

    const handleEditAppointment = (apt: any) => {
        setSelectedAppointment(apt);
        setShowDetailsModal(false);
        setShowEditModal(true);
    };

    const handleDeleteClick = (apt?: any) => {
        if (apt) setSelectedAppointment(apt);
        setShowDetailsModal(false);
        setShowDeleteDialog(true);
    };

    const handleDeleteConfirm = async () => {
        if (!selectedAppointment) return;

        setDeleteLoading(true);
        try {
            await appointmentsService.deleteAppointment(selectedAppointment.id);
            setShowDeleteDialog(false);
            setSelectedAppointment(null);
            fetchAppointments();
        } catch (error: any) {
            alert(error.message || 'Failed to delete appointment');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleStatusUpdate = async (status: AppointmentStatus) => {
        if (!selectedAppointment) return;

        try {
            await appointmentsService.updateStatus(selectedAppointment.id, status);
            // Update local state
            setSelectedAppointment({ ...selectedAppointment, status });
            fetchAppointments();
        } catch (error: any) {
            alert(error.message || 'Failed to update status');
            throw error;
        }
    };

    // Filter appointments by search query
    const filteredAppointments = appointments.filter(apt => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            apt.customer?.name?.toLowerCase().includes(query) ||
            apt.customer?.phone?.toLowerCase().includes(query) ||
            apt.stylist?.name?.toLowerCase().includes(query)
        );
    });

    return (
        <div className="space-y-3">
            {/* Header - Compact */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Appointments</h1>
                {!isStylist && (
                    <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<Plus className="h-4 w-4" />}
                        onClick={() => setShowCreateModal(true)}
                    >
                        New
                    </Button>
                )}
            </div>

            {/* Filters - Compact */}
            <div className="card p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                <div className="flex flex-wrap gap-3 items-center">
                    {/* Date Picker - Only show in list view */}
                    {view === 'list' && (
                        <div className="flex gap-2">
                            <Input
                                type="date"
                                value={selectedDate === 'all' ? '' : selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value || 'all')}
                                className="w-40"
                                leftIcon={<Calendar className="h-4 w-4" />}
                                min={getLocalDateString()}
                            />
                            <Button
                                variant={selectedDate === 'all' ? 'primary' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedDate('all')}
                            >
                                All
                            </Button>
                        </div>
                    )}

                    {/* Search - More compact */}
                    <div className="flex-1 min-w-[200px]">
                        <Input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            leftIcon={<Search className="h-4 w-4" />}
                        />
                    </div>

                    {/* Stylist Dropdown Filter */}
                    {!isStylist && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                Stylist
                            </span>
                            <select
                                value={selectedStylistId}
                                onChange={(e) => setSelectedStylistId(e.target.value)}
                                disabled={stylistsLoading}
                                className="w-56 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
                            >
                                <option value="all">All Stylists</option>
                                {stylists.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* View Toggle - Compact */}
                    <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                        <button
                            onClick={() => setView('list')}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${view === 'list'
                                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                }`}
                        >
                            List
                        </button>
                        <button
                            onClick={() => setView('calendar')}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${view === 'calendar'
                                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                                }`}
                        >
                            Calendar
                        </button>
                    </div>
                </div>

                {/* Status Filters - Compact chips */}
                <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
                    {statuses.map((status) => (
                        <button
                            key={status}
                            onClick={() => setSelectedStatus(status)}
                            className={cn(
                                'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                                selectedStatus === status
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                            )}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Appointments List */}
            {view === 'list' && (
                <div className="space-y-3">
                    {loading ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500 dark:text-gray-400">Loading appointments...</p>
                        </div>
                    ) : error ? (
                        <div className="card p-6 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800">
                            <p className="text-danger-700 dark:text-danger-400">{error}</p>
                        </div>
                    ) : filteredAppointments.length === 0 ? (
                        <div className="card p-12 text-center bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                            <Calendar className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No Appointments</h3>
                            <p className="text-gray-500 dark:text-gray-400">
                                No appointments found for the selected date and status.
                            </p>
                        </div>
                    ) : (
                        filteredAppointments.map((appointment, index) => (
                            <motion.div
                                key={appointment.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="card p-6 hover:shadow-soft-lg transition-shadow duration-200 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-start gap-3">
                                            <div className="flex-shrink-0 w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
                                                <Calendar className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold text-gray-900 dark:text-white">
                                                        {appointment.customer?.name || 'Unknown Customer'}
                                                    </h3>
                                                    <span
                                                        className={cn(
                                                            'px-2 py-0.5 text-xs font-medium rounded-lg border',
                                                            statusColors[appointment.status as AppointmentStatus]
                                                        )}
                                                    >
                                                        {appointment.status}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    {formatTime(appointment.start_time)} • {appointment.duration} min • {appointment.stylist?.name || 'Stylist'}
                                                </p>
                                                {appointment.service_names && appointment.service_names.length > 0 ? (
                                                    <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 font-medium">
                                                        {appointment.service_names.join(', ')}
                                                    </p>
                                                ) : appointment.service_name ? (
                                                    <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 font-medium">
                                                        {appointment.service_name}
                                                    </p>
                                                ) : (
                                                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                                                        {Array.isArray(appointment.services) ? `${appointment.services.length} service(s)` : 'No services'}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleViewAppointment(appointment)}
                                        >
                                            View
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleEditAppointment(appointment)}
                                        >
                                            Edit
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            )}

            {/* Calendar View */}
            {view === 'calendar' && (
                <CalendarView
                    appointments={appointments}
                    selectedDate={selectedDate}
                    onDateChange={setSelectedDate}
                    onAppointmentClick={handleViewAppointment}
                />
            )}

            {/* Create Appointment Modal */}
            {!isStylist && (
                <CreateAppointmentModal
                    isOpen={showCreateModal}
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={handleAppointmentCreated}
                />
            )}

            {/* Appointment Details Modal */}
            <AppointmentDetailsModal
                isOpen={showDetailsModal}
                onClose={() => {
                    setShowDetailsModal(false);
                    setSelectedAppointment(null);
                }}
                appointment={selectedAppointment}
                onEdit={() => handleEditAppointment(selectedAppointment)}
                onDelete={() => handleDeleteClick()}
                onStatusUpdate={handleStatusUpdate}
            />

            {/* Edit Appointment Modal */}
            <EditAppointmentModal
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    setSelectedAppointment(null);
                }}
                appointment={selectedAppointment}
                onSuccess={() => {
                    setShowEditModal(false);
                    setSelectedAppointment(null);
                    fetchAppointments();
                }}
            />

            {/* Delete Confirmation Dialog */}
            <ConfirmationDialog
                isOpen={showDeleteDialog}
                onClose={() => setShowDeleteDialog(false)}
                onConfirm={handleDeleteConfirm}
                title="Delete Appointment?"
                message={`Are you sure you want to delete the appointment for ${selectedAppointment?.customer?.name || 'this customer'}? This action cannot be undone.`}
                confirmText="Yes, Delete"
                cancelText="Cancel"
                variant="danger"
                loading={deleteLoading}
            />
        </div>
    );
}
