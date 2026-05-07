/**
 * Email template generators for the salon management system
 */

import { SALON_NAME } from '@/config/salon';

interface ReceiptEmailData {
    customer: {
        name: string;
        email: string;
        phone?: string;
    };
    invoice: {
        id: string;
        created_at: string;
    };
    items: Array<{
        name: string;
        price: number;
        quantity: number;
    }>;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paymentMethod: string;
}

export function generateReceiptEmail(data: ReceiptEmailData): string {
    const { customer, invoice, items, subtotal, discount, tax, total, paymentMethod } = data;

    // Format currency
    const formatCurrency = (amount: number) => `LKR ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Format date
    const invoiceDate = new Date(invoice.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receipt - ${SALON_NAME}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 0; text-align: center;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">✂️ ${SALON_NAME}</h1>
                            <p style="margin: 10px 0 0; color: #e0e7ff; font-size: 14px;">Thank you for your visit!</p>
                        </td>
                    </tr>

                    <!-- Customer Info -->
                    <tr>
                        <td style="padding: 30px 40px 20px;">
                            <h2 style="margin: 0 0 15px; color: #1f2937; font-size: 20px;">Receipt</h2>
                            <table style="width: 100%; margin-bottom: 20px;">
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Invoice #:</td>
                                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${invoice.id.slice(0, 8)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date:</td>
                                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right;">${invoiceDate}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Customer:</td>
                                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right;">${customer.name}</td>
                                </tr>
                                ${customer.phone ? `
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Phone:</td>
                                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right;">${customer.phone}</td>
                                </tr>
                                ` : ''}
                            </table>
                        </td>
                    </tr>

                    <!-- Items -->
                    <tr>
                        <td style="padding: 0 40px 30px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="border-bottom: 2px solid #e5e7eb;">
                                        <th style="padding: 12px 0; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase;">Service</th>
                                        <th style="padding: 12px 0; text-align: right; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase;">Qty</th>
                                        <th style="padding: 12px 0; text-align: right; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase;">Price</th>
                                        <th style="padding: 12px 0; text-align: right; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase;">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${items.map(item => `
                                    <tr style="border-bottom: 1px solid #f3f4f6;">
                                        <td style="padding: 12px 0; color: #1f2937; font-size: 14px;">${item.name}</td>
                                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px; text-align: right;">${item.quantity}</td>
                                        <td style="padding: 12px 0; color: #6b7280; font-size: 14px; text-align: right;">${formatCurrency(item.price)}</td>
                                        <td style="padding: 12px 0; color: #1f2937; font-size: 14px; font-weight: 500; text-align: right;">${formatCurrency(item.price * item.quantity)}</td>
                                    </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </td>
                    </tr>

                    <!-- Totals -->
                    <tr>
                        <td style="padding: 0 40px 30px;">
                            <table style="width: 100%; margin-top: 20px;">
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; text-align: right;">Subtotal:</td>
                                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500; text-align: right; width: 120px;">${formatCurrency(subtotal)}</td>
                                </tr>
                                ${discount > 0 ? `
                                <tr>
                                    <td style="padding: 8px 0; color: #10b981; font-size: 14px; text-align: right;">Discount:</td>
                                    <td style="padding: 8px 0; color: #10b981; font-size: 14px; font-weight: 500; text-align: right;">-${formatCurrency(discount)}</td>
                                </tr>
                                ` : ''}
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; text-align: right;">Tax (5%):</td>
                                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500; text-align: right;">${formatCurrency(tax)}</td>
                                </tr>
                                <tr style="border-top: 2px solid #e5e7eb;">
                                    <td style="padding: 12px 0; color: #1f2937; font-size: 18px; font-weight: 600; text-align: right;">Total:</td>
                                    <td style="padding: 12px 0; color: #7c3aed; font-size: 18px; font-weight: 700; text-align: right;">${formatCurrency(total)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px; text-align: right;">Payment Method:</td>
                                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500; text-align: right;">${paymentMethod}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; text-align: center;">
                            <p style="margin: 0 0 10px; color: #1f2937; font-size: 16px; font-weight: 600;">Thank you for choosing ${SALON_NAME}!</p>
                            <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">We appreciate your business and look forward to serving you again.</p>
                            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                                <p style="margin: 0; color: #9ca3af; font-size: 12px;">This is an automated receipt. Please do not reply to this email.</p>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}
