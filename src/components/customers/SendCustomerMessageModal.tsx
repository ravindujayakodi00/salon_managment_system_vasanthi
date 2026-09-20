'use client';

import { FormEvent, useEffect, useState } from 'react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import { useToast } from '@/context/ToastContext';
import type { Customer } from '@/lib/types';
import { notificationsService } from '@/services/notifications';

interface SendCustomerMessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    customer: Customer | null;
}

export default function SendCustomerMessageModal({
    isOpen,
    onClose,
    customer,
}: SendCustomerMessageModalProps) {
    const { showToast } = useToast();
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (isOpen) setMessage('');
    }, [isOpen, customer?.id]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!customer || !message.trim()) return;

        try {
            setSending(true);
            const result = await notificationsService.sendSMS(customer.phone, message.trim());

            if (!result.success) {
                throw new Error(result.error || 'Failed to send message');
            }

            showToast(`Message sent to ${customer.name}`, 'success');
            onClose();
        } catch (error: any) {
            console.error('Error sending customer message:', error);
            showToast(error.message || 'Failed to send message', 'error');
        } finally {
            setSending(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Send Message" size="sm">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 px-4 py-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Sending to</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{customer?.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{customer?.phone}</p>
                </div>

                <div>
                    <label
                        htmlFor="customer-message"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                    >
                        Message
                    </label>
                    <textarea
                        id="customer-message"
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        required
                        rows={6}
                        placeholder="Type your message..."
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y"
                    />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={onClose} disabled={sending}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" isLoading={sending} disabled={!message.trim()}>
                        Send Message
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
