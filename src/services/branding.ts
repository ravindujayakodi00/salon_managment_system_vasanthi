import { supabase } from '@/lib/supabase';
import type { Organization } from '@/lib/types';

export type BrandingUpdate = Partial<
    Pick<
        Organization,
        | 'display_name'
        | 'tagline'
        | 'logo_url'
        | 'favicon_url'
        | 'primary_color'
        | 'secondary_color'
        | 'accent_color'
        | 'contact_email'
        | 'contact_phone'
        | 'timezone'
    >
>;

const BUCKET = 'salon-assets';

/** Exported for UI error toasts when Supabase errors do not serialize well. */
export function formatUnknownError(err: unknown): string {
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === 'object' && err !== null) {
        const o = err as Record<string, unknown>;
        if (typeof o.message === 'string' && o.message) return o.message;
        if (typeof o.error_description === 'string') return o.error_description;
        if (typeof o.hint === 'string' && o.hint) return o.hint;
        if (typeof o.details === 'string' && o.details) return o.details;
        if (typeof o.code === 'string' && o.code) {
            const bits = [o.code, typeof o.message === 'string' ? o.message : ''].filter(Boolean);
            if (bits.length) return bits.join(': ');
        }
        try {
            const s = JSON.stringify(err, Object.getOwnPropertyNames(err));
            if (s && s !== '{}') return s;
        } catch {
            /* ignore */
        }
    }
    return String(err);
}

function mergeBranding(current: Organization, updates: BrandingUpdate): Required<
    Pick<
        Organization,
        | 'display_name'
        | 'tagline'
        | 'logo_url'
        | 'favicon_url'
        | 'primary_color'
        | 'secondary_color'
        | 'accent_color'
        | 'contact_email'
        | 'contact_phone'
        | 'timezone'
    >
> {
    const next = { ...updates };
    return {
        display_name: next.display_name !== undefined ? next.display_name : current.display_name ?? null,
        tagline: next.tagline !== undefined ? next.tagline : current.tagline ?? null,
        logo_url: next.logo_url !== undefined ? next.logo_url : current.logo_url ?? null,
        favicon_url: next.favicon_url !== undefined ? next.favicon_url : current.favicon_url ?? null,
        primary_color: next.primary_color !== undefined ? next.primary_color : current.primary_color ?? null,
        secondary_color: next.secondary_color !== undefined ? next.secondary_color : current.secondary_color ?? null,
        accent_color: next.accent_color !== undefined ? next.accent_color : current.accent_color ?? null,
        contact_email: next.contact_email !== undefined ? next.contact_email : current.contact_email ?? null,
        contact_phone: next.contact_phone !== undefined ? next.contact_phone : current.contact_phone ?? null,
        timezone: next.timezone !== undefined ? next.timezone : current.timezone ?? null,
    };
}

export const brandingService = {
    /**
     * Load org row for branding merge. Uses RPC so reads succeed when direct SELECT
     * under RLS returns 0 rows (profile.organization_id still matches).
     */
    async getBranding(organizationId: string): Promise<Organization | null> {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_organization_branding', {
            p_organization_id: organizationId,
        });

        if (!rpcError) {
            const row = rpcData as Organization | null;
            if (row) return row;
        }

        const { data, error } = await supabase
            .from('organizations')
            .select(
                'id, name, slug, is_active, created_at, updated_at, display_name, tagline, logo_url, favicon_url, primary_color, secondary_color, accent_color, contact_email, contact_phone, timezone'
            )
            .eq('id', organizationId)
            .maybeSingle();

        if (error) throw new Error(formatUnknownError(error));
        return data as Organization | null;
    },

    /**
     * Persists branding via RPC (SECURITY DEFINER) so RLS cannot block updates with "0 rows".
     */
    async updateBranding(organizationId: string, updates: BrandingUpdate): Promise<Organization> {
        const current = await this.getBranding(organizationId);
        if (!current) {
            throw new Error('Organization not found');
        }

        const m = mergeBranding(current, updates);

        const { data, error } = await supabase.rpc('update_organization_branding', {
            p_organization_id: organizationId,
            p_display_name: m.display_name,
            p_tagline: m.tagline,
            p_logo_url: m.logo_url,
            p_favicon_url: m.favicon_url,
            p_primary_color: m.primary_color,
            p_secondary_color: m.secondary_color,
            p_accent_color: m.accent_color,
            p_contact_email: m.contact_email,
            p_contact_phone: m.contact_phone,
            p_timezone: m.timezone,
        });

        if (error) throw new Error(formatUnknownError(error));

        const row = data as Organization | Organization[] | null;
        const org = Array.isArray(row) ? row[0] : row;
        if (!org) {
            throw new Error('Branding save returned no data. Apply migration 20260405_update_organization_branding_rpc.sql.');
        }
        return org as Organization;
    },

    /**
     * Upload logo to salon-assets/{organizationId}/logo-{timestamp}.{ext}
     * Uses a unique path per upload so Storage only needs INSERT (upsert UPDATE can fail RLS in some setups).
     */
    async uploadLogo(organizationId: string, file: File): Promise<string> {
        const ext = (file.name.split('.').pop() || 'png').toLowerCase();
        const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext) ? ext : 'png';
        const path = `${organizationId}/logo-${Date.now()}.${safeExt}`;

        const contentType =
            file.type ||
            (safeExt === 'svg'
                ? 'image/svg+xml'
                : safeExt === 'png'
                  ? 'image/png'
                  : safeExt === 'webp'
                    ? 'image/webp'
                    : 'image/jpeg');

        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType,
        });

        if (uploadError) {
            throw new Error(
                `Storage: ${formatUnknownError(uploadError)}. Ensure migration 20260404 ran (bucket "salon-assets") and you are logged in as Owner of this organization.`
            );
        }

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        if (!pub?.publicUrl) {
            throw new Error('Could not resolve public URL for uploaded logo');
        }
        return pub.publicUrl;
    },
};
