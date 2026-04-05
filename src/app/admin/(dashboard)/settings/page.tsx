'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Lock, DollarSign, Save, Loader, Mail, Eye, EyeOff, CheckCircle, XCircle, CalendarDays, Clock, Trash2, Plus, Gift, Receipt, MapPin, Palette } from 'lucide-react';
import TaxSettings from './TaxSettings';
import BranchesSettings from './BranchesSettings';
import PageAccessSettings from './PageAccessSettings';
import BrandingSettings from './BrandingSettings';
import { loyaltyService, LoyaltySettings as LoyaltySettingsType } from '@/services/loyalty';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import { useAuth } from '@/lib/auth';
import { settingsService } from '@/services/settings';
import { authService } from '@/services/auth';
import { supabase } from '@/lib/supabase';
import { schedulingService } from '@/services/scheduling';
import { availabilityService, AvailabilityRecord } from '@/services/availability';
import { staffService } from '@/services/staff';
import { UserRole } from '@/lib/types';

interface ShowMessage {
    (type: 'success' | 'error', text: string): void;
}

interface PasswordChangeSectionProps {
    hasRole: (roles: UserRole[]) => boolean;
    showMessage: ShowMessage;
}

// Password Change Section Component
function PasswordChangeSection({ hasRole, showMessage }: PasswordChangeSectionProps) {
    const [loading, setLoading] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState(0);

    const isOwner = hasRole(['Owner']);

    // Calculate password strength
    useEffect(() => {
        if (!newPassword) {
            setPasswordStrength(0);
            return;
        }
        let strength = 0;
        if (newPassword.length >= 8) strength++;
        if (newPassword.length >= 12) strength++;
        if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) strength++;
        if (/\d/.test(newPassword)) strength++;
        if (/[^a-zA-Z0-9]/.test(newPassword)) strength++;
        setPasswordStrength(Math.min(strength, 4));
    }, [newPassword]);

    // Only owners can change passwords
    if (!isOwner) {
        return (
            <div className="text-center py-8">
                <Lock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Password Management Restricted
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Only the owner can change account passwords.
                </p>
            </div>
        );
    }

    const getStrengthColor = () => {
        if (passwordStrength <= 1) return 'bg-red-500';
        if (passwordStrength === 2) return 'bg-yellow-500';
        if (passwordStrength === 3) return 'bg-blue-500';
        return 'bg-green-500';
    };

    const getStrengthText = () => {
        if (passwordStrength <= 1) return 'Weak';
        if (passwordStrength === 2) return 'Fair';
        if (passwordStrength === 3) return 'Good';
        return 'Strong';
    };

    const handleRequestOTP = async () => {
        try {
            setLoading(true);
            const result = await authService.requestPasswordChangeOTP();
            if (result.success) {
                setOtpSent(true);
                showMessage('success', result.message);
            } else {
                showMessage('error', result.message);
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to send OTP';
            showMessage('error', message);
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async () => {
        // Validation
        if (newPassword.length < 8) {
            showMessage('error', 'Password must be at least 8 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            showMessage('error', 'Passwords do not match');
            return;
        }
        if (!otp) {
            showMessage('error', 'Please enter the OTP sent to your email');
            return;
        }

        try {
            setLoading(true);
            const result = await authService.verifyOTPAndChangePassword(otp, newPassword);
            if (result.success) {
                showMessage('success', result.message);
                // Reset form
                setNewPassword('');
                setConfirmPassword('');
                setOtp('');
                setOtpSent(false);
            } else {
                showMessage('error', result.message);
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to change password';
            showMessage('error', message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Change Your Password
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    For security, we&apos;ll send a verification code to your email
                </p>
            </div>

            <div className="space-y-4">
                {/* New Password */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        New Password
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password (min 8 characters)"
                            className="w-full px-4 py-2.5 pr-10 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-gray-900 dark:text-white"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                    </div>

                    {/* Password Strength Indicator */}
                    {newPassword && (
                        <div className="mt-2">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${getStrengthColor()} transition-all duration-300`}
                                        style={{ width: `${(passwordStrength / 4) * 100}%` }}
                                    />
                                </div>
                                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                                    {getStrengthText()}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Confirm Password */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Confirm New Password
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter your new password"
                            className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-gray-900 dark:text-white"
                        />
                        {confirmPassword && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {newPassword === confirmPassword ? (
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                ) : (
                                    <XCircle className="h-5 w-5 text-red-500" />
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* OTP Section */}
                <div className="space-y-3">
                    {!otpSent ? (
                        <Button
                            variant="outline"
                            onClick={handleRequestOTP}
                            disabled={loading || !newPassword || newPassword !== confirmPassword}
                            leftIcon={<Mail className="h-5 w-5" />}
                        >
                            {loading ? 'Sending...' : 'Send Verification Code'}
                        </Button>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Verification Code
                            </label>
                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="Enter 6-digit code"
                                maxLength={6}
                                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-gray-900 dark:text-white text-center text-2xl tracking-widest font-mono"
                            />
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                Check your email for the 6-digit code. Didn&apos;t receive it?
                                <button
                                    type="button"
                                    onClick={handleRequestOTP}
                                    disabled={loading}
                                    className="ml-1 text-primary-600 dark:text-primary-400 hover:underline"
                                >
                                    Resend
                                </button>
                            </p>
                        </div>
                    )}
                </div>

                {/* Submit Button */}
                <Button
                    variant="primary"
                    onClick={handleChangePassword}
                    disabled={
                        loading ||
                        !newPassword ||
                        newPassword !== confirmPassword ||
                        !otpSent ||
                        !otp
                    }
                    leftIcon={loading ? <Loader className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
                >
                    {loading ? 'Changing Password...' : 'Change Password'}
                </Button>
            </div>
        </div>
    );
}

interface StaffPasswordSectionProps {
    showMessage: ShowMessage;
}

// Staff Password Management Section Component
function StaffPasswordSection({ showMessage }: StaffPasswordSectionProps) {
    const [loading, setLoading] = useState(false);
    const [staff, setStaff] = useState<any[]>([]);
    const [selectedStaff, setSelectedStaff] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        fetchStaff();
    }, []);

    const fetchStaff = async () => {
        try {
            const { data } = await supabase
                .from('staff')
                .select('id, name, email, role')
                .eq('is_active', true)
                .order('name');
            setStaff(data || []);
        } catch (error) {
            console.error('Error fetching staff:', error);
        }
    };

    const handleChangeStaffPassword = async () => {
        if (!selectedStaff || !newPassword) {
            showMessage('error', 'Please select a staff member and enter a new password');
            return;
        }

        if (newPassword.length < 8) {
            showMessage('error', 'Password must be at least 8 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            showMessage('error', 'Passwords do not match');
            return;
        }

        try {
            setLoading(true);

            // Get staff profile_id
            const staffMember = staff.find(s => s.id === selectedStaff);
            if (!staffMember) {
                throw new Error('Staff member not found');
            }

            // Get profile to find auth user id
            const { data: staffData } = await supabase
                .from('staff')
                .select('profile_id')
                .eq('id', selectedStaff)
                .single();

            if (!staffData?.profile_id) {
                throw new Error('Staff profile not found');
            }

            // Update password using Supabase Admin API
            const { error } = await supabase.auth.admin.updateUserById(
                staffData.profile_id,
                { password: newPassword }
            );

            if (error) throw error;

            showMessage('success', `Password updated for ${staffMember.name}`);
            setSelectedStaff('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: unknown) {
            console.error('Error changing password:', error);
            const message = error instanceof Error ? error.message : 'Failed to change password';
            showMessage('error', message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Select a staff member and set a new password for their account
                </p>
            </div>

            <div className="space-y-4">
                {/* Staff Selector */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Select Staff Member
                    </label>
                    <select
                        value={selectedStaff}
                        onChange={(e) => setSelectedStaff(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-gray-900 dark:text-white"
                    >
                        <option value="">Choose a staff member...</option>
                        {staff.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name} - {s.role} ({s.email})
                            </option>
                        ))}
                    </select>
                </div>

                {/* New Password */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        New Password
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password (min 8 characters)"
                            className="w-full px-4 py-2.5 pr-10 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-gray-900 dark:text-white"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                    </div>
                </div>

                {/* Confirm Password */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Confirm New Password
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter new password"
                            className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-gray-900 dark:text-white"
                        />
                        {confirmPassword && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {newPassword === confirmPassword ? (
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                ) : (
                                    <XCircle className="h-5 w-5 text-red-500" />
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Submit Button */}
                <Button
                    variant="primary"
                    onClick={handleChangeStaffPassword}
                    disabled={loading || !selectedStaff || !newPassword || newPassword !== confirmPassword}
                    leftIcon={loading ? <Loader className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
                >
                    {loading ? 'Changing Password...' : 'Change Staff Password'}
                </Button>
            </div>
        </div>
    );
}

interface SchedulingSettingsProps {
    showMessage: ShowMessage;
}

// Scheduling Settings Component
function SchedulingSettings({ showMessage }: SchedulingSettingsProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState<any>(null);

    const fetchSettings = useCallback(async () => {
        const data = await schedulingService.getSalonSettings(user?.organizationId ?? null);
        setSettings(data);
    }, [user?.organizationId]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleUpdate = async () => {
        if (!settings) return;
        setLoading(true);
        const result = await schedulingService.updateSalonSettings(settings, user?.organizationId);
        setLoading(false);

        if (result.success) {
            showMessage('success', result.message);
        } else {
            showMessage('error', result.message);
        }
    };

    if (!settings) return <Loader className="h-6 w-6 animate-spin" />;

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Scheduling Configuration
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Configure how appointments are scheduled in your salon
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Slot Interval */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Time Slot Interval
                    </label>
                    <select
                        value={settings.slot_interval}
                        onChange={(e) => setSettings({ ...settings, slot_interval: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-gray-900 dark:text-white"
                    >
                        <option value={15}>15 Minutes</option>
                        <option value={30}>30 Minutes</option>
                        <option value={60}>60 Minutes</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                        Duration of each time slot on the booking calendar
                    </p>
                </div>

                {/* Buffer Time */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Buffer Time (Minutes)
                    </label>
                    <Input
                        type="number"
                        value={settings.booking_buffer_minutes}
                        onChange={(e) => setSettings({ ...settings, booking_buffer_minutes: parseInt(e.target.value) })}
                        min="0"
                        step="5"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Cleanup/setup time added after each appointment
                    </p>
                </div>

                {/* Booking Window */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Booking Window (Days)
                    </label>
                    <Input
                        type="number"
                        value={settings.booking_window_days}
                        onChange={(e) => setSettings({ ...settings, booking_window_days: parseInt(e.target.value) })}
                        min="1"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        How many days in advance customers can book
                    </p>
                </div>

                {/* Staff holiday quota */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Max full-day holidays per staff (per calendar year)
                    </label>
                    <Input
                        type="number"
                        value={settings.max_full_day_holidays_per_year ?? ''}
                        onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === '') {
                                setSettings({ ...settings, max_full_day_holidays_per_year: null });
                                return;
                            }
                            const n = parseInt(raw, 10);
                            setSettings({
                                ...settings,
                                max_full_day_holidays_per_year: Number.isFinite(n) ? Math.max(0, n) : null,
                            });
                        }}
                        min="0"
                        placeholder="Empty = no limit"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Applies to staff who add full-day holidays under Settings → My Availability. Half-days and breaks
                        are not counted. Leave empty for no cap.
                    </p>
                </div>

                {/* Enable Tax */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Enable Tax in POS
                    </label>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSettings({ ...settings, enable_tax: !settings.enable_tax })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.enable_tax ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.enable_tax ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            {settings.enable_tax ? 'Tax enabled' : 'Tax disabled'}
                        </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                        When enabled, tax will be calculated and displayed on POS invoices
                    </p>
                </div>

                {/* Tax Management */}
                <div>
                    <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tax Configuration
                    </h4>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Tax Rate (%)
                    </label>
                    <Input
                        type="number"
                        value={settings.tax_rate}
                        onChange={(e) => setSettings({ ...settings, tax_rate: parseFloat(e.target.value) })}
                        min="0"
                        step="0.1"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        The percentage tax applied to services and products.
                    </p>
                </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                    variant="primary"
                    onClick={handleUpdate}
                    disabled={loading}
                    leftIcon={loading ? <Loader className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                >
                    {loading ? 'Saving...' : 'Save Settings'}
                </Button>
            </div>
        </div>
    );
}

interface AvailabilitySettingsProps {
    user: any;
    showMessage: ShowMessage;
}

// Availability Settings Component
function AvailabilitySettings({ user, showMessage }: AvailabilitySettingsProps) {
    const [loading, setLoading] = useState(false);
    const [leaves, setLeaves] = useState<AvailabilityRecord[]>([]);
    const [staffId, setStaffId] = useState<string | null>(null);
    const [holidayQuota, setHolidayQuota] = useState<number | null>(null);
    const [holidayDaysUsedThisYear, setHolidayDaysUsedThisYear] = useState<number | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState({
        startDate: '',
        endDate: '',
        startTime: '09:00',
        endTime: '17:00',
        type: 'holiday' as const,
        reason: ''
    });

    const fetchStaffId = useCallback(async () => {
        if (!user?.email) return;
        try {
            const staff = await staffService.getStaffByEmail(user.email);
            if (staff) {
                setStaffId(staff.id);
            }
        } catch (error) {
            console.error('Error fetching staff info:', error);
        }
    }, [user]);

    const fetchLeaves = useCallback(async () => {
        if (!staffId) return;
        try {
            setLoading(true);
            // Fetch for next 365 days
            const start = new Date().toISOString();
            const end = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
            const data = await availabilityService.getAvailability(staffId, start, end);
            setLeaves(data || []);
        } catch (error) {
            console.error('Error fetching leaves:', error);
            showMessage('error', 'Failed to load availability');
        } finally {
            setLoading(false);
        }
    }, [staffId, showMessage]);

    useEffect(() => {
        fetchStaffId();
    }, [fetchStaffId]);

    useEffect(() => {
        if (staffId) {
            fetchLeaves();
        }
    }, [staffId, fetchLeaves]);

    const loadHolidayQuota = useCallback(async () => {
        if (!staffId || !user?.organizationId) return;
        try {
            const salon = await schedulingService.getSalonSettings(user.organizationId);
            const cap = salon.max_full_day_holidays_per_year;
            setHolidayQuota(typeof cap === 'number' && cap >= 0 ? cap : null);
            const y = new Date().getFullYear();
            const used = await availabilityService.sumFullDayHolidayDaysInYear(staffId, y);
            setHolidayDaysUsedThisYear(used);
        } catch {
            setHolidayQuota(null);
            setHolidayDaysUsedThisYear(null);
        }
    }, [staffId, user?.organizationId]);

    useEffect(() => {
        loadHolidayQuota();
    }, [loadHolidayQuota]);

    const handleAddLeave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!staffId) return;

        try {
            setLoading(true);

            // Construct start and end timestamps
            let startDateTime = `${formData.startDate}T${formData.startTime}:00`;
            let endDateTime = `${formData.endDate || formData.startDate}T${formData.endTime}:00`;

            if (formData.type === 'holiday') {
                // For full day, cover the whole working day or 00:00-23:59
                startDateTime = `${formData.startDate}T00:00:00`;
                endDateTime = `${formData.endDate || formData.startDate}T23:59:59`;
            }

            if (formData.type === 'holiday' && user?.organizationId) {
                const salon = await schedulingService.getSalonSettings(user.organizationId);
                const cap = salon.max_full_day_holidays_per_year;
                const quotaErr = await availabilityService.validateFullDayHolidayQuota(
                    staffId,
                    new Date(startDateTime).toISOString(),
                    new Date(endDateTime).toISOString(),
                    typeof cap === 'number' && cap >= 0 ? cap : null
                );
                if (quotaErr) {
                    showMessage('error', quotaErr);
                    setLoading(false);
                    return;
                }
            }

            await availabilityService.createAvailability({
                stylist_id: staffId,
                start_time: new Date(startDateTime).toISOString(),
                end_time: new Date(endDateTime).toISOString(),
                type: formData.type,
                reason: formData.reason
            });

            showMessage('success', 'Availability updated');
            setShowAddForm(false);
            setFormData({
                startDate: '',
                endDate: '',
                startTime: '09:00',
                endTime: '17:00',
                type: 'holiday',
                reason: ''
            });
            fetchLeaves();
            await loadHolidayQuota();
        } catch (error: unknown) {
            console.error('Error adding leave:', error);
            const message = error instanceof Error ? error.message : 'Failed to add leave';
            showMessage('error', message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to remove this unavailable time?')) return;
        try {
            await availabilityService.deleteAvailability(id);
            showMessage('success', 'Removed successfully');
            fetchLeaves();
            await loadHolidayQuota();
        } catch (error) {
            console.error('Error deleting leave:', error);
            showMessage('error', 'Failed to delete');
        }
    };

    if (!staffId) {
        return (
            <div className="text-center py-8">
                <p className="text-gray-500">Loading staff profile...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {holidayQuota != null && holidayDaysUsedThisYear != null && (
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-sm text-blue-900 dark:text-blue-100">
                    Full-day holiday days used this calendar year:{' '}
                    <span className="font-semibold">
                        {holidayDaysUsedThisYear} / {holidayQuota}
                    </span>
                    . Half-days and breaks do not count toward this limit.
                </div>
            )}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        My Availability
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Manage your time off, holidays, and breaks
                    </p>
                </div>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowAddForm(!showAddForm)}
                    leftIcon={showAddForm ? <XCircle className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                >
                    {showAddForm ? 'Cancel' : 'Add Time Off'}
                </Button>
            </div>

            {showAddForm && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-200 dark:border-gray-600"
                >
                    <form onSubmit={handleAddLeave} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                                    className="w-full px-3 py-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg"
                                >
                                    <option value="holiday">Full Day Holiday</option>
                                    <option value="half_day">Half Day / Partial</option>
                                    <option value="break">Break</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                                <Input
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    placeholder="e.g. Vacation, Doctor Appointment"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                                <Input
                                    type="date"
                                    value={formData.startDate}
                                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    required
                                />
                            </div>
                            {formData.type === 'holiday' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date (Optional)</label>
                                    <Input
                                        type="date"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                        placeholder="Same as start date"
                                    />
                                </div>
                            )}
                            {formData.type !== 'holiday' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Time</label>
                                        <Input
                                            type="time"
                                            value={formData.startTime}
                                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Time</label>
                                        <Input
                                            type="time"
                                            value={formData.endTime}
                                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                            required
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex justify-end">
                            <Button type="submit" variant="primary" disabled={loading}>
                                {loading ? 'Saving...' : 'Save Availability'}
                            </Button>
                        </div>
                    </form>
                </motion.div>
            )}

            <div className="space-y-3">
                {leaves.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No upcoming time off scheduled.</p>
                ) : (
                    leaves.map((leave) => (
                        <div key={leave.id} className="flex items-center justify-between p-4 surface-panel rounded-xl shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${leave.type === 'holiday' ? 'bg-purple-100 text-purple-600' :
                                    leave.type === 'half_day' ? 'bg-orange-100 text-orange-600' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                    <CalendarDays className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-gray-900 dark:text-white capitalize">
                                        {leave.type.replace('_', ' ')}
                                    </h4>
                                    <p className="text-sm text-gray-500">
                                        {new Date(leave.start_time).toLocaleDateString()}
                                        {leave.type !== 'holiday' && ` ${new Date(leave.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                        {' - '}
                                        {new Date(leave.end_time).toLocaleDateString() !== new Date(leave.start_time).toLocaleDateString()
                                            ? new Date(leave.end_time).toLocaleDateString()
                                            : ''}
                                        {leave.type !== 'holiday' && ` ${new Date(leave.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                    </p>
                                    {leave.reason && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            &quot;{leave.reason}&quot;
                                        </p>
                                    )}
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(leave.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

interface LoyaltySettingsTabProps {
    showMessage: ShowMessage;
}

type LoyaltyProgramMode = 'none' | 'card' | 'points' | 'visits';

function loyaltyModeFromSettings(s: LoyaltySettingsType): LoyaltyProgramMode {
    if (s.option_card_enabled) return 'card';
    if (s.option_points_enabled) return 'points';
    if (s.option_visits_enabled) return 'visits';
    return 'none';
}

// Loyalty Settings: exactly one program active, or all off
function LoyaltySettingsTab({ showMessage }: LoyaltySettingsTabProps) {
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState<LoyaltySettingsType | null>(null);
    const [programMode, setProgramMode] = useState<LoyaltyProgramMode>('none');

    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            const data = await loyaltyService.getSettings();
            setSettings(data);
            setProgramMode(loyaltyModeFromSettings(data));
        } catch (error) {
            console.error('Error fetching loyalty settings:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleSave = async () => {
        if (!settings) return;
        setLoading(true);
        try {
            const saved = await loyaltyService.updateSettings({
                ...settings,
                option_card_enabled: programMode === 'card',
                option_points_enabled: programMode === 'points',
                option_visits_enabled: programMode === 'visits',
            });
            setSettings(saved);
            setProgramMode(loyaltyModeFromSettings(saved));
            showMessage('success', 'Loyalty settings saved successfully');
        } catch (error) {
            console.error('Error saving loyalty settings:', error);
            showMessage('error', 'Failed to save loyalty settings');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: keyof LoyaltySettingsType, value: number) => {
        if (!settings) return;
        setSettings({ ...settings, [field]: value });
    };

    if (!settings) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader className="h-6 w-6 animate-spin text-primary-600" />
            </div>
        );
    }

    const modeOptions: { id: LoyaltyProgramMode; title: string; desc: string }[] = [
        { id: 'none', title: 'Off', desc: 'No loyalty program' },
        { id: 'card', title: 'Annual loyalty card', desc: 'Sell cards; members get a discount for the validity period' },
        { id: 'points', title: 'Points', desc: 'Earn points from spend; redeem as money off' },
        { id: 'visits', title: 'Visit rewards', desc: 'Discount on every Nth visit' },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Loyalty Program Configuration
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Turn loyalty off, or choose <strong>one</strong> program. Only the selected option is active for your salon.
                </p>
            </div>

            <div className="p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 space-y-3">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Program type</p>
                <div className="grid gap-2">
                    {modeOptions.map(opt => (
                        <label
                            key={opt.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${programMode === opt.id
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                        >
                            <input
                                type="radio"
                                name="loyalty_program_mode"
                                className="mt-1"
                                checked={programMode === opt.id}
                                onChange={() => setProgramMode(opt.id)}
                            />
                            <span>
                                <span className="font-medium text-gray-900 dark:text-white">{opt.title}</span>
                                <span className="block text-xs text-gray-500 dark:text-gray-400">{opt.desc}</span>
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            {programMode === 'card' && (
                <div className="p-6 rounded-xl border-2 border-primary-500 bg-primary-50 dark:bg-primary-900/20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                            <Gift className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">Card pricing & benefits</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Used when you sell a card at POS and for discounts for active members</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Card price (Rs)</label>
                            <Input
                                type="number"
                                value={settings.card_price}
                                onChange={(e) => handleChange('card_price', parseFloat(e.target.value))}
                                min="0"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Member discount (%)</label>
                            <Input
                                type="number"
                                value={settings.card_discount_percent}
                                onChange={(e) => handleChange('card_discount_percent', parseFloat(e.target.value))}
                                min="0"
                                max="100"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Validity (days)</label>
                            <Input
                                type="number"
                                value={settings.card_validity_days}
                                onChange={(e) => handleChange('card_validity_days', parseInt(e.target.value))}
                                min="1"
                            />
                        </div>
                    </div>
                </div>
            )}

            {programMode === 'points' && (
                <div className="p-6 rounded-xl border-2 border-primary-500 bg-primary-50 dark:bg-primary-900/20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">Points rules</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Customize earn and redemption</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Spend per 1 point (Rs)</label>
                            <select
                                value={settings.points_threshold_amount}
                                onChange={(e) => handleChange('points_threshold_amount', parseInt(e.target.value))}
                                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-gray-900 dark:text-white"
                            >
                                <option value={100}>Rs 100 = 1 Point</option>
                                <option value={200}>Rs 200 = 1 Point</option>
                                <option value={250}>Rs 250 = 1 Point</option>
                                <option value={500}>Rs 500 = 1 Point</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">1 point = Rs (redemption)</label>
                            <Input
                                type="number"
                                value={settings.points_redemption_value}
                                onChange={(e) => handleChange('points_redemption_value', parseFloat(e.target.value))}
                                min="1"
                            />
                            <p className="mt-1 text-xs text-gray-500">Each point takes this much off the bill when redeemed</p>
                        </div>
                    </div>
                </div>
            )}

            {programMode === 'visits' && (
                <div className="p-6 rounded-xl border-2 border-primary-500 bg-primary-50 dark:bg-primary-900/20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">Visit rewards</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Configure frequency and discount</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reward every</label>
                            <select
                                value={settings.visit_reward_frequency}
                                onChange={(e) => handleChange('visit_reward_frequency', parseInt(e.target.value))}
                                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-gray-900 dark:text-white"
                            >
                                <option value={5}>Every 5th visit</option>
                                <option value={10}>Every 10th visit</option>
                                <option value={15}>Every 15th visit</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Discount on reward visit (%)</label>
                            <Input
                                type="number"
                                value={settings.visit_reward_discount_percent}
                                onChange={(e) => handleChange('visit_reward_discount_percent', parseFloat(e.target.value))}
                                min="0"
                                max="100"
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={loading}
                    leftIcon={loading ? <Loader className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                >
                    {loading ? 'Saving...' : 'Save Loyalty Settings'}
                </Button>
            </div>
        </div>
    );
}

export default function SettingsPage() {
    const { user, hasRole } = useAuth();
    const [activeTab, setActiveTab] = useState<
        'passwords' | 'scheduling' | 'availability' | 'loyalty' | 'tax' | 'branches' | 'page_access' | 'branding'
    >('passwords');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const showMessage = useCallback((type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    }, []);



    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Manage system settings and configurations</p>
            </div>

            {/* Message */}
            {message && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-xl ${message.type === 'success'
                        ? 'bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 text-success-700 dark:text-success-300'
                        : 'bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 text-danger-700 dark:text-danger-300'
                        }`}
                >
                    {message.text}
                </motion.div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('passwords')}
                    className={`px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'passwords'
                        ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                >
                    <Lock className="h-4 w-4 inline mr-2" />
                    Password Management
                </button>



                {hasRole(['Owner']) && (
                    <button
                        onClick={() => setActiveTab('branding')}
                        className={`px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'branding'
                            ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                    >
                        <Palette className="h-4 w-4 inline mr-2" />
                        Branding
                    </button>
                )}

                {hasRole(['Owner']) && (
                    <button
                        onClick={() => setActiveTab('scheduling')}
                        className={`px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'scheduling'
                            ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                    >
                        <CalendarDays className="h-4 w-4 inline mr-2" />
                        Scheduling
                    </button>
                )}

                {hasRole(['Owner', 'Manager']) && (
                    <button
                        onClick={() => setActiveTab('branches')}
                        className={`px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'branches'
                            ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                    >
                        <MapPin className="h-4 w-4 inline mr-2" />
                        Branches
                    </button>
                )}

                {/* Availability Tab - Visible to Stylists only */}
                {!hasRole(['Owner']) && (
                    <button
                        onClick={() => setActiveTab('availability')}
                        className={`px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'availability'
                            ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                    >
                        <Clock className="h-4 w-4 inline mr-2" />
                        My Availability
                    </button>
                )}

                {hasRole(['Owner']) && (
                    <button
                        onClick={() => setActiveTab('tax')}
                        className={`px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'tax'
                            ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                    >
                        <Receipt className="h-4 w-4 inline mr-2" />
                        Tax Management
                    </button>
                )}

                {hasRole(['Owner']) && (
                    <button
                        onClick={() => setActiveTab('loyalty')}
                        className={`px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'loyalty'
                            ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                    >
                        <Gift className="h-4 w-4 inline mr-2" />
                        Loyalty Program
                    </button>
                )}

                {hasRole(['Owner']) && (
                    <button
                        onClick={() => setActiveTab('page_access')}
                        className={`px-4 py-2 font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'page_access'
                            ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                    >
                        <Eye className="h-4 w-4 inline mr-2" />
                        Page Access
                    </button>
                )}
            </div>

            {/* Tab Content */}
            <div className="card p-6 surface-panel">
                {activeTab === 'passwords' && (
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">Change Your Password</h3>
                            <PasswordChangeSection
                                hasRole={hasRole}
                                showMessage={showMessage}
                            />
                        </div>

                        {hasRole(['Owner']) && (
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">Change Staff Password</h3>
                                <StaffPasswordSection
                                    showMessage={showMessage}
                                />
                            </div>
                        )}
                    </div>
                )}



                {activeTab === 'branding' && hasRole(['Owner']) && (
                    <BrandingSettings showMessage={showMessage} />
                )}

                {activeTab === 'scheduling' && hasRole(['Owner']) && (
                    <SchedulingSettings showMessage={showMessage} />
                )}

                {activeTab === 'availability' && (
                    <AvailabilitySettings user={user} showMessage={showMessage} />
                )}

                {activeTab === 'tax' && hasRole(['Owner']) && (
                    <TaxSettings showMessage={showMessage} />
                )}

                {activeTab === 'loyalty' && hasRole(['Owner']) && (
                    <LoyaltySettingsTab showMessage={showMessage} />
                )}

                {activeTab === 'branches' && hasRole(['Owner', 'Manager']) && (
                    <BranchesSettings showMessage={showMessage} />
                )}

                {activeTab === 'page_access' && hasRole(['Owner']) && (
                    <PageAccessSettings showMessage={showMessage} />
                )}
            </div>
        </div>
    );
}

