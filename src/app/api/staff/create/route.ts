import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { sendEmailFromServer } from '@/lib/email-server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

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

export async function POST(request: NextRequest) {
    try {
        // Authenticate caller via cookies
        const cookieStore = await cookies();
        const supabaseAuthed = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get: (name: string) => cookieStore.get(name)?.value ?? null,
                    set: (name: string, value: string, options: any) => cookieStore.set({ name, value, ...options }),
                    remove: (name: string) => cookieStore.delete(name),
                },
            }
        );

        const { data: { user }, error: authError } = await supabaseAuthed.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { data: callerProfile, error: profileError } = await supabaseAuthed
            .from('profiles')
            .select('id, system_role, organization_id')
            .eq('id', user.id)
            .single();
        if (profileError || !callerProfile) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        if (callerProfile.system_role !== 'Owner') {
            return NextResponse.json({ success: false, error: 'Only the Owner can create staff members.' }, { status: 403 });
        }

        const body = await request.json();
        const {
            name, email, phone, system_role, org_role_id, branch_id,
            specializations, working_days, working_hours,
            salary, commission,
        } = body;

        if (!name || !email || !system_role || !branch_id) {
            return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
        }

        // Validate branch belongs to caller's org
        const { data: branch, error: branchError } = await supabaseAdmin
            .from('branches')
            .select('id, organization_id')
            .eq('id', branch_id)
            .single();
        if (branchError || !branch) {
            return NextResponse.json({ success: false, error: 'Invalid branch.' }, { status: 400 });
        }
        if (branch.organization_id !== callerProfile.organization_id) {
            return NextResponse.json({ success: false, error: 'Selected branch does not belong to your organization.' }, { status: 403 });
        }

        const tempPassword = generatePassword();

        // 1. Create auth user
        const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
        });
        if (authCreateError) {
            if (authCreateError.message.includes('already registered')) {
                return NextResponse.json({ success: false, error: 'Email already registered' }, { status: 409 });
            }
            throw authCreateError;
        }
        if (!authData.user) throw new Error('Failed to create auth user');

        // 2. Create profile
        const profileInsert: Record<string, unknown> = {
            id: authData.user.id,
            email,
            name,
            system_role,
            branch_id,
            organization_id: branch.organization_id,
            is_active: true,
        };
        if (org_role_id) profileInsert.org_role_id = org_role_id;

        const { error: insertProfileError } = await supabaseAdmin
            .from('profiles')
            .insert(profileInsert);
        if (insertProfileError) {
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            throw insertProfileError;
        }

        // 3. Create staff entry
        const staffInsert: Record<string, unknown> = {
            profile_id: authData.user.id,
            name,
            email,
            phone,
            system_role,
            branch_id,
            organization_id: branch.organization_id,
            specializations: specializations || [],
            working_days: working_days || [],
            working_hours: working_hours,
            is_active: true,
        };
        if (org_role_id) staffInsert.org_role_id = org_role_id;
        if (salary !== undefined && salary !== null) staffInsert.salary = salary;
        if (commission !== undefined && commission !== null) staffInsert.commission = commission;

        const { error: staffError } = await supabaseAdmin.from('staff').insert(staffInsert);
        if (staffError) {
            await supabaseAdmin.from('profiles').delete().eq('id', authData.user.id);
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            throw staffError;
        }

        // 4. Send welcome email
        let emailSent = false;
        try {
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
            const emailResult = await sendEmailFromServer(
                email,
                'Welcome to the Team - Your Account Details',
                `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Welcome to the Team! 🎉</h2>
                    <p>Hi <strong>${name}</strong>,</p>
                    <p>Your staff account has been created. Here are your login details:</p>
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 8px 0;"><strong>Email:</strong> ${email}</p>
                        <p style="margin: 8px 0;"><strong>Temporary Password:</strong> <code style="background: #fff; padding: 4px 8px; border-radius: 4px; font-size: 14px;">${tempPassword}</code></p>
                    </div>
                    <p>
                        <a href="${siteUrl}/admin/login" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 10px 0;">
                            Login to Dashboard
                        </a>
                    </p>
                    <p style="color: #666; font-size: 14px; margin-top: 20px;">
                        ⚠️ <strong>Important:</strong> Please change your password after your first login for security.
                    </p>
                </div>
                `
            );
            emailSent = emailResult.success;
        } catch {
            // Don't fail if email fails
        }

        return NextResponse.json({
            success: true,
            message: emailSent
                ? 'Staff member created successfully'
                : 'Staff created, but failed to send email (Check RESEND_API_KEY)',
            credentials: { email, password: tempPassword },
        });
    } catch (error: any) {
        console.error('Error creating staff:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to create staff member' },
            { status: 500 }
        );
    }
}
