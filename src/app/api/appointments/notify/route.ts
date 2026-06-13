import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createTextLkService } from '@/services/textlk';
import { SALON_NAME } from '@/config/salon';

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
        const { type, appointmentId, appointmentIds, oldTime, oldDate, organizationId: bodyOrgId } = body;

        // Support both single and batch
        const idsToProcess = appointmentIds || (appointmentId ? [appointmentId] : []);

        if (!type || idsToProcess.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Missing type or appointmentId(s)' },
                { status: 400 }
            );
        }

        // Get all appointment details — always filter by organization_id when provided
        // to prevent cross-tenant data access (service role bypasses RLS)
        let aptQuery = supabase
            .from('appointments')
            .select(`
                *,
                customer:customers(*),
                stylist:staff(*)
            `)
            .in('id', idsToProcess);
        if (bodyOrgId) {
            aptQuery = aptQuery.eq('organization_id', bodyOrgId);
        }
        const { data: appointments, error: aptError } = await aptQuery;

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

        // Fetch branch name and address for template variables
        let branchName = '';
        let branchAddress = '';
        if (baseBranchId) {
            const { data: branchData } = await supabase
                .from('branches')
                .select('name, address')
                .eq('id', baseBranchId)
                .single();
            branchName = branchData?.name || '';
            branchAddress = branchData?.address || '';
        }

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

        // Helper: replace {variable} placeholders
        function replaceVars(template: string, vars: Record<string, string>): string {
            return Object.entries(vars).reduce(
                (msg, [key, val]) => msg.replace(new RegExp(`\\{${key}\\}`, 'g'), val),
                template
            );
        }

        if (type === 'new') {
            const appointmentsList = appointments.map(apt => {
                const serviceNames = apt.services
                    ?.map((id: string) => servicesMap.get(id))
                    .filter(Boolean)
                    .join(', ') || 'Service';
                return `${serviceNames} at ${apt.start_time}`;
            });

            const shortDate = new Date(appointments[0].appointment_date).toLocaleDateString();
            const firstServiceName = appointments[0].services?.length
                ? (servicesMap.get(appointments[0].services[0]) || 'Service')
                : 'Service';

            if (customer?.phone) {
                // Try to use the template from notification_templates
                const { data: tmpl } = await supabase
                    .from('notification_templates')
                    .select('message')
                    .eq('organization_id', organizationId)
                    .eq('type', 'appointment_confirmation')
                    .eq('is_active', true)
                    .maybeSingle();

                let msg: string;
                if (tmpl?.message) {
                    const vars: Record<string, string> = {
                        customer_name: customer.name || 'Customer',
                        date: shortDate,
                        time: appointments[0].start_time || '',
                        service: appointments.length === 1
                            ? firstServiceName
                            : `${appointments.length} services`,
                        stylist: (appointments[0].stylist as any)?.name || '',
                        salon_name: SALON_NAME,
                        branch: branchName,
                        address: branchAddress
                    };
                    msg = replaceVars(tmpl.message, vars);
                    console.log('SMS built from notification_templates template');
                } else {
                    // Fallback message
                    const locationLine = branchName
                        ? `Location: ${branchName}${branchAddress ? ' - ' + branchAddress : ''}`
                        : '';
                    const details = appointments.length === 1
                        ? `Date: ${shortDate}\nTime: ${appointments[0].start_time || ''}\n${locationLine}`
                        : appointmentsList.map((apt, i) => `${i + 1}. ${apt}`).join('\n') + `\n${locationLine}`;
                    msg = `Hello ${customer.name || 'Customer'},\nYour session at ${SALON_NAME} is officially confirmed.\n\nAppointment Details:\n${details}\n\nPlease arrive on time. We look forward to welcoming you! - ${SALON_NAME}`;
                    console.log('No active appointment_confirmation template found — using fallback message');
                }

                const result = await textlk.sendSMS(customer.phone, msg);
                results.customer = result;
                console.log('SMS sent to customer:', customer.name, customer.phone);
            }

        } else if (type === 'reschedule') {
            const appointment = appointments[0];
            const serviceNames = appointment.services
                ?.map((id: string) => servicesMap.get(id))
                .filter(Boolean)
                .join(', ') || 'Services';
            const shortDate = new Date(appointment.appointment_date).toLocaleDateString();

            if (customer?.phone) {
                // Try to use appointment_confirmation template for reschedule too
                const { data: tmpl } = await supabase
                    .from('notification_templates')
                    .select('message')
                    .eq('organization_id', organizationId)
                    .eq('type', 'appointment_confirmation')
                    .eq('is_active', true)
                    .maybeSingle();

                let msg: string;
                if (tmpl?.message) {
                    const vars: Record<string, string> = {
                        customer_name: customer.name || 'Customer',
                        date: shortDate,
                        time: appointment.start_time || '',
                        service: serviceNames,
                        stylist: (appointment.stylist as any)?.name || '',
                        salon_name: SALON_NAME,
                        branch: branchName,
                        address: branchAddress
                    };
                    msg = replaceVars(tmpl.message, vars);
                    console.log('Reschedule SMS built from notification_templates template');
                } else {
                    const locationLine = branchName
                        ? `Location: ${branchName}${branchAddress ? ' - ' + branchAddress : ''}`
                        : '';
                    msg = `Hello ${customer.name || 'Customer'},\nYour session at ${SALON_NAME} is officially confirmed.\n\nAppointment Details:\nDate: ${shortDate}\nTime: ${appointment.start_time || ''}\n${locationLine}\n\nPlease arrive on time. We look forward to welcoming you! - ${SALON_NAME}`;
                    console.log('No active appointment_confirmation template found — using fallback reschedule message');
                }

                const result = await textlk.sendSMS(customer.phone, msg);
                results.customer = result;
                console.log('Reschedule SMS sent to customer:', customer.name, customer.phone);
            }
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
