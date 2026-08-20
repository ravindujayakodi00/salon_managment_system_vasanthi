'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Send, Calendar, Users, Eye, Ban, Trash2, RotateCcw, Play } from 'lucide-react';
import Button from '@/components/shared/Button';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';
import Modal from '@/components/shared/Modal';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/context/ToastContext';
import { campaignService } from '@/services/campaigns';
import Link from 'next/link';

const statusColors = {
    draft: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    scheduled: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    sending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    completed: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300',
    cancelled: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
    failed: 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300'
};

export default function CampaignsPage() {
    const { hasRole, user } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [pendingRetryCampaign, setPendingRetryCampaign] = useState<any>(null);
    const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
    const [retrying, setRetrying] = useState(false);
    const [resumingCampaignId, setResumingCampaignId] = useState<string | null>(null);
    const loadedOrganizationRef = useRef<string | null>(null);
    const hasSendingCampaigns = campaigns.some(campaign => campaign.status === 'sending');

    useEffect(() => {
        if (!user?.organizationId || loadedOrganizationRef.current === user.organizationId) return;
        loadedOrganizationRef.current = user.organizationId;
        void fetchCampaigns();
    }, [user?.organizationId]);

    useEffect(() => {
        if (!user?.organizationId || !hasSendingCampaigns) return;

        const interval = window.setInterval(async () => {
            try {
                const data = await campaignService.getCampaigns(user.organizationId);
                setCampaigns(data || []);
            } catch (error) {
                console.error('Error refreshing campaign progress:', error);
            }
        }, 5000);

        return () => window.clearInterval(interval);
    }, [hasSendingCampaigns, user?.organizationId]);

    const fetchCampaigns = async () => {
        try {
            setLoading(true);
            const data = await campaignService.getCampaigns(user?.organizationId);
            setCampaigns(data || []);
        } catch (error) {
            console.error('Error fetching campaigns:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = (id: string) => {
        setPendingCancelId(id);
    };

    const doCancel = async () => {
        if (!pendingCancelId) return;
        const id = pendingCancelId;
        setPendingCancelId(null);
        try {
            await campaignService.cancelCampaign(id);
            await fetchCampaigns();
        } catch (error) {
            console.error('Error cancelling campaign:', error);
            showToast('Failed to cancel campaign', 'error');
        }
    };

    const handleDelete = (id: string) => {
        setPendingDeleteId(id);
    };

    const doDelete = async () => {
        if (!pendingDeleteId) return;
        const id = pendingDeleteId;
        setPendingDeleteId(null);
        try {
            await campaignService.deleteCampaign(id);
            await fetchCampaigns();
        } catch (error) {
            console.error('Error deleting campaign:', error);
            showToast('Failed to delete campaign', 'error');
        }
    };

    const doRetryFailed = async () => {
        if (!pendingRetryCampaign) return;
        setRetrying(true);
        try {
            const result = await campaignService.retryFailedCampaign(pendingRetryCampaign.id);
            setPendingRetryCampaign(null);
            showToast(`Retrying ${result.retryCount} failed recipients`, 'success');
            await fetchCampaigns();
        } catch (error) {
            console.error('Error retrying failed campaign messages:', error);
            showToast(
                error instanceof Error ? error.message : 'Failed to retry campaign messages',
                'error'
            );
        } finally {
            setRetrying(false);
        }
    };

    const resumeDelivery = async (campaignId: string) => {
        setResumingCampaignId(campaignId);
        try {
            const result = await campaignService.resumeCampaignDelivery(campaignId);
            showToast(`Resuming ${result.pendingCount} pending recipients`, 'success');
            await fetchCampaigns();
        } catch (error) {
            console.error('Error resuming campaign delivery:', error);
            showToast(
                error instanceof Error ? error.message : 'Failed to resume campaign delivery',
                'error'
            );
        } finally {
            setResumingCampaignId(null);
        }
    };

    if (!hasRole(['Owner', 'Manager'])) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <Send className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Access Restricted
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        Only owners and managers can manage campaigns
                    </p>
                </div>
            </div>
        );
    }

    const stats = {
        total: campaigns.length,
        scheduled: campaigns.filter(c => c.status === 'scheduled').length,
        completed: campaigns.filter(c => c.status === 'completed').length,
        totalSent: campaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0)
    };

    const selectedMessage = selectedCampaign?.custom_message?.trim()
        || selectedCampaign?.notification_templates?.message?.trim()
        || 'No campaign message is available.';
    const selectedSubject = selectedCampaign?.custom_subject?.trim()
        || selectedCampaign?.notification_templates?.subject?.trim()
        || '';
    const selectedAudience = selectedCampaign?.target_all_customers
        ? 'All Customers'
        : selectedCampaign?.target_segments?.length
            ? selectedCampaign.target_segments.join(', ')
            : 'No audience selected';
    const selectedChannel = selectedCampaign?.channel
        ? selectedCampaign.channel.toUpperCase()
        : '—';
    const selectedCreatedAt = selectedCampaign?.created_at
        ? new Date(selectedCampaign.created_at).toLocaleString()
        : '—';
    const selectedScheduledFor = selectedCampaign?.scheduled_for
        ? new Date(selectedCampaign.scheduled_for).toLocaleString()
        : 'Not scheduled';

    return (
        <>
        <ConfirmationDialog
            isOpen={!!pendingCancelId}
            title="Cancel Campaign"
            message="Are you sure you want to cancel this campaign?"
            confirmText="Cancel Campaign"
            onConfirm={doCancel}
            onClose={() => setPendingCancelId(null)}
        />
        <ConfirmationDialog
            isOpen={!!pendingDeleteId}
            title="Delete Campaign"
            message="Delete this campaign? This cannot be undone."
            confirmText="Delete"
            onConfirm={doDelete}
            onClose={() => setPendingDeleteId(null)}
        />
        <ConfirmationDialog
            isOpen={!!pendingRetryCampaign}
            title="Retry Failed Messages"
            message={`Retry only the ${pendingRetryCampaign?.failed_count || 0} failed recipients? Customers already marked as sent will not receive another message.`}
            confirmText="Retry Failed"
            variant="info"
            loading={retrying}
            onConfirm={doRetryFailed}
            onClose={() => setPendingRetryCampaign(null)}
        />
        <Modal
            isOpen={!!selectedCampaign}
            onClose={() => setSelectedCampaign(null)}
            title="Campaign Details"
            size="lg"
            footer={(
                <Button variant="outline" onClick={() => setSelectedCampaign(null)}>
                    Close
                </Button>
            )}
        >
            {selectedCampaign && (
                <div className="space-y-5">
                    <div>
                        <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {selectedCampaign.name}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[selectedCampaign.status as keyof typeof statusColors]}`}>
                                {selectedCampaign.status}
                            </span>
                        </div>
                        {selectedCampaign.description && (
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                {selectedCampaign.description}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Channel</p>
                            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{selectedChannel}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Audience</p>
                            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white break-words">{selectedAudience}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Created</p>
                            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{selectedCreatedAt}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Scheduled For</p>
                            <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{selectedScheduledFor}</p>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Delivery</h4>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-900/50 p-3 text-center">
                                <p className="text-xl font-semibold text-gray-900 dark:text-white">{selectedCampaign.target_count || 0}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Recipients</p>
                            </div>
                            <div className="rounded-xl bg-success-50 dark:bg-success-900/20 p-3 text-center">
                                <p className="text-xl font-semibold text-success-700 dark:text-success-300">{selectedCampaign.sent_count || 0}</p>
                                <p className="text-xs text-success-600 dark:text-success-400">Sent</p>
                            </div>
                            <div className="rounded-xl bg-danger-50 dark:bg-danger-900/20 p-3 text-center">
                                <p className="text-xl font-semibold text-danger-700 dark:text-danger-300">{selectedCampaign.failed_count || 0}</p>
                                <p className="text-xs text-danger-600 dark:text-danger-400">Failed</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Campaign Message</h4>
                        {selectedSubject && (
                            <div className="mb-3">
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Subject</p>
                                <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedSubject}</p>
                            </div>
                        )}
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
                            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-800 dark:text-gray-200">
                                {selectedMessage}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Campaigns</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Create and manage targeted marketing campaigns
                    </p>
                </div>
                <Link href="/admin/campaigns/new">
                    <Button
                        variant="primary"
                        leftIcon={<Plus className="h-5 w-5" />}
                    >
                        New Campaign
                    </Button>
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card p-4 surface-panel">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Campaigns</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</h3>
                        </div>
                        <Send className="h-8 w-8 text-primary-500" />
                    </div>
                </div>

                <div className="card p-4 surface-panel">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Scheduled</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.scheduled}</h3>
                        </div>
                        <Calendar className="h-8 w-8 text-blue-500" />
                    </div>
                </div>

                <div className="card p-4 surface-panel">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.completed}</h3>
                        </div>
                        <Users className="h-8 w-8 text-success-500" />
                    </div>
                </div>

                <div className="card p-4 surface-panel">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Sent</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalSent}</h3>
                        </div>
                        <Send className="h-8 w-8 text-warning-500" />
                    </div>
                </div>
            </div>

            {/* Campaigns List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">Loading campaigns...</div>
                ) : campaigns.length === 0 ? (
                    <div className="card surface-panel p-12 text-center">
                        <Send className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            No campaigns yet
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">
                            Create your first targeted marketing campaign
                        </p>
                        <Link href="/admin/campaigns/new">
                            <Button variant="primary">Create Campaign</Button>
                        </Link>
                    </div>
                ) : (
                    campaigns.map((campaign, index) => (
                        <motion.div
                            key={campaign.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="card p-6 surface-panel hover:shadow-lg transition-shadow"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                            {campaign.name}
                                        </h3>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[campaign.status as keyof typeof statusColors]}`}>
                                            {campaign.status}
                                        </span>
                                    </div>

                                    {campaign.description && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                            {campaign.description}
                                        </p>
                                    )}

                                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                                        <div className="flex items-center gap-1.5">
                                            <Users className="h-4 w-4" />
                                            <span>{campaign.target_count || 0} recipients</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Send className="h-4 w-4" />
                                            <span>{campaign.sent_count || 0} sent</span>
                                        </div>
                                        {(campaign.failed_count || 0) > 0 && (
                                            <div className="flex items-center gap-1.5 text-danger-600 dark:text-danger-400">
                                                <span>{campaign.failed_count} failed</span>
                                            </div>
                                        )}
                                        {campaign.scheduled_for && (
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="h-4 w-4" />
                                                <span>{new Date(campaign.scheduled_for).toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>

                                    {campaign.target_all_customers && (
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs">
                                                All Customers
                                            </span>
                                        </div>
                                    )}
                                    {!campaign.target_all_customers && campaign.target_segments && campaign.target_segments.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {campaign.target_segments.map((seg: string) => (
                                                <span key={seg} className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs">
                                                    {seg}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-wrap justify-end gap-2 ml-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        leftIcon={<Eye className="h-4 w-4" />}
                                        onClick={() => setSelectedCampaign(campaign)}
                                    >
                                        View Details
                                    </Button>
                                    {campaign.status === 'sending' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            leftIcon={<Play className="h-4 w-4" />}
                                            isLoading={resumingCampaignId === campaign.id}
                                            onClick={() => resumeDelivery(campaign.id)}
                                        >
                                            Resume Delivery
                                        </Button>
                                    )}
                                    {['completed', 'failed'].includes(campaign.status)
                                        && (campaign.failed_count || 0) > 0 && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            leftIcon={<RotateCcw className="h-4 w-4" />}
                                            onClick={() => setPendingRetryCampaign(campaign)}
                                        >
                                            Retry Failed
                                        </Button>
                                    )}
                                    {campaign.status === 'scheduled' && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            leftIcon={<Ban className="h-4 w-4" />}
                                            onClick={() => handleCancel(campaign.id)}
                                        >
                                            Cancel
                                        </Button>
                                    )}
                                    {campaign.status === 'draft' && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            leftIcon={<Trash2 className="h-4 w-4" />}
                                            onClick={() => handleDelete(campaign.id)}
                                        >
                                            Delete
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
        </>
    );
}
