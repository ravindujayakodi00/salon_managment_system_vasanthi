import { supabase } from './supabase';

/**
 * Validation utilities for appointment scheduling
 * Prevents conflicts and double-booking
 */

export interface TimeSlot {
    startTime: string; // HH:MM format
    duration: number;  // minutes
}

export interface ValidationResult {
    isValid: boolean;
    reason?: string;
    conflictType?: 'stylist_busy' | 'customer_stylist_conflict' | 'no_conflict';
    conflictingAppointment?: any;
}

/**
 * Calculate end time from start time and duration
 */
export function getTimeSlotEnd(startTime: string, duration: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
}

/**
 * Check if two time slots overlap
 */
export function doTimeSlotsOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
): boolean {
    // Convert times to minutes for comparison
    const toMinutes = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const start1Min = toMinutes(start1);
    const end1Min = toMinutes(end1);
    const start2Min = toMinutes(start2);
    const end2Min = toMinutes(end2);

    // Check overlap: start1 < end2 AND start2 < end1
    return start1Min < end2Min && start2Min < end1Min;
}

/**
 * Check if stylist is available for a time slot
 */
export async function isStylistAvailable(params: {
    stylistId: string;
    date: string;
    startTime: string;
    duration: number;
    excludeAppointmentId?: string;
    organizationId?: string;
}): Promise<{ available: boolean; conflictingAppointment?: any }> {
    const { stylistId, date, startTime, duration, excludeAppointmentId, organizationId } = params;

    // Get all appointments for this stylist on this date
    let query = supabase
        .from('appointments')
        .select('*')
        .eq('stylist_id', stylistId)
        .eq('appointment_date', date)
        .in('status', ['Pending', 'InProgress']); // Only check active appointments

    if (organizationId) {
        query = query.eq('organization_id', organizationId);
    }

    if (excludeAppointmentId) {
        query = query.neq('id', excludeAppointmentId);
    }

    const { data: existingAppointments, error } = await query;

    if (error) {
        console.error('Error checking stylist availability:', error);
        return { available: true }; // Fail open
    }

    if (!existingAppointments || existingAppointments.length === 0) {
        return { available: true };
    }

    // Check if new slot overlaps with any existing appointment
    const newEnd = getTimeSlotEnd(startTime, duration);

    for (const apt of existingAppointments) {
        const existingEnd = getTimeSlotEnd(apt.start_time, apt.duration);

        if (doTimeSlotsOverlap(startTime, newEnd, apt.start_time, existingEnd)) {
            return {
                available: false,
                conflictingAppointment: apt
            };
        }
    }

    return { available: true };
}

/**
 * Check if customer already has appointment with same stylist at overlapping time
 */
export async function hasCustomerStylistConflict(params: {
    customerId: string;
    stylistId: string;
    date: string;
    startTime: string;
    duration: number;
    excludeAppointmentId?: string;
    organizationId?: string;
}): Promise<{ hasConflict: boolean; conflictingAppointment?: any }> {
    const { customerId, stylistId, date, startTime, duration, excludeAppointmentId, organizationId } = params;

    // Get all appointments for this customer with this stylist on this date
    let query = supabase
        .from('appointments')
        .select('*')
        .eq('customer_id', customerId)
        .eq('stylist_id', stylistId)
        .eq('appointment_date', date)
        .in('status', ['Pending', 'InProgress']);

    if (organizationId) {
        query = query.eq('organization_id', organizationId);
    }

    if (excludeAppointmentId) {
        query = query.neq('id', excludeAppointmentId);
    }

    const { data: existingAppointments, error } = await query;

    if (error) {
        console.error('Error checking customer-stylist conflict:', error);
        return { hasConflict: false }; // Fail open
    }

    if (!existingAppointments || existingAppointments.length === 0) {
        return { hasConflict: false };
    }

    // Check if new slot overlaps with any existing appointment
    const newEnd = getTimeSlotEnd(startTime, duration);

    for (const apt of existingAppointments) {
        const existingEnd = getTimeSlotEnd(apt.start_time, apt.duration);

        if (doTimeSlotsOverlap(startTime, newEnd, apt.start_time, existingEnd)) {
            return {
                hasConflict: true,
                conflictingAppointment: apt
            };
        }
    }

    return { hasConflict: false };
}

/**
 * Main validation function - checks all constraints
 */
export async function validateAppointmentSlot(params: {
    stylistId: string;
    customerId: string;
    date: string;
    startTime: string;
    duration: number;
    excludeAppointmentId?: string;
    organizationId?: string;
}): Promise<ValidationResult> {
    const { stylistId, customerId, date, startTime, duration, excludeAppointmentId, organizationId } = params;

    // Check 1: Is stylist available?
    const stylistCheck = await isStylistAvailable({
        stylistId,
        date,
        startTime,
        duration,
        excludeAppointmentId,
        organizationId,
    });

    if (!stylistCheck.available) {
        return {
            isValid: false,
            reason: 'Stylist is already booked at this time',
            conflictType: 'stylist_busy',
            conflictingAppointment: stylistCheck.conflictingAppointment
        };
    }

    // Check 2: Does customer have conflicting appointment with same stylist?
    const customerCheck = await hasCustomerStylistConflict({
        customerId,
        stylistId,
        date,
        startTime,
        duration,
        excludeAppointmentId,
        organizationId,
    });

    if (customerCheck.hasConflict) {
        return {
            isValid: false,
            reason: 'You already have an appointment with this stylist at an overlapping time',
            conflictType: 'customer_stylist_conflict',
            conflictingAppointment: customerCheck.conflictingAppointment
        };
    }

    // All checks passed
    return {
        isValid: true,
        conflictType: 'no_conflict'
    };
}

/**
 * Validate multiple appointments in batch (for multi-service bookings)
 */
export async function validateMultipleAppointments(
    appointments: Array<{
        stylistId: string;
        customerId: string;
        date: string;
        startTime: string;
        duration: number;
    }>,
    organizationId?: string
): Promise<{
    allValid: boolean;
    validations: ValidationResult[];
    firstError?: string;
}> {
    const validations: ValidationResult[] = [];

    for (const apt of appointments) {
        const result = await validateAppointmentSlot({ ...apt, organizationId });
        validations.push(result);

        if (!result.isValid) {
            return {
                allValid: false,
                validations,
                firstError: result.reason
            };
        }
    }

    return {
        allValid: true,
        validations
    };
}

/**
 * Check if appointments are concurrent (same customer, different stylists, overlapping times)
 * This is ALLOWED and can be used to show UI indicators
 */
export function areConcurrentAppointments(
    apt1: TimeSlot & { stylistId: string },
    apt2: TimeSlot & { stylistId: string }
): boolean {
    if (apt1.stylistId === apt2.stylistId) {
        return false; // Same stylist = conflict, not concurrent
    }

    const end1 = getTimeSlotEnd(apt1.startTime, apt1.duration);
    const end2 = getTimeSlotEnd(apt2.startTime, apt2.duration);

    return doTimeSlotsOverlap(apt1.startTime, end1, apt2.startTime, end2);
}
