/**
 * End-to-end CRUD smoke tests for main admin entities.
 * Requires TEST_USER_EMAIL / TEST_USER_PASSWORD; Owner or Manager (TEST_USER_ROLE).
 */
import { test, expect } from '@playwright/test';
import {
    loginToAdminDashboard,
    ADMIN_LOGIN_TIMEOUT_MS,
    crudRolesAllowed,
    acceptNextConfirm,
} from './helpers/admin-auth';

test.describe('Admin CRUD', () => {
    test.describe.configure({ timeout: ADMIN_LOGIN_TIMEOUT_MS + 120_000 });

    test.beforeEach(async ({ page }) => {
        test.skip(
            !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
            'Set TEST_USER_EMAIL and TEST_USER_PASSWORD'
        );
        test.skip(!crudRolesAllowed(), 'CRUD tests require Owner or Manager (set TEST_USER_ROLE)');

        await loginToAdminDashboard(page, process.env.TEST_USER_EMAIL!, process.env.TEST_USER_PASSWORD!);
        if (page.url().includes('/admin/select-branch')) {
            test.skip(true, 'Use a user with branch_id set (not select-branch)');
        }
    });

    test('Services: create, update, delete', async ({ page }) => {
        const id = Date.now();
        const name = `E2E Service ${id}`;
        const updated = `${name} Updated`;

        await page.goto('/admin/services');
        await expect(page.getByRole('heading', { name: 'Services' })).toBeVisible();

        await page.getByRole('button', { name: 'Add Service' }).click();
        await expect(page.getByRole('heading', { name: 'Add New Service' })).toBeVisible();
        await page.getByLabel('Service Name').fill(name);
        await page.getByLabel(/Price \(Rs\)/).fill('1500');
        await page.getByLabel(/Duration \(min\)/).fill('45');
        await page.getByRole('button', { name: 'Create Service' }).click();
        await expect(page.getByRole('heading', { name: 'Add New Service' })).toBeHidden({ timeout: 20000 });
        await expect(page.locator('.card').filter({ hasText: name }).first()).toBeVisible();

        const serviceCard = page.locator('.card').filter({ hasText: name }).first();
        await serviceCard.getByRole('button', { name: 'Edit' }).click();
        await expect(page.getByRole('heading', { name: 'Edit Service' })).toBeVisible();
        await page.getByLabel('Service Name').fill(updated);
        await page.getByRole('button', { name: 'Update Service' }).click();
        await expect(page.getByRole('heading', { name: 'Edit Service' })).toBeHidden({ timeout: 20000 });
        await expect(page.locator('.card').filter({ hasText: updated }).first()).toBeVisible();

        const updatedCard = page.locator('.card').filter({ hasText: updated }).first();
        await updatedCard.locator('button').nth(1).click();
        await expect(page.getByRole('heading', { name: 'Delete Service?' })).toBeVisible();
        await page.getByRole('button', { name: 'Delete' }).click();
        await expect(page.locator('.card').filter({ hasText: updated })).toHaveCount(0, { timeout: 20000 });
    });

    test('Customers: create, update, delete', async ({ page }) => {
        const id = Date.now();
        const name = `E2E Customer ${id}`;
        const digits = `77${String(id).slice(-7)}`;

        await page.goto('/admin/customers');
        await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible();

        await page.getByRole('button', { name: 'Add Customer' }).click();
        await expect(page.getByRole('heading', { name: 'Add New Customer' })).toBeVisible();
        await page.getByLabel('Full Name').fill(name);
        await page.locator('input[type="tel"]').fill(digits);
        await page.locator('button[type="submit"]').filter({ hasText: 'Create Customer' }).click();
        await expect(page.getByRole('heading', { name: 'Add New Customer' })).toBeHidden({ timeout: 20000 });
        await expect(page.locator('.card').filter({ hasText: name }).first()).toBeVisible();

        await page.getByPlaceholder('Search by name, phone, or email...').fill(name);
        await expect(page.locator('.card').filter({ hasText: name })).toHaveCount(1, { timeout: 15000 });

        const custCard = page.locator('.card').filter({ hasText: name }).first();
        await custCard.getByRole('button', { name: 'Edit' }).click();
        await expect(page.getByRole('heading', { name: 'Edit Customer' })).toBeVisible();
        await page.getByPlaceholder('Any specific preferences...').fill('e2e prefs');
        await page.locator('button[type="submit"]').filter({ hasText: 'Update Customer' }).click();
        await expect(page.getByRole('heading', { name: 'Edit Customer' })).toBeHidden({ timeout: 20000 });

        await page.getByPlaceholder('Search by name, phone, or email...').fill('');
        await page.getByPlaceholder('Search by name, phone, or email...').fill(name);
        const cardAgain = page.locator('.card').filter({ hasText: name }).first();
        await cardAgain.locator('button').nth(2).click();
        await expect(page.getByRole('heading', { name: 'Delete Customer?' })).toBeVisible();
        await page.getByRole('button', { name: 'Delete' }).click();
        await expect(page.locator('.card').filter({ hasText: name })).toHaveCount(0, { timeout: 20000 });
    });

    test('Inventory: create, update, delete', async ({ page }) => {
        const id = Date.now();
        const name = `E2E Product ${id}`;

        await page.goto('/admin/inventory');
        await expect(page.getByRole('heading', { name: 'Inventory Management' })).toBeVisible();

        // Open modal: first block under the page root is the header row (not the modal submit).
        await page.locator('div.space-y-6').locator('> div').first().getByRole('button', { name: 'Add Product' }).click();
        await expect(page.getByRole('heading', { name: 'Add New Product' })).toBeVisible();

        const form = page.locator('form').filter({ has: page.getByPlaceholder('e.g., Shampoo, Hair Dryer') });
        const numberInputs = form.locator('input[type="number"]');

        // ProductFormModal uses React state on submit — use pressSequentially so onChange runs (fill/clear alone is unreliable).
        const nameInput = page.getByPlaceholder('e.g., Shampoo, Hair Dryer');
        await nameInput.click();
        await nameInput.pressSequentially(name, { delay: 5 });

        // Give each test product a unique SKU so we don't hit the inventory_sku_key constraint.
        const skuInput = page.getByPlaceholder('e.g., SH-001');
        await skuInput.click();
        await skuInput.pressSequentially(`E2E-${id}`, { delay: 5 });

        // Initial stock 0 skips createProduct's logTransaction (fewer RLS edge cases).
        const values = ['0', '5', '100', '199'];
        for (let i = 0; i < 4; i++) {
            const input = numberInputs.nth(i);
            await input.click({ clickCount: 3 });
            await input.pressSequentially(values[i], { delay: 5 });
        }

        await page.locator('button[type="submit"]').filter({ hasText: 'Add Product' }).click();

        const productRow = page.locator('tbody tr').filter({ hasText: name });
        await expect(productRow).toBeVisible({ timeout: 30000 }).catch(async () => {
            const err = await page.locator('form').filter({ has: page.getByPlaceholder('e.g., Shampoo, Hair Dryer') }).locator('[class*="bg-red"]').first().textContent();
            throw new Error(
                err?.trim() ||
                    'Product did not appear in table (modal uses React state — check controlled inputs / inventory RLS / org scope)'
            );
        });

        await productRow.locator('button[title="Edit product"]').click();
        await expect(page.getByRole('heading', { name: 'Edit Product' })).toBeVisible();
        const editName = page.getByPlaceholder('e.g., Shampoo, Hair Dryer');
        await editName.click({ clickCount: 3 });
        await editName.pressSequentially(`${name} Updated`, { delay: 5 });
        await page.locator('button[type="submit"]').filter({ hasText: 'Update Product' }).click();
        await expect(page.locator('tbody tr').filter({ hasText: `${name} Updated` })).toBeVisible({
            timeout: 30000,
        });

        const rowUpdated = page.locator('tbody tr').filter({ hasText: `${name} Updated` });
        acceptNextConfirm(page);
        await rowUpdated.locator('button[title="Delete product"]').click();
        await expect(page.locator('tbody tr').filter({ hasText: `${name} Updated` })).toHaveCount(0, {
            timeout: 20000,
        });
    });

    test('Promo codes: create, update, delete', async ({ page }) => {
        const id = Date.now();
        const code = `E2E${id}`.toUpperCase().slice(0, 16);

        await page.goto('/admin/promos');
        await expect(page.getByRole('heading', { name: 'Promo Codes' })).toBeVisible();

        await page.getByRole('button', { name: 'Create Promo Code' }).first().click();
        await expect(page.getByRole('heading', { name: 'Create Promo Code' })).toBeVisible();
        await page.getByLabel('Promo Code').fill(code);
        await page.getByLabel(/Discount \(%\)/).fill('10');
        await page.locator('button[type="submit"]').filter({ hasText: 'Create Promo Code' }).click();
        await expect(page.getByRole('heading', { name: 'Create Promo Code' })).toBeHidden({ timeout: 20000 });
        await expect(page.locator('.card').filter({ hasText: code }).first()).toBeVisible();

        await page.getByPlaceholder('Search promo codes...').fill(code);
        const promoCard = page.locator('.card').filter({ hasText: code }).first();
        await promoCard.getByRole('button', { name: 'Edit' }).click();
        await expect(page.getByRole('heading', { name: 'Edit Promo Code' })).toBeVisible();
        await page.locator('textarea[placeholder="Describe the promotion..."]').fill('e2e promo');
        await page.locator('button[type="submit"]').filter({ hasText: 'Update Promo Code' }).click();
        await expect(page.getByRole('heading', { name: 'Edit Promo Code' })).toBeHidden({ timeout: 20000 });

        await page.getByPlaceholder('Search promo codes...').fill(code);
        const cardAgain = page.locator('.card').filter({ hasText: code }).first();
        acceptNextConfirm(page);
        await cardAgain.locator('.flex.gap-2').last().getByRole('button').last().click();
        await expect(page.locator('.card').filter({ hasText: code })).toHaveCount(0, { timeout: 20000 });
    });

    test('Staff: list page loads (no auth user creation)', async ({ page }) => {
        await page.goto('/admin/staff');
        await expect(page.getByRole('heading', { name: 'Staff' })).toBeVisible();
        await expect(page.getByText(/Manage salon team members/)).toBeVisible();
    });
});
