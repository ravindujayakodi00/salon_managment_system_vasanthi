export function normalizeCustomerPhone(phone: string): string {
    const trimmed = phone.trim();
    const digits = trimmed.replace(/\D/g, '');

    if (digits.length === 11 && digits.startsWith('94')) {
        return `+${digits}`;
    }
    if (digits.length === 10 && digits.startsWith('0')) {
        return `+94${digits.slice(1)}`;
    }
    if (digits.length === 9) {
        return `+94${digits}`;
    }

    return trimmed;
}

export function getCustomerPhoneCandidates(phone: string): string[] {
    const normalized = normalizeCustomerPhone(phone);
    const candidates = new Set([phone.trim(), normalized]);

    if (normalized.startsWith('+94') && normalized.length === 12) {
        const local = normalized.slice(3);
        candidates.add(`0${local}`);
        candidates.add(local);
        candidates.add(`94${local}`);
    }

    return [...candidates].filter(Boolean);
}
