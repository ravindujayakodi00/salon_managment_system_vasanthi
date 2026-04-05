import {
    ADMIN_NAV_ITEMS,
    filterNavItemsForUser,
    expectedNavHrefsForRole,
} from '@/lib/admin-nav';
describe('admin navigation (manual QA inventory)', () => {
    it('defines 17 unique first-level sidebar routes', () => {
        expect(ADMIN_NAV_ITEMS).toHaveLength(17);
        const hrefs = ADMIN_NAV_ITEMS.map((i) => i.href);
        expect(new Set(hrefs).size).toBe(17);
        hrefs.forEach((h) => {
            expect(h.startsWith('/admin/')).toBe(true);
        });
    });

    it('Owner sees all nav items when page access is empty', () => {
        const filtered = filterNavItemsForUser({ role: 'Owner' }, {}, ADMIN_NAV_ITEMS);
        expect(filtered).toHaveLength(17);
    });

    it('Stylist does not see POS or back-office-only pages by default', () => {
        const hrefs = expectedNavHrefsForRole('Stylist');
        expect(hrefs).toContain('/admin/dashboard');
        expect(hrefs).toContain('/admin/settings');
        expect(hrefs).not.toContain('/admin/pos');
        expect(hrefs).not.toContain('/admin/services');
    });

    it('Receptionist sees POS and not Staff/Services', () => {
        const hrefs = expectedNavHrefsForRole('Receptionist');
        expect(hrefs).toContain('/admin/pos');
        expect(hrefs).toContain('/admin/petty-cash');
        expect(hrefs).not.toContain('/admin/staff');
        expect(hrefs).not.toContain('/admin/settings');
    });

    it('Manager sees Reports and not Settings', () => {
        const hrefs = expectedNavHrefsForRole('Manager');
        expect(hrefs).toContain('/admin/reports');
        expect(hrefs).not.toContain('/admin/settings');
    });

    it('respects organization_page_access overrides for non-Owner', () => {
        const pageAccess = {
            pos: { Receptionist: false },
        };
        const filtered = filterNavItemsForUser({ role: 'Receptionist' }, pageAccess, ADMIN_NAV_ITEMS);
        expect(filtered.map((i) => i.href)).not.toContain('/admin/pos');
    });
});
