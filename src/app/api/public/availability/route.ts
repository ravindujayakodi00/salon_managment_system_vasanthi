import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase';
import { resolvePublicOrganizationId } from '@/lib/public-tenant';

const supabase = getAdminClient();

interface TimeSlot {
    time: string;
    available: boolean;
    reason?: string;
}

/**
 * GET /api/public/availability
 * 
 * Returns available time slots for a stylist on a specific date.
 * 
 * Query params:
 * - stylist_id: (required) The stylist to check availability for
 * - date: (required) The date to check (YYYY-MM-DD format)
 * - duration: (required) Service duration in minutes
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const stylistId = searchParams.get('stylist_id');
        const date = searchParams.get('date');
        const duration = parseInt(searchParams.get('duration') || '60', 10);
        const orgSlug = searchParams.get('organization_slug') || searchParams.get('organization_id');

        const resolved = await resolvePublicOrganizationId(supabase, orgSlug);
        if (!resolved) {
            return NextResponse.json(
                { success: false, error: 'organization_slug or organization_id is required and must be valid' },
                { status: 400 }
            );
        }
        const organizationId = resolved.organizationId;

        if (!stylistId || !date) {
            return NextResponse.json(
                { success: false, error: 'stylist_id and date are required' },
                { status: 400 }
            );
        }

        // Check if date is valid and not in the past
        const requestedDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (requestedDate < today) {
            return NextResponse.json(
                { success: false, error: 'Cannot book appointments in the past' },
                { status: 400 }
            );
        }

        // Get stylist details
        const { data: stylist, error: stylistError } = await supabase
            .from('staff')
            .select('id, name, working_days, working_hours, is_emergency_unavailable')
            .eq('id', stylistId)
            .eq('organization_id', organizationId)
            .single();

        if (stylistError || !stylist) {
            return NextResponse.json(
                { success: false, error: 'Stylist not found' },
                { status: 404 }
            );
        }

        // Check if stylist is available on this day
        const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'long' });
        if (stylist.working_days && !stylist.working_days.includes(dayOfWeek)) {
            return NextResponse.json({
                success: true,
                data: [],
                message: `${stylist.name} does not work on ${dayOfWeek}s`
            });
        }

        // Check emergency unavailability
        if (stylist.is_emergency_unavailable) {
            return NextResponse.json({
                success: true,
                data: [],
                message: `${stylist.name} is currently unavailable`
            });
        }

        // Check for leave/holiday
        const { data: unavailability } = await supabase
            .from('stylist_unavailability')
            .select('*')
            .eq('stylist_id', stylistId)
            .eq('unavailable_date', date);

        if (unavailability && unavailability.length > 0) {
            return NextResponse.json({
                success: true,
                data: [],
                message: `${stylist.name} is on leave on this date`
            });
        }

        // Get salon settings for slot interval
        const { data: settings } = await supabase
            .from('salon_settings')
            .select('slot_interval')
            .eq('organization_id', organizationId)
            .maybeSingle();

        const slotInterval = settings?.slot_interval || 30;

        // Get stylist's breaks
        const { data: breaks } = await supabase
            .from('stylist_breaks')
            .select('*')
            .eq('stylist_id', stylistId);

        // Get existing appointments
        const { data: appointments, error: appointmentsError } = await supabase
            .from('appointments')
            .select('start_time, duration')
            .eq('organization_id', organizationId)
            .eq('stylist_id', stylistId)
            .eq('appointment_date', date)
            .neq('status', 'Cancelled')
            .neq('status', 'NoShow')
            .neq('status', 'Completed');

        if (appointmentsError) {
            console.error('❌ Error fetching appointments:', appointmentsError);
        }

        // Generate time slots
        const workingHours = stylist.working_hours || { start: '09:00', end: '18:00' };

        const slots: TimeSlot[] = [];

        const [startHour, startMinute] = workingHours.start.split(':').map(Number);
        const [endHour, endMinute] = workingHours.end.split(':').map(Number);

        const startTime = startHour * 60 + startMinute;
        const endTime = endHour * 60 + endMinute;

        // For today, skip past slots
        let currentTime = startTime;
        // Use local date for today comparison
        const now = new Date();
        const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        if (date === todayLocal) {
            const currentMinutes = now.getHours() * 60 + now.getMinutes() + 30; // 30 min buffer
            currentTime = Math.max(startTime, Math.ceil(currentMinutes / slotInterval) * slotInterval);
        }

        while (currentTime + duration <= endTime) {
            const hours = Math.floor(currentTime / 60);
            const minutes = currentTime % 60;
            const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

            const slotEnd = currentTime + duration;

            // Check if slot conflicts with breaks
            let isBreak = false;
            if (breaks) {
                for (const brk of breaks) {
                    const [bStartH, bStartM] = brk.start_time.split(':').map(Number);
                    const [bEndH, bEndM] = brk.end_time.split(':').map(Number);
                    const breakStart = bStartH * 60 + bStartM;
                    const breakEnd = bEndH * 60 + bEndM;

                    if (currentTime < breakEnd && slotEnd > breakStart) {
                        isBreak = true;
                        break;
                    }
                }
            }

            // Check if slot conflicts with existing appointments
            let isBooked = false;
            if (appointments && !isBreak) {
                for (const apt of appointments) {
                    const [aptH, aptM] = apt.start_time.split(':').map(Number);
                    const aptStart = aptH * 60 + aptM;
                    const aptDuration = apt.duration || 60; // Use actual duration from appointment
                    const aptEnd = aptStart + aptDuration;

                    if (currentTime < aptEnd && slotEnd > aptStart) {
                        isBooked = true;
                        break;
                    }
                }
            }

            slots.push({
                time: timeString,
                available: !isBreak && !isBooked,
                reason: isBreak ? 'Break time' : isBooked ? 'Already booked' : undefined
            });

            currentTime += slotInterval;
        }

        return NextResponse.json({
            success: true,
            data: slots,
            stylist: {
                id: stylist.id,
                name: stylist.name,
                workingHours: workingHours
            },
            availableCount: slots.filter(s => s.available).length,
            total: slots.length
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
