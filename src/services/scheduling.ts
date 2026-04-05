import { supabase } from '@/lib/supabase';
import { getLocalDateString } from '@/lib/utils';

interface TimeSlot {
    time: string;
    available: boolean;
    reason?: string;
}

interface SalonSettings {
    slot_interval: number;
    booking_window_days: number;
    booking_buffer_minutes: number;
    default_start_time: string;
    default_end_time: string;
    enable_tax: boolean;
    tax_rate: number;
    /** Max full-day holidays per staff per calendar year; null/undefined = no limit */
    max_full_day_holidays_per_year: number | null;
}

export interface StylistBreak {
    id?: string;
    stylist_id: string;
    day_of_week?: number;
    start_time: string;
    end_time: string;
    is_recurring: boolean;
    created_at?: string;
}

function logPostgrestError(context: string, error: unknown) {
    const e = error as { message?: string; code?: string; details?: string; hint?: string };
    console.error(context, {
        message: e?.message,
        code: e?.code,
        details: e?.details,
        hint: e?.hint,
    });
}

export const schedulingService = {
    /**
     * Get salon settings for the current organization (must pass organization_id from auth profile).
     */
    async getSalonSettings(organizationId?: string | null): Promise<SalonSettings> {
        const defaults: SalonSettings = {
            slot_interval: 30,
            booking_window_days: 30,
            booking_buffer_minutes: 10,
            default_start_time: '09:00',
            default_end_time: '18:00',
            enable_tax: false,
            tax_rate: 0,
            max_full_day_holidays_per_year: null,
        };

        const oid = organizationId?.trim();
        if (!oid) {
            return defaults;
        }

        try {
            const { data: row, error } = await supabase
                .from('salon_settings')
                .select('*')
                .eq('organization_id', oid)
                .maybeSingle();

            if (error) {
                logPostgrestError('Error fetching salon settings:', error);
                return defaults;
            }

            if (!row) {
                return defaults;
            }

            return { ...defaults, ...row };
        } catch (error) {
            logPostgrestError('Error fetching salon settings:', error);
            return defaults;
        }
    },

    /**
     * Update salon settings (Owner only)
     */
    async updateSalonSettings(
        settings: Partial<SalonSettings>,
        organizationId?: string | null
    ): Promise<{ success: boolean; message: string }> {
        const oid = organizationId?.trim();
        if (!oid) {
            return { success: false, message: 'Missing organization. Please sign in again.' };
        }

        try {
            const { data: existingRow, error: fetchError } = await supabase
                .from('salon_settings')
                .select('id')
                .eq('organization_id', oid)
                .maybeSingle();

            if (fetchError) {
                logPostgrestError('Error fetching existing settings:', fetchError);
                throw fetchError;
            }

            if (!existingRow) {
                const { error: insertError } = await supabase.from('salon_settings').insert({
                    organization_id: oid,
                    slot_interval: settings.slot_interval ?? 30,
                    booking_window_days: settings.booking_window_days ?? 30,
                    booking_buffer_minutes: settings.booking_buffer_minutes ?? 10,
                    default_start_time: settings.default_start_time ?? '09:00',
                    default_end_time: settings.default_end_time ?? '18:00',
                    enable_tax: settings.enable_tax ?? false,
                    tax_rate: settings.tax_rate ?? 0,
                    max_full_day_holidays_per_year: settings.max_full_day_holidays_per_year ?? null,
                });

                if (insertError) throw insertError;
                return { success: true, message: 'Settings created successfully' };
            }

            const { error: updateError } = await supabase
                .from('salon_settings')
                .update(settings)
                .eq('id', existingRow.id)
                .eq('organization_id', oid);

            if (updateError) throw updateError;

            return { success: true, message: 'Settings updated successfully' };
        } catch (error: unknown) {
            console.error('Error updating settings:', error);
            const message = error instanceof Error ? error.message : 'Failed to update settings';
            return { success: false, message };
        }
    },

    /**
     * Get available time slots for a stylist on a specific date
     */
    async getAvailableTimeSlots(
        stylistId: string,
        date: string,
        serviceDuration: number
    ): Promise<TimeSlot[]> {
        try {
            // 1. Resolve org from stylist (required for per-tenant salon_settings)
            const { data: staffRow } = await supabase
                .from('staff')
                .select('organization_id, working_hours, working_days, is_emergency_unavailable')
                .eq('id', stylistId)
                .maybeSingle();

            if (!staffRow?.organization_id) return [];

            const settings = await this.getSalonSettings(staffRow.organization_id);
            if (!settings) return [];

            const stylist = {
                working_hours: staffRow.working_hours,
                working_days: staffRow.working_days,
                is_emergency_unavailable: staffRow.is_emergency_unavailable,
            };

            // Check for emergency unavailability
            const today = getLocalDateString();
            if (stylist.is_emergency_unavailable && date >= today) {

                return [];
            }

            // Check if stylist works on this day
            const [year, month, day] = date.split('-').map(Number);
            const dateObj = new Date(year, month - 1, day); // Local midnight
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
            if (stylist.working_days && !stylist.working_days.includes(dayName)) {

                return [];
            }

            // Working hours can be either flat {start, end} or by day {Monday: {start, end}, ...}
            let dayHours = stylist.working_hours;
            if (dayHours && dayHours[dayName]) {
                dayHours = dayHours[dayName];
            }
            const workingHours = dayHours || {
                start: settings.default_start_time,
                end: settings.default_end_time
            };

            // Ensure we have valid start/end times
            if (!workingHours.start || !workingHours.end) {
                workingHours.start = settings.default_start_time;
                workingHours.end = settings.default_end_time;
            }


            // 3. Get stylist breaks for this day
            const dayOfWeek = dateObj.getDay();
            const { data: breaks } = await supabase
                .from('stylist_breaks')
                .select('start_time, end_time')
                .eq('stylist_id', stylistId)
                .or(`day_of_week.eq.${dayOfWeek},day_of_week.is.null`)
                .eq('is_recurring', true);


            // 4. Get stylist availability (leaves/holidays)
            const dayStart = `${date}T00:00:00`;
            const dayEnd = `${date}T23:59:59`;

            const { data: availability } = await supabase
                .from('stylist_availability')
                .select('start_time, end_time, type, reason')
                .eq('stylist_id', stylistId)
                .or(`start_time.lte.${dayEnd},end_time.gte.${dayStart}`);



            // 5. Get existing appointments
            const { data: appointments, error: aptError } = await supabase
                .rpc('get_stylist_appointments_for_scheduling', {
                    p_stylist_id: stylistId,
                    p_date: date
                });



            // 6. Generate time slots
            const slots: TimeSlot[] = [];
            const interval = settings.slot_interval;
            const buffer = settings.booking_buffer_minutes;

            const timeToMinutes = (time: string) => {
                const [hours, minutes] = time.split(':').map(Number);
                return hours * 60 + minutes;
            };

            const minutesToTime = (minutes: number) => {
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
            };

            const startMinutes = timeToMinutes(workingHours.start);
            const endMinutes = timeToMinutes(workingHours.end);

            // Helper to get minutes from ISO string for the CURRENT date being processed
            const getMinutesFromDate = (isoString: string) => {
                const d = new Date(isoString);
                return d.getHours() * 60 + d.getMinutes();
            };

            for (let minutes = startMinutes; minutes < endMinutes; minutes += interval) {
                const slotTime = minutesToTime(minutes);
                const slotEndMinutes = minutes + serviceDuration + buffer;
                const serviceEndMinutes = minutes + serviceDuration; // Without buffer for end-of-day check

                let available = true;
                let reason = '';

                // Check if the service (NOT including buffer) fits within working hours
                // Buffer is only for spacing between appointments, not for end of day
                if (serviceEndMinutes > endMinutes) {
                    available = false;
                    reason = 'Outside working hours';
                }

                // Check breaks
                if (available && breaks && breaks.length > 0) {
                    for (const breakTime of breaks) {
                        const breakStart = timeToMinutes(breakTime.start_time);
                        const breakEnd = timeToMinutes(breakTime.end_time);

                        if (
                            (minutes >= breakStart && minutes < breakEnd) ||
                            (slotEndMinutes > breakStart && slotEndMinutes <= breakEnd) ||
                            (minutes < breakStart && slotEndMinutes > breakEnd)
                        ) {
                            available = false;
                            reason = 'Break time';
                            break;
                        }
                    }
                }

                // Check availability/leaves
                if (available && availability && availability.length > 0) {
                    for (const record of availability) {
                        const recStartStr = record.start_time.split('T')[0];
                        const recEndStr = record.end_time.split('T')[0];

                        let recStartMinutes = 0;
                        let recEndMinutes = 24 * 60;

                        if (recStartStr > date) continue;
                        if (recEndStr < date) continue;

                        if (recStartStr === date) {
                            recStartMinutes = getMinutesFromDate(record.start_time);
                        }
                        if (recEndStr === date) {
                            recEndMinutes = getMinutesFromDate(record.end_time);
                        }

                        if (
                            (minutes >= recStartMinutes && minutes < recEndMinutes) ||
                            (slotEndMinutes > recStartMinutes && slotEndMinutes <= recEndMinutes) ||
                            (minutes < recStartMinutes && slotEndMinutes > recEndMinutes)
                        ) {
                            available = false;
                            reason = record.type === 'holiday' ? 'Holiday' :
                                record.type === 'half_day' ? 'Half Day Leave' :
                                    record.type === 'emergency' ? 'Unavailable (Emergency)' :
                                        'Unavailable';
                            break;
                        }
                    }
                }

                // Check appointments
                if (available && appointments && appointments.length > 0) {
                    for (const apt of appointments) {
                        const aptStart = timeToMinutes(apt.start_time);
                        const aptEnd = aptStart + apt.duration;
                        const newAppointmentEnd = slotEndMinutes - buffer;

                        const wouldOverlap = (
                            (minutes >= aptStart && minutes < aptEnd) ||
                            (newAppointmentEnd > aptStart && newAppointmentEnd <= aptEnd) ||
                            (minutes < aptStart && newAppointmentEnd > aptEnd)
                        );

                        if (wouldOverlap) {
                            available = false;
                            reason = 'Already booked';
                            break;
                        }
                    }
                }

                slots.push({
                    time: slotTime,
                    available,
                    ...(reason && { reason })
                });
            }

            return slots;
        } catch (error) {
            console.error('❌ Error getting time slots:', error);
            return [];
        }
    },

    /**
     * Get stylist breaks
     */
    async getStylistBreaks(stylistId: string): Promise<StylistBreak[]> {
        try {
            const { data, error } = await supabase
                .from('stylist_breaks')
                .select('*')
                .eq('stylist_id', stylistId)
                .order('day_of_week')
                .order('start_time');

            if (error) throw error;
            return (data as StylistBreak[]) || [];
        } catch (error) {
            console.error('Error fetching breaks:', error);
            return [];
        }
    },

    /**
     * Add or update break
     */
    async upsertBreak(breakData: Partial<StylistBreak>): Promise<{ success: boolean; message: string }> {
        try {
            const { error } = await supabase
                .from('stylist_breaks')
                .upsert(breakData);

            if (error) throw error;

            return { success: true, message: 'Break saved successfully' };
        } catch (error: unknown) {
            console.error('Error saving break:', error);
            const message = error instanceof Error ? error.message : 'Failed to save break';
            return { success: false, message };
        }
    },

    /**
     * Delete break
     */
    async deleteBreak(breakId: string): Promise<{ success: boolean; message: string }> {
        try {
            const { error } = await supabase
                .from('stylist_breaks')
                .delete()
                .eq('id', breakId);

            if (error) throw error;

            return { success: true, message: 'Break deleted successfully' };
        } catch (error: unknown) {
            console.error('Error deleting break:', error);
            const message = error instanceof Error ? error.message : 'Failed to delete break';
            return { success: false, message };
        }
    },

    /**
     * Get all available stylists with their time slots for a given service and date
     * Used for walk-in customers who don't have a specific stylist preference
     */
    /**
     * Get all available stylists with their time slots for a given service and date
     * Used for walk-in customers who don't have a specific stylist preference
     */
    async getAvailableStylistsWithSlots(
        serviceId: string,
        date: string,
        serviceDuration: number,
        branchId?: string
    ): Promise<{ stylist: any; slots: TimeSlot[]; skillDetails: any[] }[]> {
        try {
            console.log('🔍 getAvailableStylistsWithSlots called (via API):', { serviceId, date, serviceDuration, branchId });

            const params = new URLSearchParams({
                service_id: serviceId,
                date: date,
                duration: serviceDuration.toString()
            });

            if (branchId) {
                params.append('branch_id', branchId);
            }
            params.append(
                'organization_slug',
                process.env.NEXT_PUBLIC_ORGANIZATION_SLUG || 'default'
            );

            const response = await fetch(`/api/public/available-stylists?${params.toString()}`);
            if (!response.ok) {
                console.error('API Error:', response.status, response.statusText);
                return [];
            }

            const result = await response.json();

            if (!result.success) {
                console.error('API returned failure:', result.error);
                return [];
            }

            // Transform API response to match component expectations
            /* 
               The component expects: 
               { 
                   stylist: { id, name, ... }, 
                   slots: TimeSlot[], 
                   skillDetails: { id, name, category }[] 
               }
               
               The API returns:
               {
                   stylist: { id, name, ... },
                   slots: TimeSlot[]
               }
               
               We need to fetch skillDetails separately or just stub them for now if the API doesn't return them.
               Looking at previous code, skillDetails are just services the stylist can perform.
               The API `available-stylists` includes `specializations` in the stylist object.
               We can re-fetch services to map names or just rely on the API.
               
               Let's assume the API returns enough info or we can fetch services metadata once.
            */

            // To ensure skillDetails are populated (used for display badges), we might need to fetch service names locally
            // or update the API to return them. For now, let's try to map what we have.

            // Fetch all services map for badges (cached/lightweight)
            const { data: services } = await supabase
                .from('services')
                .select('id, name, category');

            const serviceMap = new Map(services?.map(s => [s.id, s]) || []);

            return result.data.map((item: any) => {
                const skillDetails = (item.stylist.specializations || [])
                    .map((id: string) => serviceMap.get(id))
                    .filter(Boolean);

                return {
                    stylist: item.stylist,
                    slots: item.slots,
                    skillDetails: skillDetails
                };
            });

        } catch (error) {
            console.error('❌ Error in getAvailableStylistsWithSlots:', error);
            return [];
        }
    },

    /**
     * Get consolidated availability for "No Preference" bookings
     */
    async getConsolidatedAvailability(
        serviceId: string,
        date: string,
        branchId?: string
    ): Promise<TimeSlot[]> {
        try {
            const params = new URLSearchParams({
                service_id: serviceId,
                date: date
            });

            if (branchId && branchId !== 'undefined') {
                params.append('branch_id', branchId);
            }
            params.append(
                'organization_slug',
                process.env.NEXT_PUBLIC_ORGANIZATION_SLUG || 'default'
            );

            const response = await fetch(`/api/public/consolidated-availability?${params.toString()}`);
            if (!response.ok) return [];

            const result = await response.json();
            if (!result.success) return [];

            return result.data;
        } catch (error) {
            console.error('Error fetching consolidated availability:', error);
            return [];
        }
    },
};
