'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/shared/Modal';
import Input from '@/components/shared/Input';
import Button from '@/components/shared/Button';
import { useToast } from '@/context/ToastContext';
import { segmentationService, type CustomerSegment } from '@/services/segmentation';

interface AddSegmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (segment: CustomerSegment) => void;
}

export default function AddSegmentModal({ isOpen, onClose, onSuccess }: AddSegmentModalProps) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (isOpen) {
            setName('');
            setDescription('');
        }
    }, [isOpen]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!name.trim()) return;

        try {
            setLoading(true);
            const segment = await segmentationService.createSegment({ name, description });
            showToast('Customer segment created successfully', 'success');
            onSuccess(segment);
            onClose();
        } catch (error: any) {
            console.error('Error creating customer segment:', error);
            showToast(
                error?.code === '23505'
                    ? 'A customer segment with this name already exists'
                    : error?.message || 'Failed to create customer segment',
                'error'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Customer Segment">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Segment Name"
                    value={name}
                    onChange={event => setName(event.target.value)}
                    required
                    placeholder="e.g. Bridal Customers"
                />

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description (Optional)
                    </label>
                    <textarea
                        value={description}
                        onChange={event => setDescription(event.target.value)}
                        className="w-full px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[100px]"
                        placeholder="Describe the customers in this segment..."
                    />
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" isLoading={loading} disabled={!name.trim()}>
                        Create Segment
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
