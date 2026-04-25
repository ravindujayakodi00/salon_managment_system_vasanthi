import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase';
import { resolvePublicOrganizationId, assertBranchInOrganization } from '@/lib/public-tenant';

const supabase = getAdminClient();

interface TimeSlot {
    time: string;
    available: boolean;
    availableStylistCount: number;
}

/**
 * GET /api/public/consolidated-availability
 * 
 * Returns a single merged availability grid for "No Preference" bookings.
 * A slot is available if AT LEAST ONE qualified stylist is free.
 * 
 * Query params:
 * - service_id: (required) The service to book
 * - date: (required) The date to check (YYYY-MM-DD format)
 * - branch_id: (optional) Filter by branch
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const serviceId = searchParams.get('service_id');
        const date = searchParams.get('date');
        const branchId = searchParams.get('branch_id');
        const orgSlug = searchParams.get('organization_slug') || searchParams.get('organization_id');

        const resolved = await resolvePublicOrganizationId(supabase, orgSlug);
        if (!resolved) {
            return NextResponse.json(
                { success: false, error: 'organization_slug or organization_id is required and must be valid' },
                { status: 400 }
            );
        }
        const organizationId = resolved.organizationId;

        if (!serviceId || !date) {
            return NextResponse.json(
                { success: false, error: 'service_id and date are required' },
                { status: 400 }
            );
        }

        if (branchId) {
            const ok = await assertBranchInOrganization(supabase, branchId, organizationId);
            if (!ok) {
                return NextResponse.json(
                    { success: false, error: 'Invalid branch for this organization' },
                    { status: 400 }
                );
            }
        }

        // Validate date
        const requestedDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (requestedDate < today) {
            return NextResponse.json(
                { success: false, error: 'Cannot check availability for past dates' },
                { status: 400 }
            );
        }

        // Get service details
        const { data: service, error: serviceError } = await supabase
            .from('services')
            .select('id, name, duration, price, category')
            .eq('id', serviceId)
            .eq('is_active', true)
            .eq('organization_id', organizationId)
            .single();

        if (serviceError || !service) {
            return NextResponse.json(
                { success: false, error: 'Service not found' },
                { status: 404 }
            );
        }

        const serviceDuration = service.duration;
        const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'long' });

        // Get stylists who can perform this service
        let stylistQuery = supabase
            .from('staff')
            .select('id, name, working_days, working_hours, specializations, is_emergency_unavailable')
            .eq('role', 'Stylist')
            .eq('is_active', true)
            .eq('is_emergency_unavailable', false)
            .eq('organization_id', organizationId)
            .contains('specializations', [serviceId]);

        if (branchId) {
            stylistQuery = stylistQuery.eq('branch_id', branchId);
        }

        const { data: stylists, error: stylistError } = await stylistQuery;

        if (stylistError) {
            console.error('Error fetching stylists:', stylistError);
            return NextResponse.json(
                { success: false, error: 'Failed to fetch stylists' },
                { status: 500 }
            );
        }

        if (!stylists || stylists.length === 0) {
            return NextResponse.json({
                success: true,
                data: [],
                service: service,
                message: 'No stylists available for this service'
            });
        }

        // Get unavailability records for all stylists
        const stylistIds = stylists.map(s => s.id);
        const { data: unavailability } = await supabase
            .from('stylist_unavailability')
            .select('stylist_id')
            .in('stylist_id', stylistIds)
            .eq('unavailable_date', date);

        const unavailableIds = new Set(unavailability?.map(u => u.stylist_id) || []);

        // Get salon settings
        const { data: settings } = await supabase
            .from('salon_settings')
            .select('slot_interval')
            .eq('organization_id', organizationId)
            .maybeSingle();

        const slotInterval = settings?.slot_interval || 30;

        const defaultWorkingStartMinutes = 9 * 60; // 09:00
        const defaultWorkingEndMinutes = 18 * 60; // 18:00

        // Accept both "HH:MM" and "HH:MM:SS" (and gracefully handle undefined/malformed values).
        const timeToMinutes = (timeValue: unknown): number | null => {
            if (typeof timeValue !== 'string') return null;
            const parts = timeValue.split(':');
            if (parts.length < 2) return null;
            const h = Number(parts[0]);
            const m = Number(parts[1]);
            if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
            return h * 60 + m;
        };

        const workingStartMinutes = (workingHours: any) =>
            timeToMinutes(workingHours?.start) ?? defaultWorkingStartMinutes;
        const workingEndMinutes = (workingHours: any) =>
            timeToMinutes(workingHours?.end) ?? defaultWorkingEndMinutes;

        // Get all breaks for these stylists
        const { data: allBreaks } = await supabase
            .from('stylist_breaks')
            .select('*')
            .in('stylist_id', stylistIds);

        // Get all appointments for these stylists on this date (bypasses RLS with service role key)
        const { data: allAppointments, error: appointmentError } = await supabase
            .from('appointments')
            .select('stylist_id, start_time, duration')
            .eq('organization_id', organizationId)
            .in('stylist_id', stylistIds)
            .eq('appointment_date', date)
            .neq('status', 'Cancelled')
            .neq('status', 'NoShow')
            .neq('status', 'Completed');

        if (appointmentError) {
            console.error('❌ Error fetching appointments:', appointmentError);
        }

        // Find the earliest start and latest end across all stylists
        let globalStartTime = 24 * 60; // Start with end of day
        let globalEndTime = 0; // Start with beginning of day

        const availableStylists = stylists.filter(stylist => {
            // Skip unavailable stylists
            if (unavailableIds.has(stylist.id)) return false;
            // Skip if not working on this day
            if (stylist.working_days && !stylist.working_days.includes(dayOfWeek)) return false;
            return true;
        });

        if (availableStylists.length === 0) {
            return NextResponse.json({
                success: true,
                data: [],
                service: service,
                message: 'No stylists available on this day'
            });
        }

        // Calculate global time range
        for (const stylist of availableStylists) {
            const startTime = workingStartMinutes(stylist.working_hours);
            const endTime = workingEndMinutes(stylist.working_hours);

            globalStartTime = Math.min(globalStartTime, startTime);
            globalEndTime = Math.max(globalEndTime, endTime);
        }

        // For today, skip past slots
        let currentTime = globalStartTime;
        // Use local date (not UTC) to correctly filter today's past slots
        const now = new Date();
        const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        if (date === localToday) {
            const currentMinutes = now.getHours() * 60 + now.getMinutes() + 30; // 30 min buffer
            currentTime = Math.max(globalStartTime, Math.ceil(currentMinutes / slotInterval) * slotInterval);
        }

        // Generate merged time slots
        const consolidatedSlots: TimeSlot[] = [];

        while (currentTime + serviceDuration <= globalEndTime) {
            const hours = Math.floor(currentTime / 60);
            const minutes = currentTime % 60;
            const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            const slotEnd = currentTime + serviceDuration;

            // Count how many stylists are available at this time
            let availableCount = 0;

            for (const stylist of availableStylists) {
                const stylistStart = workingStartMinutes(stylist.working_hours);
                const stylistEnd = workingEndMinutes(stylist.working_hours);

                // Check if slot is within stylist's working hours
                if (currentTime < stylistStart || slotEnd > stylistEnd) {
                    continue; // Stylist not working at this time
                }

                // Check breaks for this stylist
                const breaks = allBreaks?.filter(b => b.stylist_id === stylist.id) || [];
                let isBreak = false;
                for (const brk of breaks) {
                    const breakStart = timeToMinutes(brk.start_time);
                    const breakEnd = timeToMinutes(brk.end_time);
                    if (breakStart === null || breakEnd === null) continue;

                    if (currentTime < breakEnd && slotEnd > breakStart) {
                        isBreak = true;
                        break;
                    }
                }
                if (isBreak) continue;

                // Check appointments for this stylist
                const appointments = allAppointments?.filter(a => a.stylist_id === stylist.id) || [];
                let isBooked = false;
                for (const apt of appointments) {
                    const aptStart = timeToMinutes(apt.start_time);
                    if (aptStart === null) continue;

                    const aptDurationNum = Number(apt.duration ?? 60);
                    const aptDuration = Number.isFinite(aptDurationNum) ? aptDurationNum : 60; // Use actual duration from appointment
                    const aptEnd = aptStart + aptDuration;

                    if (currentTime < aptEnd && slotEnd > aptStart) {
                        isBooked = true;
                        break;
                    }
                }
                if (isBooked) continue;

                // Stylist is available!
                availableCount++;
            }

            consolidatedSlots.push({
                time: timeString,
                available: availableCount > 0,
                availableStylistCount: availableCount
            });

            currentTime += slotInterval;
        }

        return NextResponse.json({
            success: true,
            service: service,
            date: date,
            dayOfWeek: dayOfWeek,
            data: consolidatedSlots,
            totalSlots: consolidatedSlots.length,
            availableSlots: consolidatedSlots.filter(s => s.available).length,
            qualifiedStylistCount: availableStylists.length
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
