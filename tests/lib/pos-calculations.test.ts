import {
    calculateCartSubtotal,
    taxOnSubtotalBeforeDiscount,
    capFixedDiscountToSubtotal,
    loyaltyPointsDiscountAmount,
    calculatePosGrandTotal,
    isSplitPaymentBalanced,
    type PosCartLine,
} from '@/lib/pos-calculations';
import { calculatePaymentTotals } from '@/lib/payment-utils';

describe('POS calculations', () => {
    describe('calculateCartSubtotal', () => {
        it('sums line totals and additional fees', () => {
            const lines: PosCartLine[] = [
                { price: 50, quantity: 2 },
                { price: 30, quantity: 1, additionalFee: 5 },
            ];
            expect(calculateCartSubtotal(lines)).toBe(135);
        });

        it('returns 0 for empty cart', () => {
            expect(calculateCartSubtotal([])).toBe(0);
        });
    });

    describe('fixed discount larger than bill (no negative total)', () => {
        it('grand total floors at zero when uncapped discounts exceed subtotal and tax is zero', () => {
            const subtotal = 80;
            const promoDiscount = 500; // fixed promo larger than bill (not capped in UI state)
            const loyaltyDiscount = 0;
            const tax = 0;

            expect(calculatePosGrandTotal({ subtotal, promoDiscount, loyaltyDiscount, tax })).toBe(0);
        });

        it('when promo exceeds subtotal, Math.max floors the whole expression (total 0, not tax-only)', () => {
            const subtotal = 100;
            const promoDiscount = 150;
            const loyaltyDiscount = 0;
            const tax = taxOnSubtotalBeforeDiscount(subtotal, true, 10);

            expect(tax).toBe(10);
            // 100 - 150 + 10 = -40 → clamped to 0 (same as current POS page)
            expect(calculatePosGrandTotal({ subtotal, promoDiscount, loyaltyDiscount, tax })).toBe(0);
        });

        it('when discount equals subtotal, customer pays tax on pre-discount subtotal only', () => {
            const subtotal = 100;
            const promoDiscount = 100;
            const tax = taxOnSubtotalBeforeDiscount(subtotal, true, 8);
            expect(calculatePosGrandTotal({ subtotal, promoDiscount, loyaltyDiscount: 0, tax })).toBeCloseTo(8, 5);
        });

        it('capFixedDiscountToSubtotal prevents over-stated discount vs subtotal', () => {
            expect(capFixedDiscountToSubtotal(999, 45.5)).toBe(45.5);
            expect(capFixedDiscountToSubtotal(10, 100)).toBe(10);
            expect(capFixedDiscountToSubtotal(-5, 100)).toBe(0);
        });
    });

    describe('overlapping / additive tax rates (state + local)', () => {
        it('applies additive percentages on the same subtotal base', () => {
            const subtotal = 200;
            const state = 6;
            const local = 2.5;
            const tax = taxOnSubtotalBeforeDiscount(subtotal, true, [state, local]);
            expect(tax).toBeCloseTo(200 * (6 + 2.5) / 100, 10);
            expect(tax).toBe(17);
        });

        it('matches single-rate call when one rate is passed as array', () => {
            expect(taxOnSubtotalBeforeDiscount(100, true, [8])).toBe(8);
            expect(taxOnSubtotalBeforeDiscount(100, true, 8)).toBe(8);
        });

        it('returns 0 when tax disabled', () => {
            expect(taxOnSubtotalBeforeDiscount(100, false, [6, 4])).toBe(0);
        });

        it('ignores non-positive rate entries', () => {
            expect(taxOnSubtotalBeforeDiscount(100, true, [5, 0, -3, NaN as unknown as number])).toBe(5);
        });
    });

    describe('split payment (e.g. half cash, half card)', () => {
        it('calculatePaymentTotals splits mixed Cash and Card from payment_breakdown', () => {
            const invoices = [
                {
                    total: 200,
                    payment_method: 'Cash',
                    payment_breakdown: [
                        { method: 'Cash', amount: 100 },
                        { method: 'Card', amount: 100 },
                    ],
                },
            ];
            const totals = calculatePaymentTotals(invoices);
            expect(totals.totalCash).toBe(100);
            expect(totals.totalCard).toBe(100);
            expect(totals.splitPaymentCount).toBe(1);
        });

        it('isSplitPaymentBalanced accepts exact half / half', () => {
            expect(
                isSplitPaymentBalanced(200, [
                    { method: 'Cash', amount: 100 },
                    { method: 'Card', amount: 100 },
                ] as { amount: number }[])
            ).toBe(true);
        });

        it('isSplitPaymentBalanced rejects under/over pay', () => {
            expect(isSplitPaymentBalanced(200, [{ amount: 100 }, { amount: 50 }])).toBe(false);
            expect(isSplitPaymentBalanced(200, [{ amount: 150 }, { amount: 100 }])).toBe(false);
        });

        it('isSplitPaymentBalanced rejects all zeros or negative lines', () => {
            expect(isSplitPaymentBalanced(50, [{ amount: 0 }, { amount: 0 }])).toBe(false);
            expect(isSplitPaymentBalanced(50, [{ amount: 60 }, { amount: -10 }])).toBe(false);
        });
    });

    describe('loyalty points covering 100% of bill', () => {
        it('caps redemption at subtotal when points value exceeds services', () => {
            const subtotal = 75;
            const pointsValue = 200;
            expect(loyaltyPointsDiscountAmount(pointsValue, subtotal)).toBe(75);
        });

        it('when points cover exactly the subtotal, grand total is tax-only (tax on pre-discount subtotal)', () => {
            const subtotal = 120;
            const loyaltyDiscount = loyaltyPointsDiscountAmount(120, subtotal);
            expect(loyaltyDiscount).toBe(120);
            const tax = taxOnSubtotalBeforeDiscount(subtotal, true, 8); // 9.6
            const total = calculatePosGrandTotal({
                subtotal,
                promoDiscount: 0,
                loyaltyDiscount,
                tax,
            });
            expect(total).toBeCloseTo(9.6, 5);
        });

        it('full waiver when tax off and points equal subtotal', () => {
            const subtotal = 99.99;
            const loyaltyDiscount = loyaltyPointsDiscountAmount(99.99, subtotal);
            expect(
                calculatePosGrandTotal({
                    subtotal,
                    promoDiscount: 0,
                    loyaltyDiscount,
                    tax: 0,
                })
            ).toBe(0);
        });
    });
});
