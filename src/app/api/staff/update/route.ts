import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

        console.log('API: Updating staff:', id, updates);

        // Update staff entry using admin client (bypasses RLS)
        const { data, error: staffError } = await supabaseAdmin
            .from('staff')
            .update(updates)
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

        console.log('Staff updated successfully:', data[0]);

        // If name or role changed, update profile too
        if (updates.name || updates.role) {
            const staff = data[0];
            if (staff?.profile_id) {
                const profileUpdates: any = {};
                if (updates.name) profileUpdates.name = updates.name;
                if (updates.role) profileUpdates.role = updates.role;

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
