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
import { applyOrganizationPalettes } from '@/lib/color-palette';

/** Fixed dashboard palette (matches `globals.css` / DB column defaults). */
const DEFAULT_PRIMARY = '#4B5945';
const DEFAULT_SECONDARY = '#0d9488';

export interface BrandingContextValue {
    displayName: string;
    tagline: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    /** Re-apply fixed default theme (e.g. after client-side navigation). */
    resetTheme: () => void;
}

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

/** App theme uses fixed defaults (no per-organization color overrides). */
function applyDefaultTheme() {
    if (typeof document === 'undefined') return;
    applyOrganizationPalettes(document.documentElement, DEFAULT_PRIMARY, DEFAULT_SECONDARY);
}

export function BrandingProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();

    const resetTheme = useCallback(() => {
        applyDefaultTheme();
    }, []);

    useEffect(() => {
        applyDefaultTheme();
    }, [user?.organization?.id]);

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
            primaryColor: DEFAULT_PRIMARY,
            secondaryColor: DEFAULT_SECONDARY,
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

