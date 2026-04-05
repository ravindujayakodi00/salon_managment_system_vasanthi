/**
 * Pure POS pricing helpers (unit-tested). Keeps totals predictable and non-negative.
 */

export type PosCartLine = {
    price: number;
    quantity: number;
    additionalFee?: number;
};

export function calculateCartSubtotal(items: PosCartLine[]): number {
    return items.reduce((sum, item) => {
        const line = item.price * item.quantity + (item.additionalFee ?? 0);
        return sum + line;
    }, 0);
}

/**
 * Tax on the bill subtotal before discounts (matches current POS behavior).
 * Multiple percentages are additive on the same base (e.g. state + local).
 */
export function taxOnSubtotalBeforeDiscount(
    subtotal: number,
    enableTax: boolean,
    ratesPercent: number | number[]
): number {
    if (!enableTax || subtotal <= 0) return 0;
    const rates = Array.isArray(ratesPercent) ? ratesPercent : [ratesPercent];
    const combined = rates.reduce((acc, r) => acc + (Number.isFinite(r) && r > 0 ? r : 0), 0);
    return (subtotal * combined) / 100;
}

/**
 * Cap a fixed-amount discount so it never exceeds what can be taken off the subtotal.
 * (Promo/line display consistency; grand total still uses Math.max(0, …) as a second guard.)
 */
export function capFixedDiscountToSubtotal(fixedDiscount: number, subtotal: number): number {
    if (fixedDiscount <= 0 || subtotal <= 0) return 0;
    return Math.min(fixedDiscount, subtotal);
}

/**
 * Points redemption value applied to the bill (cannot exceed subtotal in current product).
 */
export function loyaltyPointsDiscountAmount(pointsValue: number, subtotal: number): number {
    if (pointsValue <= 0 || subtotal <= 0) return 0;
    return Math.min(pointsValue, subtotal);
}

/**
 * Final amount due. Never negative even if promo + loyalty exceed subtotal.
 * Tax is added after net subtotal discount (tax computed on raw subtotal elsewhere).
 */
export function calculatePosGrandTotal(input: {
    subtotal: number;
    promoDiscount: number;
    loyaltyDiscount: number;
    tax: number;
}): number {
    const { subtotal, promoDiscount, loyaltyDiscount, tax } = input;
    const totalDiscount = promoDiscount + loyaltyDiscount;
    return Math.max(0, subtotal - totalDiscount + tax);
}

/**
 * Split-payment modal rules: sums to total, at least one positive line, no negatives/NaN.
 */
export function isSplitPaymentBalanced(
    billTotal: number,
    parts: { amount: number }[],
    epsilon = 0.01
): boolean {
    if (!parts.length) return false;
    const sum = parts.reduce((s, p) => s + (p.amount || 0), 0);
    const hasPositive = parts.some(p => p.amount > 0);
    const allValid = parts.every(p => p.amount >= 0 && !Number.isNaN(p.amount));
    return Math.abs(billTotal - sum) < epsilon && hasPositive && allValid;
}
