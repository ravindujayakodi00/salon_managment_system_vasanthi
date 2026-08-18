'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Plus, Search, UserMinus, UserPlus, Users } from 'lucide-react';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import AddSegmentModal from '@/components/segments/AddSegmentModal';
import { useAuth } from '@/lib/auth';
import {
    segmentationService,
    type CustomerSegment,
    type SegmentCustomer,
    type SegmentCustomerCandidate,
} from '@/services/segmentation';
import { useToast } from '@/context/ToastContext';

const MEMBERS_PER_PAGE = 6;
const CANDIDATES_PER_PAGE = 8;
const PANEL_HEIGHT = 'h-[680px]';

export default function SegmentsPage() {
    const { hasRole } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [segments, setSegments] = useState<CustomerSegment[]>([]);
    const [totalCustomers, setTotalCustomers] = useState(0);
    const [serviceCategoryOptions, setServiceCategoryOptions] = useState<string[]>([]);
    const [selectedSegment, setSelectedSegment] = useState<CustomerSegment | null>(null);
    const [activeView, setActiveView] = useState<'members' | 'add'>('members');

    const [showAddModal, setShowAddModal] = useState(false);

    const [members, setMembers] = useState<SegmentCustomer[]>([]);
    const [memberCount, setMemberCount] = useState(0);
    const [memberPage, setMemberPage] = useState(0);
    const [loadingMembers, setLoadingMembers] = useState(false);

    const [candidates, setCandidates] = useState<SegmentCustomerCandidate[]>([]);
    const [candidateCount, setCandidateCount] = useState(0);
    const [candidatePage, setCandidatePage] = useState(0);
    const [candidateSearch, setCandidateSearch] = useState('');
    const [serviceCategoryFilter, setServiceCategoryFilter] = useState('');
    const [loadingCandidates, setLoadingCandidates] = useState(false);
    const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
    const [selectAllFiltered, setSelectAllFiltered] = useState(false);
    const [mappingCustomers, setMappingCustomers] = useState(false);

    useEffect(() => {
        void loadPageData();
    }, []);

    useEffect(() => {
        if (!selectedSegment) return;
        setMemberPage(0);
        setCandidatePage(0);
        setSelectedCustomerIds(new Set());
        setSelectAllFiltered(false);
        void loadMembers(selectedSegment.id, 0);
        void loadCandidates(selectedSegment.id, 0, '', '');
    }, [selectedSegment?.id]);

    useEffect(() => {
        if (!selectedSegment || activeView !== 'add') return;
        setCandidatePage(0);
        setSelectedCustomerIds(new Set());
        setSelectAllFiltered(false);

        const timer = setTimeout(() => {
            void loadCandidates(selectedSegment.id, 0, candidateSearch, serviceCategoryFilter);
        }, 300);

        return () => clearTimeout(timer);
    }, [candidateSearch, serviceCategoryFilter, selectedSegment?.id, activeView]);

    const loadPageData = async () => {
        try {
            setLoading(true);
            const [segmentRows, customerCount, services] = await Promise.all([
                segmentationService.getSegments(),
                segmentationService.getTotalCustomerCount(),
                segmentationService.getServiceCategoryFilterOptions(),
            ]);
            setSegments(segmentRows);
            setTotalCustomers(customerCount);
            setServiceCategoryOptions(services);
            setSelectedSegment(current => {
                if (!current) return null;
                return segmentRows.find(segment => segment.id === current.id) || null;
            });
        } catch (error) {
            console.error('Error loading customer segments:', error);
            showToast('Failed to load customer segments', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadMembers = async (segmentId: string, page: number) => {
        try {
            setLoadingMembers(true);
            const result = await segmentationService.getSegmentMembers(segmentId, page, MEMBERS_PER_PAGE);
            setMembers(result.data);
            setMemberCount(result.count);
        } catch (error) {
            console.error('Error loading segment customers:', error);
            showToast('Failed to load segment customers', 'error');
        } finally {
            setLoadingMembers(false);
        }
    };

    const loadCandidates = async (
        segmentId: string,
        page: number,
        search: string,
        serviceCategory: string
    ) => {
        try {
            setLoadingCandidates(true);
            const result = await segmentationService.getCustomerCandidates({
                segmentId,
                search,
                serviceCategory,
                page,
                limit: CANDIDATES_PER_PAGE,
            });
            setCandidates(result.data);
            setCandidateCount(result.count);
        } catch (error) {
            console.error('Error loading customers:', error);
            showToast('Failed to load customers', 'error');
        } finally {
            setLoadingCandidates(false);
        }
    };

    const handleSegmentCreated = async (segment: CustomerSegment) => {
        await loadPageData();
        setSelectedSegment(segment);
        setActiveView('add');
    };

    const changeMemberPage = async (page: number) => {
        if (!selectedSegment) return;
        setMemberPage(page);
        await loadMembers(selectedSegment.id, page);
    };

    const changeCandidatePage = async (page: number) => {
        if (!selectedSegment) return;
        setCandidatePage(page);
        await loadCandidates(selectedSegment.id, page, candidateSearch, serviceCategoryFilter);
    };

    const toggleCustomer = (customerId: string) => {
        setSelectAllFiltered(false);
        setSelectedCustomerIds(current => {
            const next = new Set(current);
            if (next.has(customerId)) next.delete(customerId);
            else next.add(customerId);
            return next;
        });
    };

    const handleMapCustomers = async () => {
        if (!selectedSegment) return;
        try {
            setMappingCustomers(true);
            const mappedCount = selectAllFiltered
                ? await segmentationService.mapAllFilteredCustomers({
                    segmentId: selectedSegment.id,
                    search: candidateSearch,
                    serviceCategory: serviceCategoryFilter,
                })
                : await segmentationService.mapCustomers(
                    selectedSegment.id,
                    Array.from(selectedCustomerIds)
                );

            setSelectedCustomerIds(new Set());
            setSelectAllFiltered(false);
            setMemberPage(0);
            await Promise.all([
                loadPageData(),
                loadMembers(selectedSegment.id, 0),
                loadCandidates(selectedSegment.id, candidatePage, candidateSearch, serviceCategoryFilter),
            ]);
            showToast(`${mappedCount} customer${mappedCount === 1 ? '' : 's'} added to the segment`, 'success');
        } catch (error) {
            console.error('Error mapping customers:', error);
            showToast('Failed to add customers to segment', 'error');
        } finally {
            setMappingCustomers(false);
        }
    };

    const handleRemoveCustomer = async (customerId: string) => {
        if (!selectedSegment) return;
        try {
            await segmentationService.removeCustomerFromSegment(selectedSegment.id, customerId);
            const nextPage = members.length === 1 && memberPage > 0 ? memberPage - 1 : memberPage;
            setMemberPage(nextPage);
            await Promise.all([
                loadPageData(),
                loadMembers(selectedSegment.id, nextPage),
            ]);
            showToast('Customer removed from segment', 'success');
        } catch (error) {
            console.error('Error removing customer:', error);
            showToast('Failed to remove customer from segment', 'error');
        }
    };

    if (!hasRole(['Owner', 'Manager'])) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Access Restricted</h3>
                    <p className="text-gray-500 dark:text-gray-400">Only owners and managers can manage customer segments</p>
                </div>
            </div>
        );
    }

    const totalMemberships = segments.reduce((sum, segment) => sum + segment.customer_count, 0);
    const memberPages = Math.max(1, Math.ceil(memberCount / MEMBERS_PER_PAGE));
    const candidatePages = Math.max(1, Math.ceil(candidateCount / CANDIDATES_PER_PAGE));
    const canMap = selectAllFiltered ? candidateCount > 0 : selectedCustomerIds.size > 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Customer Segments</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Create and manage customer audiences</p>
                </div>
                <Button
                    variant="primary"
                    leftIcon={<Plus className="h-5 w-5" />}
                    onClick={() => setShowAddModal(true)}
                >
                    Add Segment
                </Button>
            </div>

            {/* Segment Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                <div className="card p-6 surface-panel">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Customers</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalCustomers}</p>
                </div>
                <div className="card p-6 surface-panel">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active Segments</p>
                    <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">{segments.length}</p>
                </div>
                <div className="card p-6 surface-panel">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Mapped Memberships</p>
                    <p className="text-3xl font-bold text-success-600 dark:text-success-400">{totalMemberships}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Customer Segments</h2>
                    <div className={`card surface-panel p-4 overflow-y-auto space-y-3 ${PANEL_HEIGHT}`}>
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-gray-500">Loading segments...</div>
                        ) : segments.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-gray-500">No segments created</div>
                        ) : (
                            segments.map(segment => {
                                const isSelected = selectedSegment?.id === segment.id;
                                return (
                                    <motion.button
                                        key={segment.id}
                                        type="button"
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        onClick={() => setSelectedSegment(segment)}
                                        className={`w-full p-4 rounded-xl border text-left transition-all ${isSelected
                                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <h3 className="font-semibold text-gray-900 dark:text-white">{segment.name}</h3>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                    {segment.description || 'No description'}
                                                </p>
                                                <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                                    {segment.customer_count} customers
                                                </span>
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-gray-400" />
                                        </div>
                                    </motion.button>
                                );
                            })
                        )}
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {selectedSegment?.name || 'Select a segment'}
                        </h2>
                        {selectedSegment && (
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant={activeView === 'members' ? 'primary' : 'outline'}
                                    onClick={() => setActiveView('members')}
                                >
                                    Members
                                </Button>
                                <Button
                                    size="sm"
                                    variant={activeView === 'add' ? 'primary' : 'outline'}
                                    leftIcon={<UserPlus className="h-4 w-4" />}
                                    onClick={() => setActiveView('add')}
                                >
                                    Add Customers
                                </Button>
                            </div>
                        )}
                    </div>

                    {!selectedSegment ? (
                        <div className={`card surface-panel flex items-center justify-center text-gray-500 ${PANEL_HEIGHT}`}>
                            Select a customer segment to manage its customers
                        </div>
                    ) : activeView === 'members' ? (
                        <div className={`card surface-panel p-5 flex flex-col ${PANEL_HEIGHT}`}>
                            <div className="flex-1 overflow-y-auto space-y-2">
                                {loadingMembers ? (
                                    <div className="h-full flex items-center justify-center text-gray-500">Loading customers...</div>
                                ) : members.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-center text-gray-500">
                                        No customers are mapped to this segment yet
                                    </div>
                                ) : (
                                    members.map(customer => (
                                        <div
                                            key={customer.id}
                                            className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700"
                                        >
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">{customer.name}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{customer.phone || customer.email}</p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                leftIcon={<UserMinus className="h-4 w-4" />}
                                                onClick={() => handleRemoveCustomer(customer.id)}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => changeMemberPage(memberPage - 1)}
                                    disabled={memberPage === 0 || loadingMembers}
                                >
                                    Previous
                                </Button>
                                <span className="text-sm text-gray-500">Page {memberPage + 1} of {memberPages}</span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => changeMemberPage(memberPage + 1)}
                                    disabled={memberPage + 1 >= memberPages || loadingMembers}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className={`card surface-panel p-5 flex flex-col ${PANEL_HEIGHT}`}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <Input
                                    value={candidateSearch}
                                    onChange={event => setCandidateSearch(event.target.value)}
                                    placeholder="Search name, phone or email"
                                    leftIcon={<Search className="h-4 w-4" />}
                                />
                                <select
                                    value={serviceCategoryFilter}
                                    onChange={event => setServiceCategoryFilter(event.target.value)}
                                    aria-label="Filter customers by service category"
                                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
                                >
                                    <option value="">All service categories</option>
                                    {serviceCategoryOptions.map(category => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                            </div>

                            <label className="flex items-center gap-3 mt-4 p-3 rounded-xl bg-primary-50 dark:bg-primary-900/20 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectAllFiltered}
                                    onChange={event => {
                                        setSelectAllFiltered(event.target.checked);
                                        if (event.target.checked) setSelectedCustomerIds(new Set());
                                    }}
                                    className="h-4 w-4 rounded text-primary-600"
                                />
                                <span className="text-sm font-medium text-primary-800 dark:text-primary-200">
                                    Select all {candidateCount} filtered customers
                                </span>
                            </label>

                            <div className="flex-1 overflow-y-auto space-y-2 mt-4">
                                {loadingCandidates ? (
                                    <div className="h-full flex items-center justify-center text-gray-500">Loading customers...</div>
                                ) : candidates.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-gray-500">No customers match these filters</div>
                                ) : (
                                    candidates.map(customer => (
                                        <label
                                            key={customer.customer_id}
                                            className={`flex items-center gap-3 p-3 rounded-xl border ${customer.is_mapped
                                                ? 'border-success-200 bg-success-50/50 dark:border-success-800 dark:bg-success-900/10'
                                                : 'border-gray-100 dark:border-gray-700'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectAllFiltered || selectedCustomerIds.has(customer.customer_id) || customer.is_mapped}
                                                disabled={selectAllFiltered || customer.is_mapped}
                                                onChange={() => toggleCustomer(customer.customer_id)}
                                                className="h-4 w-4 rounded text-primary-600"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-900 dark:text-white truncate">{customer.customer_name}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{customer.phone || customer.email}</p>
                                            </div>
                                            {customer.is_mapped && <span className="text-xs text-success-600">Already added</span>}
                                        </label>
                                    ))
                                )}
                            </div>

                            <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                                <div className="flex items-center justify-between">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => changeCandidatePage(candidatePage - 1)}
                                        disabled={candidatePage === 0 || loadingCandidates}
                                    >
                                        Previous
                                    </Button>
                                    <span className="text-sm text-gray-500">Page {candidatePage + 1} of {candidatePages}</span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => changeCandidatePage(candidatePage + 1)}
                                        disabled={candidatePage + 1 >= candidatePages || loadingCandidates}
                                    >
                                        Next
                                    </Button>
                                </div>
                                <Button
                                    variant="primary"
                                    className="w-full"
                                    onClick={handleMapCustomers}
                                    isLoading={mappingCustomers}
                                    disabled={!canMap}
                                >
                                    {selectAllFiltered
                                        ? `Add All ${candidateCount} Filtered Customers`
                                        : `Add ${selectedCustomerIds.size} Selected Customers`}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Segment Modal */}
            <AddSegmentModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSuccess={handleSegmentCreated}
            />
        </div>
    );
}
