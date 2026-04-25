import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getRateLimitKey, checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const isDevelopment = process.env.NODE_ENV !== 'production' && process.env.EMAIL_MODE !== 'production';

export async function POST(request: NextRequest) {
    try {
        // Rate limiting (10 emails per minute per IP)
        const rateLimitKey = getRateLimitKey(request);
        const { allowed, resetIn } = checkRateLimit(rateLimitKey, 10);
        if (!allowed) {
            return rateLimitResponse(resetIn);
        }

        const body = await request.json();
        const { to, subject, html } = body;

        // Validation
        if (!to || !subject || !html) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields (to, subject, html)' },
                { status: 400 }
            );
        }

        // DEVELOPMENT MODE: Skip sending
        if (isDevelopment) {
            return NextResponse.json({
                success: true,
                data: {
                    id: 'dev-mode-' + Date.now(),
                    note: 'Email logged to console (development mode)'
                }
            });
        }

        // PRODUCTION MODE: Send real email via Resend
        if (!resend) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'RESEND_API_KEY not configured. Add it to your .env.local file.'
                },
                { status: 500 }
            );
        }

        // Check if custom from address is set
        const fromEmail = process.env.RESEND_FROM_EMAIL;

        if (!fromEmail || fromEmail === 'onboarding@resend.dev') {
            console.warn('⚠️  Using default onboarding@resend.dev email. This has restrictions.');
            console.warn('📌 For production: Verify a domain at https://resend.com/domains');
            console.warn('📌 Then set RESEND_FROM_EMAIL="YourApp <noreply@yourdomain.com>"');
        }

        // Send email
        const { data, error } = await resend.emails.send({
            from: fromEmail || 'SalonFlow <onboarding@resend.dev>',
            to: Array.isArray(to) ? to : [to],
            subject: subject,
            html: html,
        });

        if (error) {
            console.error('❌ Resend API Error:', error);

            // Provide helpful error message for common domain verification issue
            if (error.message?.includes('verify') || error.message?.includes('domain')) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Email send failed: ${error.message}\n\n` +
                            `💡 To fix this:\n` +
                            `1. Go to https://resend.com/domains\n` +
                            `2. Verify your domain\n` +
                            `3. Set RESEND_FROM_EMAIL="YourApp <noreply@yourdomain.com>"\n` +
                            `4. Restart your server\n\n` +
                            `For testing, you can use development mode (NODE_ENV=development).`
                    },
                    { status: 400 }
                );
            }

            return NextResponse.json(
                { success: false, error: error.message },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Email API Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
