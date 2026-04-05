'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Send, Calendar, Users, DollarSign, Eye, Ban, Trash2 } from 'lucide-react';
import Button from '@/components/shared/Button';
import { useAuth } from '@/lib/auth';
import { campaignService } from '@/services/campaigns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const statusColors = {
    draft: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
    scheduled: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    sending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    completed: 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300',
    cancelled: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
    failed: 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300'
};

export default function CampaignsPage() {
    const router = useRouter();
    const { hasRole } = useAuth();
    const [loading, setLoading] = useState(true);
    const [campaigns, setCampaigns] = useState<any[]>([]);

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const fetchCampaigns = async () => {
        try {
            setLoading(true);
            const data = await campaignService.getCampaigns();
            setCampaigns(data || []);
        } catch (error) {
            console.error('Error fetching campaigns:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async (id: string) => {
        if (!confirm('Cancel this campaign?')) return;

        try {
            await campaignService.cancelCampaign(id);
            await fetchCampaigns();
        } catch (error) {
            console.error('Error cancelling campaign:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this campaign? This cannot be undone.')) return;

        try {
            await campaignService.deleteCampaign(id);
            await fetchCampaigns();
        } catch (error) {
            console.error('Error deleting campaign:', error);
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

    return (
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
                        <DollarSign className="h-8 w-8 text-warning-500" />
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
                                        <div className="flex items-center gap-1.5">
                                            <DollarSign className="h-4 w-4" />
                                            <span>LKR {campaign.estimated_cost || 0}</span>
                                        </div>
                                        {campaign.scheduled_for && (
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="h-4 w-4" />
                                                <span>{new Date(campaign.scheduled_for).toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>

                                    {campaign.target_segments && campaign.target_segments.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {campaign.target_segments.map((seg: string) => (
                                                <span key={seg} className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs">
                                                    {seg}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 ml-4">
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
    );
}
