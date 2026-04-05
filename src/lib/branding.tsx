'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    type ReactNode,
} from 'react';
import { useAuth } from '@/lib/auth';
import type { Organization } from '@/lib/types';
import { applyOrganizationPalettes } from '@/lib/color-palette';

/** Build-time fallbacks when org has no saved colors (matches DB column defaults). */
const DEFAULT_PRIMARY = '#4B5945';
const DEFAULT_SECONDARY = '#0d9488';

export interface BrandingContextValue {
    displayName: string;
    tagline: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    /** Re-apply theme from current user.organization (e.g. after leaving branding preview) */
    resetTheme: () => void;
}

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

function applyOrganizationTheme(org: Organization | null | undefined) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const primary = org?.primary_color?.trim() || DEFAULT_PRIMARY;
    const secondary = org?.secondary_color?.trim() || DEFAULT_SECONDARY;
    applyOrganizationPalettes(root, primary, secondary);
}

export function BrandingProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();

    const resetTheme = useCallback(() => {
        applyOrganizationTheme(user?.organization ?? null);
    }, [
        user?.organization?.id,
        user?.organization?.primary_color,
        user?.organization?.secondary_color,
        user?.organization?.updated_at,
    ]);

    /** Re-apply whenever org id or saved brand colors change (not just object reference). */
    useEffect(() => {
        applyOrganizationTheme(user?.organization ?? null);
    }, [
        user?.organization?.id,
        user?.organization?.primary_color,
        user?.organization?.secondary_color,
        user?.organization?.updated_at,
    ]);

    const value = useMemo<BrandingContextValue>(() => {
        const org = user?.organization;
        const displayName =
            (org?.display_name && org.display_name.trim()) ||
            user?.organizationName ||
            org?.name ||
            'SalonFlow';
        const tagline =
            (org?.tagline && org.tagline.trim()) || 'Salon Management';

        return {
            displayName,
            tagline,
            logoUrl: org?.logo_url ?? null,
            faviconUrl: org?.favicon_url ?? null,
            primaryColor: org?.primary_color?.trim() || DEFAULT_PRIMARY,
            secondaryColor: org?.secondary_color?.trim() || DEFAULT_SECONDARY,
            resetTheme,
        };
    }, [user?.organization, user?.organizationName, resetTheme]);

    return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingContextValue {
    const ctx = useContext(BrandingContext);
    if (!ctx) {
        throw new Error('useBranding must be used within BrandingProvider');
    }
    return ctx;
}

/** Apply hex colors to document root (e.g. live preview on settings). */
export function previewBrandingColors(primaryHex: string, secondaryHex: string) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    applyOrganizationPalettes(root, primaryHex || DEFAULT_PRIMARY, secondaryHex || DEFAULT_SECONDARY);
}
