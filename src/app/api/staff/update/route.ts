import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getBearerToken } from '@/lib/in-app-notifications-auth';

// Use Service Role Key to bypass RLS
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

type SystemRole = 'Owner' | 'Manager' | 'Receptionist' | 'Stylist';

interface CallerContext {
    userId: string;
    organizationId: string;
    role: SystemRole;
}

const SYSTEM_ROLES = new Set<SystemRole>(['Owner', 'Manager', 'Receptionist', 'Stylist']);
const STAFF_UPDATE_FIELDS = new Set([
    'name',
    'phone',
    'system_role',
    'org_role_id',
    'branch_id',
    'specializations',
    'working_days',
    'working_hours',
    'salary',
    'commission',
    'is_active',
]);

async function getCallerContext(request: NextRequest): Promise<CallerContext | null> {
    const token = getBearerToken(request);
    if (!token) return null;

    const authedClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: { autoRefreshToken: false, persistSession: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
        }
    );

    const { data: { user }, error: authError } = await authedClient.auth.getUser();
    if (authError || !user) return null;

    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('organization_id, system_role, is_active')
        .eq('id', user.id)
        .maybeSingle();

    if (
        profileError ||
        !profile?.organization_id ||
        profile.is_active !== true ||
        !SYSTEM_ROLES.has(profile.system_role as SystemRole)
    ) {
        return null;
    }

    return {
        userId: user.id,
        organizationId: profile.organization_id,
        role: profile.system_role as SystemRole,
    };
}

export async function PUT(request: NextRequest) {
    try {
        const caller = await getCallerContext(request);
        if (!caller) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        if (!['Owner', 'Manager'].includes(caller.role)) {
            return NextResponse.json(
                { success: false, error: 'Forbidden: insufficient role' },
                { status: 403 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const { id, updates, organization_id: requestedOrganizationId } = body;

        if (!id || typeof id !== 'string') {
            return NextResponse.json(
                { success: false, error: 'Staff ID is required' },
                { status: 400 }
            );
        }

        if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
            return NextResponse.json(
                { success: false, error: 'updates must be an object' },
                { status: 400 }
            );
        }

        // The tenant comes from the authenticated profile. A body value is accepted
        // only for backwards compatibility and must match the authenticated tenant.
        if (requestedOrganizationId && requestedOrganizationId !== caller.organizationId) {
            return NextResponse.json(
                { success: false, error: 'Forbidden: organization mismatch' },
                { status: 403 }
            );
        }

        const invalidFields = Object.keys(updates).filter((key) => !STAFF_UPDATE_FIELDS.has(key));
        if (invalidFields.length > 0) {
            return NextResponse.json(
                { success: false, error: `Unsupported update fields: ${invalidFields.join(', ')}` },
                { status: 400 }
            );
        }

        const { data: targetStaff, error: targetError } = await supabaseAdmin
            .from('staff')
            .select('*')
            .eq('id', id)
            .eq('organization_id', caller.organizationId)
            .maybeSingle();

        if (targetError || !targetStaff) {
            return NextResponse.json(
                { success: false, error: 'Staff member not found in your organization' },
                { status: 404 }
            );
        }

        if (caller.role === 'Manager' && ['Owner', 'Manager'].includes(targetStaff.system_role)) {
            return NextResponse.json(
                { success: false, error: 'Managers cannot modify Owners or other Managers' },
                { status: 403 }
            );
        }

        const staffUpdates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
            if (STAFF_UPDATE_FIELDS.has(key)) staffUpdates[key] = value;
        }

        if (staffUpdates.branch_id !== undefined) {
            if (typeof staffUpdates.branch_id !== 'string') {
                return NextResponse.json(
                    { success: false, error: 'branch_id must be a valid branch ID' },
                    { status: 400 }
                );
            }
            const { data: branch } = await supabaseAdmin
                .from('branches')
                .select('id')
                .eq('id', staffUpdates.branch_id)
                .eq('organization_id', caller.organizationId)
                .eq('is_active', true)
                .maybeSingle();
            if (!branch) {
                return NextResponse.json(
                    { success: false, error: 'Selected branch does not belong to your organization' },
                    { status: 400 }
                );
            }
        }

        let requestedRole = staffUpdates.system_role as SystemRole | undefined;
        if (requestedRole && !SYSTEM_ROLES.has(requestedRole)) {
            return NextResponse.json(
                { success: false, error: 'Invalid system_role' },
                { status: 400 }
            );
        }

        if (staffUpdates.org_role_id !== undefined) {
            if (typeof staffUpdates.org_role_id !== 'string') {
                return NextResponse.json(
                    { success: false, error: 'org_role_id must be a valid role ID' },
                    { status: 400 }
                );
            }
            const { data: organizationRole } = await supabaseAdmin
                .from('organization_roles')
                .select('system_role')
                .eq('id', staffUpdates.org_role_id)
                .eq('organization_id', caller.organizationId)
                .maybeSingle();
            if (!organizationRole || !SYSTEM_ROLES.has(organizationRole.system_role as SystemRole)) {
                return NextResponse.json(
                    { success: false, error: 'Selected role does not belong to your organization' },
                    { status: 400 }
                );
            }
            if (requestedRole && requestedRole !== organizationRole.system_role) {
                return NextResponse.json(
                    { success: false, error: 'system_role does not match org_role_id' },
                    { status: 400 }
                );
            }
            requestedRole = organizationRole.system_role as SystemRole;
            staffUpdates.system_role = requestedRole;
        }

        const isChangingAuthorization =
            staffUpdates.system_role !== undefined || staffUpdates.org_role_id !== undefined;
        if (isChangingAuthorization && caller.role !== 'Owner') {
            return NextResponse.json(
                { success: false, error: 'Only Owners can change staff roles' },
                { status: 403 }
            );
        }

        if (Object.keys(staffUpdates).length === 0) {
            return NextResponse.json(
                { success: false, error: 'No supported update fields supplied' },
                { status: 400 }
            );
        }

        // Update staff entry using admin client (bypasses RLS)
        const { data, error: staffError } = await supabaseAdmin
            .from('staff')
            .update(staffUpdates)
            .eq('id', id)
            .eq('organization_id', caller.organizationId)
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
        if (
            updates.name !== undefined ||
            staffUpdates.system_role !== undefined ||
            updates.org_role_id !== undefined ||
            updates.branch_id !== undefined ||
            updates.is_active !== undefined
        ) {
            const staff = data[0];
            if (staff?.profile_id) {
                const profileUpdates: Record<string, unknown> = {};
                if (updates.name !== undefined) profileUpdates.name = updates.name;
                if (staffUpdates.system_role !== undefined) profileUpdates.system_role = staffUpdates.system_role;
                if (updates.org_role_id !== undefined) profileUpdates.org_role_id = updates.org_role_id;
                if (updates.branch_id !== undefined) profileUpdates.branch_id = updates.branch_id;
                if (updates.is_active !== undefined) profileUpdates.is_active = updates.is_active;

                const { error: profileError } = await supabaseAdmin
                    .from('profiles')
                    .update(profileUpdates)
                    .eq('id', staff.profile_id)
                    .eq('organization_id', caller.organizationId);

                if (profileError) {
                    const rollback: Record<string, unknown> = {};
                    for (const key of Object.keys(staffUpdates)) {
                        rollback[key] = (targetStaff as Record<string, unknown>)[key];
                    }
                    await supabaseAdmin
                        .from('staff')
                        .update(rollback)
                        .eq('id', id)
                        .eq('organization_id', caller.organizationId);

                    console.error('Profile update failed; staff update rolled back:', profileError);
                    return NextResponse.json(
                        { success: false, error: 'Failed to synchronize staff authorization profile' },
                        { status: 500 }
                    );
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
        const caller = await getCallerContext(request);
        if (!caller) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Only Owners and Managers can change passwords
        if (!['Owner', 'Manager'].includes(caller.role)) {
            return NextResponse.json({ success: false, error: 'Forbidden: insufficient role' }, { status: 403 });
        }

        const { staffId, newPassword } = await request.json();
        if (!staffId || !newPassword) {
            return NextResponse.json({ success: false, error: 'staffId and newPassword are required' }, { status: 400 });
        }

        // Verify the target staff belongs to the caller's organization
        const { data: targetStaff } = await supabaseAdmin
            .from('staff')
            .select('profile_id, organization_id, system_role')
            .eq('id', staffId)
            .eq('organization_id', caller.organizationId)
            .maybeSingle();

        if (!targetStaff?.profile_id) {
            return NextResponse.json({ success: false, error: 'Staff member not found in your organization' }, { status: 404 });
        }

        if (caller.role === 'Manager' && ['Owner', 'Manager'].includes(targetStaff.system_role)) {
            return NextResponse.json(
                { success: false, error: 'Managers cannot reset passwords for Owners or other Managers' },
                { status: 403 }
            );
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
