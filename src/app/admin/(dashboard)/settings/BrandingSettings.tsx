'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader, Save, Upload } from 'lucide-react';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import { useAuth } from '@/lib/auth';
import { previewBrandingColors, useBranding } from '@/lib/branding';
import { brandingService, formatUnknownError, type BrandingUpdate } from '@/services/branding';

interface ShowMessage {
    (type: 'success' | 'error', text: string): void;
}

export default function BrandingSettings({ showMessage }: { showMessage: ShowMessage }) {
    const { user, refreshProfile } = useAuth();
    const { resetTheme } = useBranding();
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(true);

    const [displayName, setDisplayName] = useState('');
    const [tagline, setTagline] = useState('');
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [primaryColor, setPrimaryColor] = useState('#4B5945');
    const [secondaryColor, setSecondaryColor] = useState('#0d9488');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');

    useEffect(() => {
        if (!user?.organizationId) {
            setLoadingData(false);
            return;
        }
        void (async () => {
            try {
                setLoadingData(true);
                const org = await brandingService.getBranding(user.organizationId);
                if (org) {
                    setDisplayName(org.display_name?.trim() || org.name || '');
                    setTagline(org.tagline?.trim() || '');
                    setLogoUrl(org.logo_url ?? null);
                    setPrimaryColor(org.primary_color?.trim() || '#4B5945');
                    setSecondaryColor(org.secondary_color?.trim() || '#0d9488');
                    setContactEmail(org.contact_email?.trim() || '');
                    setContactPhone(org.contact_phone?.trim() || '');
                }
            } catch (e) {
                console.error('Branding load failed:', formatUnknownError(e), e);
                showMessage('error', formatUnknownError(e) || 'Failed to load branding');
            } finally {
                setLoadingData(false);
            }
        })();
    }, [user?.organizationId]);

    useEffect(() => {
        previewBrandingColors(primaryColor, secondaryColor);
    }, [primaryColor, secondaryColor]);

    useEffect(() => {
        return () => {
            resetTheme();
        };
    }, [resetTheme]);

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.organizationId) return;
        try {
            setLoading(true);
            const url = await brandingService.uploadLogo(user.organizationId, file);
            setLogoUrl(url);
            await brandingService.updateBranding(user.organizationId, { logo_url: url });
            await refreshProfile();
            showMessage('success', 'Logo uploaded');
        } catch (err) {
            const detail = formatUnknownError(err);
            console.error('Logo upload failed:', detail, err);
            showMessage('error', detail || 'Failed to upload logo');
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    const handleSave = async () => {
        if (!user?.organizationId) return;
        try {
            setLoading(true);
            const updates: BrandingUpdate = {
                display_name: displayName.trim() || null,
                tagline: tagline.trim() || null,
                logo_url: logoUrl,
                primary_color: primaryColor,
                secondary_color: secondaryColor,
                contact_email: contactEmail.trim() || null,
                contact_phone: contactPhone.trim() || null,
            };
            await brandingService.updateBranding(user.organizationId, updates);
            await refreshProfile();
            showMessage('success', 'Branding saved');
        } catch (err) {
            const detail = formatUnknownError(err);
            console.error('Branding save failed:', detail, err);
            showMessage('error', detail || 'Failed to save branding');
        } finally {
            setLoading(false);
        }
    };

    if (loadingData) {
        return (
            <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Salon branding</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Customize the name, logo, and colors shown in the admin dashboard for your team.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                    <Input
                        label="Display name"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        placeholder="e.g. Glamour Studio"
                    />
                    <Input
                        label="Tagline"
                        value={tagline}
                        onChange={e => setTagline(e.target.value)}
                        placeholder="Short subtitle under the name"
                    />
                    <Input
                        label="Contact email"
                        type="email"
                        value={contactEmail}
                        onChange={e => setContactEmail(e.target.value)}
                    />
                    <Input
                        label="Contact phone"
                        value={contactPhone}
                        onChange={e => setContactPhone(e.target.value)}
                    />
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Logo
                        </label>
                        <div className="flex flex-wrap items-center gap-4">
                            {logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={logoUrl}
                                    alt="Salon logo"
                                    className="h-16 w-16 object-contain rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 p-1"
                                />
                            ) : (
                                <div className="h-16 w-16 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-xs text-gray-400">
                                    No logo
                                </div>
                            )}
                            <label className="cursor-pointer">
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                    className="hidden"
                                    onChange={handleLogoChange}
                                />
                                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <Upload className="h-4 w-4" />
                                    Upload logo
                                </span>
                            </label>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            PNG, JPG, WebP, or SVG. Max 2 MB.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Primary color
                            </label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    value={primaryColor}
                                    onChange={e => setPrimaryColor(e.target.value)}
                                    className="h-10 w-14 rounded border border-gray-200 dark:border-gray-600 cursor-pointer bg-transparent"
                                />
                                <Input
                                    value={primaryColor}
                                    onChange={e => setPrimaryColor(e.target.value)}
                                    className="flex-1"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Secondary color
                            </label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    value={secondaryColor}
                                    onChange={e => setSecondaryColor(e.target.value)}
                                    className="h-10 w-14 rounded border border-gray-200 dark:border-gray-600 cursor-pointer bg-transparent"
                                />
                                <Input
                                    value={secondaryColor}
                                    onChange={e => setSecondaryColor(e.target.value)}
                                    className="flex-1"
                                />
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Colors update live in this session. Save to persist for all users.
                    </p>
                </div>
            </div>

            <Button
                variant="primary"
                onClick={handleSave}
                disabled={loading}
                leftIcon={loading ? <Loader className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            >
                {loading ? 'Saving...' : 'Save branding'}
            </Button>
        </motion.div>
    );
}
