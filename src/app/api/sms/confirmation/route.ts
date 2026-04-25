import { NextRequest, NextResponse } from 'next/server';

// Format phone number for Sri Lanka
function formatPhone(phone: string): string {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');

    // If starts with 0, replace with 94
    if (cleaned.startsWith('0')) {
        cleaned = '94' + cleaned.substring(1);
    }

    // If doesn't start with 94, add it
    if (!cleaned.startsWith('94')) {
        cleaned = '94' + cleaned;
    }

    return cleaned;
}

// Format time to 12-hour format
function formatTime(time: string): string {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Format date to readable format
function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
}

interface AppointmentInfo {
    serviceName: string;
    date: string;
    time: string;
    price: number;
}

export async function POST(request: NextRequest) {
    try {
        const { phone, appointments, totalPrice } = await request.json() as {
            phone: string;
            appointments: AppointmentInfo[];
            totalPrice: number;
        };

        if (!phone || !appointments || appointments.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Phone and appointments are required' },
                { status: 400 }
            );
        }

        const formattedPhone = formatPhone(phone);

        // Build confirmation message
        const appointmentLines = appointments.map((apt, i) =>
            `${i + 1}. ${apt.serviceName} - ${formatDate(apt.date)} at ${formatTime(apt.time)}`
        ).join('\n');

        const message = `🎉 SalonFlow Booking Confirmed!\n\n${appointmentLines}\n\nTotal: Rs ${totalPrice.toLocaleString()}\n\nWe look forward to seeing you!`;

        // Send SMS via text.lk
        const textLkApiToken = process.env.TEXTLK_API_TOKEN;
        const textLkSenderId = process.env.TEXTLK_SENDER_ID || 'TextLKDemo';

        if (!textLkApiToken) {
            return NextResponse.json({
                success: true,
                message: 'Confirmation generated (SMS not configured)',
                debug_message: process.env.NODE_ENV === 'development' ? message : undefined,
            });
        }

        const smsResponse = await fetch('https://app.text.lk/api/v3/sms/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${textLkApiToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                recipient: formattedPhone,
                sender_id: textLkSenderId,
                type: 'plain',
                message: message,
            }),
        });

        if (!smsResponse.ok) {
            const errorText = await smsResponse.text();
            console.error('text.lk API error:', errorText);
            // Don't fail the booking - just log the error
            return NextResponse.json({
                success: false,
                error: 'Failed to send confirmation SMS',
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Confirmation SMS sent successfully',
        });

    } catch (error) {
        console.error('Confirmation SMS error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
