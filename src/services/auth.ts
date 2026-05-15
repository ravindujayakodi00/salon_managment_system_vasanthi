import { supabase } from '@/lib/supabase';
import { notificationsService } from './notifications';
import { randomInt } from 'crypto';

export const authService = {
    /**
     * Request OTP for password change (Owner/Manager only)
     */
    async requestPasswordChangeOTP(): Promise<{ success: boolean; message: string }> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Get user profile to check role
            const { data: profile } = await supabase
                .from('profiles')
                .select('system_role, email')
                .eq('id', user.id)
                .single();

            if (!profile) throw new Error('Profile not found');

            // Only Owner/Manager require OTP
            if (!['Owner', 'Manager'].includes(profile.system_role)) {
                throw new Error('OTP not required for your role');
            }

            // Generate 6-digit OTP using cryptographically secure randomness
            const otp = randomInt(100000, 999999).toString();

            // Set expiration to 5 minutes from now
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 5);

            // Store OTP in database
            const { error: insertError } = await supabase
                .from('password_change_otps')
                .insert({
                    user_id: user.id,
                    email: profile.email,
                    otp: otp,
                    expires_at: expiresAt.toISOString(),
                    used: false
                });

            if (insertError) throw insertError;

            // Send OTP via email
            await notificationsService.sendEmail(
                profile.email,
                'Password Change Verification Code',
                `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Password Change Verification</h2>
                    <p>Your verification code is:</p>
                    <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p>This code will expire in <strong>5 minutes</strong>.</p>
                    <p style="color: #666; font-size: 14px;">If you did not request this password change, please contact support immediately.</p>
                </div>
                `
            );

            return { success: true, message: 'OTP sent to your email' };
        } catch (error) {
            console.error('Error requesting OTP:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Failed to send OTP'
            };
        }
    },

    /**
     * Verify OTP and change password (Owner/Manager)
     */
    async verifyOTPAndChangePassword(otp: string, newPassword: string): Promise<{ success: boolean; message: string }> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Verify OTP
            const { data: otpRecord, error: otpError } = await supabase
                .from('password_change_otps')
                .select('*')
                .eq('user_id', user.id)
                .eq('otp', otp)
                .eq('used', false)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (otpError || !otpRecord) {
                throw new Error('Invalid or expired OTP');
            }

            // Change password using Supabase Auth
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            // Mark OTP as used
            await supabase
                .from('password_change_otps')
                .update({ used: true })
                .eq('id', otpRecord.id);

            return { success: true, message: 'Password changed successfully' };
        } catch (error) {
            console.error('Error changing password:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Failed to change password'
            };
        }
    },

    /**
     * Change password directly (Stylist/Receptionist)
     */
    async changePasswordDirect(newPassword: string): Promise<{ success: boolean; message: string }> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Get user profile to check role
            const { data: profile } = await supabase
                .from('profiles')
                .select('system_role')
                .eq('id', user.id)
                .single();

            if (!profile) throw new Error('Profile not found');

            // Only Stylist/Receptionist can use direct change
            if (['Owner', 'Manager'].includes(profile.system_role)) {
                throw new Error('Please use OTP verification');
            }

            // Change password using Supabase Auth
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            return { success: true, message: 'Password changed successfully' };
        } catch (error) {
            console.error('Error changing password:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Failed to change password'
            };
        }
    }
};
