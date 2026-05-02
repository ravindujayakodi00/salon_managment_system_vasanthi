import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolvePublicOrganizationId, assertBranchInOrganization } from '@/lib/public-tenant';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/public/stylists
 * 
 * Returns stylists filtered by service capability.
 * 
 * Query params:
 * - service_id: (required) Filter stylists who can perform this service
 * - branch_id: (optional) Filter by branch
 * - date: (optional) Filter out unavailable stylists for this date
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const serviceId = searchParams.get('service_id');
        const branchId = searchParams.get('branch_id');
        const date = searchParams.get('date');
        const orgSlug = searchParams.get('organization_slug') || searchParams.get('organization_id');

        const resolved = await resolvePublicOrganizationId(supabase, orgSlug);
        if (!resolved) {
            return NextResponse.json(
                { success: false, error: 'organization_slug or organization_id is required and must be valid' },
                { status: 400 }
            );
        }
        const organizationId = resolved.organizationId;

        if (!serviceId) {
            return NextResponse.json(
                { success: false, error: 'service_id is required' },
                { status: 400 }
            );
        }

        if (branchId) {
            const ok = await assertBranchInOrganization(supabase, branchId, organizationId);
            if (!ok) {
                return NextResponse.json(
                    { success: false, error: 'Invalid branch for this organization' },
                    { status: 400 }
                );
            }
        }

        let query = supabase
            .from('staff')
            .select('id, name, phone, specializations, working_days, working_hours, is_emergency_unavailable')
            .eq('role', 'Stylist')
            .eq('is_active', true)
            .eq('is_emergency_unavailable', false)
            .eq('organization_id', organizationId)
            .contains('specializations', [serviceId]);

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data: stylists, error } = await query;

        if (error) {
            console.error('Error fetching stylists:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to fetch stylists' },
                { status: 500 }
            );
        }

        // If date provided, filter out stylists who are unavailable on that date
        let availableStylists = stylists || [];

        if (date && stylists && stylists.length > 0) {
            const stylistIds = stylists.map(s => s.id);

            // Check for unavailability records
            const { data: unavailability } = await supabase
                .from('stylist_unavailability')
                .select('stylist_id')
                .eq('organization_id', organizationId)
                .in('stylist_id', stylistIds)
                .eq('unavailable_date', date);

            const unavailableIds = new Set(unavailability?.map(u => u.stylist_id) || []);

            // Filter out unavailable stylists and those not working on this day
            const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });

            availableStylists = stylists.filter(s => {
                if (unavailableIds.has(s.id)) return false;
                if (s.working_days && !s.working_days.includes(dayOfWeek)) return false;
                return true;
            });
        }

        // Get service details for skill names
        const { data: services } = await supabase
            .from('services')
            .select('id, name, category')
            .eq('is_active', true)
            .eq('organization_id', organizationId);

        const serviceMap = new Map(services?.map(s => [s.id, s]) || []);

        // Enrich stylists with skill names
        const enrichedStylists = availableStylists.map(stylist => ({
            id: stylist.id,
            name: stylist.name,
            workingDays: stylist.working_days,
            workingHours: stylist.working_hours,
            skills: (stylist.specializations || [])
                .map((id: string) => serviceMap.get(id))
                .filter(Boolean)
                .map((s: any) => ({ id: s.id, name: s.name, category: s.category }))
        }));

        return NextResponse.json({
            success: true,
            data: enrichedStylists,
            total: enrichedStylists.length
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
