import { NextRequest, NextResponse } from 'next/server';
import { createTextLkService } from '@/services/textlk';
import { getRateLimitKey, checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';

const isDevelopment = process.env.NODE_ENV !== 'production' && process.env.SMS_MODE !== 'production';

export async function POST(request: NextRequest) {
    try {
        // Rate limiting (5 SMS per minute per IP)
        const rateLimitKey = getRateLimitKey(request);
        const { allowed, resetIn } = checkRateLimit(rateLimitKey, 5);
        if (!allowed) {
            return rateLimitResponse(resetIn);
        }

        const body = await request.json();
        const { to, message } = body;

        // Validation
        if (!to || !message) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields (to, message)' },
                { status: 400 }
            );
        }

        // DEVELOPMENT MODE: Skip sending
        if (isDevelopment) {
            return NextResponse.json({
                success: true,
                data: {
                    uid: 'dev-mode-' + Date.now(),
                    to,
                    message,
                    note: 'SMS logged to console (development mode)'
                }
            });
        }

        // PRODUCTION MODE: Send real SMS via Text.lk
        const apiKey = process.env.TEXT_LK_API_KEY;
        const senderId = process.env.TEXT_LK_SENDER_ID;

        if (!apiKey || !senderId) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Text.lk credentials not configured. Add TEXT_LK_API_KEY and TEXT_LK_SENDER_ID to your .env.local file.'
                },
                { status: 500 }
            );
        }

        // Check if using demo sender ID
        if (senderId === 'TextLKDemo') {
            console.warn('⚠️  Using demo sender ID "TextLKDemo". This is for testing only.');
            console.warn('📌 For production: Register a custom Sender ID at https://www.text.lk');
            console.warn('📌 Then set TEXT_LK_SENDER_ID="YourApprovedSenderID"');
        }

        // Initialize Text.lk service
        const textLkService = createTextLkService(apiKey, senderId);

        // Validate phone number
        if (!textLkService.validatePhoneNumber(to)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid phone number format. Use Sri Lankan format (e.g., 0771234567 or +94771234567)'
                },
                { status: 400 }
            );
        }

        // Send SMS
        const result = await textLkService.sendSMS(to, message);

        if (result.status === 'error') {
            console.error('❌ Text.lk API Error:', result.message);

            // Provide helpful error messages
            if (result.message?.toLowerCase().includes('balance') || result.message?.toLowerCase().includes('credit')) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `SMS send failed: ${result.message}\n\n` +
                            `💡 To fix this:\n` +
                            `1. Go to https://www.text.lk/dashboard\n` +
                            `2. Add credits to your account\n` +
                            `3. Try again`
                    },
                    { status: 400 }
                );
            }

            if (result.message?.toLowerCase().includes('sender') || result.message?.toLowerCase().includes('mask')) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `SMS send failed: ${result.message}\n\n` +
                            `💡 To fix this:\n` +
                            `1. Register and verify your Sender ID at https://www.text.lk\n` +
                            `2. Update TEXT_LK_SENDER_ID in .env.local\n` +
                            `3. Restart your server\n\n` +
                            `For testing, use TEXT_LK_SENDER_ID="TextLKDemo"`
                    },
                    { status: 400 }
                );
            }

            return NextResponse.json(
                { success: false, error: result.message },
                { status: 400 }
            );
        }

        return NextResponse.json({
            success: true,
            data: result.data
        });
    } catch (error: any) {
        console.error('SMS API Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
