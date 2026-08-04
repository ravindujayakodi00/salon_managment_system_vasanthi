const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_BIRTHDAY_MESSAGE =
    `Dear {customer_name},
Wishing you a beautiful birthday and a year ahead filled with grace and joy.

To celebrate you, enjoy 15% OFF on any service at Vasanthi Gulasekharam Salon.
Celebrate yourself with a little extra radiance.

Valid from your birthday for 30 days.
Book your appointment: https://wa.me/94776300577
T&Cs apply.`;

export function isValidDateOfBirth(value: string, today = new Date().toISOString().slice(0, 10)): boolean {
    if (!ISO_DATE_PATTERN.test(value) || value > today) return false;

    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    return parsed.getUTCFullYear() === year
        && parsed.getUTCMonth() === month - 1
        && parsed.getUTCDate() === day;
}

export function getDateInTimeZone(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);

    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

export function renderBirthdayMessage(template: string, customerName: string, salonName: string): string {
    return template
        .replaceAll('{customer_name}', customerName)
        .replaceAll('{salon_name}', salonName);
}
