'use client';

import { useRef, useEffect, useState } from 'react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import { Printer, Loader } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useBranding } from '@/lib/branding';
import { useAuth } from '@/lib/auth';
import { branchesService } from '@/services/branches';
import type { Branch } from '@/lib/types';

interface ReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: any;
}

export default function ReceiptModal({ isOpen, onClose, invoice }: ReceiptModalProps) {
    const receiptRef = useRef<HTMLDivElement>(null);
    const { logoUrl } = useBranding();
    const { user } = useAuth();
    const salonName = user?.organization?.name ?? '';
    const [branch, setBranch] = useState<Branch | null>(null);
    const [loadingBranch, setLoadingBranch] = useState(false);

    useEffect(() => {
        if (!invoice?.branch_id) return;
        setBranch(null);
        setLoadingBranch(true);
        branchesService.getBranchById(invoice.branch_id)
            .then(setBranch)
            .catch(() => {})
            .finally(() => setLoadingBranch(false));
    }, [invoice?.branch_id]);

    const handlePrint = () => {
        const printContent = receiptRef.current;
        if (printContent) {
            const originalContents = document.body.innerHTML;
            document.body.innerHTML = printContent.innerHTML;
            window.print();
            document.body.innerHTML = originalContents;
            window.location.reload();
        }
    };

    if (!invoice) return null;

    const invoiceNumber = invoice.invoice_number
        ? invoice.invoice_number.slice(-15)
        : invoice.id?.slice(0, 8) ?? '—';

    const isLoading = loadingBranch;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Receipt">
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader className="h-6 w-6 animate-spin text-primary-600" />
                </div>
            ) : (
                <div className="space-y-6">
                    <div ref={receiptRef} className="p-4 bg-white text-black" id="receipt-content">
                        <div className="text-center mb-6">
                            {logoUrl && (
                                <img src={logoUrl} alt="Logo" className="h-16 mx-auto mb-3 object-contain" />
                            )}
                            {salonName && (
                                <p className="text-xs font-bold text-gray-900 tracking-wide mb-1">{salonName}</p>
                            )}
                            {branch && (
                                <>
                                    <p className="text-sm text-gray-500">{branch.address}</p>
                                    <p className="text-sm text-gray-500">Tel: {branch.phone}</p>
                                </>
                            )}
                        </div>

                        <div className="border-b border-dashed border-gray-300 pb-4 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Date:</span>
                                <span className="font-medium">{formatDate(invoice.created_at)}</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                                <span className="text-gray-600">Invoice #:</span>
                                <span className="font-medium font-mono">{invoiceNumber}</span>
                            </div>
                        </div>

                        <div className="space-y-2 mb-4">
                            {invoice.items?.map((item: any, index: number) => (
                                <div key={index} className="flex justify-between text-sm">
                                    <span>{item.name} x{item.quantity}</span>
                                    <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-dashed border-gray-300 pt-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Subtotal</span>
                                <span>{formatCurrency(invoice.subtotal)}</span>
                            </div>
                            {invoice.discount > 0 && (
                                <div className="flex justify-between text-sm text-success-600">
                                    <span>Discount</span>
                                    <span>-{formatCurrency(invoice.discount)}</span>
                                </div>
                            )}
                            {invoice.tax > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Tax</span>
                                    <span>{formatCurrency(invoice.tax)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-bold mt-2 pt-2 border-t border-gray-200">
                                <span>Total</span>
                                <span>{formatCurrency(invoice.total)}</span>
                            </div>
                        </div>

                        <div className="text-center mt-8 text-xs text-gray-500">
                            <p>Thank you for your visit!</p>
                            <p>Please come again.</p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={onClose}>
                            Close
                        </Button>
                        <Button variant="primary" onClick={handlePrint} leftIcon={<Printer className="h-4 w-4" />}>
                            Print Receipt
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
