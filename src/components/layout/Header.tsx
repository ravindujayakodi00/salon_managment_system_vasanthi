'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useBranding } from '@/lib/branding';
import { useWorkspace } from '@/lib/workspace';
import { useTheme } from '@/lib/theme';
import { useRouter } from 'next/navigation';
import { Menu, X, Bell, LogOut, User, Sun, Moon } from 'lucide-react';
import Button from '@/components/shared/Button';
import { supabase } from '@/lib/supabase';
import { branchPickerLabel } from '@/lib/branch-display';
import { adminPaths } from '@/lib/admin-paths';

interface HeaderProps {
    onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
    const { user, logout } = useAuth();
    const { displayName } = useBranding();
    const { branches, branchScope, setBranchScope } = useWorkspace();
    const showBranchPicker = user && user.role === 'Owner' && branches.length > 0;
    const assignedBranchLabel = useMemo(() => {
        if (!user?.branchId) return undefined;
        const b = branches.find(br => br.id === user.branchId);
        if (!b) return undefined;
        return branchPickerLabel(b, branches);
    }, [branches, user?.branchId]);
    const { theme, toggleTheme } = useTheme();
    const router = useRouter();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notificationsPreview, setNotificationsPreview] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loadingNotifications, setLoadingNotifications] = useState(false);

    const toTimeAgo = (createdAt: string | Date) => {
        const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
        const now = new Date();
        const diffMs = now.getTime() - created.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (!Number.isFinite(diffMins) || diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hr ago`;
        return `${Math.floor(diffMins / 1440)} day ago`;
    };

    /** Prefer a fresh access token; retry once after refresh on 401 (avoids flaky getSession on first paint). */
    const fetchWithSupabaseAuth = async (url: string, init: RequestInit = {}) => {
        const getToken = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) return session.access_token;
            const { data } = await supabase.auth.refreshSession();
            return data.session?.access_token ?? null;
        };

        let token = await getToken();
        if (!token) return null;

        const headers = new Headers(init.headers);
        headers.set('Authorization', `Bearer ${token}`);

        let res = await fetch(url, { ...init, headers });

        if (res.status === 401) {
            const { data } = await supabase.auth.refreshSession();
            token = data.session?.access_token ?? null;
            if (!token) return res;
            headers.set('Authorization', `Bearer ${token}`);
            res = await fetch(url, { ...init, headers });
        }
        return res;
    };

    const fetchPreview = async (limit = 5) => {
        if (!user) return;
        try {
            setLoadingNotifications(true);
            const res = await fetchWithSupabaseAuth(`/api/in-app-notifications?limit=${limit}`);
            if (!res) return;
            const json = await res.json();
            if (!json?.success) return;
            setUnreadCount(json.unreadCount || 0);
            setNotificationsPreview(json.notifications || []);
        } catch (e) {
            console.error('Failed to fetch in-app notifications preview:', e);
        } finally {
            setLoadingNotifications(false);
        }
    };

    const markAllAsRead = async () => {
        if (!user) return;
        try {
            await fetchWithSupabaseAuth(`/api/in-app-notifications/mark-read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markAll: true }),
            });
        } catch (e) {
            console.error('Failed to mark notifications as read:', e);
        }
    };

    useEffect(() => {
        if (!user) return;
        // Load unread count on header mount.
        fetchPreview(5);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    const handleLogout = () => {
        const ok = window.confirm('Are you sure you want to sign out?');
        if (!ok) return;
        setShowUserMenu(false);
        logout();
        router.push(adminPaths.login);
    };

    return (
        <header className="bg-white/95 dark:bg-primary-950/55 backdrop-blur-sm border-b border-primary-200/70 dark:border-primary-800/50 px-4 lg:px-6 py-4 sticky top-0 z-40 transition-colors shadow-[var(--brand-shadow-xs)]">
            <div className="flex items-center justify-between">
                {/* Mobile Menu Button & Logo */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={onMenuClick}
                        className="lg:hidden p-2 hover:bg-primary-50/90 dark:hover:bg-primary-900/35 rounded-xl transition-colors"
                    >
                        <Menu className="h-6 w-6 text-gray-700 dark:text-gray-200" />
                    </button>
                    <div className="lg:hidden">
                        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{displayName}</h1>
                    </div>
                </div>

                {/* Right Side - Theme Toggle, Notifications & User */}
                <div className="flex items-center gap-3">
                    {showBranchPicker && (
                        <div className="flex items-center gap-2 min-w-0">
                            <label htmlFor="header-branch-scope" className="sr-only">
                                Location
                            </label>
                            <select
                                id="header-branch-scope"
                                value={
                                    branches.some(b => b.id === branchScope) || branchScope === 'all'
                                        ? branchScope
                                        : 'all'
                                }
                                onChange={e => setBranchScope(e.target.value as 'all' | string)}
                                className="text-sm border border-primary-200/80 dark:border-primary-700/50 rounded-lg px-2 py-1.5 bg-white dark:bg-primary-950/40 text-gray-900 dark:text-gray-100 max-w-[10rem] lg:max-w-[14rem] shrink-0 shadow-[var(--brand-shadow-xs)]"
                            >
                                <option value="all">All locations</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {branchPickerLabel(b, branches)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    {!showBranchPicker && assignedBranchLabel && (
                        <span
                            className="text-sm text-gray-600 dark:text-gray-300 truncate max-w-[10rem] lg:max-w-[14rem] shrink-0"
                            title={assignedBranchLabel}
                        >
                            {assignedBranchLabel}
                        </span>
                    )}
                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-2 hover:bg-primary-50/90 dark:hover:bg-primary-900/35 rounded-xl transition-colors"
                        aria-label="Toggle theme"
                    >
                        {theme === 'light' ? (
                            <Moon className="h-5 w-5 text-primary-700 dark:text-primary-300" />
                        ) : (
                            <Sun className="h-5 w-5 text-primary-700 dark:text-primary-300" />
                        )}
                    </button>

                    {/* Notifications */}
                    <div className="relative">
                        <button
                            onClick={async () => {
                                const next = !showNotifications;
                                setShowNotifications(next);
                                if (next) {
                                    // On open: refresh and mark as read.
                                    await fetchPreview(5);
                                    await markAllAsRead();
                                    await fetchPreview(5);
                                }
                            }}
                            className="relative p-2 hover:bg-primary-50/90 dark:hover:bg-primary-900/35 rounded-xl transition-colors"
                        >
                            <Bell className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-danger-500 rounded-full"></span>
                            )}
                        </button>

                        {/* Notifications Dropdown */}
                        {showNotifications && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setShowNotifications(false)}
                                />
                                <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl z-20 max-h-[70vh] overflow-y-auto surface-panel shadow-[var(--brand-shadow-lg)]">
                                    <div className="px-4 py-3 border-b border-primary-200/60 dark:border-primary-800/45">
                                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
                                    </div>
                                    <div className="divide-y divide-primary-200/45 dark:divide-primary-800/35">
                                        {loadingNotifications ? (
                                            <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                                                Loading...
                                            </div>
                                        ) : notificationsPreview.length === 0 ? (
                                            <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                                                No notifications yet.
                                            </div>
                                        ) : (
                                            notificationsPreview.map((n) => (
                                                <div
                                                    key={n.id}
                                                    className="p-4 hover:bg-primary-50/70 dark:hover:bg-primary-900/30 transition-colors cursor-pointer"
                                                >
                                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{n.title}</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{n.message}</p>
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                        {n.createdAt ? toTimeAgo(n.createdAt) : ''}
                                                    </p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="px-4 py-3 border-t border-primary-200/60 dark:border-primary-800/45 text-center">
                                        <button className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">
                                            View all notifications
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* User Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="flex items-center gap-3 p-2 hover:bg-primary-50/90 dark:hover:bg-primary-900/35 rounded-xl transition-colors"
                        >
                            <div className="hidden sm:block text-right">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role}</p>
                            </div>
                            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-xl flex items-center justify-center">
                                <User className="h-5 w-5 text-primary-600 dark:text-primary-300" />
                            </div>
                        </button>

                        {/* Dropdown */}
                        {showUserMenu && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setShowUserMenu(false)}
                                />
                                <div className="absolute right-0 mt-2 w-[min(14rem,calc(100vw-2rem))] rounded-xl py-2 z-20 surface-panel shadow-[var(--brand-shadow-lg)]">
                                    <div className="px-4 py-3 border-b border-primary-200/60 dark:border-primary-800/45">
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Sign Out
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
