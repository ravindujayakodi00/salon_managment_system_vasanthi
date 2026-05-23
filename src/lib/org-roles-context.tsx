'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { orgRolesService } from '@/services/orgRoles';
import type { OrgRole } from '@/lib/types';

interface OrgRolesContextType {
    /** All roles defined for this organization, ordered by role_level. */
    orgRoles: OrgRole[];
    /** The specific org role for the currently logged-in user (based on user.orgRoleId). */
    myRole: OrgRole | null;
    loading: boolean;
    /** Re-fetch org roles from the database. */
    refetch: () => Promise<void>;
}

const OrgRolesContext = createContext<OrgRolesContextType | undefined>(undefined);

export function OrgRolesProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [orgRoles, setOrgRoles] = useState<OrgRole[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchRoles = async () => {
        if (!user?.organizationId) {
            setOrgRoles([]);
            return;
        }
        setLoading(true);
        try {
            const roles = await orgRolesService.getOrgRoles(user.organizationId);
            setOrgRoles(roles);
        } catch {
            setOrgRoles([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchRoles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.organizationId]);

    // Find the current user's specific role by their orgRoleId, or fall back to systemRole match
    const myRole: OrgRole | null =
        orgRoles.find((r) => r.id === user?.orgRoleId) ??
        orgRoles.find((r) => r.systemRole === user?.systemRole && !r.isDeletable) ??
        orgRoles.find((r) => r.systemRole === user?.systemRole) ??
        null;

    return (
        <OrgRolesContext.Provider value={{ orgRoles, myRole, loading, refetch: fetchRoles }}>
            {children}
        </OrgRolesContext.Provider>
    );
}

export function useOrgRoles() {
    const ctx = useContext(OrgRolesContext);
    if (!ctx) {
        throw new Error('useOrgRoles must be used within OrgRolesProvider');
    }
    return ctx;
}

/**
 * Returns whether the current user has a specific feature flag enabled.
 * Falls back to system_role-based defaults if org_roles are not yet loaded.
 */
export function useFeatureFlag(flag: keyof Pick<OrgRole,
    | 'canEarnCommission'
    | 'isBookable'
    | 'canManageStaff'
    | 'canManageSettings'
    | 'canViewAllEarnings'
    | 'canViewReports'
    | 'canProcessPos'
>): boolean {
    const { myRole } = useOrgRoles();
    if (myRole) return myRole[flag];
    return false;
}
