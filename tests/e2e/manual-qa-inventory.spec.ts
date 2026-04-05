/**
 * Automated checks aligned with the manual QA inventory:
 * public marketing anchors, API contracts, admin route smoke, optional role-based nav/settings.
 */
import { test, expect } from '@playwright/test';
import { expectedNavHrefsForRole } from '@/lib/admin-nav';
import { adminHref } from '@/lib/admin-paths';
import type { UserRole } from '@/lib/types';
import { loginToAdminDashboard, ADMIN_LOGIN_TIMEOUT_MS } from './helpers/admin-auth';

const PUBLIC_SECTION_IDS = ['home', 'services', 'gallery', 'testimonials', 'contact'];

test.describe('Public site (manual QA: / and /booking)', () => {
    test('home page exposes Navbar anchor sections', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#home')).toBeVisible();
        for (const id of PUBLIC_SECTION_IDS) {
            await expect(page.locator(`#${id}`)).toBeAttached();
        }
    });

    test('booking page loads standalone flow', async ({ page }) => {
        await page.goto('/booking');
        await expect(page.locator('#appointment')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Book Appointment' })).toBeVisible();
    });
});

test.describe('API smoke (manual QA: public + in-app contracts)', () => {
    test('GET /api/public/services without tenant returns 400', async ({ request }) => {
        const res = await request.get('/api/public/services');
        expect(res.status()).toBe(400);
        const json = await res.json();
        expect(json).toMatchObject({ success: false });
    });

    test('GET /api/in-app-notifications without auth returns 401', async ({ request }) => {
        const res = await request.get('/api/in-app-notifications');
        expect(res.status()).toBe(401);
    });
});

test.describe('Admin inventory (authenticated)', () => {
    test.describe.configure({ timeout: ADMIN_LOGIN_TIMEOUT_MS + 30_000 });

    test.beforeEach(async ({ page }) => {
        test.skip(
            !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
            'Set TEST_USER_EMAIL and TEST_USER_PASSWORD for admin smoke tests'
        );
        await loginToAdminDashboard(page, process.env.TEST_USER_EMAIL!, process.env.TEST_USER_PASSWORD!);
        if (page.url().includes('/admin/select-branch')) {
            test.skip(true, 'Select-branch flow requires manual branch pick; use a user with branch_id set');
        }
    });

    test('sidebar footer shows role and nav matches TEST_USER_ROLE when set', async ({ page }) => {
        const declared = process.env.TEST_USER_ROLE as UserRole | undefined;
        test.skip(!declared, 'Set TEST_USER_ROLE to match the logged-in user (e.g. Owner, Manager)');

        await page.goto('/admin/dashboard');
        const footer = page.locator('aside').getByText(/v1\.0\.0/);
        await expect(footer).toBeVisible();
        await expect(footer).toContainText(declared);

        const expected = expectedNavHrefsForRole(declared);
        for (const href of expected) {
            await expect(page.locator(`aside nav a[href="${href}"]`)).toHaveCount(1);
        }

        if (declared === 'Stylist') {
            await expect(page.locator(`aside nav a[href="${adminHref('/pos')}"]`)).toHaveCount(0);
        }
        if (declared === 'Receptionist') {
            await expect(page.locator(`aside nav a[href="${adminHref('/settings')}"]`)).toHaveCount(0);
        }
    });

    test('each sidebar route for TEST_USER_ROLE loads (plus campaigns/new)', async ({ page }) => {
        const role = process.env.TEST_USER_ROLE as UserRole | undefined;
        test.skip(!role, 'Set TEST_USER_ROLE to match the logged-in user');

        const paths = [...expectedNavHrefsForRole(role), adminHref('/campaigns/new')];
        const unique = [...new Set(paths)];

        for (const href of unique) {
            const res = await page.goto(href, { waitUntil: 'domcontentloaded' });
            expect(res?.ok(), `${href} should load`).toBeTruthy();
            await expect(page.locator('body')).toBeVisible();
        }
    });

    test('Settings tabs visibility matches TEST_USER_ROLE', async ({ page }) => {
        const role = process.env.TEST_USER_ROLE as UserRole | undefined;
        test.skip(!role, 'Set TEST_USER_ROLE to assert settings tabs');

        await page.goto('/admin/settings');
        await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

        if (role === 'Owner') {
            await expect(page.getByRole('button', { name: 'Scheduling' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Page Access' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'My Availability' })).toHaveCount(0);
        }
        if (role === 'Stylist') {
            await expect(page.getByRole('button', { name: 'My Availability' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Scheduling' })).toHaveCount(0);
        }
        if (role === 'Manager') {
            await expect(page.getByRole('button', { name: 'Branches' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Page Access' })).toHaveCount(0);
        }
    });
});
