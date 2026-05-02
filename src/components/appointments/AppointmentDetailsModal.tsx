'use client';

import { useState } from 'react';
import { Calendar, Clock, User, Phone, Scissors, FileText, Edit, Trash2 } from 'lucide-react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import { AppointmentStatus } from '@/lib/types';
import { formatTime, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useToast } from '@/context/ToastContext';

interface AppointmentDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment: any;
    onEdit: () => void;
    onDelete: () => void;
    onStatusUpdate: (status: AppointmentStatus) => Promise<void>;
}

const statusColors: Record<AppointmentStatus, string> = {
    Pending: 'bg-warning-100 text-warning-700 border-warning-200 dark:bg-warning-900/30 dark:text-warning-400',
    InProgress: 'bg-primary-100 text-primary-700 border-primary-200 dark:bg-primary-900/30 dark:text-primary-400',
    Completed: 'bg-success-100 text-success-700 border-success-200 dark:bg-success-900/30 dark:text-success-400',
    Cancelled: 'bg-danger-100 text-danger-700 border-danger-200 dark:bg-danger-900/30 dark:text-danger-400',
};

const allStatuses: AppointmentStatus[] = ['Pending', 'InProgress', 'Completed', 'Cancelled'];

export default function AppointmentDetailsModal({
    isOpen,
    onClose,
    appointment,
    onEdit,
    onDelete,
    onStatusUpdate
}: AppointmentDetailsModalProps) {
    const [updating, setUpdating] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<AppointmentStatus | null>(null);
    const { showToast } = useToast();

    if (!appointment) return null;

    const handleStatusChange = async (newStatus: AppointmentStatus) => {
        if (newStatus === appointment.status) return;

        // Block manual Completed status — only POS can complete
        if (newStatus === 'Completed') {
            showToast('Appointments can only be completed via POS billing system.', 'warning');
            return;
        }

        // Block changes if already Completed
        if (appointment.status === 'Completed') {
            showToast('Cannot change status of a completed appointment. Payment has been processed via POS.', 'warning');
            return;
        }

        // Require confirmation for InProgress / Cancelled — show dialog
        if (newStatus === 'InProgress' || newStatus === 'Cancelled') {
            setPendingStatus(newStatus);
            return;
        }

        await doStatusUpdate(newStatus);
    };

    const doStatusUpdate = async (newStatus: AppointmentStatus) => {
        setUpdating(true);
        try {
            await onStatusUpdate(newStatus);
            showToast(`Status updated to ${newStatus}`, 'success');
        } catch {
            showToast('Failed to update status', 'error');
        } finally {
            setUpdating(false);
        }
    };

    const isCompleted = appointment.status === 'Completed';
    const customerName = appointment.customer?.name || 'this customer';

    const confirmTitle = pendingStatus === 'InProgress'
        ? 'Start Service?'
        : 'Cancel Appointment?';

    const confirmMessage = pendingStatus === 'InProgress'
        ? `Start service for ${customerName}? This will mark the appointment as in progress.`
        : `Cancel appointment for ${customerName}? This action cannot be undone.`;

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Appointment Details" size="lg">
                <div className="space-y-6">
                    {/* Status Section */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Status
                        </label>
                        {isCompleted && (
                            <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">
                                ✓ Completed via POS - Status locked
                            </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {allStatuses.map((status) => (
                                <button
                                    key={status}
                                    onClick={() => handleStatusChange(status)}
                                    disabled={updating || status === appointment.status || isCompleted}
                                    className={cn(
                                        'px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all',
                                        appointment.status === status
                                            ? statusColors[status] + ' ring-2 ring-offset-2 ring-primary-500'
                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-primary-400',
                                        (updating || isCompleted) && 'opacity-50 cursor-not-allowed'
                                    )}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Customer Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <User className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Customer</h3>
                            </div>
                            <div className="space-y-2">
                                <p className="text-gray-900 dark:text-white font-medium">
                                    {appointment.customer?.name || 'Unknown Customer'}
                                </p>
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <Phone className="h-4 w-4" />
                                    <span>{appointment.customer?.phone || 'No phone'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Scissors className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Stylist</h3>
                            </div>
                            <p className="text-gray-900 dark:text-white font-medium">
                                {appointment.stylist?.name || 'Not assigned'}
                            </p>
                        </div>
                    </div>

                    {/* Appointment Details */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
                        <div className="flex items-start gap-3">
                            <Calendar className="h-5 w-5 text-primary-600 dark:text-primary-400 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Date</p>
                                <p className="text-gray-900 dark:text-white font-semibold">
                                    {formatDate(appointment.appointment_date)}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Clock className="h-5 w-5 text-primary-600 dark:text-primary-400 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Time & Duration</p>
                                <p className="text-gray-900 dark:text-white font-semibold">
                                    {formatTime(appointment.start_time)} ({appointment.duration} minutes)
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <FileText className="h-5 w-5 text-primary-600 dark:text-primary-400 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Services</p>
                                {appointment.service_names && appointment.service_names.length > 0 ? (
                                    <div className="space-y-1 mt-1">
                                        {appointment.service_names.map((name: string, index: number) => (
                                            <p key={index} className="text-gray-900 dark:text-white font-semibold">• {name}</p>
                                        ))}
                                    </div>
                                ) : appointment.service_name ? (
                                    <p className="text-gray-900 dark:text-white font-semibold mt-1">• {appointment.service_name}</p>
                                ) : (
                                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                                        {Array.isArray(appointment.services)
                                            ? `${appointment.services.length} service(s) - Names not available`
                                            : 'No services specified'}
                                    </p>
                                )}
                            </div>
                        </div>

                        {appointment.notes && (
                            <div className="flex items-start gap-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                <FileText className="h-5 w-5 text-primary-600 dark:text-primary-400 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes</p>
                                    <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">{appointment.notes}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Button variant="outline" onClick={onEdit} leftIcon={<Edit className="h-4 w-4" />} className="flex-1">
                            Edit Appointment
                        </Button>
                        <Button variant="danger" onClick={onDelete} leftIcon={<Trash2 className="h-4 w-4" />} className="flex-1">
                            Delete
                        </Button>
                    </div>
                </div>
            </Modal>

            <ConfirmationDialog
                isOpen={!!pendingStatus}
                onClose={() => setPendingStatus(null)}
                onConfirm={async () => {
                    if (pendingStatus) await doStatusUpdate(pendingStatus);
                    setPendingStatus(null);
                }}
                title={confirmTitle}
                message={confirmMessage}
                confirmText={pendingStatus === 'InProgress' ? 'Start Service' : 'Cancel Appointment'}
                cancelText="Go Back"
                variant={pendingStatus === 'Cancelled' ? 'danger' : 'info'}
            />
        </>
    );
}
