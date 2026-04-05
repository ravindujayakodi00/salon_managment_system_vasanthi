'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useBranding } from '@/lib/branding';
import { supabase } from '@/lib/supabase';
import { X, Scissors } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminHref } from '@/lib/admin-paths';
import { isOrgPageAccessEnabled } from '@/lib/org-page-access';
import { ADMIN_NAV_ITEMS, filterNavItemsForUser } from '@/lib/admin-nav';

interface MobileSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
    const pathname = usePathname();
    const { user } = useAuth();
    const { displayName, tagline, logoUrl } = useBranding();

    const [pageAccess, setPageAccess] = useState<Record<string, Record<string, boolean>>>({});

    useEffect(() => {
        if (!isOrgPageAccessEnabled()) {
            setPageAccess({});
            return;
        }
        if (!user?.organizationId) {
            setPageAccess({});
            return;
        }

        void (async () => {
            try {
                const { data, error } = await supabase
                    .from('organization_page_access')
                    .select('page_key, role, allowed')
                    .eq('organization_id', user.organizationId);
                if (error) throw error;

                const map: Record<string, Record<string, boolean>> = {};
                for (const row of data || []) {
                    if (!map[row.page_key]) map[row.page_key] = {};
                    map[row.page_key][row.role] = row.allowed;
                }
                setPageAccess(map);
            } catch {
                // If the table doesn't exist yet, fall back to hard-coded allowedRoles.
                setPageAccess({});
            }
        })();
    }, [user?.organizationId]);

    const filteredNavItems = useMemo(
        () => filterNavItemsForUser(user, pageAccess, ADMIN_NAV_ITEMS),
        [pageAccess, user]
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                    />

                    {/* Sidebar */}
                    <motion.aside
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed left-0 top-0 bottom-0 w-64 max-w-[85vw] bg-white/95 dark:bg-primary-950/55 border-r border-primary-200/75 dark:border-primary-800/50 backdrop-blur-sm z-50 lg:hidden flex flex-col shadow-[var(--brand-shadow-md)]"
                    >
                        <div className="p-6 flex items-center justify-between border-b border-primary-200/60 dark:border-primary-800/45">
                            <Link href={adminHref('/dashboard')} className="flex items-center gap-3" onClick={onClose}>
                                <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl overflow-hidden">
                                    {logoUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={logoUrl}
                                            alt=""
                                            className="h-6 w-6 object-contain"
                                        />
                                    ) : (
                                        <Scissors className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                                    )}
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">{displayName}</h1>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{tagline}</p>
                                </div>
                            </Link>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-primary-50/90 dark:hover:bg-primary-900/35 rounded-xl transition-colors"
                            >
                                <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            </button>
                        </div>

                        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
                            {filteredNavItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href;

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={onClose}
                                        className={cn(
                                            'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                                            isActive
                                                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                                                : 'text-gray-700 dark:text-gray-400 hover:bg-primary-50/85 dark:hover:bg-primary-900/30'
                                        )}
                                    >
                                        <Icon className={cn('h-5 w-5', isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-500')} />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="p-4 border-t border-primary-200/60 dark:border-primary-800/45">
                            <div className="text-xs text-gray-500 dark:text-gray-500 text-center">
                                v1.0.0 • {user?.role}
                            </div>
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}
