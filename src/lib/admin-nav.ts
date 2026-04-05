import type { LucideIcon } from 'lucide-react';
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
    Settings,
    DollarSign,
    Target,
    Megaphone,
    Gift,
    Package,
    Wallet,
} from 'lucide-react';
import type { UserRole } from '@/lib/types';
import { adminHref, adminPageKey } from '@/lib/admin-paths';

export interface AdminNavItem {
    label: string;
    href: string;
    icon: LucideIcon;
    allowedRoles: UserRole[];
}

/** First-level admin sidebar destinations (order matches desktop sidebar). */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
    {
        label: 'Dashboard',
        href: adminHref('/dashboard'),
        icon: LayoutDashboard,
        allowedRoles: ['Owner', 'Manager', 'Receptionist', 'Stylist'],
    },
    {
        label: 'Appointments',
        href: adminHref('/appointments'),
        icon: Calendar,
        allowedRoles: ['Owner', 'Manager', 'Receptionist', 'Stylist'],
    },
    {
        label: 'POS & Billing',
        href: adminHref('/pos'),
        icon: ShoppingCart,
        allowedRoles: ['Owner', 'Manager', 'Receptionist'],
    },
    {
        label: 'Services',
        href: adminHref('/services'),
        icon: Scissors,
        allowedRoles: ['Owner', 'Manager'],
    },
    {
        label: 'Inventory',
        href: adminHref('/inventory'),
        icon: Package,
        allowedRoles: ['Owner', 'Manager'],
    },
    {
        label: 'Staff',
        href: adminHref('/staff'),
        icon: Users,
        allowedRoles: ['Owner', 'Manager'],
    },
    {
        label: 'Customers',
        href: adminHref('/customers'),
        icon: UserCircle,
        allowedRoles: ['Owner', 'Manager', 'Receptionist'],
    },
    {
        label: 'Earnings',
        href: adminHref('/earnings'),
        icon: DollarSign,
        allowedRoles: ['Owner', 'Manager', 'Stylist', 'Receptionist'],
    },
    {
        label: 'Financial',
        href: adminHref('/financial'),
        icon: Wallet,
        allowedRoles: ['Owner', 'Manager', 'Stylist'],
    },
    {
        label: 'Petty Cash',
        href: adminHref('/petty-cash'),
        icon: Wallet,
        allowedRoles: ['Owner', 'Manager', 'Receptionist'],
    },
    {
        label: 'Customer Segments',
        href: adminHref('/segments'),
        icon: Target,
        allowedRoles: ['Owner', 'Manager'],
    },
    {
        label: 'Promo Codes',
        href: adminHref('/promos'),
        icon: Tag,
        allowedRoles: ['Owner', 'Manager'],
    },
    {
        label: 'Loyalty Program',
        href: adminHref('/loyalty'),
        icon: Gift,
        allowedRoles: ['Owner', 'Manager'],
    },
    {
        label: 'Notifications',
        href: adminHref('/notifications'),
        icon: Bell,
        allowedRoles: ['Owner', 'Manager'],
    },
    {
        label: 'Campaigns',
        href: adminHref('/campaigns'),
        icon: Megaphone,
        allowedRoles: ['Owner', 'Manager'],
    },
    {
        label: 'Reports',
        href: adminHref('/reports'),
        icon: BarChart3,
        allowedRoles: ['Owner', 'Manager'],
    },
    {
        label: 'Settings',
        href: adminHref('/settings'),
        icon: Settings,
        allowedRoles: ['Owner', 'Stylist'],
    },
];

export function filterNavItemsForUser(
    user: { role: UserRole } | null,
    pageAccess: Record<string, Record<string, boolean>>,
    items: AdminNavItem[] = ADMIN_NAV_ITEMS
): AdminNavItem[] {
    if (!user) return [];
    return items.filter((item) => {
        if (user.role === 'Owner') return true;

        const pageKey = adminPageKey(item.href);
        const forcedAllowed = pageAccess[pageKey]?.[user.role];
        if (typeof forcedAllowed === 'boolean') return forcedAllowed;

        return item.allowedRoles.includes(user.role);
    });
}

/** Hrefs a role should see when org page access is not overriding (Owner sees all). */
export function expectedNavHrefsForRole(role: UserRole): string[] {
    if (role === 'Owner') return ADMIN_NAV_ITEMS.map((i) => i.href);
    return ADMIN_NAV_ITEMS.filter((i) => i.allowedRoles.includes(role)).map((i) => i.href);
}
