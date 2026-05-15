import { supabase } from '@/lib/supabase';
import type { OrgRole, SystemRole } from '@/lib/types';

export const orgRolesService = {
    /**
     * Get all roles for an organization, ordered by system_role priority then display_name.
     */
    async getOrgRoles(organizationId: string): Promise<OrgRole[]> {
        const { data, error } = await supabase
            .from('organization_roles')
            .select('id, organization_id, display_name, system_role, is_deletable')
            .eq('organization_id', organizationId)
            .order('display_name');

        if (error) throw error;

        return (data || []).map((r) => ({
            id: r.id,
            organizationId: r.organization_id,
            displayName: r.display_name,
            systemRole: r.system_role as SystemRole,
            isDeletable: r.is_deletable,
        }));
    },

    /**
     * Get roles available for staff creation (excludes Owner).
     */
    async getAssignableRoles(organizationId: string): Promise<OrgRole[]> {
        const { data, error } = await supabase
            .from('organization_roles')
            .select('id, organization_id, display_name, system_role, is_deletable')
            .eq('organization_id', organizationId)
            .neq('system_role', 'Owner')
            .order('display_name');

        if (error) throw error;

        return (data || []).map((r) => ({
            id: r.id,
            organizationId: r.organization_id,
            displayName: r.display_name,
            systemRole: r.system_role as SystemRole,
            isDeletable: r.is_deletable,
        }));
    },

    /**
     * Look up the system_role for a given display_name within an organization.
     * Returns null if the role is not found.
     */
    async getSystemRole(organizationId: string, displayName: string): Promise<SystemRole | null> {
        const { data, error } = await supabase
            .from('organization_roles')
            .select('system_role')
            .eq('organization_id', organizationId)
            .eq('display_name', displayName)
            .maybeSingle();

        if (error) throw error;
        return data ? (data.system_role as SystemRole) : null;
    },
};
