'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    Send, Calendar, Target, Eye, ArrowLeft, ArrowRight,
    Check, Users, Clock
} from 'lucide-react';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/context/ToastContext';
import { campaignService } from '@/services/campaigns';
import { segmentationService } from '@/services/segmentation';
import { notificationsService } from '@/services/notifications';
import { useRouter } from 'next/navigation';

const STEPS = ['Details', 'Audience', 'Schedule', 'Review'];

export default function NewCampaignPage() {
    const router = useRouter();
    const { showToast } = useToast();
    const { hasRole, user } = useAuth();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [segments, setSegments] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [audiencePreview, setAudiencePreview] = useState<any>(null);
    const loadedOrganizationRef = useRef<string | null>(null);
    const submittingRef = useRef(false);

    const [campaign, setCampaign] = useState({
        name: '',
        description: '',
        template_id: '',
        message_source: 'template' as 'template' | 'custom',
        custom_message: '',
        custom_subject: '',
        target_segments: [] as string[],
        target_all_customers: false,
        scheduled_for: '',
        channel: 'sms' as 'sms' | 'email' | 'both',
        send_now: true
    });

    useEffect(() => {
        if (user?.organizationId && loadedOrganizationRef.current !== user.organizationId) {
            loadedOrganizationRef.current = user.organizationId;
            void loadData();
        }
    }, [user?.organizationId]);

    useEffect(() => {
        if ((campaign.target_all_customers || campaign.target_segments.length > 0) && campaign.channel) {
            loadAudiencePreview();
        } else {
            setAudiencePreview(null);
        }
    }, [campaign.target_segments, campaign.target_all_customers, campaign.channel]);

    const loadData = async () => {
        if (!user?.organizationId) return;
        try {
            const [segs, temps] = await Promise.all([
                segmentationService.getSegments(),
                notificationsService.getTemplates(user.organizationId)
            ]);
            setSegments(segs);
            setTemplates(temps.filter(t => t.is_active));
        } catch (error) {
            console.error('Error loading data:', error);
        }
    };

    const loadAudiencePreview = async () => {
        try {
            const preview = await campaignService.previewAudience(
                campaign.target_segments,
                campaign.channel,
                campaign.target_all_customers,
                user?.organizationId
            );
            setAudiencePreview(preview);
        } catch (error) {
            console.error('Error loading preview:', error);
        }
    };

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const toggleSegment = (segmentName: string) => {
        setCampaign(prev => ({
            ...prev,
            target_segments: prev.target_segments.includes(segmentName)
                ? prev.target_segments.filter(s => s !== segmentName)
                : [...prev.target_segments, segmentName]
        }));
    };

    const handleSubmit = async () => {
        if (submittingRef.current || !user?.organizationId) return;
        submittingRef.current = true;

        try {
            setLoading(true);

            const resolvedAudience = await campaignService.previewAudience(
                campaign.target_segments,
                campaign.channel,
                campaign.target_all_customers,
                user.organizationId
            );

            // Create campaign
            const newCampaign = await campaignService.createCampaign({
                name: campaign.name,
                description: campaign.description,
                template_id: campaign.message_source === 'template' ? campaign.template_id : undefined,
                custom_message: campaign.message_source === 'custom' ? campaign.custom_message : undefined,
                custom_subject: campaign.message_source === 'custom' ? campaign.custom_subject : undefined,
                target_segments: campaign.target_segments,
                target_all_customers: campaign.target_all_customers,
                scheduled_for: campaign.send_now ? undefined : campaign.scheduled_for,
                channel: campaign.channel
            }, {
                organizationId: user.organizationId,
                createdBy: user.id,
                audienceSummary: resolvedAudience,
            });

            // Send immediately if requested
            if (campaign.send_now) {
                await campaignService.sendCampaignNow(newCampaign.id);
            }

            router.push('/admin/campaigns');
        } catch (error) {
            console.error('Error creating campaign:', error);
            showToast('Failed to create campaign', 'error');
        } finally {
            submittingRef.current = false;
            setLoading(false);
        }
    };

    if (!hasRole(['Owner', 'Manager'])) {
        return <div className="text-center py-12">Access restricted</div>;
    }

    const canProceed = () => {
        switch (currentStep) {
            case 0:
                return Boolean(
                    campaign.name.trim()
                    && (campaign.message_source === 'template'
                        ? campaign.template_id
                        : campaign.custom_message.trim())
                );
            case 1: return campaign.target_all_customers || campaign.target_segments.length > 0;
            case 2: return campaign.send_now || campaign.scheduled_for;
            default: return true;
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Campaign</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Send targeted messages using a saved template or a custom message</p>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-between">
                {STEPS.map((step, index) => (
                    <div key={step} className="flex items-center flex-1">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${index <= currentStep
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                                }`}>
                                {index < currentStep ? <Check className="h-5 w-5" /> : index + 1}
                            </div>
                            <span className={`text-sm font-medium ${index <= currentStep ? 'text-gray-900 dark:text-white' : 'text-gray-500'
                                }`}>
                                {step}
                            </span>
                        </div>
                        {index < STEPS.length - 1 && (
                            <div className={`h-0.5 flex-1 mx-4 ${index < currentStep ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                                }`} />
                        )}
                    </div>
                ))}
            </div>

            {/* Step Content */}
            <div className="card surface-panel p-8">
                {/* Step 0: Details */}
                {currentStep === 0 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Campaign Details</h2>

                        <Input
                            label="Campaign Name"
                            value={campaign.name}
                            onChange={(e) => setCampaign({ ...campaign, name: e.target.value })}
                            placeholder="e.g., Weekend Haircut Special"
                        />

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Description (Optional)
                            </label>
                            <textarea
                                value={campaign.description}
                                onChange={(e) => setCampaign({ ...campaign, description: e.target.value })}
                                rows={3}
                                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                                placeholder="Brief description of this campaign..."
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Message Source
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setCampaign({ ...campaign, message_source: 'template' })}
                                    className={`p-3 rounded-xl border-2 transition-all ${campaign.message_source === 'template'
                                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                        : 'border-gray-200 dark:border-gray-700'
                                        }`}
                                >
                                    <span className="font-medium text-gray-900 dark:text-white">Saved Template</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCampaign({ ...campaign, message_source: 'custom' })}
                                    className={`p-3 rounded-xl border-2 transition-all ${campaign.message_source === 'custom'
                                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                        : 'border-gray-200 dark:border-gray-700'
                                        }`}
                                >
                                    <span className="font-medium text-gray-900 dark:text-white">Write Message</span>
                                </button>
                            </div>
                        </div>

                        {campaign.message_source === 'template' ? (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Notification Template
                                </label>
                                <select
                                    value={campaign.template_id}
                                    onChange={(e) => {
                                        const templateId = e.target.value;
                                        const selectedTemplate = templates.find(t => t.id === templateId);
                                        setCampaign({
                                            ...campaign,
                                            template_id: templateId,
                                            channel: selectedTemplate?.channel || campaign.channel
                                        });
                                    }}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                                >
                                    <option value="">Select a template...</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {campaign.channel !== 'sms' && (
                                    <Input
                                        label="Email Subject (Optional)"
                                        value={campaign.custom_subject}
                                        onChange={(e) => setCampaign({ ...campaign, custom_subject: e.target.value })}
                                    />
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        Message
                                    </label>
                                    <textarea
                                        value={campaign.custom_message}
                                        onChange={(e) => setCampaign({ ...campaign, custom_message: e.target.value })}
                                        rows={7}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white resize-none"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Channel
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {['email', 'sms', 'both'].map(ch => (
                                    <button
                                        key={ch}
                                        onClick={() => setCampaign({ ...campaign, channel: ch as any })}
                                        className={`p-3 rounded-xl border-2 transition-all ${campaign.channel === ch
                                            ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                            : 'border-gray-200 dark:border-gray-700'
                                            }`}
                                    >
                                        <span className="font-medium text-gray-900 dark:text-white capitalize">{ch}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 1: Audience */}
                {currentStep === 1 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Target Audience</h2>

                        <button
                            type="button"
                            onClick={() => setCampaign({
                                ...campaign,
                                target_all_customers: !campaign.target_all_customers,
                                target_segments: []
                            })}
                            className={`w-full p-5 rounded-xl border-2 text-left transition-all ${campaign.target_all_customers
                                ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                : 'border-gray-200 dark:border-gray-700'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-medium text-gray-900 dark:text-white">All Customers</h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        Every active customer in this organization with matching contact details
                                    </p>
                                </div>
                                {campaign.target_all_customers && <Check className="h-5 w-5 text-primary-600" />}
                            </div>
                        </button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">or select segments</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {segments.map(segment => (
                                <button
                                    key={segment.id}
                                    type="button"
                                    onClick={() => toggleSegment(segment.name)}
                                    disabled={campaign.target_all_customers}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${campaign.target_segments.includes(segment.name)
                                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                        : 'border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-medium text-gray-900 dark:text-white">{segment.name}</h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                                {segment.customer_count} customers
                                            </p>
                                        </div>
                                        {campaign.target_segments.includes(segment.name) && (
                                            <Check className="h-5 w-5 text-primary-600" />
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>

                        {audiencePreview && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                                <div>
                                    <p className="text-sm text-blue-700 dark:text-blue-300">Total Recipients</p>
                                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{audiencePreview.count}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 2: Schedule */}
                {currentStep === 2 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">When to Send</h2>

                        <div className="space-y-4">
                            <button
                                onClick={() => setCampaign({ ...campaign, send_now: true })}
                                className={`w-full p-6 rounded-xl border-2 text-left transition-all ${campaign.send_now
                                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                    : 'border-gray-200 dark:border-gray-700'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <Send className="h-6 w-6 text-primary-600" />
                                    <div>
                                        <h4 className="font-medium text-gray-900 dark:text-white">Send Immediately</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            Campaign will be sent right away to all selected customers
                                        </p>
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => setCampaign({ ...campaign, send_now: false })}
                                className={`w-full p-6 rounded-xl border-2 text-left transition-all ${!campaign.send_now
                                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                    : 'border-gray-200 dark:border-gray-700'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <Calendar className="h-6 w-6 text-primary-600" />
                                    <div className="flex-1">
                                        <h4 className="font-medium text-gray-900 dark:text-white">Schedule for Later</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            Choose a specific date and time to send
                                        </p>
                                        {!campaign.send_now && (
                                            <input
                                                type="datetime-local"
                                                value={campaign.scheduled_for}
                                                onChange={(e) => setCampaign({ ...campaign, scheduled_for: e.target.value })}
                                                min={new Date().toISOString().slice(0, 16)}
                                                className="mt-3 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                                            />
                                        )}
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Review */}
                {currentStep === 3 && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Review & Confirm</h2>

                        <div className="space-y-4">
                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Campaign Name</h4>
                                <p className="text-gray-900 dark:text-white">{campaign.name}</p>
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Audience</h4>
                                <div className="flex flex-wrap gap-2">
                                    {campaign.target_all_customers ? (
                                        <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm">
                                            All Customers
                                        </span>
                                    ) : (
                                        campaign.target_segments.map(seg => (
                                            <span key={seg} className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm">
                                                {seg}
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>

                            {audiencePreview && (
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Users className="h-5 w-5 text-gray-600" />
                                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Recipients</h4>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{audiencePreview.count}</p>
                                </div>
                            )}

                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                <div className="flex items-center gap-2 mb-2">
                                    <Clock className="h-5 w-5 text-gray-600" />
                                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Delivery</h4>
                                </div>
                                <p className="text-gray-900 dark:text-white">
                                    {campaign.send_now ? 'Immediately' : new Date(campaign.scheduled_for).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
                <Button
                    variant="outline"
                    leftIcon={<ArrowLeft className="h-5 w-5" />}
                    onClick={handleBack}
                    disabled={currentStep === 0}
                >
                    Back
                </Button>

                {currentStep < STEPS.length - 1 ? (
                    <Button
                        variant="primary"
                        rightIcon={<ArrowRight className="h-5 w-5" />}
                        onClick={handleNext}
                        disabled={!canProceed()}
                    >
                        Next
                    </Button>
                ) : (
                    <Button
                        variant="primary"
                        leftIcon={<Send className="h-5 w-5" />}
                        onClick={handleSubmit}
                        disabled={loading || !canProceed()}
                    >
                        {loading ? 'Creating...' : campaign.send_now ? 'Send Campaign' : 'Schedule Campaign'}
                    </Button>
                )}
            </div>
        </div>
    );
}
