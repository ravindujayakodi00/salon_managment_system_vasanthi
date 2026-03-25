'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { UserRole } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import {
    LayoutDashboard,
    Calendar,
    ShoppingCart,
    Scissors,
    Users,
    UserCircle,
    Tag,
    Bell,
    BarChart3,
    CreditCard,
    Settings,
    DollarSign,
    Target,
    Megaphone,
    Gift,
    Share2,
    Package,
    Wallet,
    LucideIcon,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface NavItem {
    label: string;
    href: string;
    icon: LucideIcon;
    allowedRoles: UserRole[];
}

const navItems: NavItem[] = [
    {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        allowedRoles: ['Owner', 'Manager', 'Receptionist', 'Stylist'],
    },
    {
        label: 'Appointments',
        href: '/appointments',
        icon: Calendar,
        allowedRoles: ['Owner', 'Manager', 'Receptionist', 'Stylist'],
    },
    {
        label: 'POS & Billing',
        href: '/pos',
        icon: ShoppingCart,
        allowedRoles: ['Owner', 'Manager', 'Receptionist'],
    },
    {
        label: 'Services',
        href: '/services',
        icon: Scissors,
        allowedRoles: ['Owner', 'Manager'],
    },
    {
        label: 'Inventory',
        href: '/inventory',
        icon: Package,
        allowedRoles: ['Owner', 'Manager'],
    },
    {
        label: 'Staff',
        href: '/staff',
        icon: Users,
        allowedRoles: ['Owner', 'Manager'],
    },
    {
        label: 'Customers',
        href: '/customers',
        icon: UserCircle,
        allowedRoles: ['Owner', 'Manager', 'Receptionist'],
    },
    {
        label: 'Earnings',
        href: '/earnings',
        icon: DollarSign,
        allowedRoles: ['Owner', 'Manager', 'Stylist', 'Receptionist'],
    },
    {
        label: 'Financial',
        href: '/financial',
        icon: Wallet,
        allowedRoles: ['Owner', 'Manager', 'Stylist'],
    },
    {
        label: 'Petty Cash',
        href: '/petty-cash',
        icon: Wallet,
        allowedRoles: ['Owner', 'Manager', 'Receptionist'],
    },
    {
        label: 'Customer Segments',
        href: '/segments',
        icon: Target,
        allowedRoles: ['Owner', 'Manager'],
    },
    {
        label: 'Promo Codes',
        href: '/promos',
        icon: Tag,
        allowedRoles: ['Owner', 'Manager'],
    },
    {
        label: 'Loyalty Program',
        href: '/loyalty',
        icon: Gift,
        allowedRoles: ['Owner', 'Manager'],
    },
    {
        label: 'Notifications',
        href: '/notifications',
        icon: Bell,
        allowedRoles: ['Owner', 'Manager'],
    },
    {
        label: 'Campaigns',
        href: '/campaigns',
        icon: Megaphone,
        allowedRoles: ['Owner', 'Manager'],
    },
    {
        label: 'Reports',
        href: '/reports',
        icon: BarChart3,
        allowedRoles: ['Owner', 'Manager'],
    },
    {
        label: 'Settings',
        href: '/settings',
        icon: Settings,
        allowedRoles: ['Owner', 'Stylist'],
    },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { user } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const filteredNavItems = navItems.filter((item) =>
        user ? item.allowedRoles.includes(user.role) : false
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
            className="hidden md:flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 min-h-screen transition-colors relative"
        >
            {/* Collapse/Expand Button */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-9 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-1.5 shadow-md hover:shadow-lg transition-all hover:scale-110"
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
                    href="/dashboard"
                    className={cn('flex items-center gap-3', isCollapsed && 'justify-center')}
                >
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex-shrink-0">
                        <Scissors className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    {!isCollapsed && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                SalonFlow
                            </h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                Salon Management
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
                                    : 'text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50',
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
                    'p-4 border-t border-gray-200 dark:border-gray-700',
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
