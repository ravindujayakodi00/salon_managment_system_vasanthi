import type { SupabaseClient } from '@supabase/supabase-js';

const configuredOrganizationId = process.env.NEXT_PUBLIC_ORGANIZATION_ID?.trim() || '';
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolve organization id for public (unauthenticated) booking APIs.
 * Prefer slug (stable); accept raw UUID when valid.
 */
export async function resolvePublicOrganizationId(
    admin: SupabaseClient,
    slugOrId: string | null | undefined
): Promise<{ organizationId: string; slug: string } | null> {
    if (!slugOrId || !String(slugOrId).trim()) return null;
    // Each branded deployment is bound to exactly one organization. The value is
    // public configuration, but callers cannot use this API as a gateway to another
    // active organization in the shared database.
    if (!uuidRe.test(configuredOrganizationId)) return null;

    const raw = String(slugOrId).trim();
    if (uuidRe.test(raw)) {
        if (raw.toLowerCase() !== configuredOrganizationId.toLowerCase()) return null;
        const { data, error } = await admin
            .from('organizations')
            .select('id, slug')
            .eq('id', configuredOrganizationId)
            .eq('is_active', true)
            .maybeSingle();
        if (error || !data) return null;
        return { organizationId: data.id, slug: data.slug };
    }
    const { data, error } = await admin
        .from('organizations')
        .select('id, slug')
        .eq('id', configuredOrganizationId)
        .eq('slug', raw)
        .eq('is_active', true)
        .maybeSingle();
    if (error || !data) return null;
    return { organizationId: data.id, slug: data.slug };
}

export async function assertBranchInOrganization(
    admin: SupabaseClient,
    branchId: string,
    organizationId: string
): Promise<boolean> {
    const { data, error } = await admin
        .from('branches')
        .select('id')
        .eq('id', branchId)
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .maybeSingle();
    return !error && !!data;
}
