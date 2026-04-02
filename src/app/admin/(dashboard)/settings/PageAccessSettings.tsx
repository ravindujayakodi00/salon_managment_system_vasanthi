'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import Button from '@/components/shared/Button';
import { Eye, Save, Loader, Trash2 } from 'lucide-react';
import type { UserRole } from '@/lib/types';
import { isOrgPageAccessEnabled } from '@/lib/org-page-access';

type PageKey =
    | 'dashboard'
    | 'appointments'
    | 'pos'
    | 'services'
    | 'inventory'
    | 'staff'
    | 'customers'
    | 'earnings'
    | 'financial'
    | 'petty-cash'
    | 'segments'
    | 'promos'
    | 'loyalty'
    | 'notifications'
    | 'campaigns'
    | 'reports'
    | 'settings';

type PageAccessRow = { page_key: PageKey; role: UserRole; allowed: boolean };

/** PostgREST errors are plain objects; console.error(err) often prints `{}`. */
function supabaseErrorMessage(err: unknown): string {
    if (err && typeof err === 'object') {
        const o = err as { message?: string; code?: string; details?: string; hint?: string };
        if (o.message) return o.message;
        if (o.code)
            return [o.code, o.details, o.hint].filter(Boolean).join(' — ') || o.code;
    }
    if (err instanceof Error) return err.message;
    try {
        return JSON.stringify(err);
    } catch {
        return String(err);
    }
}

/** Table not migrated yet, or PostgREST schema cache missing relation. */
function isMissingPageAccessTable(err: unknown): boolean {
    const msg = supabaseErrorMessage(err).toLowerCase();
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
    return (
        code === 'PGRST205' ||
        code === '42P01' ||
        msg.includes('does not exist') ||
        msg.includes('schema cache') ||
        msg.includes('could not find the table')
    );
}

const roles: UserRole[] = ['Owner', 'Manager', 'Receptionist', 'Stylist'];

// Mirrors the sidebar routes. These page keys drive the access matrix.
const pageDefaults: Array<{ page_key: PageKey; allowedRoles: UserRole[] }> = [
    { page_key: 'dashboard', allowedRoles: ['Owner', 'Manager', 'Receptionist', 'Stylist'] },
    { page_key: 'appointments', allowedRoles: ['Owner', 'Manager', 'Receptionist', 'Stylist'] },
    { page_key: 'pos', allowedRoles: ['Owner', 'Manager', 'Receptionist'] },
    { page_key: 'services', allowedRoles: ['Owner', 'Manager'] },
    { page_key: 'inventory', allowedRoles: ['Owner', 'Manager'] },
    { page_key: 'staff', allowedRoles: ['Owner', 'Manager'] },
    { page_key: 'customers', allowedRoles: ['Owner', 'Manager', 'Receptionist'] },
    { page_key: 'earnings', allowedRoles: ['Owner', 'Manager', 'Stylist', 'Receptionist'] },
    { page_key: 'financial', allowedRoles: ['Owner', 'Manager', 'Stylist'] },
    { page_key: 'petty-cash', allowedRoles: ['Owner', 'Manager', 'Receptionist'] },
    { page_key: 'segments', allowedRoles: ['Owner', 'Manager'] },
    { page_key: 'promos', allowedRoles: ['Owner', 'Manager'] },
    { page_key: 'loyalty', allowedRoles: ['Owner', 'Manager'] },
    { page_key: 'notifications', allowedRoles: ['Owner', 'Manager'] },
    { page_key: 'campaigns', allowedRoles: ['Owner', 'Manager'] },
    { page_key: 'reports', allowedRoles: ['Owner', 'Manager'] },
    { page_key: 'settings', allowedRoles: ['Owner', 'Stylist'] },
];

export default function PageAccessSettings({
    showMessage,
}: {
    showMessage: (type: 'success' | 'error', text: string) => void;
}) {
    const { user } = useAuth();
    const [rows, setRows] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const orgId = user?.organizationId;

    const defaults = useMemo(() => {
        const map: Record<string, boolean> = {};
        for (const p of pageDefaults) {
            for (const r of roles) {
                map[`${p.page_key}:${r}`] = p.allowedRoles.includes(r);
            }
        }
        return map;
    }, []);

    useEffect(() => {
        if (!orgId) {
            setRows({ ...defaults });
            setLoading(false);
            return;
        }
        if (!isOrgPageAccessEnabled()) {
            setRows({ ...defaults });
            setLoading(false);
            return;
        }
        void (async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('organization_page_access')
                    .select('page_key, role, allowed')
                    .eq('organization_id', orgId);

                if (error) throw error;

                const next: Record<string, boolean> = { ...defaults };
                for (const r of (data || []) as PageAccessRow[]) {
                    next[`${r.page_key}:${r.role}`] = r.allowed;
                }
                setRows(next);
            } catch (e) {
                if (isMissingPageAccessTable(e)) {
                    // Table not migrated yet — use defaults; avoid console.error (noisy in dev overlay).
                    setRows({ ...defaults });
                } else {
                    console.error('Page access load failed:', supabaseErrorMessage(e), e);
                    showMessage('error', `Failed to load page access: ${supabaseErrorMessage(e)}`);
                    setRows({ ...defaults });
                }
            } finally {
                setLoading(false);
            }
        })();
    }, [orgId, defaults, showMessage]);

    const updateAllowed = (pageKey: PageKey, role: UserRole, allowed: boolean) => {
        setRows(prev => ({
            ...prev,
            [`${pageKey}:${role}`]: role === 'Owner' ? true : allowed,
        }));
    };

    const handleSave = async () => {
        if (!orgId || !user) return;
        if (!isOrgPageAccessEnabled()) {
            showMessage(
                'error',
                'Page access is disabled. Apply migration 20260329_organization_page_access.sql, then set NEXT_PUBLIC_ORG_PAGE_ACCESS=1.'
            );
            return;
        }
        setSaving(true);
        try {
            const payload: Array<{ organization_id: string; role: UserRole; page_key: PageKey; allowed: boolean }> = [];
            for (const p of pageDefaults) {
                for (const r of roles) {
                    payload.push({
                        organization_id: orgId,
                        page_key: p.page_key,
                        role: r,
                        allowed: rows[`${p.page_key}:${r}`] ?? false,
                    });
                }
            }

            const { error } = await supabase
                .from('organization_page_access')
                .upsert(payload, { onConflict: 'organization_id,role,page_key' });

            if (error) throw error;
            showMessage('success', 'Page access saved');
        } catch (e) {
            console.error('Page access save failed:', supabaseErrorMessage(e), e);
            showMessage('error', supabaseErrorMessage(e) || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setRows({ ...defaults });
        showMessage('success', 'Reset to defaults (not saved yet)');
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader className="h-8 w-8 animate-spin text-primary-600" />
            </div>
        );
    }

    const pageAccessOff = !isOrgPageAccessEnabled();

    return (
        <div className="space-y-6">
            {pageAccessOff && (
                <div
                    className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
                    role="status"
                >
                    <strong className="font-semibold">Page access table not used.</strong> You have{' '}
                    <code className="text-xs bg-amber-100/80 dark:bg-amber-900/40 px-1 rounded">NEXT_PUBLIC_ORG_PAGE_ACCESS=0</code>{' '}
                    or the feature is off. To use the matrix, run{' '}
                    <code className="text-xs bg-amber-100/80 dark:bg-amber-900/40 px-1 rounded">
                        supabase/migrations/20260329_organization_page_access.sql
                    </code>{' '}
                    in the Supabase SQL editor, then set{' '}
                    <code className="text-xs bg-amber-100/80 dark:bg-amber-900/40 px-1 rounded">NEXT_PUBLIC_ORG_PAGE_ACCESS=1</code>{' '}
                    (or remove the line) and restart the app.
                </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Eye className="h-5 w-5 text-primary-600" />
                        Page Access
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Owner controls which roles can see each sidebar page for this organization.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={handleReset} disabled={saving || pageAccessOff}>
                        <Trash2 className="h-4 w-4" />
                        Reset
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        leftIcon={<Save className="h-4 w-4" />}
                        onClick={handleSave}
                        isLoading={saving}
                        disabled={pageAccessOff}
                    >
                        Save access
                    </Button>
                </div>
            </div>

            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl">
                <table className="min-w-[760px] w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900/40">
                            <th className="text-left p-4 font-semibold text-gray-700 dark:text-gray-200">Page</th>
                            {roles.map(r => (
                                <th key={r} className="text-left p-4 font-semibold text-gray-700 dark:text-gray-200">
                                    {r}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {pageDefaults.map(p => (
                            <tr key={p.page_key}>
                                <td className="p-4 font-medium text-gray-900 dark:text-gray-100">{p.page_key}</td>
                                {roles.map(r => {
                                    const checked = rows[`${p.page_key}:${r}`] ?? false;
                                    return (
                                        <td key={`${p.page_key}:${r}`} className="p-4">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                disabled={saving || r === 'Owner'}
                                                onChange={(e) => updateAllowed(p.page_key, r, e.target.checked)}
                                            />
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

