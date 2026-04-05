'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Organization, User, UserRole } from './types';
import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';
import { brandingService } from '@/services/branding';

interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    refreshProfile: () => Promise<void>;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
    hasRole: (roles: UserRole[]) => boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_LOAD_ERROR =
    'Your profile could not be loaded. If you are staff, ask the salon owner to fix your account or run the latest database migration.';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                fetchUserProfile(session);
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                fetchUserProfile(session);
            } else {
                setUser(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    /** Loads profile for the session. Returns false if missing or RLS blocked (user stays logged out of app UI). */
    const fetchUserProfile = async (session: Session): Promise<boolean> => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (error) {
                console.error('Error fetching user profile:', error.message, error);
                setUser(null);
                return false;
            }

            if (!data) {
                setUser(null);
                return false;
            }

            let organizationSlug: string | undefined;
            let organizationName: string | undefined;
            let organization: Organization | null = null;
            if (data.organization_id) {
                // Use same path as branding (RPC) so RLS cannot leave organization null — required for global theme CSS vars.
                try {
                    organization = await brandingService.getBranding(data.organization_id as string);
                } catch {
                    organization = null;
                }
                if (organization) {
                    organizationSlug = organization.slug;
                    organizationName = (organization.display_name as string | null | undefined)?.trim()
                        ? (organization.display_name as string)
                        : organization.name;
                }
            }
            setUser({
                id: data.id,
                email: data.email,
                name: data.name,
                role: data.role as UserRole,
                branchId: data.branch_id || undefined,
                organizationId: data.organization_id as string,
                organizationSlug,
                organizationName,
                organization,
                isActive: data.is_active,
            });
            return true;
        } catch (error) {
            console.error('Error fetching user profile:', error);
            setUser(null);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const refreshProfile = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            await fetchUserProfile(session);
            return;
        }
        setUser(null);
        setLoading(false);
    };

    const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                // Map Supabase errors to user-friendly messages
                if (error.message.includes('Invalid login credentials')) {
                    return { success: false, error: 'Incorrect email or password' };
                } else if (error.message.includes('Email not confirmed')) {
                    return { success: false, error: 'Please verify your email address' };
                } else if (error.message.includes('User not found')) {
                    return { success: false, error: 'No account found with this email' };
                } else {
                    return { success: false, error: error.message };
                }
            }

            if (data.session) {
                const ok = await fetchUserProfile(data.session);
                if (!ok) {
                    await supabase.auth.signOut();
                    return { success: false, error: PROFILE_LOAD_ERROR };
                }
                return { success: true };
            }

            return { success: false, error: 'Login failed. Please try again.' };
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'
            };
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null);
    };

    const hasRole = (roles: UserRole[]): boolean => {
        if (!user) return false;
        return roles.includes(user.role);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                login,
                refreshProfile,
                logout,
                isAuthenticated: !!user,
                hasRole,
                loading,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
