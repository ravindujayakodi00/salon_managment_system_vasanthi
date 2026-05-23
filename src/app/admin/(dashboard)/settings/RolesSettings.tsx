'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Shield, Save, X, Loader } from 'lucide-react';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import { useOrgRoles } from '@/lib/org-roles-context';
import { orgRolesService } from '@/services/orgRoles';
import { useAuth } from '@/lib/auth';
import type { OrgRole } from '@/lib/types';

const SYSTEM_ROLE_OPTIONS = [
    { value: 'Owner', label: 'Owner', level: 1 },
    { value: 'Manager', label: 'Manager', level: 2 },
    { value: 'Receptionist', label: 'Receptionist', level: 3 },
    { value: 'Stylist', label: 'Stylist', level: 4 },
];

const ROLE_LEVEL_LABEL: Record<number, string> = {
    1: 'Owner tier',
    2: 'Manager tier',
    3: 'Receptionist tier',
    4: 'Staff tier',
};

const FLAG_LABELS: { key: keyof OrgRole; label: string; description: string }[] = [
    { key: 'canManageStaff', label: 'Manage Staff', description: 'Create, edit, and deactivate staff members' },
    { key: 'canManageSettings', label: 'Manage Settings', description: 'Access and modify system settings' },
    { key: 'canViewAllEarnings', label: 'View All Earnings', description: 'See earnings from all staff members' },
    { key: 'canViewReports', label: 'View Reports', description: 'Access financial and performance reports' },
    { key: 'canProcessPos', label: 'Process POS', description: 'Create invoices and process payments' },
    { key: 'isBookable', label: 'Bookable', description: 'Can be assigned to appointments and services' },
    { key: 'canEarnCommission', label: 'Earn Commission', description: 'Receives commission on completed services' },
];

interface RoleFormState {
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
}

function defaultFormForSystemRole(systemRole: string): RoleFormState {
    const level = SYSTEM_ROLE_OPTIONS.find(r => r.value === systemRole)?.level ?? 4;
    return {
        displayName: '',
        systemRole,
        roleLevel: level,
        canManageStaff: level <= 2,
        canManageSettings: level <= 2,
        canViewAllEarnings: level <= 2,
        canViewReports: level <= 2,
        canProcessPos: level <= 3,
        isBookable: level >= 3,
        canEarnCommission: level >= 4,
    };
}

function roleFormFromOrgRole(role: OrgRole): RoleFormState {
    return {
        displayName: role.displayName,
        systemRole: role.systemRole,
        roleLevel: role.roleLevel,
        canEarnCommission: role.canEarnCommission,
        isBookable: role.isBookable,
        canManageStaff: role.canManageStaff,
        canManageSettings: role.canManageSettings,
        canViewAllEarnings: role.canViewAllEarnings,
        canViewReports: role.canViewReports,
        canProcessPos: role.canProcessPos,
    };
}

export default function RolesSettings({ showMessage }: { showMessage: (type: 'success' | 'error', text: string) => void }) {
    const { user } = useAuth();
    const { orgRoles, loading, refetch } = useOrgRoles();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [form, setForm] = useState<RoleFormState>(defaultFormForSystemRole('Stylist'));

    const orgId = user?.organizationId;

    const startEdit = (role: OrgRole) => {
        setAdding(false);
        setEditingId(role.id);
        setForm(roleFormFromOrgRole(role));
    };

    const startAdd = () => {
        setEditingId(null);
        setAdding(true);
        setForm(defaultFormForSystemRole('Stylist'));
    };

    const cancelForm = () => {
        setEditingId(null);
        setAdding(false);
    };

    const handleSystemRoleChange = (value: string) => {
        const level = SYSTEM_ROLE_OPTIONS.find(r => r.value === value)?.level ?? 4;
        setForm(prev => ({
            ...prev,
            systemRole: value,
            roleLevel: level,
            canManageStaff: level <= 2,
            canManageSettings: level <= 2,
            canViewAllEarnings: level <= 2,
            canViewReports: level <= 2,
            canProcessPos: level <= 3,
            isBookable: level >= 3,
            canEarnCommission: level >= 4,
        }));
    };

    const handleSave = async () => {
        if (!orgId) return;
        if (!form.displayName.trim()) {
            showMessage('error', 'Role name is required');
            return;
        }
        setSaving(true);
        try {
            if (adding) {
                await orgRolesService.createRole(orgId, {
                    displayName: form.displayName.trim(),
                    systemRole: form.systemRole,
                    roleLevel: form.roleLevel,
                    canEarnCommission: form.canEarnCommission,
                    isBookable: form.isBookable,
                    canManageStaff: form.canManageStaff,
                    canManageSettings: form.canManageSettings,
                    canViewAllEarnings: form.canViewAllEarnings,
                    canViewReports: form.canViewReports,
                    canProcessPos: form.canProcessPos,
                });
                showMessage('success', 'Role created');
            } else if (editingId) {
                await orgRolesService.updateRole(editingId, {
                    displayName: form.displayName.trim(),
                    systemRole: form.systemRole,
                    roleLevel: form.roleLevel,
                    canEarnCommission: form.canEarnCommission,
                    isBookable: form.isBookable,
                    canManageStaff: form.canManageStaff,
                    canManageSettings: form.canManageSettings,
                    canViewAllEarnings: form.canViewAllEarnings,
                    canViewReports: form.canViewReports,
                    canProcessPos: form.canProcessPos,
                });
                showMessage('success', 'Role updated');
            }
            cancelForm();
            await refetch();
        } catch (e: any) {
            showMessage('error', e.message || 'Failed to save role');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (role: OrgRole) => {
        if (!role.isDeletable) return;
        if (!confirm(`Delete "${role.displayName}"? Staff assigned to this role will lose their role assignment.`)) return;
        setDeleting(role.id);
        try {
            await orgRolesService.deleteRole(role.id);
            showMessage('success', 'Role deleted');
            await refetch();
        } catch (e: any) {
            showMessage('error', e.message || 'Failed to delete role');
        } finally {
            setDeleting(null);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader className="h-8 w-8 animate-spin text-primary-600" />
            </div>
        );
    }

    const isFormOpen = adding || !!editingId;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary-600" />
                        Roles & Permissions
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Define custom roles and control what each role can access.
                    </p>
                </div>
                {!isFormOpen && (
                    <Button variant="primary" onClick={startAdd}>
                        <Plus className="h-4 w-4" />
                        Add Role
                    </Button>
                )}
            </div>

            {/* Add / Edit form */}
            {isFormOpen && (
                <div className="border border-primary-200 dark:border-primary-800 rounded-xl p-5 bg-primary-50/50 dark:bg-primary-950/30 space-y-5">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                        {adding ? 'New Role' : `Edit — ${orgRoles.find(r => r.id === editingId)?.displayName}`}
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Role Name <span className="text-danger-500">*</span>
                            </label>
                            <Input
                                value={form.displayName}
                                onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
                                placeholder="e.g. Senior Stylist"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Permission Tier
                            </label>
                            <select
                                value={form.systemRole}
                                onChange={e => handleSystemRoleChange(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                {SYSTEM_ROLE_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label} ({ROLE_LEVEL_LABEL[opt.level]})
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Sets the base permission level. Feature flags below override specifics.
                            </p>
                        </div>
                    </div>

                    <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Feature Flags</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {FLAG_LABELS.map(({ key, label, description }) => (
                                <label key={key} className="flex items-start gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={!!form[key as keyof RoleFormState]}
                                        onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))}
                                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    <span>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                                        <span className="block text-xs text-gray-500 dark:text-gray-400">{description}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button variant="primary" onClick={handleSave} isLoading={saving}>
                            <Save className="h-4 w-4" />
                            {adding ? 'Create Role' : 'Save Changes'}
                        </Button>
                        <Button variant="outline" onClick={cancelForm} disabled={saving}>
                            <X className="h-4 w-4" />
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {/* Roles list */}
            <div className="space-y-3">
                {orgRoles.map(role => {
                    const isEditing = editingId === role.id;
                    return (
                        <div
                            key={role.id}
                            className={`border rounded-xl p-4 transition-colors ${isEditing
                                ? 'border-primary-400 dark:border-primary-600 bg-primary-50/30 dark:bg-primary-950/20'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-gray-900 dark:text-white">
                                            {role.displayName}
                                        </span>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                                            {ROLE_LEVEL_LABEL[role.roleLevel] ?? `Level ${role.roleLevel}`}
                                        </span>
                                        {!role.isDeletable && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                                Default
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {FLAG_LABELS.filter(f => !!role[f.key as keyof OrgRole]).map(f => (
                                            <span key={f.key} className="text-xs px-2 py-0.5 rounded-full bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400">
                                                {f.label}
                                            </span>
                                        ))}
                                        {FLAG_LABELS.every(f => !role[f.key as keyof OrgRole]) && (
                                            <span className="text-xs text-gray-400 dark:text-gray-500">No special permissions</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => startEdit(role)}
                                        disabled={isFormOpen}
                                        className="p-1.5 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors disabled:opacity-40"
                                        title="Edit role"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                    {role.isDeletable && (
                                        <button
                                            onClick={() => handleDelete(role)}
                                            disabled={isFormOpen || deleting === role.id}
                                            className="p-1.5 rounded-lg text-gray-500 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/30 transition-colors disabled:opacity-40"
                                            title="Delete role"
                                        >
                                            {deleting === role.id
                                                ? <Loader className="h-4 w-4 animate-spin" />
                                                : <Trash2 className="h-4 w-4" />
                                            }
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
