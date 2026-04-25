'use server';

import { Resend } from 'resend';

/**
 * Server-side email sender for use in server actions
 * This bypasses the API route and calls Resend directly
 */
export async function sendEmailFromServer(
    to: string,
    subject: string,
    html: string
): Promise<{ success: boolean; error?: string; data?: any }> {
    try {
        const apiKey = process.env.RESEND_API_KEY;
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

        if (!apiKey) {
            console.error('❌ RESEND_API_KEY not configured');
            return {
                success: false,
                error: 'Email service not configured. Please set RESEND_API_KEY in environment variables.'
            };
        }

        const resend = new Resend(apiKey);

        const data = await resend.emails.send({
            from: fromEmail,
            to: [to],
            subject: subject,
            html: html,
        });

        return {
            success: true,
            data: data
        };
    } catch (error: any) {
        console.error('❌ Error sending email from server:', error);
        return {
            success: false,
            error: error.message || 'Failed to send email'
        };
    }
}
