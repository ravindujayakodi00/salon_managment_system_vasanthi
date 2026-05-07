import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SALON_NAME } from '@/config/salon';

// Generate 6-digit OTP
function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

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

// Create Supabase admin client lazily (only when needed at runtime)
function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase environment variables are not configured');
    }

    return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(request: NextRequest) {
    try {
        const { phone } = await request.json();

        if (!phone) {
            return NextResponse.json(
                { success: false, error: 'Phone number is required' },
                { status: 400 }
            );
        }

        const formattedPhone = formatPhone(phone);
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        const supabaseAdmin = getSupabaseAdmin();

        // Check for existing unexpired OTP (rate limiting)
        const { data: existingOtp } = await supabaseAdmin
            .from('booking_otps')
            .select('*')
            .eq('phone', formattedPhone)
            .eq('verified', false)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (existingOtp) {
            const timeSinceCreated = Date.now() - new Date(existingOtp.created_at).getTime();
            if (timeSinceCreated < 60000) { // 1 minute cooldown
                return NextResponse.json(
                    { success: false, error: 'Please wait before requesting another OTP' },
                    { status: 429 }
                );
            }
        }

        // Store OTP in database
        const { error: insertError } = await supabaseAdmin
            .from('booking_otps')
            .insert({
                phone: formattedPhone,
                otp: otp,
                expires_at: expiresAt.toISOString(),
                verified: false,
                attempts: 0,
            });

        if (insertError) {
            console.error('Error storing OTP:', insertError);
            return NextResponse.json(
                { success: false, error: 'Failed to generate OTP' },
                { status: 500 }
            );
        }

        // Send SMS via text.lk
        const textLkApiToken = process.env.TEXT_LK_API_KEY;
        const textLkSenderId = process.env.TEXT_LK_SENDER_ID || 'TextLKDemo';

        if (!textLkApiToken) {
            console.error('TEXTLK_API_TOKEN not configured');
            // For development, return success with OTP visible
            return NextResponse.json({
                success: true,
                message: 'OTP generated (SMS not configured)',
                debug_otp: process.env.NODE_ENV === 'development' ? otp : undefined,
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
                message: `Your ${SALON_NAME} booking verification code is: ${otp}. Valid for 5 minutes.`,
            }),
        });

        if (!smsResponse.ok) {
            const errorText = await smsResponse.text();
            console.error('text.lk API error:', errorText);
            return NextResponse.json(
                { success: false, error: 'Failed to send SMS' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'OTP sent successfully',
        });

    } catch (error) {
        console.error('OTP send error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
