import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getBearerToken } from '@/lib/in-app-notifications-auth';

// Use Service Role Key to bypass RLS
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, updates, organization_id: organizationId } = body;

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Staff ID is required' },
                { status: 400 }
            );
        }

        if (!organizationId || typeof organizationId !== 'string') {
            return NextResponse.json(
                { success: false, error: 'organization_id is required' },
                { status: 400 }
            );
        }

        const staffUpdates = { ...updates };

        // Update staff entry using admin client (bypasses RLS)
        const { data, error: staffError } = await supabaseAdmin
            .from('staff')
            .update(staffUpdates)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select();

        if (staffError) {
            console.error('Staff update error:', staffError);
            return NextResponse.json(
                { success: false, error: staffError.message },
                { status: 500 }
            );
        }

        if (!data || data.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Staff member not found' },
                { status: 404 }
            );
        }

        // Sync profile when name, system_role, or org_role_id changed
        if (updates.name || updates.system_role || updates.org_role_id) {
            const staff = data[0];
            if (staff?.profile_id) {
                const profileUpdates: any = {};
                if (updates.name) profileUpdates.name = updates.name;
                if (updates.system_role) profileUpdates.system_role = updates.system_role;
                if (updates.org_role_id !== undefined) profileUpdates.org_role_id = updates.org_role_id;

                const { error: profileError } = await supabaseAdmin
                    .from('profiles')
                    .update(profileUpdates)
                    .eq('id', staff.profile_id);

                if (profileError) {
                    console.warn('Profile update failed:', profileError);
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Staff member updated successfully',
            data: data[0]
        });

    } catch (error: any) {
        console.error('Unexpected error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/staff/update
 * Change a staff member's auth password. Requires a valid owner/manager JWT.
 * Uses the service role key server-side — the browser anon client cannot call auth.admin.
 */
export async function PATCH(request: NextRequest) {
    try {
        // Verify the caller is authenticated
        const token = getBearerToken(request);
        if (!token) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const authedClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        );
        const { data: { user: callerUser }, error: callerError } = await authedClient.auth.getUser();
        if (callerError || !callerUser) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Get caller's organization and role — check staff table first, fall back to profiles
        let callerOrgId: string | null = null;
        let callerRole: string | null = null;

        const { data: callerStaff } = await supabaseAdmin
            .from('staff')
            .select('organization_id, system_role')
            .eq('profile_id', callerUser.id)
            .maybeSingle();

        if (callerStaff?.organization_id) {
            callerOrgId = callerStaff.organization_id;
            callerRole = callerStaff.system_role;
        } else {
            // Owner may only have a profiles row, not a staff row
            const { data: callerProfileRow } = await supabaseAdmin
                .from('profiles')
                .select('organization_id, system_role')
                .eq('id', callerUser.id)
                .maybeSingle();

            if (callerProfileRow?.organization_id) {
                callerOrgId = callerProfileRow.organization_id;
                callerRole = callerProfileRow.system_role;
            }
        }

        if (!callerOrgId) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        // Only Owners and Managers can change passwords
        if (!['Owner', 'Manager'].includes(callerRole ?? '')) {
            return NextResponse.json({ success: false, error: 'Forbidden: insufficient role' }, { status: 403 });
        }

        const { staffId, newPassword } = await request.json();
        if (!staffId || !newPassword) {
            return NextResponse.json({ success: false, error: 'staffId and newPassword are required' }, { status: 400 });
        }

        // Verify the target staff belongs to the caller's organization
        const { data: targetStaff } = await supabaseAdmin
            .from('staff')
            .select('profile_id, organization_id')
            .eq('id', staffId)
            .eq('organization_id', callerOrgId)
            .maybeSingle();

        if (!targetStaff?.profile_id) {
            return NextResponse.json({ success: false, error: 'Staff member not found in your organization' }, { status: 404 });
        }

        // Update the password using the service role key — this is the only way auth.admin works
        const { error } = await supabaseAdmin.auth.admin.updateUserById(
            targetStaff.profile_id,
            { password: newPassword }
        );

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
    }
}
