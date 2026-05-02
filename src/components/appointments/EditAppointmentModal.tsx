'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, User, Scissors, CheckCircle } from 'lucide-react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import { useToast } from '@/context/ToastContext';
import { appointmentsService } from '@/services/appointments';
import { servicesService } from '@/services/services';
import { staffService } from '@/services/staff';
import TimeSlotPicker from '@/components/scheduling/TimeSlotPicker';

interface EditAppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment: any;
    onSuccess?: () => void;
}

export default function EditAppointmentModal({ isOpen, onClose, appointment, onSuccess }: EditAppointmentModalProps) {
    const { showToast } = useToast();
    const [step, setStep] = useState<'selection' | 'review'>('selection');
    const [formData, setFormData] = useState({
        date: '',
        time: '',
        serviceId: '',
        stylistId: '',
        notes: '',
        duration: 60,
    });
    const [loading, setLoading] = useState(false);
    const [services, setServices] = useState<any[]>([]);
    const [stylists, setStylists] = useState<any[]>([]);

    // Load appointment data when modal opens
    useEffect(() => {
        if (isOpen && appointment) {
            setFormData({
                date: appointment.appointment_date || '',
                time: appointment.start_time || '',
                serviceId: Array.isArray(appointment.services) && appointment.services.length > 0
                    ? appointment.services[0]
                    : '',
                stylistId: appointment.stylist_id || '',
                notes: appointment.notes || '',
                duration: appointment.duration || 60,
            });
            fetchServices();
            // Fetch stylists based on service after form data is set
            setStep('selection');
        }
    }, [isOpen, appointment]);

    // Fetch stylists when service changes
    useEffect(() => {
        if (isOpen && formData.serviceId) {
            fetchStylists(formData.serviceId);
        }
    }, [isOpen, formData.serviceId, formData.date]);

    const fetchServices = async () => {
        try {
            const data = await servicesService.getServices();
            setServices(data || []);
        } catch (error) {
            console.error('Error fetching services:', error);
        }
    };

    const fetchStylists = async (serviceId?: string) => {
        try {
            let data;
            if (serviceId) {
                // Filter stylists by service capability
                data = await staffService.getStylistsByService(serviceId, undefined, formData.date || undefined);
            } else {
                // Get all stylists (fallback)
                data = await staffService.getStylists(undefined, formData.date || undefined);
            }
            setStylists(data || []);
        } catch (error) {
            console.error('Error fetching stylists:', error);
        }
    };



    const handleReview = (e: React.FormEvent) => {
        e.preventDefault();
        setStep('review');
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const selectedService = services.find(s => s.id === formData.serviceId);

            // Use snake_case for API
            const updateData: any = {
                stylist_id: formData.stylistId,
                services: [formData.serviceId],
                appointment_date: formData.date,
                start_time: formData.time,
                duration: selectedService?.duration || formData.duration,
                notes: formData.notes || undefined,
            };

            await appointmentsService.updateAppointment(appointment.id, updateData);

            setStep('selection');
            onClose();
            onSuccess?.();
        } catch (error: any) {
            console.error('Error updating appointment:', error);
            showToast(error.message || 'Failed to update appointment', 'error');
        } finally {
            setLoading(false);
        }
    };

    const selectedService = services.find(s => s.id === formData.serviceId);
    const selectedStylist = stylists.find(s => s.id === formData.stylistId);

    const formatTime = (time: string) => {
        if (!time) return '';
        const [hours, minutes] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={step === 'review' ? "Review Changes" : "Edit Appointment"}
            size="lg"
        >
            {step === 'selection' ? (
                <form onSubmit={handleReview} className="space-y-4">
                    {/* Customer Info (Read-only) */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Customer</h3>
                        <p className="text-gray-900 dark:text-white font-semibold">
                            {appointment?.customer?.name || 'Unknown'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {appointment?.customer?.phone || 'No phone'}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Date */}
                        <Input
                            label="Date"
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            leftIcon={<Calendar className="h-5 w-5" />}
                            min={new Date().toISOString().split('T')[0]}
                            required
                        />

                        {/* Service */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Service
                            </label>
                            <select
                                value={formData.serviceId}
                                onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-gray-900 dark:text-white"
                                required
                            >
                                <option value="">Select service</option>
                                {services.map((service) => (
                                    <option key={service.id} value={service.id}>
                                        {service.name} - Rs {service.price}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Stylist */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Stylist
                            </label>
                            <select
                                value={formData.stylistId}
                                onChange={(e) => setFormData({ ...formData, stylistId: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-gray-900 dark:text-white"
                                required
                            >
                                <option value="">Select stylist</option>
                                {stylists.map((stylist) => (
                                    <option key={stylist.id} value={stylist.id}>
                                        {stylist.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Time Slot Picker */}
                    {formData.date && formData.stylistId && formData.serviceId && (
                        <div>
                            <TimeSlotPicker
                                stylistId={formData.stylistId}
                                date={formData.date}
                                serviceDuration={services.find(s => s.id === formData.serviceId)?.duration || 60}
                                onSelect={(time) => setFormData({ ...formData, time })}
                                selectedTime={formData.time}
                            />
                            <input
                                type="text"
                                value={formData.time}
                                required
                                className="opacity-0 h-0 w-0 absolute"
                                onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please select a time slot')}
                                onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                            />
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Notes (Optional)
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Add any special notes..."
                            rows={3}
                            className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-none text-gray-900 dark:text-white"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary">
                            Review Changes
                        </Button>
                    </div>
                </form>
            ) : (
                <div className="space-y-6">
                    {/* Review Summary */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Customer</h4>
                                <p className="text-base font-semibold text-gray-900 dark:text-white">{appointment?.customer?.name}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300">{appointment?.customer?.phone}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Stylist</h4>
                                <p className="text-base font-semibold text-gray-900 dark:text-white">{selectedStylist?.name}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Date & Time</h4>
                                <p className="text-base font-semibold text-gray-900 dark:text-white">{formatDate(formData.date)}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300">{formatTime(formData.time)}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Service</h4>
                                <p className="text-base font-semibold text-gray-900 dark:text-white">{selectedService?.name}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300">{selectedService?.duration} mins</p>
                            </div>
                        </div>

                        {formData.notes && (
                            <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</h4>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{formData.notes}</p>
                            </div>
                        )}

                        <div className="pt-4 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
                            <span className="text-lg font-medium text-gray-900 dark:text-white">Total Price</span>
                            <span className="text-2xl font-bold text-primary-600">Rs {selectedService?.price}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setStep('selection')}
                            disabled={loading}
                        >
                            Back to Edit
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={handleSubmit}
                            disabled={loading}
                            leftIcon={loading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><Clock className="h-5 w-5" /></motion.div> : <CheckCircle className="h-5 w-5" />}
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
