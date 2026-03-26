'use client';

import { useState } from 'react';
import { AuthProvider } from '@/lib/auth';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MobileSidebar from '@/components/layout/MobileSidebar';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <ProtectedRoute>
            <div className="flex h-dvh overflow-hidden">
                {/* Desktop Sidebar */}
                <Sidebar />

                {/* Mobile Sidebar */}
                <MobileSidebar
                    isOpen={mobileMenuOpen}
                    onClose={() => setMobileMenuOpen(false)}
                />

                {/* Main Content */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <Header onMenuClick={() => setMobileMenuOpen(true)} />

                    <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 transition-colors">
                        <div className="container mx-auto px-4 lg:px-6 py-6 max-w-full">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </ProtectedRoute>
    );
}
