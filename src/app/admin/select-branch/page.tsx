'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/shared/Button';
import { branchesService } from '@/services/branches';
import type { Branch } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { adminPaths } from '@/lib/admin-paths';

export default function SelectBranchPage() {
    const router = useRouter();
    const { user, refreshProfile, loading } = useAuth();

    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string>('');
    const [loadingBranches, setLoadingBranches] = useState(false);

    const branchLabel = useMemo(() => {
        if (!selectedBranchId) return '';
        return branches.find(b => b.id === selectedBranchId)?.name || '';
    }, [branches, selectedBranchId]);

    useEffect(() => {
        if (loading) return;
        if (!user) return;

        // Owners can switch in the header, so no login-time branch gate is needed.
        if (user.systemRole === 'Owner') {
            router.replace(adminPaths.dashboard);
            return;
        }
    }, [loading, router, user]);

    useEffect(() => {
        if (!user?.organizationId) return;
        void (async () => {
            setLoadingBranches(true);
            setError('');
            try {
                const list = await branchesService.getBranches(user.organizationId);
                setBranches(list || []);

                const initial = user.branchId && list?.some(b => b.id === user.branchId)
                    ? user.branchId
                    : (list?.[0]?.id ?? '');
                setSelectedBranchId(initial);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load branches');
            } finally {
                setLoadingBranches(false);
            }
        })();
    }, [user?.organizationId, user?.branchId]);

    const handleConfirm = async () => {
        if (!user) return;
        if (!selectedBranchId) {
            setError('Please select a branch');
            return;
        }
        try {
            setSaving(true);
            setError('');

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ branch_id: selectedBranchId })
                .eq('id', user.id);
            if (updateError) throw updateError;

            await refreshProfile();
            router.replace(adminPaths.dashboard);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to select branch');
        } finally {
            setSaving(false);
        }
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 flex items-center justify-center">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 space-y-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Select Location</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        You can only view and manage data for your selected branch.
                    </p>
                </div>

                {error && (
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Branch
                    </label>
                    <select
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        disabled={loadingBranches || saving || branches.length === 0}
                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-gray-900 dark:text-white"
                    >
                        {branches.length === 0 ? (
                            <option value="" disabled>No branches available</option>
                        ) : (
                            branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))
                        )}
                    </select>
                    {branchLabel && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Selected: {branchLabel}
                        </p>
                    )}
                </div>

                <Button
                    variant="primary"
                    leftIcon={undefined}
                    onClick={handleConfirm}
                    isLoading={saving}
                    disabled={saving || loadingBranches || !selectedBranchId}
                >
                    Continue
                </Button>
            </div>
        </div>
    );
}

