'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { UserRole } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { X } from 'lucide-react';
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
    Wallet,
    Target,
    Megaphone,
    LucideIcon,
    Gift,
    Package,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

interface MobileSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
    const pathname = usePathname();
    const { user } = useAuth();

    const filteredNavItems = navItems.filter((item) =>
        user ? item.allowedRoles.includes(user.role) : false
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
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
                    />

                    {/* Sidebar */}
                    <motion.aside
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 md:hidden flex flex-col"
                    >
                        <div className="p-6 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
                            <Link href="/dashboard" className="flex items-center gap-3" onClick={onClose}>
                                <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
                                    <Scissors className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">SalonFlow</h1>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Salon Management</p>
                                </div>
                            </Link>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-xl transition-colors"
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
                                                : 'text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                        )}
                                    >
                                        <Icon className={cn('h-5 w-5', isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-500')} />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
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
