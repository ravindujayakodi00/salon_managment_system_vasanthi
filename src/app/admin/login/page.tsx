'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { motion } from 'framer-motion';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import Input from '@/components/shared/Input';
import Button from '@/components/shared/Button';
import { adminPaths } from '@/lib/admin-paths';
import logoLongLight from '@/assets/logo-pack/logo-long-light.png';

export default function LoginPage() {
    const router = useRouter();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Email validation
    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newEmail = e.target.value;
        setEmail(newEmail);
        setEmailError('');
        setError('');

        // Validate email on blur or after typing
        if (newEmail && !validateEmail(newEmail)) {
            setEmailError('Please enter a valid email address');
        }
    };

    const handleEmailBlur = () => {
        if (email && !validateEmail(email)) {
            setEmailError('Please enter a valid email address');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setEmailError('');

        // Validate email before submission
        if (!email) {
            setEmailError('Email is required');
            return;
        }

        if (!validateEmail(email)) {
            setEmailError('Please enter a valid email address');
            return;
        }

        if (!password) {
            setError('Password is required');
            return;
        }

        setIsLoading(true);

        try {
            const result = await login(email, password);
            if (result.success) {
                router.push(adminPaths.dashboard);
            } else {
                setError(result.error || 'Login failed. Please try again.');
            }
        } catch (err) {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-primary-100 via-primary-50 to-white dark:bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] dark:from-primary-800 dark:via-primary-950 dark:to-black flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                {/* Logo & Title */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1, type: 'spring' }}
                        className="inline-flex items-center justify-center mb-4"
                    >
                        <Image src={logoLongLight} alt="Salon Logo" height={80} className="w-auto" priority />
                    </motion.div>
                    <p className="text-primary-600 dark:text-primary-100">Professional Care. Personal Attention</p>
                </div>

                {/* Login Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-gray-900/30 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-primary-200 dark:border-white/10"
                >
                    <h2 className="text-2xl font-bold text-primary-900 dark:text-white mb-6">Welcome Back</h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-primary-700 dark:text-white/90 mb-1.5">
                                Email Address
                            </label>
                            <Input
                                type="email"
                                value={email}
                                onChange={handleEmailChange}
                                onBlur={handleEmailBlur}
                                leftIcon={<Mail className="h-5 w-5 text-gray-500 dark:text-gray-400" />}
                                placeholder="you@example.com"
                                required
                                autoComplete="email"
                                className={`bg-gray-50 dark:bg-white/10 text-gray-900 dark:text-white border-gray-300 dark:border-white/20 placeholder:text-gray-400 focus:bg-white dark:focus:bg-white/15 focus:border-primary-400 ${emailError ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : ''
                                    }`}
                            />
                            {emailError && (
                                <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-1 mt-1.5 text-red-600 dark:text-red-300 text-sm"
                                >
                                    <AlertCircle className="h-4 w-4" />
                                    <span>{emailError}</span>
                                </motion.div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-primary-700 dark:text-white/90 mb-1.5">
                                Password
                            </label>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setError('');
                                }}
                                leftIcon={<Lock className="h-5 w-5 text-gray-500 dark:text-gray-400" />}
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                                className="bg-gray-50 dark:bg-white/10 text-gray-900 dark:text-white border-gray-300 dark:border-white/20 placeholder:text-gray-400 focus:bg-white dark:focus:bg-white/15 focus:border-primary-400"
                            />
                        </div>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-start gap-2 p-3 bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-400/30 rounded-xl text-red-700 dark:text-red-200 text-sm"
                            >
                                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </motion.div>
                        )}

                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            className="w-full bg-primary-600 dark:bg-white text-white dark:text-primary-950 hover:bg-primary-700 dark:hover:bg-gray-100 font-bold shadow-lg shadow-primary-600/20 dark:shadow-black/20 border-none"
                            isLoading={isLoading}
                            disabled={isLoading || !!emailError}
                        >
                            {isLoading ? 'Signing in...' : 'Sign In'}
                        </Button>
                    </form>
                </motion.div>

                <p className="text-center text-primary-400 dark:text-white/50 text-sm mt-6">
                    <Link href="/" className="hover:text-primary-600 dark:hover:text-white/80 underline underline-offset-2">
                        Back to website
                    </Link>
                    <span className="mx-2">·</span>
                    © 2025 Metafuse. All rights reserved.
                </p>
            </motion.div>
        </div>
    );
}
