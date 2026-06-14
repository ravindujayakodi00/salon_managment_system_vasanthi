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
        if (!printContent) return;

        // Remove any stale iframe from a previous print
        const existing = document.getElementById('receipt-print-iframe');
        if (existing) existing.remove();

        // Use a hidden iframe instead of window.open() — avoids popup blocking
        // on iOS Safari, Android Chrome, and all tablet browsers
        const iframe = document.createElement('iframe');
        iframe.id = 'receipt-print-iframe';
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.cssText = 'position:absolute;width:1px;height:1px;top:-9999px;left:-9999px;border:none;visibility:hidden;';
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
        if (!doc) { iframe.remove(); return; }

        doc.open();
        doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Receipt</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; color: #000 !important; }
  body {
    font-family: Arial, sans-serif;
    font-size: 13px;
    background: #fff !important;
    color: #000 !important;
    padding: 16px;
    width: 100%;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  img { max-width: 100%; display: block; }
  .text-center { text-align: center; }
  .text-sm   { font-size: 12px; }
  .text-xs   { font-size: 11px; }
  .text-lg   { font-size: 16px; }
  .font-bold   { font-weight: 700; }
  .font-medium { font-weight: 600; }
  .font-mono   { font-family: monospace; }
  .mb-1 { margin-bottom: 4px; }
  .mb-3 { margin-bottom: 12px; }
  .mb-4 { margin-bottom: 16px; }
  .mb-6 { margin-bottom: 24px; }
  .mt-1 { margin-top: 4px; }
  .mt-2 { margin-top: 8px; }
  .mt-8 { margin-top: 32px; }
  .pt-2 { padding-top: 8px; }
  .pt-4 { padding-top: 16px; }
  .pb-4 { padding-bottom: 16px; }
  .p-4  { padding: 16px; }
  .h-16 { height: 64px; }
  .mx-auto { margin-left: auto; margin-right: auto; }
  .object-contain { object-fit: contain; }
  .space-y-2 > * + * { margin-top: 8px; }
  .flex { display: flex; }
  .justify-between { justify-content: space-between; }
  .border-b { border-bottom: 1px solid #555; }
  .border-t { border-top: 1px solid #555; }
  .border-b.border-dashed { border-bottom: 1px dashed #555; border-top: none; border-left: none; border-right: none; }
  .border-t.border-dashed { border-top: 1px dashed #555; border-bottom: none; border-left: none; border-right: none; }
  .tracking-wide { letter-spacing: 0.025em; }
  @page { size: auto; margin: 8mm; }
  @media print {
    body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
${printContent.innerHTML}
</body>
</html>`);
        doc.close();

        const win = iframe.contentWindow;
        if (!win) { iframe.remove(); return; }

        const doPrint = () => {
            win.focus();
            win.print();
            // Remove iframe after print dialog is dismissed
            setTimeout(() => iframe.remove(), 1000);
        };

        // Wait for all resources (logo image etc.) to finish loading before printing
        if (doc.readyState === 'complete') {
            setTimeout(doPrint, 150);
        } else {
            iframe.onload = () => setTimeout(doPrint, 150);
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
