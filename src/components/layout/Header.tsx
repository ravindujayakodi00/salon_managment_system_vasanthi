'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useRouter } from 'next/navigation';
import { Menu, X, Bell, LogOut, User, Sun, Moon } from 'lucide-react';
import Button from '@/components/shared/Button';

interface HeaderProps {
    onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const router = useRouter();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    return (
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4 sticky top-0 z-40 transition-colors">
            <div className="flex items-center justify-between">
                {/* Mobile Menu Button & Logo */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={onMenuClick}
                        className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                    >
                        <Menu className="h-6 w-6 text-gray-700 dark:text-gray-200" />
                    </button>
                    <div className="lg:hidden">
                        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">SalonFlow</h1>
                    </div>
                </div>

                {/* Right Side - Theme Toggle, Notifications & User */}
                <div className="flex items-center gap-3">
                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                        aria-label="Toggle theme"
                    >
                        {theme === 'light' ? (
                            <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                        ) : (
                            <Sun className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                        )}
                    </button>

                    {/* Notifications */}
                    <div className="relative">
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                        >
                            <Bell className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                            <span className="absolute top-1 right-1 w-2 h-2 bg-danger-500 rounded-full"></span>
                        </button>

                        {/* Notifications Dropdown */}
                        {showNotifications && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setShowNotifications(false)}
                                />
                                <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] bg-white dark:bg-gray-800 rounded-xl shadow-soft-lg border border-gray-200 dark:border-gray-700 z-20 max-h-[70vh] overflow-y-auto">
                                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
                                    </div>
                                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {/* Sample Notifications */}
                                        <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">New appointment booked</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Sarah Johnson - Hair Cut at 2:00 PM</p>
                                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">5 minutes ago</p>
                                        </div>
                                        <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Payment received</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Rs 2,500 from Mike Smith</p>
                                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">1 hour ago</p>
                                        </div>
                                        <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Appointment reminder</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Emily Davis appointment in 30 minutes</p>
                                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">2 hours ago</p>
                                        </div>
                                    </div>
                                    <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-center">
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
                            className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
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
                                <div className="absolute right-0 mt-2 w-[min(14rem,calc(100vw-2rem))] bg-white dark:bg-gray-800 rounded-xl shadow-soft-lg border border-gray-200 dark:border-gray-700 py-2 z-20">
                                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
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
