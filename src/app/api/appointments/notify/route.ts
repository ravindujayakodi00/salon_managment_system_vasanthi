import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTextLkService } from '@/services/textlk';

// Use Service Role Key for reliable server-side operations
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/appointments/notify
 * 
 * Server-side endpoint to send appointment notifications.
 * This is more reliable than client-side notifications.
 * 
 * Request body:
 * {
 *   type: 'new' | 'reschedule' | 'cancel',
 *   appointmentId?: string,       // For single appointment
 *   appointmentIds?: string[],    // For batch (multi-service bookings)
 *   oldTime?: string,  // For reschedule
 *   oldDate?: string   // For reschedule
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, appointmentId, appointmentIds, oldTime, oldDate } = body;

        // Support both single and batch
        const idsToProcess = appointmentIds || (appointmentId ? [appointmentId] : []);

        if (!type || idsToProcess.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Missing type or appointmentId(s)' },
                { status: 400 }
            );
        }


        // Get all appointment details
        const { data: appointments, error: aptError } = await supabase
            .from('appointments')
            .select(`
                *,
                customer:customers(*),
                stylist:staff(*)
            `)
            .in('id', idsToProcess);

        if (aptError || !appointments || appointments.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Appointments not found' },
                { status: 404 }
            );
        }

        const orgIds = new Set(
            appointments.map((a: { organization_id?: string | null }) => a.organization_id).filter(Boolean) as string[]
        );
        if (orgIds.size !== 1) {
            return NextResponse.json(
                { success: false, error: 'Appointments must belong to a single organization' },
                { status: 400 }
            );
        }
        const organizationId = [...orgIds][0]!;

        // Collect unique service IDs for all appointments
        const allServiceIds = new Set<string>();
        appointments.forEach(apt => {
            if (apt.services && apt.services.length > 0) {
                apt.services.forEach((id: string) => allServiceIds.add(id));
            }
        });

        // Fetch all services in one query
        const { data: servicesData } = await supabase
            .from('services')
            .select('id, name')
            .eq('organization_id', organizationId)
            .in('id', Array.from(allServiceIds));

        const servicesMap = new Map(servicesData?.map((s: any) => [s.id, s.name]) || []);

        // Assume all appointments are for the same customer (multi-service booking)
        const customer = appointments[0].customer as any;
        const baseBranchId = appointments[0]?.branch_id as string | null;

        // In-app notifications payload (DB-backed)
        let inAppNotification: { type: string; title: string; message: string } | null = null;

        // Initialize SMS service
        const apiKey = process.env.TEXT_LK_API_KEY;
        const senderId = process.env.TEXT_LK_SENDER_ID;

        if (!apiKey || !senderId) {
            console.error('❌ SMS config missing: TEXT_LK_API_KEY or TEXT_LK_SENDER_ID');
            return NextResponse.json(
                { success: false, error: 'SMS service not configured' },
                { status: 500 }
            );
        }

        const textlk = createTextLkService(apiKey, senderId);
        const results: any = { customer: null, stylists: [], managers: [] };

        if (type === 'new') {
            // Consolidate appointment details for customer
            const appointmentsList = appointments.map(apt => {
                const stylist = apt.stylist as any;
                const serviceNames = apt.services
                    ?.map((id: string) => servicesMap.get(id))
                    .filter(Boolean)
                    .join(', ') || 'Service';

                return `${serviceNames} at ${apt.start_time} with ${stylist?.name || 'stylist'}`;
            });

            const shortDate = new Date(appointments[0].appointment_date).toLocaleDateString();

            inAppNotification = {
                type: 'AppointmentNew',
                title: appointments.length === 1 ? 'New appointment booked' : 'New appointments booked',
                message: appointments.length === 1
                    ? `${customer?.name || 'Customer'} booked ${appointmentsList[0]} on ${shortDate}.`
                    : `${customer?.name || 'Customer'} booked ${appointments.length} appointments on ${shortDate}.`
            };

            // Send ONE consolidated SMS to customer
            if (customer?.phone) {
                const msg = appointments.length === 1
                    ? `✅ Appointment Confirmed! ${appointmentsList[0]} on ${shortDate}. See you soon! - SalonFlow`
                    : `✅ ${appointments.length} Appointments Confirmed for ${shortDate}:\n${appointmentsList.map((apt, i) => `${i + 1}. ${apt}`).join('\n')}\nSee you soon! - SalonFlow`;

                const result = await textlk.sendSMS(customer.phone, msg);
                results.customer = result;
                console.log(`✅ Consolidated SMS sent to customer (${appointments.length} appointments)`);
            }

            // Group appointments by stylist and send ONE SMS per stylist
            const appointmentsByStylist = new Map<string, any[]>();
            appointments.forEach(apt => {
                const stylist = apt.stylist as any;
                if (stylist?.id) {
                    if (!appointmentsByStylist.has(stylist.id)) {
                        appointmentsByStylist.set(stylist.id, []);
                    }
                    appointmentsByStylist.get(stylist.id)!.push(apt);
                }
            });

            // Send consolidated SMS to each stylist
            for (const [stylistId, stylistAppts] of appointmentsByStylist) {
                const stylist = stylistAppts[0].stylist as any;
                if (stylist?.phone) {
                    const aptDetails = stylistAppts.map((apt: any) => {
                        const serviceNames = apt.services
                            ?.map((id: string) => servicesMap.get(id))
                            .filter(Boolean)
                            .join(', ') || 'Service';
                        return `${serviceNames} at ${apt.start_time} (${apt.duration} mins)`;
                    });

                    const msg = stylistAppts.length === 1
                        ? `📅 New Appointment! Customer: ${customer?.name || 'Customer'}, ${aptDetails[0]} on ${shortDate}.`
                        : `📅 ${stylistAppts.length} New Appointments with ${customer?.name || 'Customer'} on ${shortDate}:\n${aptDetails.map((d: any, i: number) => `${i + 1}. ${d}`).join('\n')}`;

                    const result = await textlk.sendSMS(stylist.phone, msg);
                    results.stylists.push({ name: stylist.name, result });
                    console.log(`✅ Consolidated SMS sent to stylist ${stylist.name} (${stylistAppts.length} appointments)`);
                }
            }

            // Send ONE consolidated SMS to managers
            const { data: managers } = await supabase
                .from('staff')
                .select('id, name, phone')
                .eq('role', 'Manager')
                .eq('is_active', true)
                .eq('organization_id', organizationId);

            if (managers && managers.length > 0) {
                const aptSummary = appointments.map(apt => {
                    const stylist = apt.stylist as any;
                    const serviceNames = apt.services
                        ?.map((id: string) => servicesMap.get(id))
                        .filter(Boolean)
                        .join(', ') || 'Service';
                    return `${serviceNames} at ${apt.start_time} with ${stylist?.name}`;
                });

                const managerMsg = appointments.length === 1
                    ? `📅 New Booking! ${customer?.name || 'Customer'} booked ${aptSummary[0]} on ${shortDate}. - SalonFlow`
                    : `📅 ${appointments.length} New Bookings! ${customer?.name || 'Customer'} on ${shortDate}:\n${aptSummary.map((s, i) => `${i + 1}. ${s}`).join('\n')} - SalonFlow`;

                for (const manager of managers) {
                    if (manager.phone) {
                        const result = await textlk.sendSMS(manager.phone, managerMsg);
                        results.managers.push({ name: manager.name, result });
                        console.log(`✅ Consolidated SMS sent to manager: ${manager.name}`);
                    }
                }
            }

        } else if (type === 'reschedule') {
            // Reschedule only works for single appointment currently
            const appointment = appointments[0];
            const stylist = appointment.stylist as any;
            const serviceNames = appointment.services
                ?.map((id: string) => servicesMap.get(id))
                .filter(Boolean)
                .join(', ') || 'Services';
            const shortDate = new Date(appointment.appointment_date).toLocaleDateString();

            const oldDateStr = oldDate ? new Date(oldDate).toLocaleDateString() : 'previous date';
            const oldTimeStr = oldTime || 'previous time';

            inAppNotification = {
                type: 'AppointmentRescheduled',
                title: 'Appointment rescheduled',
                message: `${customer?.name || 'Customer'} rescheduled from ${oldDateStr} ${oldTimeStr} to ${shortDate} at ${appointment.start_time}.`
            };

            // Customer SMS
            if (customer?.phone) {
                const msg = `🔄 Appointment Rescheduled! Your ${serviceNames} appointment has been moved to ${shortDate} at ${appointment.start_time}. See you then! - SalonFlow`;
                const result = await textlk.sendSMS(customer.phone, msg);
                results.customer = result;
                console.log('✅ Reschedule SMS sent to customer:', customer.phone);
            }

            // Stylist SMS  
            if (stylist?.phone) {
                const msg = `🔄 Appointment Updated! ${customer?.name || 'Customer'}'s ${serviceNames} rescheduled to ${shortDate} at ${appointment.start_time}. Duration: ${appointment.duration} mins.`;
                const result = await textlk.sendSMS(stylist.phone, msg);
                results.stylists.push({ name: stylist.name, result });
                console.log('✅ Reschedule SMS sent to stylist:', stylist.phone);
            }

            // Manager SMS
            const { data: managers } = await supabase
                .from('staff')
                .select('id, name, phone')
                .eq('role', 'Manager')
                .eq('is_active', true)
                .eq('organization_id', organizationId);

            if (managers && managers.length > 0) {
                const managerMsg = `🔄 Appointment Rescheduled! ${customer?.name || 'Customer'}'s ${serviceNames} moved from ${oldDateStr} ${oldTimeStr} to ${shortDate} ${appointment.start_time}. - SalonFlow`;

                for (const manager of managers) {
                    if (manager.phone) {
                        const result = await textlk.sendSMS(manager.phone, managerMsg);
                        results.managers.push({ name: manager.name, result });
                        console.log('✅ Reschedule SMS sent to manager:', manager.name);
                    }
                }
            }
        } else if (type === 'cancel') {
            // In-app cancellation notification (external notification already handled elsewhere)
            const appointment = appointments[0];
            const shortDate = new Date(appointment.appointment_date).toLocaleDateString();
            const appointmentServices = (appointment.services || [])
                .map((id: string) => servicesMap.get(id))
                .filter(Boolean)
                .join(', ') || 'Service';

            inAppNotification = {
                type: 'AppointmentCancelled',
                title: 'Appointment cancelled',
                message: `${customer?.name || 'Customer'} cancelled ${appointmentServices} on ${shortDate} at ${appointment.start_time}.`
            };
        }

        // Persist DB-backed in-app notifications for all active staff in this branch.
        // We never fail the whole request if in-app insert fails (SMS might still be useful).
        try {
            if (inAppNotification && baseBranchId) {
                const { data: staffRecipients, error: staffRecipientsError } = await supabase
                    .from('staff')
                    .select('id')
                    .eq('branch_id', baseBranchId)
                    .eq('organization_id', organizationId)
                    .eq('is_active', true);

                if (staffRecipientsError) {
                    console.error('In-app notification recipient fetch failed:', staffRecipientsError);
                } else if (staffRecipients && staffRecipients.length > 0) {
                    const notificationInsert = await supabase
                        .from('in_app_notifications')
                        .insert({
                            type: inAppNotification.type,
                            title: inAppNotification.title,
                            message: inAppNotification.message,
                            branch_id: baseBranchId,
                            organization_id: organizationId,
                            appointment_id: appointments.length === 1 ? appointments[0].id : null,
                            metadata: {
                                appointmentIds: idsToProcess
                            }
                        })
                        .select('id')
                        .single();

                    if (!notificationInsert?.data?.id) {
                        // supabase-js returns { data, error } - support both shapes
                        console.error('In-app notification insert returned no id:', notificationInsert);
                    } else {
                        const notificationId = notificationInsert.data.id;
                        await supabase
                            .from('in_app_notification_recipients')
                            .insert(
                                (staffRecipients || []).map((s: any) => ({
                                    notification_id: notificationId,
                                    staff_id: s.id
                                }))
                            );
                    }
                }
            }
        } catch (inAppError) {
            console.error('Failed to persist in-app notifications:', inAppError);
        }

        return NextResponse.json({
            success: true,
            message: 'Notifications sent',
            results
        });

    } catch (error: any) {
        console.error('Notification API Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
