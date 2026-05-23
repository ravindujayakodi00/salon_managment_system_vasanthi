import { supabase } from '@/lib/supabase';
import type { OrgRole, SystemRole } from '@/lib/types';

const SELECT_COLUMNS =
    'id, organization_id, display_name, system_role, role_level, is_deletable, ' +
    'can_earn_commission, is_bookable, can_manage_staff, can_manage_settings, ' +
    'can_view_all_earnings, can_view_reports, can_process_pos';

function mapRow(r: any): OrgRole {
    return {
        id: r.id,
        organizationId: r.organization_id,
        displayName: r.display_name,
        systemRole: r.system_role,
        roleLevel: r.role_level ?? 4,
        isDeletable: r.is_deletable,
        canEarnCommission: r.can_earn_commission ?? false,
        isBookable: r.is_bookable ?? false,
        canManageStaff: r.can_manage_staff ?? false,
        canManageSettings: r.can_manage_settings ?? false,
        canViewAllEarnings: r.can_view_all_earnings ?? false,
        canViewReports: r.can_view_reports ?? false,
        canProcessPos: r.can_process_pos ?? false,
    };
}

export const orgRolesService = {
    /**
     * Get all roles for an organization, ordered by role_level then display_name.
     */
    async getOrgRoles(organizationId: string): Promise<OrgRole[]> {
        const { data, error } = await supabase
            .from('organization_roles')
            .select(SELECT_COLUMNS)
            .eq('organization_id', organizationId)
            .order('role_level')
            .order('display_name');

        if (error) throw error;
        return (data || []).map(mapRow);
    },

    /**
     * Get roles available for staff assignment (excludes Owner).
     */
    async getAssignableRoles(organizationId: string): Promise<OrgRole[]> {
        const { data, error } = await supabase
            .from('organization_roles')
            .select(SELECT_COLUMNS)
            .eq('organization_id', organizationId)
            .neq('system_role', 'Owner')
            .order('role_level')
            .order('display_name');

        if (error) throw error;
        return (data || []).map(mapRow);
    },

    /**
     * Get a single org role by its ID.
     */
    async getOrgRoleById(id: string): Promise<OrgRole | null> {
        const { data, error } = await supabase
            .from('organization_roles')
            .select(SELECT_COLUMNS)
            .eq('id', id)
            .maybeSingle();

        if (error) throw error;
        return data ? mapRow(data) : null;
    },

    /**
     * Look up the system_role for a given display_name within an organization.
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

    /**
     * Create a new custom role for an organization.
     */
    async createRole(organizationId: string, params: {
        displayName: string;
        systemRole: string;
        roleLevel: number;
        canEarnCommission?: boolean;
        isBookable?: boolean;
        canManageStaff?: boolean;
        canManageSettings?: boolean;
        canViewAllEarnings?: boolean;
        canViewReports?: boolean;
        canProcessPos?: boolean;
    }): Promise<OrgRole> {
        const { data, error } = await supabase
            .from('organization_roles')
            .insert({
                organization_id: organizationId,
                display_name: params.displayName,
                system_role: params.systemRole,
                role_level: params.roleLevel,
                is_deletable: true,
                can_earn_commission: params.canEarnCommission ?? false,
                is_bookable: params.isBookable ?? false,
                can_manage_staff: params.canManageStaff ?? false,
                can_manage_settings: params.canManageSettings ?? false,
                can_view_all_earnings: params.canViewAllEarnings ?? false,
                can_view_reports: params.canViewReports ?? false,
                can_process_pos: params.canProcessPos ?? false,
            })
            .select(SELECT_COLUMNS)
            .single();

        if (error) throw error;
        return mapRow(data);
    },

    /**
     * Update an existing role's display name and/or feature flags.
     */
    async updateRole(id: string, params: Partial<{
        displayName: string;
        systemRole: string;
        roleLevel: number;
        canEarnCommission: boolean;
        isBookable: boolean;
        canManageStaff: boolean;
        canManageSettings: boolean;
        canViewAllEarnings: boolean;
        canViewReports: boolean;
        canProcessPos: boolean;
    }>): Promise<OrgRole> {
        const updates: Record<string, unknown> = {};
        if (params.displayName !== undefined) updates.display_name = params.displayName;
        if (params.systemRole !== undefined) updates.system_role = params.systemRole;
        if (params.roleLevel !== undefined) updates.role_level = params.roleLevel;
        if (params.canEarnCommission !== undefined) updates.can_earn_commission = params.canEarnCommission;
        if (params.isBookable !== undefined) updates.is_bookable = params.isBookable;
        if (params.canManageStaff !== undefined) updates.can_manage_staff = params.canManageStaff;
        if (params.canManageSettings !== undefined) updates.can_manage_settings = params.canManageSettings;
        if (params.canViewAllEarnings !== undefined) updates.can_view_all_earnings = params.canViewAllEarnings;
        if (params.canViewReports !== undefined) updates.can_view_reports = params.canViewReports;
        if (params.canProcessPos !== undefined) updates.can_process_pos = params.canProcessPos;

        const { data, error } = await supabase
            .from('organization_roles')
            .update(updates)
            .eq('id', id)
            .select(SELECT_COLUMNS)
            .single();

        if (error) throw error;
        return mapRow(data);
    },

    /**
     * Delete a custom role (only deletable roles can be removed).
     */
    async deleteRole(id: string): Promise<void> {
        const { error } = await supabase
            .from('organization_roles')
            .delete()
            .eq('id', id)
            .eq('is_deletable', true);

        if (error) throw error;
    },
};
