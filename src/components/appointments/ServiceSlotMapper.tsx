'use client';

import { Service } from '@/lib/types';
import AvailableStylistsView from './AvailableStylistsView';
import { Scissors, Clock, DollarSign } from 'lucide-react';

interface ServiceSlotMapperProps {
    service: Service;
    date: string;
    onSelect: (stylistId: string, time: string, stylistName: string) => void;
    selectedTime?: string;
    branchId?: string;
    occupiedSlots?: string[]; // Time slots already selected by other services
}

export default function ServiceSlotMapper({
    service,
    date,
    onSelect,
    selectedTime,
    branchId,
    occupiedSlots = []
}: ServiceSlotMapperProps) {
    return (
        <div className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-800/50">
            {/* Service Header */}
            <div className="flex items-start justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <Scissors className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                            {service.name}
                        </h3>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            <span>Rs {service.price.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{service.duration} mins</span>
                        </div>
                        {service.gender && (
                            <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700">
                                {service.gender}
                            </span>
                        )}
                    </div>
                </div>
                {selectedTime && (
                    <div className="flex items-center gap-1 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        ✓ Booked
                    </div>
                )}
            </div>

            {/* Stylist & Time Selection */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Available Stylists & Time Slots
                </label>
                <AvailableStylistsView
                    serviceId={service.id}
                    serviceName={service.name}
                    serviceDuration={service.duration}
                    date={date}
                    onSelect={(stylistId, time, stylistName) => {
                        onSelect(stylistId, time, stylistName);
                    }}
                    branchId={branchId}
                    occupiedSlots={occupiedSlots}
                />
            </div>
        </div>
    );
}
