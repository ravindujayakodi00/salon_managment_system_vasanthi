import { supabase } from '@/lib/supabase';

/** Calendar days (local) covered by a range, grouped by year — for holiday quota checks. */
export function fullDayHolidayDaysByCalendarYear(startISO: string, endISO: string): Map<number, number> {
    const byYear = new Map<number, number>();
    const s = new Date(startISO);
    const e = new Date(endISO);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return byYear;
    const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const endD = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    while (cur.getTime() <= endD.getTime()) {
        const y = cur.getFullYear();
        byYear.set(y, (byYear.get(y) || 0) + 1);
        cur.setDate(cur.getDate() + 1);
    }
    return byYear;
}

/** Inclusive calendar days of one holiday row that fall inside `year`. */
export function holidayDaysInSingleYear(startISO: string, endISO: string, year: number): number {
    let n = 0;
    const yStart = new Date(year, 0, 1);
    const yEnd = new Date(year, 11, 31, 23, 59, 59, 999);
    const s = new Date(startISO);
    const e = new Date(endISO);
    const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const endD = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    while (cur.getTime() <= endD.getTime()) {
        if (cur >= yStart && cur <= yEnd) n += 1;
        cur.setDate(cur.getDate() + 1);
    }
    return n;
}

export interface AvailabilityRecord {
    id: string;
    stylist_id: string;
    start_time: string;
    end_time: string;
    type: 'holiday' | 'half_day' | 'emergency' | 'break' | 'other';
    reason?: string;
    created_at: string;
}

export const availabilityService = {
    /**
     * Get availability records for a stylist within a date range
     */
    async getAvailability(stylistId: string, startDate: string, endDate: string) {
        const { data, error } = await supabase
            .from('stylist_availability')
            .select('*')
            .eq('stylist_id', stylistId)
            .gte('start_time', startDate)
            .lte('end_time', endDate);

        if (error) throw error;
        return data as AvailabilityRecord[];
    },

    /**
     * Create a new availability record (leave/holiday)
     */
    async createAvailability(record: {
        stylist_id: string;
        start_time: string;
        end_time: string;
        type: 'holiday' | 'half_day' | 'emergency' | 'break' | 'other';
        reason?: string;
    }) {
        const { data, error } = await supabase
            .from('stylist_availability')
            .insert(record)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Delete an availability record
     */
    async deleteAvailability(id: string) {
        const { error } = await supabase
            .from('stylist_availability')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Toggle emergency unavailability status for a stylist
     */
    async toggleEmergencyStatus(stylistId: string, isUnavailable: boolean) {
        const { data, error } = await supabase
            .from('staff')
            .update({ is_emergency_unavailable: isUnavailable })
            .eq('id', stylistId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Get emergency status for a stylist
     */
    async getEmergencyStatus(stylistId: string) {
        const { data, error } = await supabase
            .from('staff')
            .select('is_emergency_unavailable')
            .eq('id', stylistId)
            .single();

        if (error) throw error;
        return data?.is_emergency_unavailable || false;
    },

    /**
     * Full-day holiday "days" already used in a calendar year (sum of calendar days per holiday row).
     */
    async sumFullDayHolidayDaysInYear(stylistId: string, year: number, excludeAvailabilityId?: string) {
        const yearStart = `${year}-01-01T00:00:00.000Z`;
        const yearEnd = `${year}-12-31T23:59:59.999Z`;
        const { data, error } = await supabase
            .from('stylist_availability')
            .select('id, start_time, end_time')
            .eq('stylist_id', stylistId)
            .eq('type', 'holiday')
            .lte('start_time', yearEnd)
            .gte('end_time', yearStart);

        if (error) throw error;

        let sum = 0;
        for (const row of data || []) {
            if (excludeAvailabilityId && row.id === excludeAvailabilityId) continue;
            sum += holidayDaysInSingleYear(row.start_time, row.end_time, year);
        }
        return sum;
    },

    /**
     * Returns null if within quota or no quota; error message if adding this holiday would exceed quota.
     */
    async validateFullDayHolidayQuota(
        stylistId: string,
        startISO: string,
        endISO: string,
        maxDaysPerYear: number | null | undefined,
        excludeAvailabilityId?: string
    ): Promise<string | null> {
        if (maxDaysPerYear == null || maxDaysPerYear < 0) return null;

        const newByYear = fullDayHolidayDaysByCalendarYear(startISO, endISO);
        for (const [year, newDays] of newByYear) {
            const used = await this.sumFullDayHolidayDaysInYear(stylistId, year, excludeAvailabilityId);
            if (used + newDays > maxDaysPerYear) {
                return `Holiday limit for ${year}: you have used ${used} of ${maxDaysPerYear} full-day holiday(s). This request adds ${newDays} day(s).`;
            }
        }
        return null;
    },
};
