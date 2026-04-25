import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRateLimitKey, checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';
import { resolvePublicOrganizationId, assertBranchInOrganization } from '@/lib/public-tenant';

// Use Service Role Key to bypass RLS for booking operations
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/public/random-book
 *
 * Creates a new appointment with a randomly selected available stylist.
 * No stylist_id required — the system picks one at random from all qualified,
 * available stylists for the requested service, date, and time.
 *
 * Request body:
 * {
 *   organization_slug: string (required)
 *   customer: {
 *     name: string (required)
 *     phone: string (required)
 *     email?: string
 *     gender?: "Male" | "Female" | "Other"
 *   },
 *   appointment: {
 *     service_id: string (required)
 *     date: string (required, YYYY-MM-DD)
 *     time: string (required, HH:MM)
 *     notes?: string
 *     branch_id?: string
 *   }
 * }
 */
export async function POST(request: NextRequest) {
    try {
        // Rate limiting (20 bookings per minute per IP)
        const rateLimitKey = getRateLimitKey(request);
        const { allowed, resetIn } = checkRateLimit(rateLimitKey, 20);
        if (!allowed) {
            return rateLimitResponse(resetIn);
        }

        const body = await request.json();
        const { customer, appointment } = body;

        const orgSlug =
            appointment?.organization_slug ||
            body.organization_slug ||
            appointment?.organization_id ||
            body.organization_id;
        const resolved = await resolvePublicOrganizationId(supabase, orgSlug);
        if (!resolved) {
            return NextResponse.json(
                { success: false, error: 'organization_slug or organization_id is required and must be valid' },
                { status: 400 }
            );
        }
        const organizationId = resolved.organizationId;

        // Validate required fields
        if (!customer?.name || !customer?.phone) {
            return NextResponse.json(
                { success: false, error: 'Customer name and phone are required' },
                { status: 400 }
            );
        }

        if (!appointment?.service_id || !appointment?.date || !appointment?.time) {
            return NextResponse.json(
                { success: false, error: 'Service, date, and time are required' },
                { status: 400 }
            );
        }

        // Validate date is not in the past
        const appointmentDate = new Date(appointment.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (appointmentDate < today) {
            return NextResponse.json(
                { success: false, error: 'Cannot book appointments in the past' },
                { status: 400 }
            );
        }

        // Verify service exists
        const { data: service, error: serviceError } = await supabase
            .from('services')
            .select('id, name, duration, price')
            .eq('id', appointment.service_id)
            .eq('is_active', true)
            .eq('organization_id', organizationId)
            .single();

        if (serviceError || !service) {
            return NextResponse.json(
                { success: false, error: 'Service not found' },
                { status: 404 }
            );
        }

        // ============================================
        // RANDOM ALLOCATION: Find all qualified stylists
        // available at the requested time and pick one at random
        // ============================================

        const dayOfWeek = new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'long' });

        // Get all stylists who can perform this service
        const { data: qualifiedStylists, error: qualifiedError } = await supabase
            .from('staff')
            .select('id, name, branch_id, specializations, working_days, working_hours, is_emergency_unavailable')
            .eq('role', 'Stylist')
            .eq('is_active', true)
            .eq('is_emergency_unavailable', false)
            .eq('organization_id', organizationId)
            .contains('specializations', [appointment.service_id]);

        if (qualifiedError || !qualifiedStylists || qualifiedStylists.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No stylists available for this service' },
                { status: 404 }
            );
        }

        let branchFiltered = qualifiedStylists;
        if (appointment.branch_id) {
            const ok = await assertBranchInOrganization(supabase, appointment.branch_id, organizationId);
            if (!ok) {
                return NextResponse.json(
                    { success: false, error: 'Invalid branch for this organization' },
                    { status: 400 }
                );
            }
            branchFiltered = qualifiedStylists.filter(s => s.branch_id === appointment.branch_id);
        }

        const stylistsWorkingToday = branchFiltered.filter(s =>
            !s.working_days || s.working_days.includes(dayOfWeek)
        );

        if (stylistsWorkingToday.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No stylists available on this day' },
                { status: 404 }
            );
        }

        // Check for unavailability (leave/holiday)
        const stylistIds = stylistsWorkingToday.map(s => s.id);
        const { data: unavailability } = await supabase
            .from('stylist_unavailability')
            .select('stylist_id')
            .in('stylist_id', stylistIds)
            .eq('unavailable_date', appointment.date);

        const unavailableIds = new Set(unavailability?.map(u => u.stylist_id) || []);
        const availableStylists = stylistsWorkingToday.filter(s => !unavailableIds.has(s.id));

        if (availableStylists.length === 0) {
            return NextResponse.json(
                { success: false, error: 'All stylists are unavailable on this date' },
                { status: 404 }
            );
        }

        // Get all breaks for available stylists
        const availableStylistIds = availableStylists.map(s => s.id);
        const { data: allBreaks } = await supabase
            .from('stylist_breaks')
            .select('*')
            .in('stylist_id', availableStylistIds);

        // Get all appointments for these stylists on this date
        const { data: allAppointments } = await supabase
            .from('appointments')
            .select('stylist_id, start_time, duration')
            .in('stylist_id', availableStylistIds)
            .eq('appointment_date', appointment.date)
            .neq('status', 'Cancelled');

        // Calculate requested slot timing
        const [reqHour, reqMinute] = appointment.time.split(':').map(Number);
        const reqStart = reqHour * 60 + reqMinute;
        const reqEnd = reqStart + service.duration;

        // Find stylists who are free at the requested time
        const freeStylists: { stylist: any }[] = [];

        for (const s of availableStylists) {
            const workingHours = s.working_hours || { start: '09:00', end: '18:00' };
            const [startH, startM] = workingHours.start.split(':').map(Number);
            const [endH, endM] = workingHours.end.split(':').map(Number);
            const stylistStart = startH * 60 + startM;
            const stylistEnd = endH * 60 + endM;

            // Check if slot is within working hours
            if (reqStart < stylistStart || reqEnd > stylistEnd) continue;

            // Check breaks
            const breaks = allBreaks?.filter(b => b.stylist_id === s.id) || [];
            let isBreak = false;
            for (const brk of breaks) {
                const [bStartH, bStartM] = brk.start_time.split(':').map(Number);
                const [bEndH, bEndM] = brk.end_time.split(':').map(Number);
                const breakStart = bStartH * 60 + bStartM;
                const breakEnd = bEndH * 60 + bEndM;
                if (reqStart < breakEnd && reqEnd > breakStart) {
                    isBreak = true;
                    break;
                }
            }
            if (isBreak) continue;

            // Check appointments
            const appointments = allAppointments?.filter(a => a.stylist_id === s.id) || [];
            let isBooked = false;
            for (const apt of appointments) {
                const [aptH, aptM] = apt.start_time.split(':').map(Number);
                const aptStart = aptH * 60 + aptM;
                const aptDuration = apt.duration || 60;
                const aptEnd = aptStart + aptDuration;
                if (reqStart < aptEnd && reqEnd > aptStart) {
                    isBooked = true;
                    break;
                }
            }
            if (isBooked) continue;

            freeStylists.push({ stylist: s });
        }

        if (freeStylists.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No stylists available at this time' },
                { status: 409 }
            );
        }

        // RANDOM ALLOCATION: Pick a random stylist from the free list
        const randomIndex = Math.floor(Math.random() * freeStylists.length);
        const stylist = freeStylists[randomIndex].stylist;
        const selectedStylistId = stylist.id;

        // Find or create customer
        let customerId: string;
        const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('phone', customer.phone)
            .eq('organization_id', organizationId)
            .maybeSingle();

        if (existingCustomer) {
            customerId = existingCustomer.id;

            // Update customer details if provided
            await supabase
                .from('customers')
                .update({
                    name: customer.name,
                    email: customer.email || undefined,
                    gender: customer.gender || undefined
                })
                .eq('id', customerId);
        } else {
            // Create new customer
            const { data: newCustomer, error: customerError } = await supabase
                .from('customers')
                .insert({
                    name: customer.name,
                    phone: customer.phone,
                    email: customer.email || null,
                    gender: customer.gender || 'Other',
                    is_active: true,
                    organization_id: organizationId
                })
                .select('id')
                .single();

            if (customerError) {
                console.error('Error creating customer:', customerError);
                return NextResponse.json(
                    { success: false, error: 'Failed to create customer' },
                    { status: 500 }
                );
            }

            customerId = newCustomer.id;
        }

        const branchId = stylist.branch_id;
        if (!branchId) {
            return NextResponse.json(
                { success: false, error: 'Stylist has no branch assigned' },
                { status: 400 }
            );
        }

        const timeParts = appointment.time.split(':');
        const startTime =
            timeParts.length >= 2
                ? `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:00`
                : appointment.time;

        const { data: newAppointment, error: appointmentError } = await supabase
            .from('appointments')
            .insert({
                customer_id: customerId,
                stylist_id: selectedStylistId,
                branch_id: branchId,
                services: [appointment.service_id],
                appointment_date: appointment.date,
                start_time: startTime,
                duration: service.duration,
                status: 'Pending',
                notes: appointment.notes || null
            })
            .select('id, appointment_date, start_time, status')
            .single();

        if (appointmentError) {
            console.error('Error creating appointment:', appointmentError);
            return NextResponse.json(
                { success: false, error: 'Failed to create appointment' },
                { status: 500 }
            );
        }

        // ============================================
        // SEND BOOKING CONFIRMATION NOTIFICATIONS
        // ============================================
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                process.env.NEXT_PUBLIC_SITE_URL || 'https://www.salonflow.space');
        const formattedDate = new Date(appointment.date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Send SMS confirmation
        if (customer.phone) {
            try {
                const { createTextLkService } = await import('@/services/textlk');
                const apiKey = process.env.TEXT_LK_API_KEY;
                const senderId = process.env.TEXT_LK_SENDER_ID;

                if (apiKey && senderId) {
                    const textlk = createTextLkService(apiKey, senderId);
                    const smsMessage = `✅ Booking Confirmed!\n\n📅 ${formattedDate}\n⏰ ${appointment.time}\n💇 ${service.name}\n👤 Stylist: ${stylist.name}\n\nThank you for choosing our salon!`;
                    await textlk.sendSMS(customer.phone, smsMessage);
                } else {
                    console.error('❌ SMS config missing: TEXT_LK_API_KEY or TEXT_LK_SENDER_ID');
                }
            } catch (smsError) {
                console.error('Failed to send SMS confirmation:', smsError);
            }
        }

        // Send Email confirmation
        if (customer.email) {
            try {
                const emailHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #B9A594;">✅ Booking Confirmed!</h2>
                        <p>Hi ${customer.name},</p>
                        <p>Your appointment has been successfully booked.</p>

                        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #374151;">Appointment Details</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0;"><strong>📅 Date:</strong></td>
                                    <td style="padding: 8px 0;">${formattedDate}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0;"><strong>⏰ Time:</strong></td>
                                    <td style="padding: 8px 0;">${appointment.time}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0;"><strong>💇 Service:</strong></td>
                                    <td style="padding: 8px 0;">${service.name} (${service.duration} mins)</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0;"><strong>👤 Stylist:</strong></td>
                                    <td style="padding: 8px 0;">${stylist.name}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0;"><strong>💰 Price:</strong></td>
                                    <td style="padding: 8px 0;">Rs. ${service.price}</td>
                                </tr>
                            </table>
                        </div>

                        <p style="color: #6b7280; font-size: 14px;">
                            If you need to reschedule or cancel, please contact us in advance.
                        </p>

                        <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">
                            Thank you for choosing our salon!
                        </p>
                    </div>
                `;

                await fetch(`${baseUrl}/api/send-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: customer.email,
                        subject: `✅ Booking Confirmed - ${formattedDate} at ${appointment.time}`,
                        html: emailHtml
                    })
                });
            } catch (emailError) {
                console.error('Failed to send email confirmation:', emailError);
            }
        }

        const startDisp =
            typeof newAppointment.start_time === 'string'
                ? newAppointment.start_time.slice(0, 5)
                : appointment.time;

        return NextResponse.json({
            success: true,
            message: 'Appointment booked successfully',
            data: {
                appointmentId: newAppointment.id,
                date: newAppointment.appointment_date,
                time: startDisp,
                status: newAppointment.status,
                service: {
                    name: service.name,
                    duration: service.duration,
                    price: service.price
                },
                stylist: {
                    name: stylist.name
                },
                customer: {
                    name: customer.name,
                    phone: customer.phone
                },
                notifications: {
                    sms: !!customer.phone,
                    email: !!customer.email
                }
            }
        }, { status: 201 });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
