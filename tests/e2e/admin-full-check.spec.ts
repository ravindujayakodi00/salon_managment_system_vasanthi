/**
 * Broader admin smoke + CRUD: petty cash, notification templates, staff (Owner),
 * plus key route headings and primary actions.
 * Requires TEST_USER_EMAIL / TEST_USER_PASSWORD; Owner or Manager (TEST_USER_ROLE) except staff CRUD (Owner).
 */
import { test, expect } from '@playwright/test';
import {
    loginToAdminDashboard,
    ADMIN_LOGIN_TIMEOUT_MS,
    crudRolesAllowed,
    ownerRoleAllowed,
    acceptNextConfirm,
} from './helpers/admin-auth';

test.describe('Admin full check', () => {
    test.describe.configure({ timeout: ADMIN_LOGIN_TIMEOUT_MS + 180_000 });

    test.beforeEach(async ({ page }) => {
        test.skip(
            !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
            'Set TEST_USER_EMAIL and TEST_USER_PASSWORD'
        );
        test.skip(!crudRolesAllowed(), 'Full-check admin tests require Owner or Manager (set TEST_USER_ROLE)');

        await loginToAdminDashboard(page, process.env.TEST_USER_EMAIL!, process.env.TEST_USER_PASSWORD!);
        if (page.url().includes('/admin/select-branch')) {
            test.skip(true, 'Use a user with branch_id set (not select-branch)');
        }
    });

    test('Petty cash: add cash and record expense', async ({ page }) => {
        const id = Date.now();
        const depositNote = `E2E deposit ${id}`;
        const expenseNote = `E2E expense ${id}`;

        await page.goto('/admin/petty-cash');
        await expect(page.getByRole('heading', { name: 'Petty Cash' })).toBeVisible();

        const canAdd = await page.getByRole('button', { name: 'Add Cash' }).first().isVisible();
        test.skip(!canAdd, 'Add Cash is Owner/Manager only');

        await page.getByRole('button', { name: 'Add Cash' }).first().click();
        await expect(page.getByRole('heading', { name: 'Add Cash to Petty Cash' })).toBeVisible();
        const addModal = page.locator('.fixed.inset-0').filter({
            has: page.getByRole('heading', { name: 'Add Cash to Petty Cash' }),
        });
        const depositAmt = addModal.locator('input[type="number"]').first();
        await depositAmt.click({ clickCount: 3 });
        await depositAmt.pressSequentially('500', { delay: 10 });
        const depDesc = addModal.getByPlaceholder('e.g., Initial deposit, Monthly addition');
        await depDesc.click();
        await depDesc.pressSequentially(depositNote, { delay: 5 });
        await addModal.getByRole('button', { name: 'Add Cash' }).click();
        await expect(page.getByRole('heading', { name: 'Add Cash to Petty Cash' })).toBeHidden({
            timeout: 25_000,
        });
        await expect(page.locator('tbody tr').filter({ hasText: depositNote })).toBeVisible({ timeout: 25_000 });

        await page.getByRole('button', { name: 'Record Expense' }).first().click();
        await expect(page.getByRole('heading', { name: 'Record Expense' })).toBeVisible();
        const expModal = page.locator('.fixed.inset-0').filter({
            has: page.getByRole('heading', { name: 'Record Expense' }),
        });
        const expAmt = expModal.locator('input[type="number"]').first();
        await expAmt.click({ clickCount: 3 });
        await expAmt.pressSequentially('100', { delay: 10 });
        const expDesc = expModal.getByPlaceholder('e.g., Cleaning supplies, Electricity bill');
        await expDesc.click();
        await expDesc.pressSequentially(expenseNote, { delay: 5 });
        await expModal.getByRole('button', { name: 'Record Expense' }).click();
        await expect(page.getByRole('heading', { name: 'Record Expense' })).toBeHidden({ timeout: 25_000 });
        await expect(page.locator('tbody tr').filter({ hasText: expenseNote })).toBeVisible({ timeout: 25_000 });
    });

    test('Notification templates: create (SMS), edit, delete', async ({ page }) => {
        const id = Date.now();
        const name = `E2E Template ${id}`;
        const updated = `${name} Updated`;

        await page.goto('/admin/notifications');
        await expect(page.getByRole('heading', { name: 'Notification Templates' })).toBeVisible();

        await page.getByRole('button', { name: 'New Template' }).click();
        await expect(page.getByRole('heading', { name: 'Create New Template' })).toBeVisible();

        const editor = page.locator('.card').filter({ has: page.getByRole('heading', { name: 'Create New Template' }) });
        await editor.getByLabel('Template Name').fill(name);
        await editor.locator('select').nth(1).selectOption('sms');
        await editor.locator('textarea').fill('Hi {customer_name} — E2E SMS template test.');
        await editor.getByRole('button', { name: 'Save Template' }).click();
        await expect(page.getByRole('heading', { name: 'Create New Template' })).toBeHidden({ timeout: 25_000 });

        const tplCard = page
            .locator('.card')
            .filter({ hasText: name })
            .filter({ has: page.getByRole('button', { name: 'Edit' }) })
            .first();
        await expect(tplCard).toBeVisible({ timeout: 25_000 });

        await tplCard.getByRole('button', { name: 'Edit' }).click();
        await expect(page.getByRole('heading', { name: 'Edit Template' })).toBeVisible();
        await page.getByLabel('Template Name').fill(updated);
        await page.getByRole('button', { name: 'Save Template' }).click();
        await expect(page.getByRole('heading', { name: 'Edit Template' })).toBeHidden({ timeout: 25_000 });

        const updatedCard = page
            .locator('.card')
            .filter({ hasText: updated })
            .filter({ has: page.getByRole('button', { name: 'Delete' }) })
            .first();
        await expect(updatedCard).toBeVisible({ timeout: 25_000 });

        acceptNextConfirm(page);
        await updatedCard.getByRole('button', { name: 'Delete' }).click();
        await expect(page.locator('.card').filter({ hasText: updated })).toHaveCount(0, { timeout: 25_000 });
    });

    test('Staff: create Receptionist, update name, delete', async ({ page }) => {
        test.skip(!ownerRoleAllowed(), 'Staff creation requires Owner (set TEST_USER_ROLE=Owner)');

        const id = Date.now();
        const name = `E2E Staff ${id}`;
        const nameUpdated = `${name} Updated`;
        const email = `e2e.staff.${id}@example.com`;

        await page.goto('/admin/staff');
        await expect(page.getByRole('heading', { name: 'Staff' })).toBeVisible();

        await page.getByRole('button', { name: 'Add Staff Member' }).click();
        await expect(page.getByRole('heading', { name: 'Add Staff Member' })).toBeVisible();

        const staffModal = page.locator('.max-w-2xl').filter({
            has: page.getByRole('heading', { name: 'Add Staff Member' }),
        });
        await staffModal.getByLabel('Name').fill(name);
        await staffModal.getByLabel('Email').fill(email);
        await staffModal.locator('input[type="tel"]').fill('771234567');
        await staffModal.locator('select').first().selectOption('Receptionist');
        await staffModal.locator('select').nth(1).selectOption({ index: 1 });
        await staffModal.getByRole('button', { name: 'Create Staff' }).click();

        await expect(page.getByRole('heading', { name: 'Staff Account Created!' })).toBeVisible({ timeout: 60_000 });
        await page.getByRole('button', { name: 'Done' }).click();
        await expect(page.getByRole('heading', { name: 'Staff Account Created!' })).toBeHidden();

        await page.getByPlaceholder('Search staff...').fill(name);
        const staffCard = page.locator('.card').filter({ has: page.getByRole('heading', { name }) }).first();
        await expect(staffCard).toBeVisible({ timeout: 25_000 });

        await staffCard.locator('button').filter({ has: page.locator('svg') }).first().click();
        await expect(page.getByRole('heading', { name: 'Edit Staff Member' })).toBeVisible();
        const editModal = page.locator('.max-w-2xl').filter({
            has: page.getByRole('heading', { name: 'Edit Staff Member' }),
        });
        await editModal.getByLabel('Name').fill(nameUpdated);
        await editModal.getByRole('button', { name: 'Update Staff' }).click();
        await expect(page.getByRole('heading', { name: 'Edit Staff Member' })).toBeHidden({ timeout: 25_000 });

        await page.getByPlaceholder('Search staff...').fill('');
        await page.getByPlaceholder('Search staff...').fill(nameUpdated);
        const cardAgain = page.locator('.card').filter({ has: page.getByRole('heading', { name: nameUpdated }) }).first();
        await expect(cardAgain).toBeVisible({ timeout: 15_000 });
        await cardAgain.locator('button').nth(1).click();
        await expect(page.getByRole('heading', { name: 'Delete Staff Member?' })).toBeVisible();
        const deleteModal = page.locator('.max-w-md').filter({
            has: page.getByRole('heading', { name: 'Delete Staff Member?' }),
        });
        await deleteModal.getByRole('button', { name: 'Delete' }).click();
        await expect(page.getByRole('heading', { name: 'Delete Staff Member?' })).toBeHidden({ timeout: 25_000 });
        await expect(
            page.locator('.card').filter({ has: page.getByRole('heading', { name: nameUpdated }) })
        ).toHaveCount(0, { timeout: 15_000 });
    });

    test('Appointments: page and New opens create flow', async ({ page }) => {
        await page.goto('/admin/appointments');
        await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible();
        await page.getByRole('button', { name: 'New', exact: true }).click();
        await expect(page.getByRole('heading', { name: /New Appointment/i })).toBeVisible({ timeout: 15_000 });
    });

    test('Smoke: POS, segments, loyalty, campaigns, reports, financial, earnings, settings', async ({ page }) => {
        await page.goto('/admin/pos');
        await expect(page.getByRole('heading', { name: 'POS & Billing' })).toBeVisible();

        await page.goto('/admin/segments');
        await expect(page.getByRole('heading', { name: 'Customer Segments' })).toBeVisible();

        await page.goto('/admin/loyalty');
        await expect(page.getByRole('heading', { name: 'Loyalty Program' })).toBeVisible();

        await page.goto('/admin/campaigns');
        await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();
        await expect(page.locator('a[href*="/admin/campaigns/new"]').first()).toBeVisible();

        await page.goto('/admin/campaigns/new');
        await expect(page.getByRole('heading', { name: 'Create Campaign' })).toBeVisible();

        await page.goto('/admin/reports');
        await expect(
            page.getByRole('heading', { name: 'Reports & Analytics' }).or(page.getByText('Access restricted'))
        ).toBeVisible({ timeout: 20_000 });

        await page.goto('/admin/financial');
        await expect(page.getByRole('heading', { name: 'Financial' })).toBeVisible();

        await page.goto('/admin/earnings');
        await expect(page.getByRole('heading', { name: 'Earnings' })).toBeVisible();

        await page.goto('/admin/settings');
        await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    });
});
