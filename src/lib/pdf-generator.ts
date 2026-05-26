import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF type for autoTable
declare module 'jspdf' {
    interface jsPDF {
        autoTable: typeof autoTable;
    }
}

function savePDF(doc: jsPDF, filename: string) {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Generate Sales Report PDF
 */
export function generateSalesReportPDF(data: {
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
    byPaymentMethod: { method: string; amount: number; count: number }[];
    byService: { service: string; revenue: number; count: number }[];
    dailyStats: { date: string; revenue: number; transactions: number }[];
    invoices: { id: string; invoice_number?: string; customer: string; date: string; payment_method: string; subtotal: number; discount: number; total: number; items: any[] }[];
}) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const periodLabel = data.period || (data.startDate && data.endDate ? `${data.startDate} to ${data.endDate}` : 'All Time');

    // Header
    doc.setFontSize(20);
    doc.setTextColor(59, 130, 246);
    doc.text('Sales Report', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Period: ${periodLabel}`, pageWidth / 2, 28, { align: 'center' });

    // Summary section
    let yPos = 42;
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text('Financial Summary', 14, yPos);

    yPos += 6;
    const summary = [
        ['Total Revenue', `LKR ${data.totalRevenue.toLocaleString()}`],
        ['Total Expenses', `LKR ${data.totalExpenses.toLocaleString()}`],
        ['Total Profit', `LKR ${data.totalProfit.toLocaleString()}`],
        ['Total Transactions', data.totalTransactions.toString()],
        ['Total Discounts Given', `LKR ${data.totalDiscount.toLocaleString()}`],
    ];

    autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value']],
        body: summary,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 }
    });

    // Payment Method Breakdown
    yPos = (doc as any).lastAutoTable.finalY + 12;
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text('Revenue by Payment Method', 14, yPos);

    yPos += 5;
    autoTable(doc, {
        startY: yPos,
        head: [['Payment Method', 'Amount']],
        body: [
            ['Cash', `LKR ${data.totalCash.toLocaleString()}`],
            ['Card', `LKR ${data.totalCard.toLocaleString()}`],
            ['Bank Transfer', `LKR ${data.totalBankTransfer.toLocaleString()}`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 }
    });

    // Service Breakdown
    yPos = (doc as any).lastAutoTable.finalY + 12;
    if (yPos > 240) { doc.addPage(); yPos = 20; }

    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text('Revenue by Service', 14, yPos);

    yPos += 5;
    autoTable(doc, {
        startY: yPos,
        head: [['Service', 'Revenue', 'Count']],
        body: data.byService.slice(0, 15).map(s => [
            s.service,
            `LKR ${s.revenue.toLocaleString()}`,
            s.count.toString()
        ]),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 }
    });

    // Invoice Details
    if (data.invoices.length > 0) {
        yPos = (doc as any).lastAutoTable.finalY + 12;
        if (yPos > 220) { doc.addPage(); yPos = 20; }

        doc.setFontSize(13);
        doc.setTextColor(0, 0, 0);
        doc.text('Invoice Details', 14, yPos);

        yPos += 5;
        autoTable(doc, {
            startY: yPos,
            head: [['Invoice #', 'Customer', 'Date', 'Payment', 'Subtotal', 'Discount', 'Total']],
            body: data.invoices.map(inv => [
                inv.invoice_number ? inv.invoice_number.slice(-10) : inv.id.slice(0, 8),
                inv.customer,
                inv.date,
                inv.payment_method,
                `LKR ${inv.subtotal.toLocaleString()}`,
                inv.discount > 0 ? `LKR ${inv.discount.toLocaleString()}` : '-',
                `LKR ${inv.total.toLocaleString()}`,
            ]),
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            margin: { left: 14, right: 14 },
            columnStyles: {
                0: { cellWidth: 22 },
                1: { cellWidth: 35 },
                2: { cellWidth: 22 },
                3: { cellWidth: 22 },
                4: { cellWidth: 25 },
                5: { cellWidth: 22 },
                6: { cellWidth: 25 },
            }
        });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Generated on ${todayStr()} | Page ${i} of ${pageCount}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );
    }

    savePDF(doc, `Sales_Report_${data.startDate || todayStr()}_to_${data.endDate || todayStr()}.pdf`);
}

/**
 * Generate Customer Growth Report PDF
 */
export function generateCustomerGrowthReportPDF(data: {
    totalCustomers: number;
    newCustomersThisMonth: number;
    newCustomersLastMonth: number;
    topCustomers: { name: string; phone: string; totalSpent: number; visits: number }[];
    byGender: { gender: string; count: number; percentage: number }[];
    bySegment: { segment: string; count: number }[];
}) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(16, 185, 129); // Green
    doc.text('Customer Growth Report', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(todayStr(), pageWidth / 2, 28, { align: 'center' });

    // Summary
    let yPos = 45;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Overview', 14, yPos);

    yPos += 10;
    const growthRate = data.newCustomersLastMonth > 0
        ? ((data.newCustomersThisMonth - data.newCustomersLastMonth) / data.newCustomersLastMonth * 100).toFixed(1)
        : '0';

    const summary = [
        ['Total Customers', data.totalCustomers.toString()],
        ['New This Month', data.newCustomersThisMonth.toString()],
        ['New Last Month', data.newCustomersLastMonth.toString()],
        ['Growth Rate', `${growthRate}%`]
    ];

    autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value']],
        body: summary,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: 14, right: 14 }
    });

    // Top Customers
    yPos = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text('Top 10 Customers by Spending', 14, yPos);

    yPos += 5;
    autoTable(doc, {
        startY: yPos,
        head: [['Name', 'Phone', 'Total Spent', 'Visits']],
        body: data.topCustomers.map(c => [
            c.name,
            c.phone,
            `LKR ${c.totalSpent.toLocaleString()}`,
            c.visits.toString()
        ]),
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: 14, right: 14 }
    });

    // Gender Distribution
    yPos = (doc as any).lastAutoTable.finalY + 15;
    if (yPos > 230) {
        doc.addPage();
        yPos = 20;
    }

    doc.setFontSize(14);
    doc.text('Customer Distribution by Gender', 14, yPos);

    yPos += 5;
    autoTable(doc, {
        startY: yPos,
        head: [['Gender', 'Count', 'Percentage']],
        body: data.byGender.map(g => [
            g.gender,
            g.count.toString(),
            `${g.percentage.toFixed(1)}%`
        ]),
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: 14, right: 14 }
    });

    // Segment Distribution
    yPos = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text('Customer Segments', 14, yPos);

    yPos += 5;
    autoTable(doc, {
        startY: yPos,
        head: [['Segment', 'Customers']],
        body: data.bySegment.map(s => [
            s.segment,
            s.count.toString()
        ]),
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: 14, right: 14 }
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Generated on ${todayStr()} | Page ${i} of ${pageCount}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );
    }

    savePDF(doc, `Customer_Growth_Report_${todayStr()}.pdf`);
}

/**
 * Generate Staff Performance Report PDF
 */
export function generateStaffPerformanceReportPDF(data: {
    period: string;
    staffPerformance: {
        name: string;
        role: string;
        appointmentsCompleted: number;
        totalRevenue: number;
        commission: number;
        avgServiceTime: number;
    }[];
}) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(147, 51, 234); // Purple
    doc.text('Staff Performance Report', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(data.period, pageWidth / 2, 28, { align: 'center' });

    // Summary Stats
    let yPos = 45;
    const totalRevenue = data.staffPerformance.reduce((sum, s) => sum + s.totalRevenue, 0);
    const totalCommission = data.staffPerformance.reduce((sum, s) => sum + s.commission, 0);
    const totalAppointments = data.staffPerformance.reduce((sum, s) => sum + s.appointmentsCompleted, 0);

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Overall Performance', 14, yPos);

    yPos += 10;
    const summary = [
        ['Total Staff', data.staffPerformance.length.toString()],
        ['Total Appointments', totalAppointments.toString()],
        ['Total Revenue Generated', `LKR ${totalRevenue.toLocaleString()}`],
        ['Total Commission Paid', `LKR ${totalCommission.toLocaleString()}`]
    ];

    autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value']],
        body: summary,
        theme: 'grid',
        headStyles: { fillColor: [147, 51, 234] },
        margin: { left: 14, right: 14 }
    });

    // Individual Performance
    yPos = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text('Individual Staff Performance', 14, yPos);

    yPos += 5;
    autoTable(doc, {
        startY: yPos,
        head: [['Name', 'Role', 'Appointments', 'Revenue', 'Commission']],
        body: data.staffPerformance.map(s => [
            s.name,
            s.role,
            s.appointmentsCompleted.toString(),
            `LKR ${s.totalRevenue.toLocaleString()}`,
            `LKR ${s.commission.toLocaleString()}`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [147, 51, 234] },
        margin: { left: 14, right: 14 }
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Generated on ${todayStr()} | Page ${i} of ${pageCount}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );
    }

    savePDF(doc, `Staff_Performance_Report_${todayStr()}.pdf`);
}

/**
 * Generate Inventory Status Report PDF
 */
export function generateInventoryReportPDF(data: {
    totalProducts: number;
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    lowStockItems: { name: string; currentStock: number; minStock: number; unit: string }[];
    byCategory: { category: string; productCount: number; totalValue: number }[];
    stockStatus: { name: string; category: string; currentStock: number; minStock: number; unit: string; status: string }[];
}) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(251, 146, 60); // Orange
    doc.text('Inventory Status Report', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(todayStr(), pageWidth / 2, 28, { align: 'center' });

    // Summary
    let yPos = 45;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Overview', 14, yPos);

    yPos += 10;
    const summary = [
        ['Total Products', data.totalProducts.toString()],
        ['Total Inventory Value', `LKR ${data.totalValue.toLocaleString()}`],
        ['Low Stock Items', `${data.lowStockCount} (${((data.lowStockCount / data.totalProducts) * 100).toFixed(1)}%)`],
        ['Out of Stock Items', data.outOfStockCount.toString()]
    ];

    autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value']],
        body: summary,
        theme: 'grid',
        headStyles: { fillColor: [251, 146, 60] },
        margin: { left: 14, right: 14 }
    });

    // Low Stock Alert
    if (data.lowStockItems.length > 0) {
        yPos = (doc as any).lastAutoTable.finalY + 15;

        if (yPos > 230) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(220, 38, 38); // Red
        doc.text('⚠️ Low Stock Alert', 14, yPos);

        yPos += 5;
        autoTable(doc, {
            startY: yPos,
            head: [['Product', 'Current Stock', 'Min Stock', 'Unit']],
            body: data.lowStockItems.slice(0, 10).map(item => [
                item.name,
                item.currentStock.toString(),
                item.minStock.toString(),
                item.unit
            ]),
            theme: 'striped',
            headStyles: { fillColor: [220, 38, 38] },
            margin: { left: 14, right: 14 }
        });
    }

    // Category Breakdown
    yPos = (doc as any).lastAutoTable.finalY + 15;

    if (yPos > 230) {
        doc.addPage();
        yPos = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Inventory by Category', 14, yPos);

    yPos += 5;
    autoTable(doc, {
        startY: yPos,
        head: [['Category', 'Products', 'Total Value']],
        body: data.byCategory.map(cat => [
            cat.category,
            cat.productCount.toString(),
            `LKR ${cat.totalValue.toLocaleString()}`
        ]),
        theme: 'grid',
        headStyles: { fillColor: [251, 146, 60] },
        margin: { left: 14, right: 14 }
    });

    // Stock Status
    yPos = (doc as any).lastAutoTable.finalY + 15;

    if (yPos > 200) {
        doc.addPage();
        yPos = 20;
    }

    doc.setFontSize(14);
    doc.text('Stock Status Details', 14, yPos);

    yPos += 5;
    autoTable(doc, {
        startY: yPos,
        head: [['Product', 'Category', 'Stock', 'Status']],
        body: data.stockStatus.map(item => [
            item.name,
            item.category,
            `${item.currentStock} ${item.unit}`,
            item.status
        ]),
        theme: 'striped',
        headStyles: { fillColor: [251, 146, 60] },
        margin: { left: 14, right: 14 }
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Generated on ${todayStr()} | Page ${i} of ${pageCount}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
        );
    }

    savePDF(doc, `Inventory_Status_Report_${todayStr()}.pdf`);
}
