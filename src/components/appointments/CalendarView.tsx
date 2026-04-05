'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User } from 'lucide-react';
import Button from '@/components/shared/Button';
import WeeklyCalendarView from './WeeklyCalendarView';

interface CalendarViewProps {
    appointments: any[];
    onAppointmentClick?: (appointment: any) => void;
    selectedDate?: string; // YYYY-MM-DD format
    onDateChange?: (date: string) => void;
}

type ViewMode = 'week' | 'month' | 'day';

const statusColors = {
    Pending: 'bg-warning-100 border-warning-300 text-warning-800 dark:bg-warning-900/30 dark:border-warning-700 dark:text-warning-200',
    Confirmed: 'bg-primary-100 border-primary-300 text-primary-800 dark:bg-primary-900/30 dark:border-primary-700 dark:text-primary-200',
    InService: 'bg-secondary-100 border-secondary-300 text-secondary-800 dark:bg-secondary-900/30 dark:border-secondary-700 dark:text-secondary-200',
    Completed: 'bg-success-100 border-success-300 text-success-800 dark:bg-success-900/30 dark:border-success-700 dark:text-success-200',
    Cancelled: 'bg-danger-100 border-danger-300 text-danger-800 dark:bg-danger-900/30 dark:border-danger-700 dark:text-danger-200',
    NoShow: 'bg-gray-100 border-gray-300 text-gray-800 dark:bg-gray-900/30 dark:border-gray-700 dark:text-gray-200',
};

export default function CalendarView({ appointments, onAppointmentClick, selectedDate, onDateChange }: CalendarViewProps) {
    const [currentDate, setCurrentDate] = useState(() => {
        if (selectedDate && selectedDate !== 'all') {
            const [year, month, day] = selectedDate.split('-').map(Number);
            return new Date(year, month - 1, day);
        }
        return new Date();
    });
    const [viewMode, setViewMode] = useState<ViewMode>('week');

    // Get calendar data for the current month
    const { days, monthName, year } = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startingDayOfWeek = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        const days: (Date | null)[] = [];

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null);
        }

        // Add all days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(new Date(year, month, day));
        }

        const monthName = firstDay.toLocaleDateString('en-US', { month: 'long' });

        return { days, monthName, year };
    }, [currentDate]);

    // Get appointments for a specific date (timezone-safe)
    const getAppointmentsForDate = (date: Date | null) => {
        if (!date) return [];
        // Create local date string without timezone conversion
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        return appointments.filter(apt => apt.appointment_date === dateStr);
    };

    // Navigation handlers
    const goToPrevious = () => {
        if (viewMode === 'month') {
            setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
        } else {
            setCurrentDate(new Date(currentDate.getTime() - 24 * 60 * 60 * 1000));
        }
    };

    const goToNext = () => {
        if (viewMode === 'month') {
            setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
        } else {
            setCurrentDate(new Date(currentDate.getTime() + 24 * 60 * 60 * 1000));
        }
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    const isToday = (date: Date | null) => {
        if (!date) return false;
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    // Day view: Generate time slots (9 AM to 9 PM)
    const timeSlots = useMemo(() => {
        const slots = [];
        for (let hour = 9; hour <= 21; hour++) {
            slots.push(`${hour.toString().padStart(2, '0')}:00`);
        }
        return slots;
    }, []);

    // Get appointments for a specific time slot
    const getAppointmentsForTimeSlot = (timeSlot: string) => {
        const dayAppointments = getAppointmentsForDate(currentDate);
        return dayAppointments.filter(apt => {
            const aptTime = apt.start_time?.substring(0, 5);
            return aptTime === timeSlot;
        });
    };

    const renderDayView = () => {
        const dayAppointments = getAppointmentsForDate(currentDate);
        const dateString = currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-4 sm:p-6 surface-panel"
            >
                <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{dateString}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{dayAppointments.length} appointments scheduled</p>
                </div>

                <div className="space-y-2">
                    {timeSlots.map((timeSlot) => {
                        const slotAppointments = getAppointmentsForTimeSlot(timeSlot);

                        return (
                            <div key={timeSlot} className="flex gap-3">
                                {/* Time column */}
                                <div className="w-20 flex-shrink-0 pt-2">
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                        {timeSlot}
                                    </span>
                                </div>

                                {/* Appointments column */}
                                <div className="flex-1 min-h-[60px] border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                                    {slotAppointments.length > 0 ? (
                                        <div className="space-y-2">
                                            {slotAppointments.map((apt, idx) => (
                                                <motion.div
                                                    key={apt.id}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    onClick={() => onAppointmentClick?.(apt)}
                                                    className={`
                                                        p-3 rounded-xl border-2 cursor-pointer transition-all
                                                        ${statusColors[apt.status as keyof typeof statusColors] || statusColors.Pending}
                                                        hover:shadow-md hover:scale-[1.02]
                                                    `}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <User className="h-4 w-4 flex-shrink-0" />
                                                                <span className="font-semibold">{apt.customer?.name || 'Unknown'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <Clock className="h-3 w-3" />
                                                                <span>{apt.start_time?.substring(0, 5)} ({apt.duration} min)</span>
                                                            </div>
                                                            <div className="text-xs mt-1">
                                                                <span>with {apt.stylist?.name || 'Stylist'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex-shrink-0">
                                                            <span className="text-xs font-medium px-2 py-1 rounded-lg bg-white/50 dark:bg-black/20">
                                                                {apt.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="h-full flex items-center">
                                            <span className="text-sm text-gray-400 dark:text-gray-600">No appointments</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </motion.div>
        );
    };

    const renderMonthView = () => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-4 sm:p-6 surface-panel"
        >
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-2 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div
                        key={day}
                        className="text-center text-sm font-semibold text-gray-600 dark:text-gray-400 py-2"
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-2">
                {days.map((date, index) => {
                    const dayAppointments = getAppointmentsForDate(date);
                    const today = isToday(date);

                    return (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.01 }}
                            onClick={() => {
                                if (date) {
                                    setCurrentDate(date);
                                    // Notify parent of date change
                                    if (onDateChange) {
                                        const year = date.getFullYear();
                                        const month = String(date.getMonth() + 1).padStart(2, '0');
                                        const day = String(date.getDate()).padStart(2, '0');
                                        onDateChange(`${year}-${month}-${day}`);
                                    }
                                }
                            }}
                            onDoubleClick={() => {
                                if (date) {
                                    setCurrentDate(date);
                                    setViewMode('day');
                                }
                            }}
                            className={`
                                min-h-[100px] sm:min-h-[120px] p-2 rounded-xl border-2 transition-all
                                ${date ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md cursor-pointer' : 'bg-transparent border-transparent'}
                                ${today ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''}
                            `}
                        >
                            {date && (
                                <>
                                    <div className={`
                                        text-sm font-semibold mb-2
                                        ${today ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'}
                                    `}>
                                        {date.getDate()}
                                    </div>
                                    <div className="space-y-1 overflow-y-auto max-h-[60px] sm:max-h-[80px]">
                                        {dayAppointments.slice(0, 3).map((apt, i) => (
                                            <motion.div
                                                key={apt.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onAppointmentClick?.(apt);
                                                }}
                                                className={`
                                                    px-2 py-1 rounded-lg border text-xs truncate
                                                    ${statusColors[apt.status as keyof typeof statusColors] || statusColors.Pending}
                                                    hover:scale-105 transition-transform cursor-pointer
                                                `}
                                            >
                                                <div className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3 flex-shrink-0" />
                                                    <span className="truncate">{apt.start_time?.substring(0, 5)}</span>
                                                </div>
                                            </motion.div>
                                        ))}
                                        {dayAppointments.length > 3 && (
                                            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                                                +{dayAppointments.length - 3} more
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </motion.div>
                    );
                })}
            </div>
        </motion.div>
    );

    // Week view has its own navigation, so we conditionally render
    if (viewMode === 'week') {
        return (
            <WeeklyCalendarView
                appointments={appointments}
                onAppointmentClick={onAppointmentClick}
                currentDate={currentDate}
                onDateChange={(date) => {
                    setCurrentDate(date);
                    if (onDateChange) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        onDateChange(`${year}-${month}-${day}`);
                    }
                }}
            />
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2 sm:gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={goToPrevious}
                        leftIcon={<ChevronLeft className="h-4 w-4" />}
                    />
                    <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white min-w-[140px] sm:min-w-[200px] text-center">
                        {viewMode === 'month'
                            ? `${monthName} ${year}`
                            : currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        }
                    </h2>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={goToNext}
                        rightIcon={<ChevronRight className="h-4 w-4" />}
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={goToToday}
                        leftIcon={<CalendarIcon className="h-4 w-4" />}
                    >
                        Today
                    </Button>

                    {/* View mode selector */}
                    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('week')}
                            className="px-3 py-1 rounded text-sm font-medium transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        >
                            Week
                        </button>
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${viewMode === 'month'
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            Month
                        </button>
                        <button
                            onClick={() => setViewMode('day')}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${viewMode === 'day'
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            Day
                        </button>
                    </div>
                </div>
            </div>

            {/* View Content */}
            <AnimatePresence mode="wait">
                {viewMode === 'month' ? renderMonthView() : renderDayView()}
            </AnimatePresence>

            {/* Legend */}
            <div className="card p-4 surface-panel">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Status Legend</h3>
                <div className="flex flex-wrap gap-3">
                    {Object.entries(statusColors).map(([status, colorClass]) => (
                        <div key={status} className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded border ${colorClass}`} />
                            <span className="text-xs text-gray-600 dark:text-gray-400">{status}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
