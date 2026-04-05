'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Send, Calendar, Target, Eye, ArrowLeft, ArrowRight,
    Check, Users, DollarSign, Clock
} from 'lucide-react';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import { useAuth } from '@/lib/auth';
import { campaignService } from '@/services/campaigns';
import { segmentationService } from '@/services/segmentation';
import { notificationsService } from '@/services/notifications';
import { useRouter } from 'next/navigation';

const STEPS = ['Details', 'Audience', 'Schedule', 'Review'];

export default function NewCampaignPage() {
    const router = useRouter();
    const { hasRole, user } = useAuth();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [segments, setSegments] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [audiencePreview, setAudiencePreview] = useState<any>(null);

    const [campaign, setCampaign] = useState({
        name: '',
        description: '',
        template_id: '',
        target_segments: [] as string[],
        scheduled_for: '',
        channel: 'sms' as 'sms' | 'email' | 'both',
        send_now: true
    });

    useEffect(() => {
        if (user?.organizationId) {
            void loadData();
        }
    }, [user?.organizationId]);

    useEffect(() => {
        if (campaign.target_segments.length > 0 && campaign.channel) {
            loadAudiencePreview();
        }
    }, [campaign.target_segments, campaign.channel]);

    const loadData = async () => {
        if (!user?.organizationId) return;
        try {
            const [segs, temps] = await Promise.all([
                segmentationService.getSegments(),
                notificationsService.getTemplates(user.organizationId)
            ]);
            setSegments(segs);
            setTemplates(temps.filter(t => t.type === 'promotional'));
        } catch (error) {
            console.error('Error loading data:', error);
        }
    };

    const loadAudiencePreview = async () => {
        try {
            const preview = await campaignService.previewAudience(
                campaign.target_segments,
                campaign.channel
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
        try {
            setLoading(true);

            // Create campaign
            const newCampaign = await campaignService.createCampaign({
                name: campaign.name,
                description: campaign.description,
                template_id: campaign.template_id,
                target_segments: campaign.target_segments,
                scheduled_for: campaign.send_now ? undefined : campaign.scheduled_for,
                channel: campaign.channel
            });

            // Send immediately if requested
            if (campaign.send_now) {
                await campaignService.sendCampaignNow(newCampaign.id);
            }

            router.push('/admin/campaigns');
        } catch (error) {
            console.error('Error creating campaign:', error);
            alert('Failed to create campaign');
        } finally {
            setLoading(false);
        }
    };

    if (!hasRole(['Owner', 'Manager'])) {
        return <div className="text-center py-12">Access restricted</div>;
    }

    const canProceed = () => {
        switch (currentStep) {
            case 0: return campaign.name && campaign.template_id;
            case 1: return campaign.target_segments.length > 0;
            case 2: return campaign.send_now || campaign.scheduled_for;
            default: return true;
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Campaign</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Send targeted promotional messages to customer segments</p>
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

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                Notification Template
                            </label>
                            <select
                                value={campaign.template_id}
                                onChange={(e) => setCampaign({ ...campaign, template_id: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                            >
                                <option value="">Select a template...</option>
                                {templates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>

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

                        <div className="grid grid-cols-2 gap-4">
                            {segments.map(segment => (
                                <button
                                    key={segment.id}
                                    onClick={() => toggleSegment(segment.name)}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${campaign.target_segments.includes(segment.name)
                                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                        : 'border-gray-200 dark:border-gray-700'
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
                                <div className="flex items-center gap-6">
                                    <div>
                                        <p className="text-sm text-blue-700 dark:text-blue-300">Total Recipients</p>
                                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{audiencePreview.count}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-blue-700 dark:text-blue-300">Estimated Cost</p>
                                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">LKR {audiencePreview.estimatedCost}</p>
                                    </div>
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
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target Segments</h4>
                                <div className="flex flex-wrap gap-2">
                                    {campaign.target_segments.map(seg => (
                                        <span key={seg} className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm">
                                            {seg}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {audiencePreview && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Users className="h-5 w-5 text-gray-600" />
                                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Recipients</h4>
                                        </div>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{audiencePreview.count}</p>
                                    </div>

                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <DollarSign className="h-5 w-5 text-gray-600" />
                                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Cost</h4>
                                        </div>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">LKR {audiencePreview.estimatedCost}</p>
                                    </div>
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
