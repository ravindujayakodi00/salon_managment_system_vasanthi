import { formatDaysSinceLastVisit } from '@/lib/utils';

describe('days since last visit', () => {
    it('calculates calendar days and formats singular and plural values', () => {
        expect(formatDaysSinceLastVisit(
            '2026-08-01T12:00:00.000Z',
            new Date('2026-08-04T12:00:00.000Z')
        )).toBe('3 days');

        expect(formatDaysSinceLastVisit(
            '2026-08-03T12:00:00.000Z',
            new Date('2026-08-04T12:00:00.000Z')
        )).toBe('1 day');
    });

    it('shows Never when there is no valid last visit', () => {
        expect(formatDaysSinceLastVisit(null)).toBe('Never');
        expect(formatDaysSinceLastVisit('invalid')).toBe('Never');
    });
});
