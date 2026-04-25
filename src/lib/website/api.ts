// API Service Layer for SalonFlow Website
// Direct Supabase queries for public booking functionality

import { supabase, DbService, DbStaff, DbStylistBreak, DbStylistUnavailability, DbSalonSettings } from './supabase';

// Organization scope — all queries are filtered to this org
const ORG_ID = process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? '';

// ============================================
// PUBLIC TYPES
// ============================================

export interface Service {
    id: string;
    name: string;
    description?: string;
    category: string;
    price: number;
    duration: number;
    gender: 'Male' | 'Female' | 'Unisex';
}

export interface Stylist {
    id: string;
    name: string;
    workingDays: string[];
    workingHours: { start: string; end: string };
    skills: { id: string; name: string; category: string }[];
}

export interface TimeSlot {
    time: string;
    available: boolean;
    reason?: string;
}

export interface StylistWithSlots {
    stylist: Stylist;
    skills: { id: string; name: string; category: string }[];
    slots: TimeSlot[];
    availableCount: number;
}

export interface ConsolidatedSlot {
    time: string;
    available: boolean;
    availableStylists?: number;
    reason?: string;
}

export interface ConsolidatedAvailabilityResponse {
    slots: ConsolidatedSlot[];
    service: Service;
    totalStylists: number;
    availableCount: number;
}

export interface StylistAvailabilityResponse {
    slots: TimeSlot[];
    unavailabilityReason?: string;
    stylistName?: string;
}

export interface BookingRequest {
    customer: {
        name: string;
        phone: string;
        email?: string;
        gender?: 'Male' | 'Female' | 'Other';
    };
    appointment: {
        service_id: string;
        stylist_id: string;
        date: string;
        time: string;
        notes?: string;
    };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get salon settings (slot interval, working hours, etc.)
 */
async function getSalonSettings(): Promise<DbSalonSettings> {
    const { data, error } = await supabase
        .from('salon_settings')
        .select('*')
        .eq('organization_id', ORG_ID)
        .limit(1)
        .single();

    if (error || !data) {
        // Return defaults if no settings found
        return {
            id: 'default',
            slot_interval: 30,
            booking_window_days: 30,
            booking_buffer_minutes: 10,
            default_start_time: '09:00',
            default_end_time: '18:00',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
    }

    return data as DbSalonSettings;
}

/**
 * Generate time slots based on salon settings and stylist working hours
 */
function generateTimeSlots(
    startTime: string,
    endTime: string,
    slotInterval: number
): string[] {
    const slots: string[] = [];
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    let currentMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    while (currentMinutes < endMinutes) {
        const hours = Math.floor(currentMinutes / 60);
        const mins = currentMinutes % 60;
        slots.push(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
        currentMinutes += slotInterval;
    }

    return slots;
}

/**
 * Check if a time slot is within a break period
 */
function isInBreak(
    slotTime: string,
    breaks: DbStylistBreak[],
    dayOfWeek: number
): boolean {
    const [slotHour, slotMin] = slotTime.split(':').map(Number);
    const slotMinutes = slotHour * 60 + slotMin;

    return breaks.some(brk => {
        // Check if break applies to this day
        if (brk.day_of_week !== null && brk.day_of_week !== dayOfWeek) {
            return false;
        }

        const [breakStartHour, breakStartMin] = brk.start_time.split(':').map(Number);
        const [breakEndHour, breakEndMin] = brk.end_time.split(':').map(Number);
        const breakStartMinutes = breakStartHour * 60 + breakStartMin;
        const breakEndMinutes = breakEndHour * 60 + breakEndMin;

        return slotMinutes >= breakStartMinutes && slotMinutes < breakEndMinutes;
    });
}

/**
 * Check if an appointment overlaps with a time slot
 */
function isSlotBooked(
    slotTime: string,
    serviceDuration: number,
    appointments: { start_time: string; duration: number }[]
): boolean {
    const [slotHour, slotMin] = slotTime.split(':').map(Number);
    const slotStartMinutes = slotHour * 60 + slotMin;
    const slotEndMinutes = slotStartMinutes + serviceDuration;

    return appointments.some(apt => {
        const [aptHour, aptMin] = apt.start_time.split(':').map(Number);
        const aptStartMinutes = aptHour * 60 + aptMin;
        const aptEndMinutes = aptStartMinutes + apt.duration;

        // Check for overlap: slot overlaps if it starts before apt ends AND ends after apt starts
        return slotStartMinutes < aptEndMinutes && slotEndMinutes > aptStartMinutes;
    });
}

/**
 * Convert database service to API service format
 */
function mapDbServiceToService(dbService: DbService): Service {
    return {
        id: dbService.id,
        name: dbService.name,
        description: dbService.description || undefined,
        category: dbService.category,
        price: dbService.price,
        duration: dbService.duration,
        gender: dbService.gender || 'Unisex',
    };
}

/**
 * Convert database staff to stylist format
 */
function mapDbStaffToStylist(dbStaff: DbStaff, services: DbService[]): Stylist {
    // Map specialization IDs to skill objects
    const skills = (dbStaff.specializations || [])
        .map(serviceId => {
            const service = services.find(s => s.id === serviceId);
            return service ? { id: service.id, name: service.name, category: service.category as string } : null;
        })
        .filter((s): s is { id: string; name: string; category: string } => s !== null);

    return {
        id: dbStaff.id,
        name: dbStaff.name,
        workingDays: dbStaff.working_days || [],
        workingHours: dbStaff.working_hours || { start: '09:00', end: '18:00' },
        skills,
    };
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Get all active services
 */
export async function fetchServices(category?: string, gender?: string): Promise<Service[]> {
    let query = supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .eq('organization_id', ORG_ID)
        .order('category')
        .order('name');

    if (category) {
        query = query.eq('category', category);
    }

    if (gender && gender !== 'Unisex') {
        query = query.or(`gender.eq.${gender},gender.eq.Unisex`);
    }

    const { data, error } = await query;

    if (error) {
        console.error('❌ Error fetching services:', error);
        throw new Error(`Failed to fetch services: ${error.message}`);
    }

    const services = (data as DbService[]).map(mapDbServiceToService);

    return services;
}

/**
 * Get stylists who can perform a specific service
 */
export async function fetchStylistsForService(serviceId: string, date?: string): Promise<Stylist[]> {
    // Get all active stylists for this organization
    const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('is_active', true)
        .eq('role', 'Stylist')
        .eq('organization_id', ORG_ID)
        .not('is_emergency_unavailable', 'is', true);

    if (staffError) {
        console.error('❌ Error fetching stylists:', staffError);
        throw new Error(`Failed to fetch stylists: ${staffError.message}`);
    }

    // Get all services for mapping skills
    const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .eq('organization_id', ORG_ID);

    if (servicesError) {
        console.error('❌ Error fetching services:', servicesError);
        throw new Error(`Failed to fetch services: ${servicesError.message}`);
    }

    const services = servicesData as DbService[];

    // Filter stylists who have the service in their specializations
    const qualifiedStaff = (staffData as DbStaff[]).filter(staff =>
        staff.specializations && staff.specializations.includes(serviceId)
    );

    // If a date is provided, filter out unavailable stylists
    if (date) {
        const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });

        const { data: unavailabilityData } = await supabase
            .from('stylist_unavailability')
            .select('stylist_id')
            .eq('unavailable_date', date);

        const unavailableIds = new Set((unavailabilityData || []).map(u => u.stylist_id));

        const availableStaff = qualifiedStaff.filter(staff => {
            // Check if working on this day
            if (!staff.working_days?.includes(dayOfWeek)) {
                return false;
            }
            // Check if not on unavailability list
            return !unavailableIds.has(staff.id);
        });

        const stylists = availableStaff.map(staff => mapDbStaffToStylist(staff, services));
        return stylists;
    }

    const stylists = qualifiedStaff.map(staff => mapDbStaffToStylist(staff, services));

    return stylists;
}

/**
 * Get time slots for a specific stylist on a date
 */
export async function fetchTimeSlots(
    stylistId: string,
    date: string,
    duration: number
): Promise<StylistAvailabilityResponse> {
    // Get salon settings
    const settings = await getSalonSettings();

    // Get stylist info
    const { data: stylistData, error: stylistError } = await supabase
        .from('staff')
        .select('*')
        .eq('id', stylistId)
        .eq('organization_id', ORG_ID)
        .single();

    if (stylistError || !stylistData) {
        console.error('❌ Error fetching stylist:', stylistError);
        throw new Error('Stylist not found');
    }

    const stylist = stylistData as DbStaff;
    const workingHours = {
        start: stylist.working_hours?.start || settings.default_start_time || '09:00',
        end: stylist.working_hours?.end || settings.default_end_time || '18:00',
    };

    // Get day of week (0 = Sunday, 1 = Monday, etc.)
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

    // Check if stylist works on this day
    if (!stylist.working_days?.includes(dayName)) {
        return {
            slots: [],
            unavailabilityReason: `${stylist.name} doesn't work on ${dayName}s`,
            stylistName: stylist.name,
        };
    }

    // Check for unavailability (holiday/day off)
    const { data: unavailData } = await supabase
        .from('stylist_unavailability')
        .select('*')
        .eq('stylist_id', stylistId)
        .eq('unavailable_date', date);

    if (unavailData && unavailData.length > 0) {
        const unavailRecord = unavailData[0] as DbStylistUnavailability;
        const reason = unavailRecord.reason || 'day off';
        return {
            slots: [],
            unavailabilityReason: `${stylist.name} is on ${reason} on this date`,
            stylistName: stylist.name,
        };
    }

    // Get stylist breaks
    const { data: breaksData } = await supabase
        .from('stylist_breaks')
        .select('*')
        .eq('stylist_id', stylistId);

    const breaks = (breaksData || []) as DbStylistBreak[];

    // Get existing appointments for this stylist on this date
    const { data: appointmentsData } = await supabase
        .from('appointments')
        .select('start_time, duration, status')
        .eq('stylist_id', stylistId)
        .eq('appointment_date', date)
        .eq('organization_id', ORG_ID)
        .not('status', 'in', '("Cancelled","NoShow")');

    const appointments = (appointmentsData || []) as { start_time: string; duration: number }[];

    // Generate all time slots
    const allSlots = generateTimeSlots(workingHours.start, workingHours.end, settings.slot_interval);

    // Map to TimeSlot with availability
    const timeSlots: TimeSlot[] = allSlots.map(slotTime => {
        // Check if in break
        if (isInBreak(slotTime, breaks, dayOfWeek)) {
            return { time: slotTime, available: false, reason: 'Break time' };
        }

        // Check if booked
        if (isSlotBooked(slotTime, duration, appointments)) {
            return { time: slotTime, available: false, reason: 'Already booked' };
        }

        return { time: slotTime, available: true };
    });

    return {
        slots: timeSlots,
        stylistName: stylist.name,
    };
}

/**
 * Get consolidated availability for "no preference" booking flow.
 * Uses direct Supabase queries (same pattern as other functions in this file).
 * A slot is available if AT LEAST ONE qualified stylist is free at that time.
 */
export async function fetchConsolidatedAvailability(
    serviceId: string,
    date: string,
    duration?: number
): Promise<ConsolidatedAvailabilityResponse> {
    // Get the service
    const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .eq('organization_id', ORG_ID)
        .single();

    if (serviceError || !serviceData) {
        throw new Error('Service not found');
    }

    const service = mapDbServiceToService(serviceData as DbService);
    const serviceDuration = duration || service.duration;

    // Get all qualified stylists for this service
    const stylists = await fetchStylistsForService(serviceId, date);

    if (stylists.length === 0) {
        return { slots: [], service, totalStylists: 0, availableCount: 0 };
    }

    // Get salon settings for slot interval
    const settings = await getSalonSettings();

    // Use the earliest start / latest end across all stylists
    const startTime = stylists[0]?.workingHours?.start || settings.default_start_time || '09:00';
    const endTime = stylists[0]?.workingHours?.end || settings.default_end_time || '18:00';

    // Generate all possible time slots for the day
    const allSlotTimes = generateTimeSlots(startTime, endTime, settings.slot_interval);

    // Get per-stylist availability in parallel
    const stylistAvailabilities = await Promise.all(
        stylists.map(async stylist => {
            const response = await fetchTimeSlots(stylist.id, date, serviceDuration);
            return { stylistId: stylist.id, slots: response.slots };
        })
    );

    // Consolidate: a slot is available if ANY stylist can take it
    const consolidatedSlots: ConsolidatedSlot[] = allSlotTimes.map(slotTime => {
        const availableCount = stylistAvailabilities.filter(sa =>
            sa.slots.find((s: TimeSlot) => s.time === slotTime && s.available)
        ).length;

        return {
            time: slotTime,
            available: availableCount > 0,
            availableStylists: availableCount,
            reason: availableCount === 0 ? 'No stylists available' : undefined,
        };
    });

    const availableCount = consolidatedSlots.filter(s => s.available).length;

    return { slots: consolidatedSlots, service, totalStylists: stylists.length, availableCount };
}

/**
 * Get ALL available stylists with their time slots
 */
export async function fetchAllStylistsWithAvailability(
    serviceId: string,
    date: string,
    duration?: number
): Promise<StylistWithSlots[]> {
    // Get the service for duration
    const { data: serviceData } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .single();

    const serviceDuration = duration || (serviceData as DbService)?.duration || 30;

    // Get all qualified stylists
    const stylists = await fetchStylistsForService(serviceId, date);

    // Get slots for each stylist
    const stylistsWithSlots = await Promise.all(
        stylists.map(async stylist => {
            const response = await fetchTimeSlots(stylist.id, date, serviceDuration);
            return {
                stylist,
                skills: stylist.skills,
                slots: response.slots,
                availableCount: response.slots.filter((s: TimeSlot) => s.available).length,
            };
        })
    );

    return stylistsWithSlots;
}

/**
 * Create a new booking via the server-side API (handles NO_PREFERENCE dispatch,
 * bypasses RLS, sends SMS/email confirmation).
 * @param booking - The booking request data
 * @param _authClient - Kept for API compatibility (unused — server handles auth)
 */
export async function createBooking(
    booking: BookingRequest,
    _authClient?: any
): Promise<{
    appointmentId: string;
    date: string;
    time: string;
    status: string;
    service: { name: string; duration: number; price: number };
    stylist: { name: string };
}> {
    const orgSlug = process.env.NEXT_PUBLIC_ORGANIZATION_SLUG || 'vasanthi_salon';

    const res = await fetch('/api/public/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            organization_slug: orgSlug,
            customer: booking.customer,
            appointment: booking.appointment,
        }),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to create booking');
    }

    const d = json.data;

    return {
        appointmentId: d.appointmentId,
        date: d.date,
        time: d.time,
        status: d.status,
        service: d.service,
        stylist: d.stylist,
    };
}

/**
 * Create a booking with random stylist assignment.
 * Finds all stylists free at the requested time, picks one at random,
 * then creates the appointment using direct Supabase calls.
 */
export async function createRandomBooking(
    booking: {
        customer: BookingRequest['customer'];
        appointment: Omit<BookingRequest['appointment'], 'stylist_id'>;
    },
    authClient?: any
): Promise<{
    appointmentId: string;
    date: string;
    time: string;
    status: string;
    service: { name: string; duration: number; price: number };
    stylist: { name: string };
}> {
    const client = authClient || supabase;

    // 1. Get service details
    const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select('*')
        .eq('id', booking.appointment.service_id)
        .eq('organization_id', ORG_ID)
        .single();

    if (serviceError || !serviceData) {
        throw new Error('Service not found');
    }

    const service = serviceData as DbService;

    // 2. Get all qualified stylists available on this date
    const stylists = await fetchStylistsForService(booking.appointment.service_id, booking.appointment.date);

    if (stylists.length === 0) {
        throw new Error('No stylists available for this service on this date');
    }

    // 3. Find which stylists are free at the requested time
    const freeStylists: Stylist[] = [];

    await Promise.all(
        stylists.map(async (stylist) => {
            const response = await fetchTimeSlots(stylist.id, booking.appointment.date, service.duration);
            const slot = response.slots.find((s: TimeSlot) => s.time === booking.appointment.time && s.available);
            if (slot) freeStylists.push(stylist);
        })
    );

    if (freeStylists.length === 0) {
        throw new Error('No stylists available at this time slot');
    }

    // 4. Pick a random free stylist
    const selected = freeStylists[Math.floor(Math.random() * freeStylists.length)];

    // 5. Get branch and organization_id from the selected stylist
    const { data: stylistRecord } = await supabase
        .from('staff')
        .select('branch_id, organization_id')
        .eq('id', selected.id)
        .single();

    const organizationId = stylistRecord?.organization_id;
    let branchId = stylistRecord?.branch_id;
    if (!branchId) {
        const { data: branchData } = await supabase
            .from('branches')
            .select('id')
            .eq('is_active', true)
            .limit(1)
            .single();
        branchId = branchData?.id;
    }

    if (!branchId) {
        throw new Error('No active branch found');
    }

    // 6. Get or create customer (organization_id required)
    let customerId: string;

    const { data: existingCustomer } = await client
        .from('customers')
        .select('id')
        .eq('phone', booking.customer.phone)
        .eq('organization_id', ORG_ID)
        .maybeSingle();

    if (existingCustomer) {
        customerId = existingCustomer.id;
        await client.from('customers').update({
            name: booking.customer.name,
            email: booking.customer.email || undefined,
        }).eq('id', customerId);
    } else {
        const { data: newCustomer, error: customerError } = await client
            .from('customers')
            .insert({
                name: booking.customer.name,
                phone: booking.customer.phone,
                email: booking.customer.email || null,
                gender: booking.customer.gender || null,
                is_active: true,
                organization_id: ORG_ID || organizationId,
            })
            .select('id')
            .single();

        if (customerError || !newCustomer) {
            throw new Error(`Failed to create customer: ${customerError?.message}`);
        }

        customerId = newCustomer.id;
    }

    // 7. Create appointment
    const timeParts = booking.appointment.time.split(':');
    const startTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:00`;

    const { data: newAppointment, error: appointmentError } = await client
        .from('appointments')
        .insert({
            customer_id: customerId,
            stylist_id: selected.id,
            branch_id: branchId,
            organization_id: ORG_ID || organizationId,
            services: [booking.appointment.service_id],
            appointment_date: booking.appointment.date,
            start_time: startTime,
            duration: service.duration,
            status: 'Pending',
            notes: booking.appointment.notes || null,
        })
        .select('id, appointment_date, start_time, status')
        .single();

    if (appointmentError || !newAppointment) {
        throw new Error(`Failed to create appointment: ${appointmentError?.message}`);
    }

    const startDisp = typeof newAppointment.start_time === 'string'
        ? newAppointment.start_time.slice(0, 5)
        : booking.appointment.time;

    return {
        appointmentId: newAppointment.id,
        date: newAppointment.appointment_date,
        time: startDisp,
        status: newAppointment.status,
        service: {
            name: service.name,
            duration: service.duration,
            price: service.price,
        },
        stylist: {
            name: selected.name,
        },
    };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format time to 12-hour format
 */
export function formatTime(time: string): string {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Format date to readable format
 */
export function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Get minimum bookable date (today)
 */
export function getMinDate(): string {
    return new Date().toISOString().split('T')[0];
}

/**
 * Check if demo mode is active (always false with direct Supabase)
 */
export function isDemoMode(): boolean {
    return false;
}
