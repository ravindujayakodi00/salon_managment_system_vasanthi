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
        if (!receiptRef.current) return;

        // Remove any stale print style from a previous print
        document.getElementById('receipt-print-style')?.remove();

        // Inject @media print CSS into the main document — this is the only approach
        // that works correctly on all devices (iOS Safari, Android Chrome, tablets).
        // Iframes and window.open() lose the print context when settings change on mobile,
        // causing the full page to render instead. Using the main page's print context
        // with visibility:hidden on everything except the receipt is universally reliable.
        const style = document.createElement('style');
        style.id = 'receipt-print-style';
        style.innerHTML = `
          @media print {
            @page { size: auto; margin: 8mm; }

            /* Hide the entire page */
            body * { visibility: hidden !important; }

            /* Show only the receipt */
            #receipt-content,
            #receipt-content * { visibility: visible !important; }

            /* Position receipt at top-left of the page */
            #receipt-content {
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              width: 100% !important;
              background: #fff !important;
              padding: 16px !important;
              font-family: Arial, sans-serif !important;
              font-size: 13px !important;
              color: #000 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            /* Force all text black */
            #receipt-content * {
              color: #000 !important;
              background: transparent !important;
            }

            /* Fix borders — only show the lines we want, not full boxes */
            #receipt-content .border-b { border-bottom: 1px solid #555 !important; border-top: none !important; border-left: none !important; border-right: none !important; }
            #receipt-content .border-t { border-top: 1px solid #555 !important; border-bottom: none !important; border-left: none !important; border-right: none !important; }
            #receipt-content .border-b.border-dashed { border-bottom: 1px dashed #555 !important; }
            #receipt-content .border-t.border-dashed { border-top: 1px dashed #555 !important; }
            #receipt-content .border-gray-200,
            #receipt-content .border-gray-300 { border-color: #555 !important; }
          }
        `;
        document.head.appendChild(style);

        // afterprint fires when the print dialog is closed (cancel or confirm)
        const cleanup = () => {
            document.getElementById('receipt-print-style')?.remove();
            window.removeEventListener('afterprint', cleanup);
        };
        window.addEventListener('afterprint', cleanup);

        window.print();
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
