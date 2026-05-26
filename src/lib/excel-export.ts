import * as XLSX from 'xlsx';

function saveXLSX(wb: XLSX.WorkBook, filename: string) {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}

interface SalesReportData {
    period: string;
    startDate: string;
    endDate: string;
    totalRevenue: number;
    totalTransactions: number;
    totalDiscount: number;
    totalTax: number;
    totalExpenses: number;
    totalProfit: number;
    totalCash: number;
    totalCard: number;
    totalBankTransfer: number;
    splitPaymentCount: number;
    byService: Array<{ service: string; revenue: number; count: number }>;
    dailyStats: Array<{ date: string; revenue: number; transactions: number }>;
    invoices: Array<{ id: string; invoice_number?: string; customer: string; date: string; payment_method: string; subtotal: number; discount: number; total: number }>;
}

/**
 * Export sales report data to Excel file
 */
export function exportSalesReportToExcel(data: SalesReportData) {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summaryData = [
        ['Sales Report', ''],
        ['Period', data.period],
        [''],
        ['Financial Summary', ''],
        ['Total Revenue', data.totalRevenue],
        ['Total Expenses', data.totalExpenses],
        ['Total Profit', data.totalProfit],
        ['Total Transactions', data.totalTransactions],
        ['Total Discount', data.totalDiscount],
        ['Total Tax', data.totalTax],
        [''],
        ['Payment Method Breakdown', ''],
        ['Cash', data.totalCash],
        ['Card', data.totalCard],
        ['Bank Transfer', data.totalBankTransfer],
        ['Split Transactions', data.splitPaymentCount],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Sheet 2: Invoice Details
    const invoiceData = [
        ['Invoice #', 'Customer', 'Date', 'Payment Method', 'Subtotal', 'Discount', 'Total'],
        ...data.invoices.map(inv => [
            inv.invoice_number ? inv.invoice_number.slice(-12) : inv.id.slice(0, 8),
            inv.customer,
            inv.date,
            inv.payment_method,
            inv.subtotal,
            inv.discount,
            inv.total,
        ])
    ];
    const wsInvoices = XLSX.utils.aoa_to_sheet(invoiceData);
    XLSX.utils.book_append_sheet(wb, wsInvoices, 'Invoices');

    // Sheet 3: Services Breakdown
    const servicesData = [
        ['Service', 'Revenue', 'Count'],
        ...data.byService.map(s => [s.service, s.revenue, s.count])
    ];
    const wsServices = XLSX.utils.aoa_to_sheet(servicesData);
    XLSX.utils.book_append_sheet(wb, wsServices, 'Services');

    // Sheet 4: Daily Stats
    const dailyData = [
        ['Date', 'Revenue', 'Transactions'],
        ...data.dailyStats.map(d => [d.date, d.revenue, d.transactions])
    ];
    const wsDaily = XLSX.utils.aoa_to_sheet(dailyData);
    XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Stats');

    const filename = `Sales_Report_${data.startDate}_to_${data.endDate}.xlsx`;
    saveXLSX(wb, filename);
    return filename;
}

/**
 * Export customer data to Excel
 */
export function exportCustomersToExcel(customers: any[]) {
    const wb = XLSX.utils.book_new();

    const customerData = [
        ['Name', 'Phone', 'Email', 'Total Spent', 'Total Visits', 'Gender', 'Created Date'],
        ...customers.map(c => [
            c.name,
            c.phone,
            c.email || '',
            c.total_spent || 0,
            c.total_visits || 0,
            c.gender || '',
            c.created_at?.split('T')[0] || ''
        ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(customerData);
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');

    const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const filename = `Customers_${today}.xlsx`;
    saveXLSX(wb, filename);

    return filename;
}

/**
 * Export appointments to Excel
 */
export function exportAppointmentsToExcel(appointments: any[], month: string, year: number) {
    const wb = XLSX.utils.book_new();

    const appointmentData = [
        ['Date', 'Time', 'Customer', 'Phone', 'Stylist', 'Services', 'Status', 'Duration'],
        ...appointments.map(a => [
            a.appointment_date,
            a.start_time,
            a.customer?.name || '',
            a.customer?.phone || '',
            a.stylist?.name || '',
            a.services_data?.map((s: any) => s.name).join(', ') || '',
            a.status,
            `${a.duration} min`
        ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(appointmentData);
    XLSX.utils.book_append_sheet(wb, ws, 'Appointments');

    const filename = `Appointments_${month}_${year}.xlsx`;
    saveXLSX(wb, filename);

    return filename;
}
