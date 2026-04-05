'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { useBranding } from '@/lib/branding';
import { supabase } from '@/lib/supabase';
import { Scissors, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { adminHref } from '@/lib/admin-paths';
import { isOrgPageAccessEnabled } from '@/lib/org-page-access';
import { ADMIN_NAV_ITEMS, filterNavItemsForUser } from '@/lib/admin-nav';

export default function Sidebar() {
    const pathname = usePathname();
    const { user } = useAuth();
    const { displayName, tagline, logoUrl } = useBranding();
    const [isCollapsed, setIsCollapsed] = useState(false);

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
        <motion.aside
            initial={false}
            animate={{
                width: isCollapsed ? '80px' : '256px',
            }}
            transition={{
                duration: 0.3,
                ease: 'easeInOut',
            }}
            className="hidden lg:flex flex-col border-r border-primary-200/75 dark:border-primary-800/50 bg-white/95 dark:bg-primary-950/55 backdrop-blur-sm min-h-screen transition-colors relative shadow-[var(--brand-shadow-xs)]"
        >
            {/* Collapse/Expand Button */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-9 z-50 bg-white dark:bg-primary-950/60 border border-primary-200/80 dark:border-primary-700/50 rounded-full p-1.5 shadow-[var(--brand-shadow-sm)] hover:shadow-[var(--brand-shadow-md)] transition-all hover:scale-110"
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                ) : (
                    <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                )}
            </button>

            {/* Logo Section */}
            <div className={cn('p-6 transition-all', isCollapsed && 'px-4')}>
                <Link
                    href={adminHref('/dashboard')}
                    className={cn('flex items-center gap-3', isCollapsed && 'justify-center')}
                >
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex-shrink-0 overflow-hidden">
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
                    {!isCollapsed && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                {displayName}
                            </h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                {tagline}
                            </p>
                        </motion.div>
                    )}
                </Link>
            </div>

            {/* Navigation */}
            <nav className={cn('flex-1 px-4 space-y-0.5 overflow-y-auto', isCollapsed && 'px-2')}>
                {filteredNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 relative group',
                                isActive
                                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                                    : 'text-gray-700 dark:text-gray-400 hover:bg-primary-50/80 dark:hover:bg-primary-900/30',
                                isCollapsed && 'justify-center px-2.5'
                            )}
                            title={isCollapsed ? item.label : ''}
                        >
                            <Icon
                                className={cn(
                                    'h-4 w-4 flex-shrink-0',
                                    isActive
                                        ? 'text-primary-600 dark:text-primary-400'
                                        : 'text-gray-500 dark:text-gray-500'
                                )}
                            />
                            {!isCollapsed && (
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="whitespace-nowrap text-sm"
                                >
                                    {item.label}
                                </motion.span>
                            )}

                            {/* Tooltip for collapsed state */}
                            {isCollapsed && (
                                <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 pointer-events-none">
                                    {item.label}
                                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45"></div>
                                </div>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div
                className={cn(
                    'p-4 border-t border-primary-200/60 dark:border-primary-800/45',
                    isCollapsed && 'px-2'
                )}
            >
                <div
                    className={cn(
                        'text-xs text-gray-500 dark:text-gray-500 text-center',
                        isCollapsed && 'transform -rotate-90 origin-center'
                    )}
                >
                    {!isCollapsed ? (
                        <>v1.0.0 • {user?.role}</>
                    ) : (
                        <span className="block w-16">v1.0</span>
                    )}
                </div>
            </div>
        </motion.aside>
    );
}
