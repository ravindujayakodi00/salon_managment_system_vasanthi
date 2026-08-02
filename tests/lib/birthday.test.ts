import {
    DEFAULT_BIRTHDAY_MESSAGE,
    getDateInTimeZone,
    isValidDateOfBirth,
    renderBirthdayMessage,
} from '@/lib/birthday';

describe('birthday helpers', () => {
    it('accepts real past dates and rejects invalid or future dates', () => {
        expect(isValidDateOfBirth('1990-05-12', '2026-08-01')).toBe(true);
        expect(isValidDateOfBirth('2024-02-29', '2026-08-01')).toBe(true);
        expect(isValidDateOfBirth('2023-02-29', '2026-08-01')).toBe(false);
        expect(isValidDateOfBirth('2026-08-02', '2026-08-01')).toBe(false);
        expect(isValidDateOfBirth('12-05-1990', '2026-08-01')).toBe(false);
    });

    it('renders the editable birthday template variables', () => {
        expect(renderBirthdayMessage(DEFAULT_BIRTHDAY_MESSAGE, 'Nimali', 'Vasanthi Salon'))
            .toBe('Happy Birthday Nimali! This is a test birthday message from Vasanthi Salon.');
    });

    it('calculates the organization-local date', () => {
        const instant = new Date('2026-07-31T20:00:00.000Z');
        expect(getDateInTimeZone(instant, 'Asia/Colombo')).toBe('2026-08-01');
        expect(getDateInTimeZone(instant, 'UTC')).toBe('2026-07-31');
    });
});
