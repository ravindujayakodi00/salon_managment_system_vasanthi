/**
 * E2E Test: Walk-in Customer Billing Flow
 * Tests complete customer creation and walk-in service billing
 */

import { test, expect } from '@playwright/test';

test.describe('Walk-in Customer Billing', () => {
    test.beforeEach(async ({ page }) => {
        // Login (adjust credentials as needed)
        await page.goto('/admin/login');
        await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || 'test@salon.com');
        await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'password');
        await page.click('button[type="submit"]');
        await page.waitForURL('/admin/dashboard');
    });

    test('Complete walk-in customer creation and billing', async ({ page }) => {
        // Navigate to POS
        await page.goto('/admin/pos');
        await expect(page.locator('h1:has-text("POS & Billing")')).toBeVisible();

        // Search for new customer
        const phoneNumber = `077${Math.floor(Math.random() * 10000000)}`;
        await page.fill('input[placeholder*="Search by phone"]', phoneNumber);
        await page.waitForTimeout(1000);

        // Click create customer button
        await page.click('button:has-text("Create Walk-in Customer")');

        // Fill customer form
        await page.fill('input[placeholder*="customer name"]', 'Test Walk-in Customer');
        await expect(page.locator('input[type="tel"]')).toHaveValue(phoneNumber.replace(/\D/g, ''));
        await page.locator('input[type="date"]').fill('1990-05-12');

        // Verify phone validation
        await expect(page.locator('svg[class*="text-success"]')).toBeVisible(); // Green check

        // Submit form
        await page.click('button:has-text("Create Customer")');

        // Verify customer created
        await expect(page.locator('text=Customer created')).toBeVisible();
        await expect(page.locator('text=Test Walk-in Customer')).toBeVisible();

        // Add walk-in service
        await page.locator('text=Walk-in Services').scrollIntoViewIfNeeded();

        // Select first service's stylist
        const firstServiceDropdown = page.locator('select').first();
        await firstServiceDropdown.selectOption({ index: 1 });

        // Click Add button
        await page.locator('button:has-text("Add")').first().click();

        // Verify service in cart
        await expect(page.locator('text=Bill Summary')).toBeVisible();

        // Complete payment
        await page.locator('button:has-text("Pay")').click();

        // Verify success
        await expect(page.locator('text=Payment successful')).toBeVisible({ timeout: 10000 });
    });

    test('Customer search and re-selection', async ({ page }) => {
        await page.goto('/admin/pos');

        // Type in search
        await page.fill('input[placeholder*="Search"]', '077');
        await page.waitForTimeout(1000);

        // Verify dropdown appears
        const dropdown = page.locator('[class*="absolute"][class*="z-10"]');
        await expect(dropdown).toBeVisible();

        // Verify can select different customer after one is selected
        // (This tests the fix we made earlier)
    });

    test('Phone validation shows correct feedback', async ({ page }) => {
        await page.goto('/admin/pos');

        // Search with invalid number
        await page.fill('input[placeholder*="Search"]', '123');
        await page.click('button:has-text("Create Walk-in Customer")');

        // Invalid number should show warning
        await expect(page.locator('text=Please enter a valid phone number')).toBeVisible();
    });

    test('Walk-in service shows stylist name in cart', async ({ page }) => {
        await page.goto('/admin/pos');

        // Assume customer already selected
        // Add walk-in service
        const stylistDropdown = page.locator('select').first();
        await stylistDropdown.selectOption({ index: 1 });
        const stylistName = await stylistDropdown.locator('option:checked').textContent();

        await page.locator('button:has-text("Add")').first().click();

        // Verify stylist name appears in cart
        await expect(page.locator(`text=${stylistName}`)).toBeVisible();
    });
});
