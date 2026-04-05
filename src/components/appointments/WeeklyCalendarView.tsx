'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Scissors } from 'lucide-react';
import Button from '@/components/shared/Button';
import { getLocalDateString } from '@/lib/utils';

interface WeeklyCalendarViewProps {
    appointments: any[];
    onAppointmentClick?: (appointment: any) => void;
    currentDate: Date;
    onDateChange: (date: Date) => void;
}

const statusColors: Record<string, { bg: string; border: string; text: string }> = {
    Pending: {
        bg: 'bg-amber-100 dark:bg-amber-900/40',
        border: 'border-l-amber-500',
        text: 'text-amber-800 dark:text-amber-200'
    },
    InProgress: {
        bg: 'bg-purple-100 dark:bg-purple-900/40',
        border: 'border-l-purple-500',
        text: 'text-purple-800 dark:text-purple-200'
    },
    Completed: {
        bg: 'bg-emerald-100 dark:bg-emerald-900/40',
        border: 'border-l-emerald-500',
        text: 'text-emerald-800 dark:text-emerald-200'
    },
    Cancelled: {
        bg: 'bg-red-100 dark:bg-red-900/40',
        border: 'border-l-red-500',
        text: 'text-red-800 dark:text-red-200'
    },
};

// Time slots from 9 AM to 7 PM (30-minute intervals) - compact
const TIME_SLOTS = Array.from({ length: 21 }, (_, i) => {
    const hour = Math.floor(i / 2) + 9;
    const minute = (i % 2) * 30;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

const SLOT_HEIGHT = 28; // Compact height

export default function WeeklyCalendarView({
    appointments,
    onAppointmentClick,
    currentDate,
    onDateChange
}: WeeklyCalendarViewProps) {
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update current time every minute
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    // Get the week's dates (starting from today, for 7 days)
    const weekDates = useMemo(() => {
        const dates: Date[] = [];
        const startDate = new Date(currentDate);

        for (let i = 0; i < 7; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            dates.push(date);
        }
        return dates;
    }, [currentDate]);

    // Get appointments for a specific date
    const getAppointmentsForDate = (date: Date) => {
        const dateStr = getLocalDateString(date);
        return appointments.filter(apt => apt.appointment_date === dateStr);
    };

    // Calculate appointment position and height
    const getAppointmentStyle = (appointment: any) => {
        const [hours, minutes] = appointment.start_time.split(':').map(Number);
        const startMinutes = (hours - 9) * 60 + minutes; // Minutes from 9 AM
        const top = (startMinutes / 30) * SLOT_HEIGHT;
        const height = (appointment.duration / 30) * SLOT_HEIGHT;
        return { top, height: Math.max(height, SLOT_HEIGHT) };
    };

    // Group overlapping appointments
    const getAppointmentColumns = (dayAppointments: any[]) => {
        if (dayAppointments.length === 0) return [];

        // Sort by start time
        const sorted = [...dayAppointments].sort((a, b) => {
            return a.start_time.localeCompare(b.start_time);
        });

        const columns: any[][] = [];

        sorted.forEach(apt => {
            const aptStart = apt.start_time;
            const [h, m] = aptStart.split(':').map(Number);
            const aptStartMins = h * 60 + m;
            const aptEndMins = aptStartMins + apt.duration;

            // Find first column where appointment doesn't overlap
            let placed = false;
            for (let col = 0; col < columns.length; col++) {
                const lastInCol = columns[col][columns[col].length - 1];
                const [lastH, lastM] = lastInCol.start_time.split(':').map(Number);
                const lastEndMins = lastH * 60 + lastM + lastInCol.duration;

                if (aptStartMins >= lastEndMins) {
                    columns[col].push(apt);
                    placed = true;
                    break;
                }
            }

            if (!placed) {
                columns.push([apt]);
            }
        });

        return columns;
    };

    // Determine if appointment should blink
    const shouldBlinkAppointment = (appointment: any) => {
        const status = appointment.status;

        // Always blink cancelled
        if (status === 'Cancelled') {
            return 'appointment-blink-danger';
        }

        // Blink Pending appointments approaching time (within 15 minutes)
        if (status === 'Pending') {
            const [hours, minutes] = appointment.start_time.split(':').map(Number);
            const aptTime = new Date();
            aptTime.setHours(hours, minutes, 0, 0);

            const now = new Date();
            const minutesUntil = (aptTime.getTime() - now.getTime()) / (1000 * 60);

            // Blink if appointment is within 15 minutes and hasn't passed
            if (minutesUntil > 0 && minutesUntil <= 15) {
                return 'appointment-blink-warning';
            }
        }

        return '';
    };

    // Check if date is today
    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    // Get current time position
    const getCurrentTimePosition = () => {
        const now = currentTime;
        const hours = now.getHours();
        const minutes = now.getMinutes();

        if (hours < 9 || hours >= 21) return null;

        const minutesFrom9AM = (hours - 9) * 60 + minutes;
        return (minutesFrom9AM / 30) * SLOT_HEIGHT;
    };

    // Navigate weeks
    const goToPrevWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() - 7);
        onDateChange(newDate);
    };

    const goToNextWeek = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + 7);
        onDateChange(newDate);
    };

    const goToToday = () => {
        onDateChange(new Date());
    };

    // Format week range for header
    const weekRange = useMemo(() => {
        const start = weekDates[0];
        const end = weekDates[6];
        const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
        const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
        const year = end.getFullYear();

        if (startMonth === endMonth) {
            return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${year}`;
        }
        return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${year}`;
    }, [weekDates]);

    const currentTimePos = getCurrentTimePosition();

    return (
        <div className="space-y-2">
            {/* Week Header - Compact inline */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <button
                        onClick={goToPrevWeek}
                        className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </button>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white min-w-[120px] sm:min-w-[160px] text-center">
                        {weekRange}
                    </span>
                    <button
                        onClick={goToNextWeek}
                        className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </button>
                </div>
                <button
                    onClick={goToToday}
                    className="px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded"
                >
                    Today
                </button>
            </div>

            {/* Calendar Grid */}
            <div className="card surface-panel overflow-hidden">
                <div className="overflow-x-auto">
                    <div className="min-w-[720px] md:min-w-[800px]">
                        {/* Day Headers - Compact */}
                        <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                            <div className="p-1.5 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">

                            </div>
                            {weekDates.map((date, idx) => {
                                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                                const dayNum = date.getDate();
                                const today = isToday(date);

                                return (
                                    <div
                                        key={idx}
                                        className={`p-1.5 text-center border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${today ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                                            }`}
                                    >
                                        <div className={`text-[10px] font-medium ${today ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
                                            }`}>
                                            {dayName}
                                        </div>
                                        <div className={`text-sm font-bold ${today
                                            ? 'text-white bg-primary-600 rounded-full w-6 h-6 flex items-center justify-center mx-auto text-xs'
                                            : 'text-gray-900 dark:text-white'
                                            }`}>
                                            {dayNum}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Time Grid */}
                        <div className="relative">
                            {/* Time slots */}
                            {TIME_SLOTS.map((time, idx) => (
                                <div
                                    key={time}
                                    className="grid grid-cols-8 border-b border-gray-100 dark:border-gray-700/50"
                                    style={{ height: SLOT_HEIGHT }}
                                >
                                    {/* Time label */}
                                    <div className="px-1 text-right text-[10px] text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-end">
                                        {idx % 2 === 0 ? (
                                            <span className="font-medium">
                                                {parseInt(time.split(':')[0]) > 12
                                                    ? `${parseInt(time.split(':')[0]) - 12}PM`
                                                    : parseInt(time.split(':')[0]) === 12
                                                        ? '12PM'
                                                        : `${parseInt(time.split(':')[0])}AM`
                                                }
                                            </span>
                                        ) : null}
                                    </div>

                                    {/* Day columns */}
                                    {weekDates.map((date, colIdx) => (
                                        <div
                                            key={colIdx}
                                            className={`relative border-r border-gray-100 dark:border-gray-700/50 last:border-r-0 ${isToday(date) ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''
                                                }`}
                                        />
                                    ))}
                                </div>
                            ))}

                            {/* Current time indicator */}
                            {currentTimePos !== null && (
                                <div
                                    className="absolute left-0 right-0 z-20 pointer-events-none"
                                    style={{ top: currentTimePos }}
                                >
                                    <div className="relative">
                                        <div className="absolute left-[12.5%] right-0 h-0.5 bg-red-500" />
                                        <div className="absolute left-[12.5%] w-3 h-3 bg-red-500 rounded-full -mt-1" />
                                    </div>
                                </div>
                            )}

                            {/* Appointments overlay */}
                            <div className="absolute inset-0 grid grid-cols-8 pointer-events-none">
                                {/* Empty time column */}
                                <div />

                                {/* Day columns with appointments */}
                                {weekDates.map((date, colIdx) => {
                                    const dayAppointments = getAppointmentsForDate(date);
                                    const columns = getAppointmentColumns(dayAppointments);
                                    const totalColumns = columns.length || 1;

                                    return (
                                        <div key={colIdx} className="relative">
                                            {columns.map((col, colIndex) =>
                                                col.map((apt) => {
                                                    const { top, height } = getAppointmentStyle(apt);
                                                    const colors = statusColors[apt.status] || statusColors.Pending;
                                                    const width = 100 / totalColumns;
                                                    const left = colIndex * width;
                                                    const blinkClass = shouldBlinkAppointment(apt);

                                                    return (
                                                        <motion.div
                                                            key={apt.id}
                                                            initial={{ opacity: 0, scale: 0.95 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            className={`absolute pointer-events-auto cursor-pointer rounded-lg border-l-4 ${colors.bg} ${colors.border} ${colors.text} shadow-sm hover:shadow-md transition-all hover:z-30 ${blinkClass}`}
                                                            style={{
                                                                top: top + 2,
                                                                height: height - 4,
                                                                left: `${left + 2}%`,
                                                                width: `${width - 4}%`,
                                                            }}
                                                            onClick={() => onAppointmentClick?.(apt)}
                                                            title={`${apt.customer?.name || 'Customer'} - ${apt.start_time}`}
                                                        >
                                                            <div className="p-1.5 h-full overflow-hidden">
                                                                <div className="flex items-center gap-1 mb-0.5">
                                                                    <User className="h-3 w-3 flex-shrink-0 opacity-70" />
                                                                    <span className="text-xs font-semibold truncate">
                                                                        {apt.customer?.name || 'Customer'}
                                                                    </span>
                                                                </div>
                                                                {height > SLOT_HEIGHT && (
                                                                    <>
                                                                        <div className="flex items-center gap-1 text-[10px] opacity-80">
                                                                            <Clock className="h-2.5 w-2.5" />
                                                                            <span>{apt.start_time?.substring(0, 5)} ({apt.duration}m)</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1 text-[10px] opacity-70 mt-0.5">
                                                                            <Scissors className="h-2.5 w-2.5" />
                                                                            <span className="truncate">{apt.stylist?.name || 'Stylist'}</span>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
