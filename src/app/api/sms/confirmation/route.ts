import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SALON_NAME } from '@/config/salon';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatPhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '94' + cleaned.substring(1);
    if (!cleaned.startsWith('94')) cleaned = '94' + cleaned;
    return cleaned;
}

function formatTime(time: string): string {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

async function sendSMS(apiKey: string, senderId: string, phone: string, message: string) {
    const res = await fetch('https://app.text.lk/api/v3/sms/send', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ recipient: formatPhone(phone), sender_id: senderId, type: 'plain', message }),
    });
    const result = await res.json();
    console.log('SMS result to', phone, ':', result);
    return result;
}

interface AppointmentInfo {
    serviceName: string;
    date: string;
    time: string;
    price: number;
}

export async function POST(request: NextRequest) {
    try {
        const { phone, customerName, appointments, totalPrice, organizationId, stylistIds } = await request.json() as {
            phone: string;
            customerName: string;
            appointments: AppointmentInfo[];
            totalPrice: number;
            organizationId?: string;
            stylistIds?: string[];
        };

        if (!phone || !appointments || appointments.length === 0) {
            return NextResponse.json({ success: false, error: 'Phone and appointments are required' }, { status: 400 });
        }

        const apiKey = process.env.TEXT_LK_API_KEY;
        const senderId = process.env.TEXT_LK_SENDER_ID;

        if (!apiKey || !senderId) {
            console.error('SMS config missing: TEXT_LK_API_KEY or TEXT_LK_SENDER_ID');
            return NextResponse.json({ success: false, message: 'SMS not configured' });
        }

        const appointmentLines = appointments.map((apt, i) =>
            `${i + 1}. ${apt.serviceName} - ${formatDate(apt.date)} at ${formatTime(apt.time)}`
        ).join('\n');

        // Customer SMS
        const customerMsg = appointments.length === 1
            ? `Appointment Confirmed! ${appointments[0].serviceName} on ${formatDate(appointments[0].date)} at ${formatTime(appointments[0].time)}. See you soon! - ${SALON_NAME}`
            : `${appointments.length} Appointments Confirmed!\n${appointmentLines}\nTotal: Rs ${totalPrice.toLocaleString()} - ${SALON_NAME}`;

        await sendSMS(apiKey, senderId, phone, customerMsg);
        console.log('Customer SMS sent to:', customerName, phone);

        // Stylist + Manager SMS (only if organizationId provided)
        console.log('organizationId received:', organizationId);
        console.log('stylistIds received:', stylistIds);

        if (organizationId) {
            const shortSummary = appointments.length === 1
                ? `${appointments[0].serviceName} on ${formatDate(appointments[0].date)} at ${formatTime(appointments[0].time)}`
                : `${appointments.length} services on ${formatDate(appointments[0].date)}`;

            // Stylist SMS
            if (stylistIds && stylistIds.length > 0) {
                const uniqueStylistIds = [...new Set(stylistIds)];
                console.log('Fetching stylists for IDs:', uniqueStylistIds);

                const { data: stylists, error: stylistError } = await supabase
                    .from('staff')
                    .select('name, phone')
                    .in('id', uniqueStylistIds)
                    .eq('organization_id', organizationId);

                console.log('Stylists found:', stylists, 'Error:', stylistError);

                for (const stylist of stylists || []) {
                    console.log('Stylist:', stylist.name, '| phone:', stylist.phone);
                    if (stylist.phone) {
                        await sendSMS(apiKey, senderId, stylist.phone,
                            `New Appointment! Customer: ${customerName || 'Customer'}, ${shortSummary}.`
                        );
                    } else {
                        console.log('Stylist', stylist.name, 'has no phone — skipping');
                    }
                }
            } else {
                console.log('No stylistIds — skipping stylist SMS');
            }

            // Manager SMS
            const { data: managers, error: managerError } = await supabase
                .from('staff')
                .select('name, phone')
                .eq('system_role', 'Manager')
                .eq('is_active', true)
                .eq('organization_id', organizationId);

            console.log('Managers found:', managers, 'Error:', managerError);

            for (const manager of managers || []) {
                console.log('Manager:', manager.name, '| phone:', manager.phone);
                if (manager.phone) {
                    await sendSMS(apiKey, senderId, manager.phone,
                        `New Booking! ${customerName || 'Customer'} booked ${shortSummary}.`
                    );
                } else {
                    console.log('Manager', manager.name, 'has no phone — skipping');
                }
            }
        } else {
            console.log('No organizationId received — skipping stylist and manager SMS');
        }

        return NextResponse.json({ success: true, message: 'SMS notifications sent' });

    } catch (error) {
        console.error('Confirmation SMS error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
