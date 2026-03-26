'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Clock, Sparkles, ChevronRight, AlertCircle } from 'lucide-react';
import { schedulingService } from '@/services/scheduling';

interface TimeSlot {
    time: string;
    available: boolean;
    reason?: string;
}

interface StylistWithSlots {
    stylist: {
        id: string;
        name: string;
        email?: string;
        phone: string;
        specializations?: string[];
    };
    slots: TimeSlot[];
    skillDetails: { id: string; name: string; category: string }[];
}

interface AvailableStylistsViewProps {
    serviceId: string;
    serviceName: string;
    serviceDuration: number;
    date: string;
    onSelect: (stylistId: string, time: string, stylistName: string) => void;
    branchId?: string;
    occupiedSlots?: string[]; // Time slots already selected by other services
}

export default function AvailableStylistsView({
    serviceId,
    serviceName,
    serviceDuration,
    date,
    onSelect,
    branchId,
    occupiedSlots = []
}: AvailableStylistsViewProps) {
    const [loading, setLoading] = useState(true);
    const [stylistsWithSlots, setStylistsWithSlots] = useState<StylistWithSlots[]>([]);
    const [selectedStylist, setSelectedStylist] = useState<string | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);

    useEffect(() => {
        const fetchAvailableStylists = async () => {
            setLoading(true);
            setSelectedStylist(null);
            setSelectedTime(null);

            try {
                // Fetch both detailed availability and consolidated "No Preference" availability
                const [detailedResults, consolidatedSlots] = await Promise.all([
                    schedulingService.getAvailableStylistsWithSlots(
                        serviceId,
                        date,
                        serviceDuration,
                        branchId
                    ),
                    schedulingService.getConsolidatedAvailability(
                        serviceId,
                        date,
                        branchId
                    )
                ]);

                // Create a "No Preference" synthetic stylist entry if there are consolidated slots
                const noPreferenceEntry = consolidatedSlots.length > 0 ? {
                    stylist: {
                        id: 'NO_PREFERENCE',
                        name: 'Any Professional',
                        phone: '', // Placeholder
                        specializations: []
                    },
                    slots: consolidatedSlots,
                    skillDetails: []
                } : null;

                // Add "No Preference" at the start of the list
                setStylistsWithSlots(
                    noPreferenceEntry
                        ? [noPreferenceEntry, ...detailedResults]
                        : detailedResults
                );
            } catch (error) {
                console.error('Error fetching available stylists:', error);
                setStylistsWithSlots([]);
            } finally {
                setLoading(false);
            }
        };

        if (serviceId && date) {
            fetchAvailableStylists();
        }
    }, [serviceId, date, serviceDuration, branchId]);

    const formatTime = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
        });
    };

    // Get slot color based on availability and reason
    const getSlotColor = (slot: TimeSlot, stylistId: string) => {
        if (!slot.available) {
            if (slot.reason === 'Break time') {
                return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 cursor-not-allowed border border-yellow-300 dark:border-yellow-700';
            }
            return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 cursor-not-allowed border border-red-300 dark:border-red-700';
        }
        // Check if slot is occupied by another service
        if (occupiedSlots.includes(slot.time)) {
            return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 ring-2 ring-orange-400 dark:ring-orange-500 cursor-pointer border border-orange-300 dark:border-orange-700 opacity-75';
        }
        if (selectedStylist === stylistId && selectedTime === slot.time) {
            return 'bg-primary-600 text-white ring-2 ring-primary-400 shadow-lg shadow-primary-500/30';
        }
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 cursor-pointer border border-green-300 dark:border-green-700';
    };

    const handleTimeSelect = (stylistId: string, time: string, stylistName: string, available: boolean) => {
        if (!available) return;
        setSelectedStylist(stylistId);
        setSelectedTime(time);
        onSelect(stylistId, time, stylistName);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full"
                />
                <p className="text-gray-500 dark:text-gray-400">
                    Finding available stylists for {serviceName}...
                </p>
            </div>
        );
    }

    if (stylistsWithSlots.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-12 space-y-4"
            >
                <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        No Available Stylists
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                        No stylists with {serviceName} skills are available on {formatDate(date)}.
                        Please try a different date.
                    </p>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Available Stylists
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(date)} • {serviceName}
                    </p>
                </div>
                <span className="px-3 py-1 text-sm font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
                    {stylistsWithSlots.length} stylist{stylistsWithSlots.length !== 1 ? 's' : ''} available
                </span>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-100 dark:bg-green-900/30 rounded border border-green-300 dark:border-green-700" />
                    <span className="text-gray-700 dark:text-gray-300">Available</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 dark:bg-red-900/30 rounded border border-red-300 dark:border-red-700" />
                    <span className="text-gray-700 dark:text-gray-300">Booked</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-yellow-100 dark:bg-yellow-900/30 rounded border border-yellow-300 dark:border-yellow-700" />
                    <span className="text-gray-700 dark:text-gray-300">Break</span>
                </div>
                {occupiedSlots.length > 0 && (
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-orange-100 dark:bg-orange-900/30 rounded border border-orange-300 dark:border-orange-700 ring-2 ring-orange-400" />
                        <span className="text-gray-700 dark:text-gray-300">Other Service</span>
                    </div>
                )}
            </div>

            {/* Stylist Cards */}
            <div className="space-y-4 max-h-[65dvh] overflow-y-auto pr-0 sm:pr-2">
                <AnimatePresence>
                    {stylistsWithSlots.map(({ stylist, slots, skillDetails }, index) => {
                        const availableCount = slots.filter(s => s.available).length;

                        return (
                            <motion.div
                                key={stylist.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`
                                    border rounded-xl p-4 transition-all duration-200
                                    ${selectedStylist === stylist.id
                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500/20'
                                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-600'
                                    }
                                `}
                            >
                                {/* Stylist Info */}
                                <div className="flex items-start gap-3 mb-3">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg ${stylist.id === 'NO_PREFERENCE'
                                        ? 'bg-gradient-to-br from-indigo-400 to-indigo-600'
                                        : 'bg-gradient-to-br from-primary-400 to-primary-600'
                                        }`}>
                                        {stylist.id === 'NO_PREFERENCE' ? <Sparkles className="w-6 h-6" /> : stylist.name.charAt(0)}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                            {stylist.name}
                                            {stylist.id === 'NO_PREFERENCE' && (
                                                <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                                                    Fastest
                                                </span>
                                            )}
                                            {selectedStylist === stylist.id && selectedTime && (
                                                <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                                                    Selected
                                                </span>
                                            )}
                                        </h4>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {skillDetails.slice(0, 4).map((skill) => (
                                                <span
                                                    key={skill.id}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full"
                                                >
                                                    <Sparkles className="w-3 h-3" />
                                                    {skill.name}
                                                </span>
                                            ))}
                                            {skillDetails.length > 4 && (
                                                <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-0.5">
                                                    +{skillDetails.length - 4} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Time Slots */}
                                <div className="mt-3">
                                    <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 mb-2">
                                        <Clock className="w-4 h-4" />
                                        <span>{availableCount} available out of {slots.length} slots</span>
                                    </div>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                                        {slots.map((slot) => (
                                            <motion.button
                                                key={slot.time}
                                                type="button"
                                                whileHover={slot.available ? { scale: 1.05 } : {}}
                                                whileTap={slot.available ? { scale: 0.95 } : {}}
                                                onClick={() => handleTimeSelect(stylist.id, slot.time, stylist.name, slot.available)}
                                                disabled={!slot.available}
                                                className={`px-2 py-2 text-xs font-medium rounded-lg min-h-11 transition-all ${getSlotColor(slot, stylist.id)}`}
                                                title={slot.reason || 'Available'}
                                            >
                                                {formatTime(slot.time)}
                                            </motion.button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Selection Summary */}
            {selectedStylist && selectedTime && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center">
                            <User className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-sm text-green-700 dark:text-green-300">Selected</p>
                            <p className="font-semibold text-green-800 dark:text-green-200">
                                {stylistsWithSlots.find(s => s.stylist.id === selectedStylist)?.stylist.name} at {formatTime(selectedTime)}
                            </p>
                        </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-green-600 dark:text-green-400" />
                </motion.div>
            )}
        </div>
    );
}
