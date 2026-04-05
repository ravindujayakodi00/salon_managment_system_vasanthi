'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import logoLongLight from '@/assets/logo-pack/logo-long-light.png';
import { gsap, ScrollTrigger } from '@/utils/gsapConfig';
import { useWebsiteAuth } from '@/context/WebsiteAuthContext';
import {
    fetchServices,
    fetchConsolidatedAvailability,
    createRandomBooking,
    formatTime,
    getMinDate,
    type Service,
    type ConsolidatedSlot,
} from '@/lib/website/api';

interface BookingData {
    id: string;
    service: string;
    serviceName: string;
    servicePrice: number;
    serviceDuration: number;
    date: string;
    time: string;
}

interface CustomerData {
    name: string;
    email: string;
    phone: string;
    notes: string;
}

const steps = [
    { id: 1, title: 'Service', icon: '✂️', subtitle: 'Choose your treatment' },
    { id: 2, title: 'Review', icon: '📋', subtitle: 'Your appointments' },
    { id: 3, title: 'Details', icon: '📝', subtitle: 'Your information' },
    { id: 4, title: 'Verify', icon: '📱', subtitle: 'OTP verification' },
    { id: 5, title: 'Confirm', icon: '✓', subtitle: 'Submit booking' },
];


const serviceCategories = [
    { id: 'all', name: 'All', icon: '✨' },
    { id: 'Hair', name: 'Hair', icon: '✂️' },
    { id: 'Spa', name: 'Skin & Spa', icon: '💆' },
    { id: 'Nails', name: 'Nails', icon: '💅' },
    { id: 'Bridal', name: 'Bridal', icon: '👰' },
];


const generateId = () => `booking-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

interface AppointmentSectionProps {
    isStandalone?: boolean;
}

export default function AppointmentSection({ isStandalone = false }: AppointmentSectionProps) {
    const { setSession, isAuthenticated, getAuthenticatedClient } = useWebsiteAuth();
    const [currentStep, setCurrentStep] = useState(1);
    const sectionRef = useRef<HTMLElement | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // API Data States
    const [services, setServices] = useState<Service[]>([]);
    const [consolidatedSlots, setConsolidatedSlots] = useState<ConsolidatedSlot[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Multi-Booking States
    const [cart, setCart] = useState<BookingData[]>([]);
    const [customer, setCustomer] = useState<CustomerData>({ name: '', email: '', phone: '', notes: '' });
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    // OTP States
    const [otpSent, setOtpSent] = useState(false);
    const [otpValue, setOtpValue] = useState('');
    const [otpVerified, setOtpVerified] = useState(false);
    const [otpLoading, setOtpLoading] = useState(false);
    const [otpError, setOtpError] = useState<string | null>(null);
    const [otpCountdown, setOtpCountdown] = useState(0);

    // Booking success state
    const [bookingSuccess, setBookingSuccess] = useState<{
        show: boolean;
        appointments: { serviceName: string; date: string; time: string; price: number }[];
        total: number;
    } | null>(null);

    // Form validation states
    const [fieldErrors, setFieldErrors] = useState<{
        name?: string;
        phone?: string;
        email?: string;
    }>({});
    const [showErrors, setShowErrors] = useState(false);

    // Current service being configured (before adding to cart)
    const [configuring, setConfiguring] = useState<{
        service: Service | null;
        date: string;
        time: string;
    }>({
        service: null,
        date: '',
        time: '',
    });

    // Modal state for configuring appointment
    const [showModal, setShowModal] = useState(false);

    // Get total price
    const totalPrice = cart.reduce((sum, item) => sum + item.servicePrice, 0);
    const totalDuration = cart.reduce((sum, item) => sum + item.serviceDuration, 0);

    // Calculate time slots blocked by cart items for a specific date
    const getCartBlockedSlots = (date: string): { time: string; endTime: string; serviceName: string }[] => {
        return cart
            .filter(item => item.date === date)
            .map(item => {
                // Calculate end time based on service duration
                const [hours, mins] = item.time.split(':').map(Number);
                const endMinutes = hours * 60 + mins + item.serviceDuration;
                const endHours = Math.floor(endMinutes / 60);
                const endMins = endMinutes % 60;
                const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
                return { time: item.time, endTime, serviceName: item.serviceName };
            });
    };

    // Check if a time slot overlaps with cart bookings
    const isSlotBlockedByCart = (
        slotTime: string,
        serviceDuration: number,
        cartBlocked: { time: string; endTime: string; serviceName: string }[]
    ): { blocked: boolean; conflictWith?: string } => {
        const [slotHour, slotMin] = slotTime.split(':').map(Number);
        const slotStartMinutes = slotHour * 60 + slotMin;
        const slotEndMinutes = slotStartMinutes + serviceDuration;

        for (const cartItem of cartBlocked) {
            const [cartStartHour, cartStartMin] = cartItem.time.split(':').map(Number);
            const [cartEndHour, cartEndMin] = cartItem.endTime.split(':').map(Number);
            const cartStartMinutes = cartStartHour * 60 + cartStartMin;
            const cartEndMinutes = cartEndHour * 60 + cartEndMin;

            // Check for overlap: slot overlaps if it starts before cart ends AND ends after cart starts
            if (slotStartMinutes < cartEndMinutes && slotEndMinutes > cartStartMinutes) {
                return { blocked: true, conflictWith: cartItem.serviceName };
            }
        }
        return { blocked: false };
    };

    // Navigation functions
    const goBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const goNext = () => {
        if (currentStep < steps.length) {
            setCurrentStep(currentStep + 1);
        }
    };

    // Validation functions
    const validateName = (name: string): string | undefined => {
        if (!name.trim()) return 'Name is required';
        if (name.trim().length < 2) return 'Name must be at least 2 characters';
        if (name.trim().length > 100) return 'Name is too long';
        return undefined;
    };

    const validatePhone = (phone: string): string | undefined => {
        if (!phone.trim()) return 'Phone is required';
        // Remove all non-digits for validation
        const digits = phone.replace(/\D/g, '');
        // Sri Lanka: 10 digits starting with 0 or 9 digits without 0, or with country code
        if (digits.length < 9 || digits.length > 12) {
            return 'Enter a valid phone number';
        }
        // Check if it's a valid Sri Lanka number pattern
        if (!digits.match(/^(94|0)?[0-9]{9}$/)) {
            return 'Enter a valid Sri Lanka phone number';
        }
        return undefined;
    };

    const validateEmail = (email: string): string | undefined => {
        if (!email.trim()) return undefined; // Optional field
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return 'Enter a valid email address';
        }
        return undefined;
    };

    const validateCustomerForm = (): boolean => {
        const errors: { name?: string; phone?: string; email?: string } = {};

        errors.name = validateName(customer.name);
        errors.phone = validatePhone(customer.phone);
        errors.email = validateEmail(customer.email);

        setFieldErrors(errors);
        setShowErrors(true);

        return !errors.name && !errors.phone && !errors.email;
    };

    const canProceed = () => {
        switch (currentStep) {
            case 1: {
                // Check if a service is fully configured (for service selection step)
                return configuring.service && configuring.date && configuring.time;
            }
            case 2: {
                // Review step - check if there are appointments in the list
                return cart.length > 0;
            }
            case 3: {
                // Details step - validate customer form
                const nameErr = validateName(customer.name);
                const phoneErr = validatePhone(customer.phone);
                const emailErr = validateEmail(customer.email);
                return !nameErr && !phoneErr && !emailErr;
            }
            case 4: return otpVerified;
            default: return true;
        }
    };

    // OTP Countdown timer
    useEffect(() => {
        if (otpCountdown > 0) {
            const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [otpCountdown]);

    // Send OTP function
    const sendOtp = async () => {
        if (!customer.phone) return;

        setOtpLoading(true);
        setOtpError(null);

        try {
            const response = await fetch('/api/otp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: customer.phone }),
            });

            const data = await response.json();

            if (data.success) {
                setOtpSent(true);
                setOtpCountdown(60); // 60 second cooldown
                // For development, show OTP in console
                if (data.debug_otp) {
                    console.log('DEBUG OTP:', data.debug_otp);
                }
            } else {
                setOtpError(data.error || 'Failed to send OTP');
            }
        } catch (err) {
            setOtpError('Failed to send OTP. Please try again.');
        } finally {
            setOtpLoading(false);
        }
    };

    // Verify OTP function
    const verifyOtp = async () => {
        if (!otpValue || otpValue.length !== 6) {
            setOtpError('Please enter a valid 6-digit OTP');
            return;
        }

        setOtpLoading(true);
        setOtpError(null);

        try {
            const response = await fetch('/api/otp/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: customer.phone, otp: otpValue }),
            });

            const data = await response.json();

            if (data.success) {
                setOtpVerified(true);
                // Save session from server response
                if (data.session) {
                    setSession(data.session);
                }
                goNext(); // Auto-advance to confirmation
            } else {
                setOtpError(data.error || 'Invalid OTP');
            }
        } catch (err) {
            setOtpError('Failed to verify OTP. Please try again.');
        } finally {
            setOtpLoading(false);
        }
    };

    // Mount effects
    useEffect(() => {
        setIsMounted(true);
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Fetch services on mount
    useEffect(() => {
        async function loadServices() {
            try {
                setLoading(true);
                const data = await fetchServices();
                setServices(data);
                setError(null);
            } catch (err) {
                console.error('Error loading services:', err);
                setError('Failed to load services. Please refresh the page.');
            } finally {
                setLoading(false);
            }
        }
        loadServices();
    }, []);

    // Fetch consolidated availability when date is selected
    useEffect(() => {
        if (!configuring.date || !configuring.service) {
            setConsolidatedSlots([]);
            return;
        }

        async function loadAvailability() {
            try {
                setLoading(true);
                const data = await fetchConsolidatedAvailability(
                    configuring.service!.id,
                    configuring.date,
                    configuring.service!.duration
                );
                setConsolidatedSlots(data.slots);
                setError(null);
            } catch (err) {
                console.error('Error loading availability:', err);
                setError('Failed to load available times.');
            } finally {
                setLoading(false);
            }
        }
        loadAvailability();
    }, [configuring.service, configuring.date]);

    // ScrollTrigger for pinning
    useEffect(() => {
        if (!isMounted || !sectionRef.current) return;

        let ctx: gsap.Context | null = null;

        const timer = setTimeout(() => {
            const section = sectionRef.current;
            if (!section) return;

            ctx = gsap.context(() => {
                ScrollTrigger.create({
                    trigger: section,
                    start: 'top top',
                    end: `+=${steps.length * 500}`,
                    pin: true,
                    pinSpacing: true,
                    anticipatePin: 1,
                    invalidateOnRefresh: true,
                    scrub: isMobile ? 1 : false,
                    onUpdate: isMobile ? (self) => {
                        const progress = self.progress;
                        const stepIndex = Math.floor(progress * steps.length);
                        const newStep = Math.min(Math.max(stepIndex + 1, 1), steps.length);
                        setCurrentStep(prev => prev !== newStep ? newStep : prev);
                    } : undefined,
                });
            }, section);
        }, 300);

        return () => {
            clearTimeout(timer);
            if (ctx) ctx.revert();
        };
    }, [isMounted, isMobile]);

    // Open modal to configure a service
    const openServiceModal = (service: Service) => {
        setConfiguring({
            service,
            date: '',
            time: '',
        });
        setShowModal(true);
    };

    // Add configured service to appointments list
    const addToAppointments = () => {
        if (!configuring.service || !configuring.date || !configuring.time) return;

        const newBooking: BookingData = {
            id: generateId(),
            service: configuring.service.id,
            serviceName: configuring.service.name,
            servicePrice: configuring.service.price,
            serviceDuration: configuring.service.duration,
            date: configuring.date,
            time: configuring.time,
        };

        setCart(prev => [...prev, newBooking]);
        setShowModal(false);
        setConfiguring({
            service: null,
            date: '',
            time: '',
        });

        // Always navigate to Review step after adding appointment
        setCurrentStep(2);
    };

    // Remove from cart
    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    // Handle booking submission - submits each appointment separately
    const handleSubmit = async () => {
        if (cart.length === 0) return;

        try {
            setLoading(true);
            setError(null);

            const authClient = getAuthenticatedClient();
            const results: { date: string; time: string; serviceName: string; price: number }[] = [];

            // Submit each appointment separately using random stylist allocation
            for (const booking of cart) {
                const result = await createRandomBooking({
                    customer: {
                        name: customer.name,
                        phone: customer.phone,
                        email: customer.email || undefined,
                    },
                    appointment: {
                        service_id: booking.service,
                        date: booking.date,
                        time: booking.time,
                        notes: customer.notes || undefined,
                    }
                }, authClient);

                results.push({
                    date: result.date,
                    time: result.time,
                    serviceName: booking.serviceName,
                    price: booking.servicePrice,
                });
            }

            // Send confirmation SMS with all appointments
            try {
                await fetch('/api/sms/confirmation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone: customer.phone,
                        appointments: results,
                        totalPrice,
                    }),
                });
                console.log('✅ Confirmation SMS sent');
            } catch (smsErr) {
                console.error('Failed to send confirmation SMS:', smsErr);
                // Don't fail the booking if SMS fails
            }

            // Show success message on screen
            const successData = {
                show: true,
                appointments: results,
                total: totalPrice,
            };
            setBookingSuccess(successData);

            // Reset form
            setCart([]);
            setConfiguring({
                service: null,
                date: '',
                time: '',
            });
            setOtpSent(false);
            setOtpValue('');
            setOtpVerified(false);
            setCurrentStep(1);

        } catch (err: any) {
            console.error('Error submitting booking:', err);
            setError(err.message || 'Failed to create appointments. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Filter services by category
    const filteredServices = selectedCategory === 'all'
        ? services
        : services.filter(s => s.category === selectedCategory);

    // Navigation Buttons Component
    const NavButtons = ({ showBack = true, showNext = true }: { showBack?: boolean; showNext?: boolean }) => (
        <div className="flex items-center justify-between gap-4 mt-6">
            {showBack && currentStep > 1 ? (
                <button
                    onClick={goBack}
                    className="flex items-center gap-2 px-5 py-2.5 border border-[var(--t-border-2)] text-[var(--t-text-2)] hover:border-[var(--t-text)] hover:text-[var(--t-text)] transition-all text-sm"
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="square" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>
            ) : (
                <div />
            )}
            {showNext && currentStep < steps.length && (
                <button
                    onClick={goNext}
                    disabled={!canProceed()}
                    className={`flex items-center gap-2 px-6 py-2.5 font-medium text-sm tracking-wider uppercase transition-all ${canProceed()
                        ? 'bg-[var(--t-accent)] text-white hover:bg-[#8F7B6C]'
                        : 'bg-[var(--t-border)] text-[var(--t-text-3)] cursor-not-allowed'
                        }`}
                >
                    Continue
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="square" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}
        </div>
    );

    // Render modal content for configuring a service (date & time only — stylist allocated randomly)
    const renderModalContent = () => {
        if (!configuring.service) return null;

        return (
            <div className="space-y-4">
                <div className="text-center mb-4">
                    <p className="t-script text-[var(--t-accent-2)] mb-1" style={{ fontSize: '1rem' }}>Select Date & Time</p>
                    <p className="text-[var(--t-text-2)] text-sm">{configuring.service.name}</p>
                </div>

                <div>
                    <label className="block text-[var(--t-text-2)] mb-2 text-xs uppercase tracking-widest">Date</label>
                    <input
                        type="date"
                        value={configuring.date}
                        onChange={(e) => setConfiguring(prev => ({ ...prev, date: e.target.value, time: '' }))}
                        min={getMinDate()}
                        className="w-full p-3 bg-[var(--t-bg-2)] border border-[var(--t-border)] text-[var(--t-text)] focus:border-[var(--t-accent-2)] focus:outline-none transition-all"
                    />
                </div>

                {configuring.date && loading && (
                    <div className="text-center py-4">
                        <div className="w-5 h-5 border-2 border-[var(--t-accent-2)] border-t-transparent rounded-full mx-auto animate-spin"></div>
                    </div>
                )}

                {configuring.date && !loading && consolidatedSlots.length === 0 && (
                    <div className="bg-amber-50 border border-amber-200 p-4 text-center">
                        <div className="text-2xl mb-2">📅</div>
                        <p className="text-amber-700 font-medium text-sm">No available slots on this date</p>
                        <p className="text-amber-600 text-xs mt-1">Please select a different date.</p>
                    </div>
                )}

                {configuring.date && !loading && consolidatedSlots.length > 0 && (
                    <div>
                        <label className="block text-[var(--t-text-2)] mb-2 text-xs uppercase tracking-widest">Time</label>
                        <div className="flex flex-wrap gap-3 text-[10px] text-[var(--t-text-3)] mb-3">
                            <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 bg-[var(--t-bg-2)] border border-[var(--t-border)]"></div>
                                <span>Available</span>
                            </div>
                            {cart.length > 0 && (
                                <div className="flex items-center gap-1">
                                    <div className="w-2.5 h-2.5 bg-amber-100 border border-amber-300"></div>
                                    <span>In Your Cart</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1">
                                <div className="w-2.5 h-2.5 bg-red-50 border border-red-200"></div>
                                <span>Booked</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
                            {consolidatedSlots.map(slot => {
                                const cartBlocked = isSlotBlockedByCart(
                                    slot.time,
                                    configuring.service!.duration,
                                    getCartBlockedSlots(configuring.date)
                                );
                                const isDisabled = !slot.available || cartBlocked.blocked;

                                return (
                                    <button
                                        key={slot.time}
                                        onClick={() => setConfiguring(prev => ({ ...prev, time: slot.time }))}
                                        disabled={isDisabled}
                                        title={cartBlocked.blocked ? `Conflicts with: ${cartBlocked.conflictWith}` : undefined}
                                        className={`p-2 text-xs font-medium transition-all border ${configuring.time === slot.time
                                            ? 'bg-[var(--t-accent)] border-[var(--t-accent)] text-[var(--t-text)]'
                                            : cartBlocked.blocked
                                                ? 'bg-amber-50 text-amber-500 cursor-not-allowed border-amber-200'
                                                : slot.available
                                                    ? 'bg-[var(--t-bg-2)] text-[var(--t-text-2)] hover:border-[var(--t-accent-2)] border-[var(--t-border)]'
                                                    : 'bg-red-50 text-red-300 cursor-not-allowed border-red-100'
                                            }`}
                                    >
                                        {formatTime(slot.time)}
                                        {cartBlocked.blocked && <span className="block text-[8px] opacity-70">In Cart</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex gap-3 pt-4">
                    <button
                        onClick={() => setShowModal(false)}
                        className="flex-1 px-4 py-2 border border-[var(--t-border-2)] text-[var(--t-text-2)] hover:border-[var(--t-text)] hover:text-[var(--t-text)] text-sm transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={addToAppointments}
                        disabled={!configuring.time}
                        className={`flex-1 px-4 py-2 font-medium text-sm tracking-wider uppercase transition-all ${configuring.time
                            ? 'bg-[var(--t-accent)] text-white hover:bg-[#8F7B6C]'
                            : 'bg-[var(--t-border)] text-[var(--t-text-3)] cursor-not-allowed'
                            }`}
                    >
                        Add Appointment
                    </button>
                </div>
            </div>
        );
    };

    // Render step content
    const renderStepContent = () => {
        switch (currentStep) {
            case 1: // Service Selection
                return (
                    <div className="space-y-6">
                        <div className="mb-6">
                            <p className="t-script text-[var(--t-accent-2)] mb-1" style={{ fontSize: '1.1rem' }}>Step One</p>
                            <h3 className="t-display font-light text-[var(--t-text)]" style={{ fontSize: 'clamp(1.4rem, 2.5vw, 2rem)' }}>Choose Your Service</h3>
                            <p className="text-[var(--t-text-2)] text-sm mt-1">Select a service to begin</p>
                        </div>

                        {/* Category Filter */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            {serviceCategories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`px-4 py-1.5 text-xs font-medium tracking-wider uppercase border transition-all ${selectedCategory === cat.id
                                        ? 'bg-[var(--t-accent)] border-[var(--t-accent)] text-[var(--t-text)]'
                                        : 'bg-transparent border-[var(--t-border-2)] text-[var(--t-text-2)] hover:border-[var(--t-accent-2)]'
                                        }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <div className="text-center py-12">
                                <div className="w-6 h-6 border-2 border-[var(--t-accent-2)] border-t-transparent rounded-full mx-auto animate-spin"></div>
                                <p className="text-[var(--t-text-3)] mt-3 text-sm">Loading services...</p>
                            </div>
                        ) : (
                            <div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {filteredServices.map(service => {
                                        const isSelected = configuring.service?.id === service.id && configuring.date && configuring.time;
                                        return (
                                            <button
                                                key={service.id}
                                                onClick={() => openServiceModal(service)}
                                                className={`p-4 text-left border transition-all group ${isSelected
                                                    ? 'bg-[var(--t-accent)] border-[var(--t-accent)]'
                                                    : 'bg-[var(--t-bg-2)] border-[var(--t-border)] hover:border-[var(--t-accent-2)]'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className={`font-medium text-sm ${isSelected ? 'text-[var(--t-text)]' : 'text-[var(--t-text)]'}`}>{service.name}</h4>
                                                        <p className={`text-xs mt-0.5 ${isSelected ? 'text-[var(--t-text-2)]' : 'text-[var(--t-text-3)]'}`}>{service.duration} mins</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`font-semibold text-sm ${isSelected ? 'text-[var(--t-text)]' : 'text-[var(--t-accent-2)]'}`}>Rs {service.price}</span>
                                                        {isSelected && (
                                                            <span className="block text-[10px] text-[var(--t-text)] mt-0.5">✓ Selected</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Selected Service Summary */}
                        {configuring.service && configuring.date && configuring.time && (
                            <div className="bg-[var(--t-bg-2)] p-4 border-l-2 border-[var(--t-accent-2)]">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="t-label text-[var(--t-accent-2)] text-[0.6rem] tracking-[0.3em] mb-1">Selected Appointment</p>
                                        <h4 className="font-medium text-[var(--t-text)] text-sm">{configuring.service.name}</h4>
                                        <p className="text-xs text-[var(--t-text-2)] mt-0.5">
                                            {configuring.date} at {formatTime(configuring.time)} · Stylist auto-assigned
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[var(--t-accent-2)] font-semibold">Rs {configuring.service.price}</span>
                                        <button
                                            onClick={() => setConfiguring({ service: null, date: '', time: '' })}
                                            className="block text-xs text-red-400 hover:text-red-600 mt-1 transition-colors"
                                        >
                                            Change
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <NavButtons showBack={false} />
                    </div>
                );

            case 2: // Review Appointments
                return (
                    <div className="space-y-6">
                        <div className="mb-6">
                            <p className="t-script text-[var(--t-accent-2)] mb-1" style={{ fontSize: '1.1rem' }}>Step Two</p>
                            <h3 className="t-display font-light text-[var(--t-text)]" style={{ fontSize: 'clamp(1.4rem, 2.5vw, 2rem)' }}>
                                Your {cart.length > 1 ? 'Appointments' : 'Appointment'}
                            </h3>
                            <p className="text-[var(--t-text-2)] text-sm mt-1">Review before proceeding</p>
                        </div>

                        {cart.length === 0 ? (
                            <div className="text-center py-12 text-[var(--t-text-3)]">
                                <p className="text-sm">No appointments selected. Go back to add services.</p>
                            </div>
                        ) : (
                            <div className="max-w-lg mx-auto space-y-4">
                                <div className="space-y-2">
                                    {cart.map((item, index) => (
                                        <div key={item.id} className="bg-[var(--t-bg-2)] p-4 border border-[var(--t-border)]">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="t-label text-[var(--t-accent-2)] text-[0.6rem] tracking-[0.3em] mb-1">Appointment {index + 1}</p>
                                                    <h4 className="font-medium text-[var(--t-text)] text-sm">{item.serviceName}</h4>
                                                    <p className="text-xs text-[var(--t-text-2)] mt-0.5">{item.date} at {formatTime(item.time)} · Stylist auto-assigned</p>
                                                    <p className="text-xs text-[var(--t-text-3)] mt-0.5">{item.serviceDuration} mins</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[var(--t-accent-2)] font-semibold text-sm">Rs {item.servicePrice}</span>
                                                    <button onClick={() => removeFromCart(item.id)} className="block text-xs text-red-400 hover:text-red-600 mt-1 transition-colors">Remove</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Total */}
                                <div className="bg-[var(--t-accent)] p-4 border border-[var(--t-accent)]">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className="text-[var(--t-text)] font-semibold text-sm">Total ({cart.length} appointment{cart.length > 1 ? 's' : ''})</span>
                                            <span className="text-[var(--t-text-2)] text-xs block">{totalDuration} mins</span>
                                        </div>
                                        <span className="text-[var(--t-text)] font-bold text-xl">Rs {totalPrice}</span>
                                    </div>
                                </div>

                                {/* Add Another */}
                                <button
                                    onClick={() => setCurrentStep(1)}
                                    className="w-full p-4 border border-dashed border-[var(--t-accent-2)] text-[var(--t-accent-2)] hover:bg-[var(--t-bg-2)] transition-all text-sm font-medium tracking-wider uppercase"
                                >
                                    + Add Another Appointment
                                </button>
                            </div>
                        )}

                        <NavButtons />
                    </div>
                );

            case 3: // Customer Details
                return (
                    <div className="space-y-6">
                        <div className="mb-6">
                            <p className="t-script text-[var(--t-accent-2)] mb-1" style={{ fontSize: '1.1rem' }}>Step Three</p>
                            <h3 className="t-display font-light text-[var(--t-text)]" style={{ fontSize: 'clamp(1.4rem, 2.5vw, 2rem)' }}>Your Details</h3>
                            <p className="text-[var(--t-text-2)] text-sm mt-1">Enter your contact information</p>
                        </div>

                        <div className="max-w-md mx-auto space-y-4">
                            <div>
                                <label className="block text-[var(--t-text-2)] mb-1.5 text-xs uppercase tracking-widest">Name *</label>
                                <input
                                    type="text"
                                    value={customer.name}
                                    onChange={(e) => { setCustomer(prev => ({ ...prev, name: e.target.value })); if (showErrors) setFieldErrors(prev => ({ ...prev, name: validateName(e.target.value) })); }}
                                    onBlur={() => { if (customer.name) { setFieldErrors(prev => ({ ...prev, name: validateName(customer.name) })); setShowErrors(true); } }}
                                    placeholder="Your full name"
                                    className={`w-full p-3.5 bg-[var(--t-bg-2)] border text-[var(--t-text)] placeholder-[var(--t-text-3)] focus:outline-none transition-all text-sm ${showErrors && fieldErrors.name ? 'border-red-400 focus:border-red-500' : 'border-[var(--t-border)] focus:border-[var(--t-accent-2)]'}`}
                                />
                                {showErrors && fieldErrors.name && <p className="text-red-500 text-xs mt-1">{fieldErrors.name}</p>}
                            </div>

                            <div>
                                <label className="block text-[var(--t-text-2)] mb-1.5 text-xs uppercase tracking-widest">Phone *</label>
                                <input
                                    type="tel"
                                    value={customer.phone}
                                    onChange={(e) => { setCustomer(prev => ({ ...prev, phone: e.target.value })); if (showErrors) setFieldErrors(prev => ({ ...prev, phone: validatePhone(e.target.value) })); }}
                                    onBlur={() => { if (customer.phone) { setFieldErrors(prev => ({ ...prev, phone: validatePhone(customer.phone) })); setShowErrors(true); } }}
                                    placeholder="+94 77 123 4567"
                                    className={`w-full p-3.5 bg-[var(--t-bg-2)] border text-[var(--t-text)] placeholder-[var(--t-text-3)] focus:outline-none transition-all text-sm ${showErrors && fieldErrors.phone ? 'border-red-400 focus:border-red-500' : 'border-[var(--t-border)] focus:border-[var(--t-accent-2)]'}`}
                                />
                                {showErrors && fieldErrors.phone && <p className="text-red-500 text-xs mt-1">{fieldErrors.phone}</p>}
                            </div>

                            <div>
                                <label className="block text-[var(--t-text-2)] mb-1.5 text-xs uppercase tracking-widest">Email (Optional)</label>
                                <input
                                    type="email"
                                    value={customer.email}
                                    onChange={(e) => { setCustomer(prev => ({ ...prev, email: e.target.value })); if (showErrors) setFieldErrors(prev => ({ ...prev, email: validateEmail(e.target.value) })); }}
                                    onBlur={() => { if (customer.email) { setFieldErrors(prev => ({ ...prev, email: validateEmail(customer.email) })); setShowErrors(true); } }}
                                    placeholder="your@email.com"
                                    className={`w-full p-3.5 bg-[var(--t-bg-2)] border text-[var(--t-text)] placeholder-[var(--t-text-3)] focus:outline-none transition-all text-sm ${showErrors && fieldErrors.email ? 'border-red-400 focus:border-red-500' : 'border-[var(--t-border)] focus:border-[var(--t-accent-2)]'}`}
                                />
                                {showErrors && fieldErrors.email && <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>}
                            </div>

                            <div>
                                <label className="block text-[var(--t-text-2)] mb-1.5 text-xs uppercase tracking-widest">Notes (Optional)</label>
                                <textarea
                                    value={customer.notes}
                                    onChange={(e) => setCustomer(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Any special requests..."
                                    rows={3}
                                    className="w-full p-3.5 bg-[var(--t-bg-2)] border border-[var(--t-border)] text-[var(--t-text)] placeholder-[var(--t-text-3)] focus:border-[var(--t-accent-2)] focus:outline-none transition-all resize-none text-sm"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 mt-6">
                            <button
                                onClick={goBack}
                                className="flex items-center gap-2 px-5 py-2.5 border border-[var(--t-border-2)] text-[var(--t-text-2)] hover:border-[var(--t-text)] hover:text-[var(--t-text)] transition-all text-sm"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="square" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back
                            </button>
                            <button
                                onClick={() => { if (validateCustomerForm()) goNext(); }}
                                disabled={!canProceed()}
                                className={`flex items-center gap-2 px-6 py-2.5 font-medium text-sm tracking-wider uppercase transition-all ${canProceed() ? 'bg-[var(--t-accent)] text-white hover:bg-[#8F7B6C]' : 'bg-[var(--t-border)] text-[var(--t-text-3)] cursor-not-allowed'}`}
                            >
                                Continue
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="square" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                );

            case 4: // OTP Verification
                return (
                    <div className="space-y-6">
                        <div className="mb-6">
                            <p className="t-script text-[var(--t-accent-2)] mb-1" style={{ fontSize: '1.1rem' }}>Step Four</p>
                            <h3 className="t-display font-light text-[var(--t-text)]" style={{ fontSize: 'clamp(1.4rem, 2.5vw, 2rem)' }}>Verify Your Phone</h3>
                            <p className="text-[var(--t-text-2)] text-sm mt-1">We&apos;ll send a code to {customer.phone}</p>
                        </div>

                        <div className="max-w-md mx-auto space-y-5">
                            {!otpSent ? (
                                <div className="text-center pt-4">
                                    <button
                                        onClick={sendOtp}
                                        disabled={otpLoading}
                                        className="px-8 py-3 bg-[var(--t-accent)] text-[var(--t-text)] font-medium text-sm tracking-wider uppercase hover:bg-[#8F7B6C] transition-all disabled:opacity-50"
                                    >
                                        {otpLoading ? (
                                            <span className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-[var(--t-text)] border-t-transparent rounded-full animate-spin"></div>
                                                Sending...
                                            </span>
                                        ) : 'Send Verification Code'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-[var(--t-bg-2)] p-4 text-center border-l-2 border-[var(--t-accent-2)]">
                                        <p className="text-[var(--t-accent-2)] text-sm">✓ Verification code sent to {customer.phone}</p>
                                    </div>

                                    <div>
                                        <label className="block text-[var(--t-text-2)] mb-2 text-xs uppercase tracking-widest text-center">Enter 6-digit code</label>
                                        <input
                                            type="text"
                                            value={otpValue}
                                            onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            placeholder="000000"
                                            maxLength={6}
                                            className="w-full p-4 bg-[var(--t-bg-2)] border border-[var(--t-border)] text-[var(--t-text)] text-center text-2xl tracking-[0.5em] font-mono placeholder-[var(--t-text-3)] focus:border-[var(--t-accent-2)] focus:outline-none transition-all"
                                        />
                                    </div>

                                    <button
                                        onClick={verifyOtp}
                                        disabled={otpLoading || otpValue.length !== 6}
                                        className={`w-full py-3 font-medium text-sm tracking-wider uppercase transition-all ${otpValue.length === 6 ? 'bg-[var(--t-accent)] text-white hover:bg-[#8F7B6C]' : 'bg-[var(--t-border)] text-[var(--t-text-3)] cursor-not-allowed'}`}
                                    >
                                        {otpLoading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <div className="w-4 h-4 border-2 border-[var(--t-text)] border-t-transparent rounded-full animate-spin"></div>
                                                Verifying...
                                            </span>
                                        ) : 'Verify Code'}
                                    </button>

                                    <div className="text-center">
                                        {otpCountdown > 0 ? (
                                            <p className="text-[var(--t-text-3)] text-sm">Resend in {otpCountdown}s</p>
                                        ) : (
                                            <button onClick={sendOtp} disabled={otpLoading} className="text-[var(--t-accent-2)] hover:text-[var(--t-text)] text-sm transition-colors">
                                                Resend verification code
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {otpVerified && (
                                <div className="bg-green-50 p-4 text-center border-l-2 border-green-400">
                                    <p className="text-green-700 font-medium text-sm">✓ Phone verified successfully!</p>
                                </div>
                            )}

                            {otpError && (
                                <div className="bg-red-50 border border-red-200 p-4 text-red-600 text-center text-sm">
                                    {otpError}
                                </div>
                            )}
                        </div>

                        <NavButtons showNext={false} />
                    </div>
                );

            case 5: // Confirmation
                return (
                    <div className="space-y-6">
                        <div className="mb-6">
                            <p className="t-script text-[var(--t-accent-2)] mb-1" style={{ fontSize: '1.1rem' }}>Final Step</p>
                            <h3 className="t-display font-light text-[var(--t-text)]" style={{ fontSize: 'clamp(1.4rem, 2.5vw, 2rem)' }}>
                                Confirm Your {cart.length > 1 ? 'Appointments' : 'Appointment'}
                            </h3>
                            <p className="text-[var(--t-text-2)] text-sm mt-1">Review and submit your booking</p>
                        </div>

                        <div className="max-w-lg mx-auto space-y-3">
                            <div className="bg-[var(--t-bg-2)] p-4 border border-[var(--t-border)]">
                                <p className="t-label text-[var(--t-text-3)] text-[0.6rem] tracking-[0.3em] mb-2">Customer Details</p>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div><span className="text-[var(--t-text-3)]">Name: </span><span className="text-[var(--t-text)]">{customer.name}</span></div>
                                    <div><span className="text-[var(--t-text-3)]">Phone: </span><span className="text-[var(--t-text)]">{customer.phone}</span></div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {cart.map((item, index) => (
                                    <div key={item.id} className="bg-[var(--t-bg-2)] p-4 border border-[var(--t-border)]">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="t-label text-[var(--t-accent-2)] text-[0.6rem] tracking-[0.3em] mb-1">Appointment {index + 1}</p>
                                                <h4 className="font-medium text-[var(--t-text)] text-sm">{item.serviceName}</h4>
                                                <p className="text-xs text-[var(--t-text-2)] mt-0.5">{item.date} at {formatTime(item.time)} · Stylist auto-assigned</p>
                                                <p className="text-xs text-[var(--t-text-3)]">{item.serviceDuration} mins</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[var(--t-accent-2)] font-semibold text-sm">Rs {item.servicePrice}</span>
                                                {cart.length > 1 && (
                                                    <button onClick={() => removeFromCart(item.id)} className="block text-xs text-red-400 hover:text-red-600 mt-1 transition-colors">Remove</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-[var(--t-accent)] p-4 border border-[var(--t-accent)]">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className="text-[var(--t-text)] font-semibold text-sm">Total ({cart.length} appointment{cart.length > 1 ? 's' : ''})</span>
                                        <span className="text-[var(--t-text-2)] text-xs block">{totalDuration} mins</span>
                                    </div>
                                    <span className="text-[var(--t-text)] font-bold text-xl">Rs {totalPrice}</span>
                                </div>
                            </div>

                            <div className="text-center">
                                <button onClick={() => setCurrentStep(1)} className="text-[var(--t-accent-2)] hover:text-[var(--t-text)] text-xs tracking-widest uppercase transition-colors">
                                    + Add Another Appointment
                                </button>
                            </div>

                            {customer.notes && (
                                <div className="bg-[var(--t-bg-2)] p-4 border border-[var(--t-border)]">
                                    <p className="t-label text-[var(--t-text-3)] text-[0.6rem] tracking-[0.3em] mb-1">Notes</p>
                                    <p className="text-[var(--t-text-2)] text-sm">{customer.notes}</p>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="max-w-lg mx-auto bg-red-50 border border-red-200 p-4 text-red-600 text-center text-sm">
                                {error}
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-4 mt-6 max-w-lg mx-auto">
                            <button
                                onClick={goBack}
                                className="flex items-center gap-2 px-5 py-2.5 border border-[var(--t-border-2)] text-[var(--t-text-2)] hover:border-[var(--t-text)] hover:text-[var(--t-text)] transition-all text-sm"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="square" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading || cart.length === 0}
                                className="flex items-center gap-2 px-8 py-2.5 bg-[var(--t-accent)] text-[var(--t-text)] font-medium text-sm tracking-wider uppercase hover:bg-[#8F7B6C] transition-all disabled:opacity-50"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-[var(--t-text)] border-t-transparent rounded-full animate-spin"></div>
                                        Booking...
                                    </>
                                ) : (
                                    <>
                                        Confirm {cart.length} Booking{cart.length > 1 ? 's' : ''}
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="square" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <>
            <section
                ref={sectionRef}
                id="appointment"
                className={`h-[100dvh] w-full bg-[var(--t-bg)] relative z-10 overflow-hidden ${isStandalone ? 'pt-16' : ''}`}
            >
                {/* Desktop Layout */}
                <div className={`h-full flex ${isMobile ? 'hidden' : ''}`}>
                    {/* Left Sidebar */}
                    <div className="w-72 bg-[var(--t-bg-2)] border-r border-[var(--t-border)] p-6 flex flex-col">
                        <div className="mb-6">
                            <Image src={logoLongLight} alt="VG Salon" height={44} className="w-auto" />
                        </div>
                        <p className="t-script text-[var(--t-accent-2)] mb-5" style={{ fontSize: '1rem' }}>Reserve Your Appointment</p>

                        <div className="flex-1">
                            {steps.map((s) => (
                                <div
                                    key={s.id}
                                    className={`flex items-center gap-4 p-3 mb-1 border transition-all cursor-pointer ${currentStep === s.id
                                        ? 'bg-[var(--t-accent)] border-[var(--t-accent)] text-[var(--t-text)]'
                                        : currentStep > s.id
                                            ? 'bg-[var(--t-bg-3)] border-[var(--t-border)] text-[var(--t-text-2)]'
                                            : 'bg-transparent border-transparent text-[var(--t-text-3)]'
                                        }`}
                                    onClick={() => currentStep > s.id && setCurrentStep(s.id)}
                                >
                                    <div className={`w-8 h-8 flex items-center justify-center text-sm border transition-all flex-shrink-0 ${currentStep > s.id
                                        ? 'bg-[var(--t-accent-2)] border-[var(--t-accent-2)] text-white'
                                        : currentStep === s.id
                                            ? 'bg-[var(--t-text)] border-[var(--t-text)] text-[var(--t-accent)]'
                                            : 'bg-transparent border-[var(--t-border)] text-[var(--t-text-3)]'
                                        }`}>
                                        {currentStep > s.id ? '✓' : s.id}
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium tracking-widest uppercase">{s.title}</p>
                                        <p className="text-[0.65rem] opacity-60">{s.subtitle}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Cart Summary */}
                        {cart.length > 0 && (
                            <div className="bg-[var(--t-bg-3)] p-4 border border-[var(--t-border)]">
                                <p className="t-label text-[var(--t-text-3)] mb-2 tracking-[0.3em]">Cart</p>
                                <p className="text-[var(--t-text)] font-medium text-sm">{cart.length} appointment{cart.length > 1 ? 's' : ''}</p>
                                <p className="text-[var(--t-accent-2)] font-semibold">Rs {totalPrice}</p>
                            </div>
                        )}
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-8 overflow-y-auto">
                        <div className="w-full max-w-4xl mx-auto pb-8">
                            {renderStepContent()}
                        </div>
                    </div>
                </div>

                {/* Mobile Layout */}
                <div className={`h-full flex flex-col ${isMobile ? '' : 'hidden'}`}>
                    {/* Mobile Header */}
                    <div className="flex-shrink-0 bg-[var(--t-bg-2)] border-b border-[var(--t-border)] px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                            <Image src={logoLongLight} alt="VG Salon" height={30} className="w-auto" />
                            <div className="flex items-center gap-2">
                                {cart.length > 0 && (
                                    <span className="bg-[var(--t-accent)] text-[var(--t-text)] text-[0.6rem] px-2 py-1 font-medium tracking-wider uppercase">
                                        {cart.length} in cart
                                    </span>
                                )}
                                <span className="t-label text-[var(--t-text-3)] text-[0.6rem]">Step {currentStep}/{steps.length}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {steps.map(s => (
                                <div
                                    key={s.id}
                                    className={`flex-1 h-0.5 transition-all ${currentStep >= s.id ? 'bg-[var(--t-accent-2)]' : 'bg-[var(--t-border-2)]'}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Mobile Content */}
                    <div className="flex-1 overflow-hidden p-4 flex flex-col">
                        <div className="flex-1 overflow-y-auto">
                            {renderStepContent()}
                        </div>
                    </div>
                </div>
            </section>

            {/* Service Configuration Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[var(--t-bg-3)] p-6 max-w-md w-full border border-[var(--t-border-2)] max-h-[80vh] overflow-y-auto shadow-xl">
                        <div className="flex justify-between items-center mb-5">
                            <p className="t-script text-[var(--t-accent-2)]" style={{ fontSize: '1.1rem' }}>Configure Service</p>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-[var(--t-text-3)] hover:text-[var(--t-text)] transition-colors text-lg leading-none"
                            >
                                ✕
                            </button>
                        </div>
                        {renderModalContent()}
                    </div>
                </div>
            )}

            {/* Booking Success Modal */}
            {bookingSuccess && bookingSuccess.show && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[var(--t-bg-3)] p-8 max-w-md w-full border border-[var(--t-border-2)] text-center shadow-xl">
                        {/* Success Icon */}
                        <div className="w-16 h-16 mx-auto mb-5 bg-[var(--t-accent)] flex items-center justify-center">
                            <svg className="w-8 h-8 text-[var(--t-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="square" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>

                        <p className="t-script text-[var(--t-accent-2)] mb-1" style={{ fontSize: '1.2rem' }}>Booking Confirmed</p>
                        <h2 className="t-display font-light text-[var(--t-text)] mb-2" style={{ fontSize: '1.6rem' }}>You&apos;re all set!</h2>
                        <p className="text-[var(--t-text-2)] text-sm mb-6">Your appointment has been successfully booked.</p>

                        <div className="bg-[var(--t-bg-2)] p-4 mb-5 text-left space-y-3 border border-[var(--t-border)]">
                            {bookingSuccess.appointments.map((apt, i) => (
                                <div key={i} className="flex justify-between items-center border-b border-[var(--t-border)] pb-2 last:border-0 last:pb-0">
                                    <div>
                                        <p className="text-[var(--t-text)] font-medium text-sm">{apt.serviceName}</p>
                                        <p className="text-[var(--t-text-2)] text-xs mt-0.5">
                                            {new Date(apt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {formatTime(apt.time)}
                                        </p>
                                    </div>
                                    <span className="text-[var(--t-accent-2)] font-semibold text-sm">Rs {apt.price}</span>
                                </div>
                            ))}
                        </div>

                        <p className="text-[var(--t-text-3)] text-xs mb-6 tracking-wide">Confirmation SMS has been sent to your phone.</p>

                        <div className="space-y-3">
                            <button
                                onClick={() => { setBookingSuccess(null); setCurrentStep(1); }}
                                className="w-full px-6 py-2.5 bg-[var(--t-accent)] text-[var(--t-text)] font-medium text-sm tracking-wider uppercase hover:bg-[#8F7B6C] transition-all"
                            >
                                + Book Another Appointment
                            </button>
                            <a href="/" className="block text-[var(--t-text-3)] hover:text-[var(--t-text)] text-sm transition-colors">
                                Done — Go to Home
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
