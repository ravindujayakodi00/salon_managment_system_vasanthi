'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Calendar, Clock, User, Scissors, CheckCircle, Search, Phone, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import PhoneInput from '@/components/shared/PhoneInput';
import { appointmentsService } from '@/services/appointments';
import { customersService } from '@/services/customers';
import { servicesService } from '@/services/services';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import MultiServiceSelector from './MultiServiceSelector';
import ServiceSlotMapper from './ServiceSlotMapper';
import { Service } from '@/lib/types';

interface CreateAppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

interface ServiceBooking {
    serviceId: string;
    stylistId: string;
    stylistName: string;
    time: string;
}

export default function CreateAppointmentModal({ isOpen, onClose, onSuccess }: CreateAppointmentModalProps) {
    const { user } = useAuth();
    const [step, setStep] = useState<'customer' | 'slots' | 'review'>('customer');

    // Customer & Service Selection (Step 1)
    const [formData, setFormData] = useState({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        customerGender: 'Female' as 'Male' | 'Female' | 'Other',
        customerPreferences: '',
        date: '',
        notes: '',
    });

    const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

    // Service Bookings (Step 2)
    const [serviceBookings, setServiceBookings] = useState<ServiceBooking[]>([]);

    const [loading, setLoading] = useState(false);
    const [services, setServices] = useState<Service[]>([]);

    // Customer lookup state
    const [customerLookupStatus, setCustomerLookupStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle');
    const [existingCustomer, setExistingCustomer] = useState<any>(null);
    const [isCustomerLocked, setIsCustomerLocked] = useState(false);

    // Debounced phone lookup
    useEffect(() => {
        if (isCustomerLocked) return;

        if (!formData.customerPhone || formData.customerPhone.length < 9) {
            setCustomerLookupStatus('idle');
            setExistingCustomer(null);
            return;
        }

        setCustomerLookupStatus('searching');

        const timeoutId = setTimeout(async () => {
            try {
                const customer = await customersService.getCustomerByPhone(formData.customerPhone);
                if (customer) {
                    setExistingCustomer(customer);
                    setCustomerLookupStatus('found');
                    setFormData(prev => ({
                        ...prev,
                        customerName: customer.name || '',
                        customerEmail: customer.email || '',
                        customerGender: customer.gender || 'Female',
                        customerPreferences: customer.preferences || '',
                    }));
                    setIsCustomerLocked(true);
                } else {
                    setCustomerLookupStatus('not_found');
                    setExistingCustomer(null);
                    setIsCustomerLocked(false);
                }
            } catch (error) {
                console.error('Error looking up customer:', error);
                setCustomerLookupStatus('not_found');
                setExistingCustomer(null);
                setIsCustomerLocked(false);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [formData.customerPhone, isCustomerLocked]);

    // Fetch services when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchServices();
            resetForm();
        }
    }, [isOpen]);

    const fetchServices = async () => {
        try {
            const data = await servicesService.getServices();
            setServices(data || []);
        } catch (error) {
            console.error('Error fetching services:', error);
        }
    };

    const resetForm = () => {
        setStep('customer');
        setFormData({
            customerName: '',
            customerPhone: '',
            customerEmail: '',
            customerGender: 'Female',
            customerPreferences: '',
            date: '',
            notes: '',
        });
        setSelectedServiceIds([]);
        setServiceBookings([]);
        setCustomerLookupStatus('idle');
        setExistingCustomer(null);
        setIsCustomerLocked(false);
    };

    const handleCustomerStepNext = () => {
        // Initialize service bookings array
        const initialBookings = selectedServiceIds.map(serviceId => ({
            serviceId,
            stylistId: '',
            stylistName: '',
            time: ''
        }));
        setServiceBookings(initialBookings);
        setStep('slots');
    };

    const updateServiceBooking = (serviceId: string, stylistId: string, time: string, stylistName: string) => {
        setServiceBookings(prev =>
            prev.map(booking =>
                booking.serviceId === serviceId
                    ? { ...booking, stylistId, time, stylistName }
                    : booking
            )
        );
    };

    const canProceedToReview = () => {
        return serviceBookings.every(booking =>
            booking.stylistId && booking.time
        );
    };

    const handleSubmit = async () => {
        if (!user) {
            alert('You must be logged in');
            return;
        }

        setLoading(true);
        try {
            // Check if customer exists or create new one
            let customer = await customersService.getCustomerByPhone(formData.customerPhone);

            if (!customer) {
                customer = await customersService.createCustomer({
                    name: formData.customerName,
                    phone: formData.customerPhone,
                    email: formData.customerEmail || undefined,
                    gender: formData.customerGender,
                    preferences: formData.customerPreferences || undefined,
                });
            }

            // Get branch ID
            let branchId = user.branchId;
            if (!branchId) {
                const { data: branches } = await supabase
                    .from('branches')
                    .select('id')
                    .limit(1)
                    .single();

                if (branches) {
                    branchId = branches.id;
                } else {
                    throw new Error('No branch found. Please contact support.');
                }
            }

            // Create appointments array
            const appointmentsToCreate = serviceBookings.map(booking => {
                const service = services.find(s => s.id === booking.serviceId);
                return {
                    customer_id: customer.id,
                    stylist_id: booking.stylistId,
                    branch_id: branchId!,
                    services: [booking.serviceId], // Single service per appointment
                    appointment_date: formData.date,
                    start_time: booking.time,
                    duration: service?.duration || 60,
                    notes: formData.notes || undefined,
                };
            });

            // Create all appointments
            await appointmentsService.createMultipleAppointments(appointmentsToCreate);

            // Reset and close
            resetForm();
            onClose();
            onSuccess?.();
        } catch (error: any) {
            console.error('Error creating appointments:', JSON.stringify(error, null, 2));
            alert(error.message || 'Failed to create appointments');
        } finally {
            setLoading(false);
        }
    };

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

    // Calculate total for review
    const totalPrice = serviceBookings.reduce((sum, booking) => {
        const service = services.find(s => s.id === booking.serviceId);
        return sum + (service?.price || 0);
    }, 0);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                step === 'customer' ? 'New Appointment - Customer & Services' :
                    step === 'slots' ? 'New Appointment - Select Time Slots' :
                        'Review Appointments'
            }
            size="lg"
        >
            {/* Step Indicators */}
            <div className="flex flex-wrap items-center justify-start sm:justify-center gap-2 mb-6">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${step === 'customer' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' :
                    'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${step === 'customer' ? 'bg-primary-500 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>1</div>
                    <span>Customer</span>
                </div>
                <ChevronRight className="hidden sm:block w-4 h-4 text-gray-400" />
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${step === 'slots' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' :
                    'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${step === 'slots' ? 'bg-primary-500 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>2</div>
                    <span>Time Slots</span>
                </div>
                <ChevronRight className="hidden sm:block w-4 h-4 text-gray-400" />
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${step === 'review' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' :
                    'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${step === 'review' ? 'bg-primary-500 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>3</div>
                    <span>Review</span>
                </div>
            </div>

            {/* Step 1: Customer & Services */}
            {step === 'customer' && (
                <form onSubmit={(e) => { e.preventDefault(); handleCustomerStepNext(); }} className="space-y-3">
                    {/* Phone Number with auto lookup */}
                    <div className="space-y-2">
                        <div className="relative">
                            <PhoneInput
                                label="Phone Number"
                                value={formData.customerPhone}
                                onChange={(value) => {
                                    setFormData({ ...formData, customerPhone: value });
                                    if (isCustomerLocked) {
                                        setIsCustomerLocked(false);
                                        setExistingCustomer(null);
                                        setCustomerLookupStatus('idle');
                                        setFormData(prev => ({
                                            ...prev,
                                            customerPhone: value,
                                            customerName: '',
                                            customerEmail: '',
                                            customerGender: 'Female',
                                            customerPreferences: '',
                                        }));
                                    }
                                }}
                                required
                            />
                            {customerLookupStatus === 'searching' && (
                                <div className="absolute right-3 top-9 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-xs">Searching...</span>
                                </div>
                            )}
                        </div>

                        {customerLookupStatus === 'found' && existingCustomer && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl"
                            >
                                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                                        Welcome back, {existingCustomer.name}!
                                    </p>
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                        Customer found • {existingCustomer.total_visits || 0} previous visits
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setIsCustomerLocked(false);
                                        setCustomerLookupStatus('idle');
                                    }}
                                    className="text-emerald-600 dark:text-emerald-400"
                                >
                                    Edit
                                </Button>
                            </motion.div>
                        )}

                        {customerLookupStatus === 'not_found' && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl"
                            >
                                <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                <p className="text-sm text-blue-800 dark:text-blue-200">
                                    New customer! Please fill in their details below.
                                </p>
                            </motion.div>
                        )}
                    </div>

                    {/* Customer Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                            label="Customer Name"
                            type="text"
                            value={formData.customerName}
                            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                            placeholder="Enter customer name"
                            leftIcon={<User className="h-4 w-4" />}
                            required
                            disabled={isCustomerLocked}
                            className={isCustomerLocked ? '!border-emerald-500 dark:!border-emerald-600' : ''}
                        />
                        <Input
                            label="Email (Optional)"
                            type="email"
                            value={formData.customerEmail}
                            onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                            placeholder="customer@email.com"
                            disabled={isCustomerLocked}
                            className={isCustomerLocked ? '!border-emerald-500 dark:!border-emerald-600' : ''}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                            label="Date"
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            leftIcon={<Calendar className="h-4 w-4" />}
                            min={new Date().toISOString().split('T')[0]}
                            required
                        />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Gender
                            </label>
                            <select
                                value={formData.customerGender}
                                onChange={(e) => setFormData({ ...formData, customerGender: e.target.value as 'Male' | 'Female' | 'Other' })}
                                className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base ${isCustomerLocked
                                    ? 'border-emerald-500 dark:border-emerald-600 cursor-not-allowed'
                                    : 'border-gray-300 dark:border-gray-600'
                                    }`}
                                disabled={isCustomerLocked}
                            >
                                <option value="Female">Female</option>
                                <option value="Male">Male</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    {/* Multi-Service Selector */}
                    {formData.date && (
                        <MultiServiceSelector
                            services={services}
                            selectedServiceIds={selectedServiceIds}
                            onSelectionChange={setSelectedServiceIds}
                        />
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
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={!formData.date || selectedServiceIds.length === 0}
                        >
                            Next: Select Time Slots
                        </Button>
                    </div>
                </form>
            )}

            {/* Step 2: Time Slot Selection */}
            {step === 'slots' && (
                <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Selected Date:</strong> {formatDate(formData.date)}
                        </p>
                        <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                            Please select a stylist and time slot for each service below.
                        </p>
                    </div>

                    <div className="space-y-4 max-h-[70dvh] overflow-y-auto pr-0 sm:pr-2">
                        {serviceBookings.map((booking, index) => {
                            const service = services.find(s => s.id === booking.serviceId);
                            if (!service) return null;

                            // Collect all occupied time slots from OTHER services
                            const occupiedSlots = serviceBookings
                                .filter((b, idx) => idx !== index && b.time) // Exclude current service, only confirmed bookings
                                .map(b => b.time);

                            return (
                                <ServiceSlotMapper
                                    key={booking.serviceId}
                                    service={service}
                                    date={formData.date}
                                    onSelect={(stylistId, time, stylistName) => {
                                        updateServiceBooking(booking.serviceId, stylistId, time, stylistName);
                                    }}
                                    branchId={user?.branchId}
                                    occupiedSlots={occupiedSlots}
                                />
                            );
                        })}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setStep('customer')}
                            leftIcon={<ChevronLeft className="h-4 w-4" />}
                        >
                            Back
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={() => setStep('review')}
                            disabled={!canProceedToReview()}
                            rightIcon={<ChevronRight className="h-4 w-4" />}
                        >
                            Review Appointments
                        </Button>
                    </div>
                </div>
            )}

            {/* Step 3: Review */}
            {step === 'review' && (
                <div className="space-y-6">
                    {/* Customer Info */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Customer Details</h4>
                        <p className="text-base font-semibold text-gray-900 dark:text-white">{formData.customerName}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{formData.customerPhone}</p>
                        {formData.customerEmail && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">{formData.customerEmail}</p>
                        )}
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                            <strong>Date:</strong> {formatDate(formData.date)}
                        </p>
                    </div>

                    {/* Appointments List */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Appointments to be Created ({serviceBookings.length})
                        </h4>
                        {serviceBookings.map((booking, index) => {
                            const service = services.find(s => s.id === booking.serviceId);
                            if (!service) return null;

                            return (
                                <motion.div
                                    key={booking.serviceId}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-800"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-semibold text-sm">
                                                    {index + 1}
                                                </div>
                                                <h5 className="font-semibold text-gray-900 dark:text-white">{service.name}</h5>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 text-sm ml-10">
                                                <div>
                                                    <p className="text-gray-500 dark:text-gray-400">Stylist</p>
                                                    <p className="font-medium text-gray-900 dark:text-white">{booking.stylistName}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 dark:text-gray-400">Time</p>
                                                    <p className="font-medium text-gray-900 dark:text-white">{formatTime(booking.time)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 dark:text-gray-400">Duration</p>
                                                    <p className="font-medium text-gray-900 dark:text-white">{service.duration} mins</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 dark:text-gray-400">Price</p>
                                                    <p className="font-medium text-primary-600 dark:text-primary-400">Rs {service.price.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Total */}
                    <div className="bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-200 dark:border-primary-800 rounded-xl p-4">
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-medium text-gray-900 dark:text-white">Total Amount</span>
                            <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">Rs {totalPrice.toLocaleString()}</span>
                        </div>
                    </div>

                    {formData.notes && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{formData.notes}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setStep('slots')}
                            disabled={loading}
                            leftIcon={<ChevronLeft className="h-4 w-4" />}
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
                            {loading ? 'Creating Appointments...' : `Confirm ${serviceBookings.length} Appointment${serviceBookings.length > 1 ? 's' : ''}`}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
