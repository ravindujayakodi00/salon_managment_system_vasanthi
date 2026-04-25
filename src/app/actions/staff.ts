'use server';

import { getAdminClient } from '@/lib/supabase';
import { sendEmailFromServer } from '@/lib/email-server';
import { randomBytes } from 'crypto';
import { getSupabaseServerClient } from '@/lib/supabase-server';

// Utility to generate cryptographically secure random password
function generatePassword(): string {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const bytes = randomBytes(length);
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset[bytes[i] % charset.length];
    }
    return password;
}

export async function createStaffAction(staffData: {
    name: string;
    email: string;
    phone: string;
    role: 'Manager' | 'Receptionist' | 'Stylist';
    branch_id: string;
    specializations?: string[];
    working_days?: string[];
    working_hours?: { start: string; end: string };
}) {
    try {
        // Service-role client bypasses RLS, so we must validate caller explicitly.
        const supabaseAuthed = await getSupabaseServerClient();
        const {
            data: { user },
            error: authGetError,
        } = await supabaseAuthed.auth.getUser();
        if (authGetError || !user) {
            return { success: false, message: 'Unauthorized' };
        }

        const { data: callerProfile, error: callerProfileError } = await supabaseAuthed
            .from('profiles')
            .select('id, role, organization_id')
            .eq('id', user.id)
            .single();
        if (callerProfileError || !callerProfile) {
            return { success: false, message: 'Unauthorized' };
        }
        if (callerProfile.role !== 'Owner') {
            return { success: false, message: 'Only the Owner can create staff members.' };
        }

        const adminClient = getAdminClient();

        // Validate branch exists and belongs to the caller's organization.
        const { data: branch, error: branchError } = await adminClient
            .from('branches')
            .select('id, organization_id')
            .eq('id', staffData.branch_id)
            .single();
        if (branchError || !branch) {
            return { success: false, message: 'Invalid branch.' };
        }
        if (branch.organization_id !== callerProfile.organization_id) {
            return { success: false, message: 'Selected branch does not belong to your organization.' };
        }

        // Generate temporary password
        const tempPassword = generatePassword();

        // 1. Create auth user using Supabase Admin API
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
            email: staffData.email,
            password: tempPassword,
            email_confirm: true, // Auto-confirm email
        });

        if (authError) {
            if (authError.message.includes('already registered')) {
                return { success: false, message: 'Email already registered' };
            }
            throw authError;
        }

        if (!authData.user) {
            throw new Error('Failed to create auth user');
        }

        // 2. Create profile entry (using admin client to bypass RLS if needed)
        // organization_id must match the branch's tenant or RLS will block reads/writes after login.
        const { error: insertProfileError } = await adminClient
            .from('profiles')
            .insert({
                id: authData.user.id,
                email: staffData.email,
                name: staffData.name,
                role: staffData.role,
                branch_id: staffData.branch_id,
                organization_id: branch.organization_id,
                is_active: true,
            });

        if (insertProfileError) {
            // Rollback: delete auth user
            await adminClient.auth.admin.deleteUser(authData.user.id);
            throw insertProfileError;
        }

        // 3. Create staff entry
        const { error: staffError } = await adminClient
            .from('staff')
            .insert({
                profile_id: authData.user.id,
                name: staffData.name,
                email: staffData.email,
                phone: staffData.phone,
                role: staffData.role,
                branch_id: staffData.branch_id,
                organization_id: branch.organization_id,
                specializations: staffData.specializations || [],
                working_days: staffData.working_days || [],
                working_hours: staffData.working_hours,
                is_active: true,
            });

        if (staffError) {
            // Rollback: delete profile and auth user
            await adminClient.from('profiles').delete().eq('id', authData.user.id);
            await adminClient.auth.admin.deleteUser(authData.user.id);
            throw staffError;
        }

        // 4. Send welcome email (using server-side helper)
        let emailSent = false;
        try {
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
            const loginUrl = `${siteUrl}/admin/login`;

            const emailResult = await sendEmailFromServer(
                staffData.email,
                'Welcome to the Team - Your Account Details',
                `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Welcome to the Team! 🎉</h2>
                    
                    <p>Hi <strong>${staffData.name}</strong>,</p>
                    
                    <p>Your staff account has been created. Here are your login details:</p>
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 8px 0;"><strong>Email:</strong> ${staffData.email}</p>
                        <p style="margin: 8px 0;"><strong>Temporary Password:</strong> <code style="background: #fff; padding: 4px 8px; border-radius: 4px; font-size: 14px;">${tempPassword}</code></p>
                    </div>
                    
                    <p>
                        <a href="${loginUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 10px 0;">
                            Login to Dashboard
                        </a>
                    </p>
                    
                    <p style="color: #666; font-size: 14px; margin-top: 20px;">
                        ⚠️ <strong>Important:</strong> Please change your password after your first login for security.
                    </p>
                    
                    <p style="color: #999; font-size: 12px; margin-top: 30px;">
                        If you have any questions, please contact your administrator.
                    </p>
                </div>
                `
            );

            emailSent = emailResult.success;

            if (!emailSent) {
                console.error('❌ Welcome email failed:', emailResult.error);
            }
        } catch (emailError) {
            console.error('❌ Failed to send welcome email:', emailError);
            // Don't fail the entire operation if email fails
        }

        return {
            success: true,
            message: emailSent
                ? 'Staff member created successfully'
                : 'Staff created, but failed to send email (Check RESEND_API_KEY)',
            credentials: {
                email: staffData.email,
                password: tempPassword,
            },
        };
    } catch (error: any) {
        console.error('Error creating staff:', error);
        return {
            success: false,
            message: error.message || 'Failed to create staff member',
        };
    }
}

export async function deleteStaffAction(id: string) {
    try {
        // Validate caller is Owner (service role bypasses RLS).
        const supabaseAuthed = await getSupabaseServerClient();
        const {
            data: { user },
            error: authError,
        } = await supabaseAuthed.auth.getUser();
        if (authError || !user) {
            return { success: false, message: 'Unauthorized' };
        }

        const { data: callerProfile, error: profileError } = await supabaseAuthed
            .from('profiles')
            .select('id, role, organization_id')
            .eq('id', user.id)
            .single();
        if (profileError || !callerProfile) {
            return { success: false, message: 'Unauthorized' };
        }
        if (callerProfile.role !== 'Owner') {
            return { success: false, message: 'Only the Owner can delete staff members.' };
        }

        const adminClient = getAdminClient();

        // Get profile_id first
        const { data: staff } = await adminClient
            .from('staff')
            .select('profile_id')
            .eq('id', id)
            .single();

        if (!staff) throw new Error('Staff member not found');

        // Delete staff entry (CASCADE will handle profile)
        const { error: staffError } = await adminClient
            .from('staff')
            .delete()
            .eq('id', id);

        if (staffError) throw staffError;

        // Delete profile entry
        if (staff.profile_id) {
            await adminClient
                .from('profiles')
                .delete()
                .eq('id', staff.profile_id);

            // Delete auth user
            await adminClient.auth.admin.deleteUser(staff.profile_id);
        }

        return {
            success: true,
            message: 'Staff member deleted successfully',
        };
    } catch (error: any) {
        console.error('Error deleting staff:', error);
        return {
            success: false,
            message: error.message || 'Failed to delete staff member',
        };
    }
}
