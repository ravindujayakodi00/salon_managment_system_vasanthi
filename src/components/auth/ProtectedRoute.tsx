'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { SystemRole } from '@/lib/types';
import { adminPaths } from '@/lib/admin-paths';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: SystemRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, isAuthenticated, loading } = useAuth();

    useEffect(() => {
        // Wait for auth to finish loading before redirecting
        if (loading) return;

        if (!isAuthenticated) {
            router.push(adminPaths.login);
            return;
        }

        if (allowedRoles && user && !allowedRoles.includes(user.systemRole)) {
            router.push(adminPaths.dashboard);
        }
    }, [isAuthenticated, user, allowedRoles, router, pathname, loading]);

    // Show loading state while checking authentication
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.systemRole)) {
        return null;
    }

    return <>{children}</>;
}
