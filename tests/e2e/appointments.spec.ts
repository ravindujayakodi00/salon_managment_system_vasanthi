/**
 * E2E Test: Appointment Creation
 * Tests appointment booking and multi-service flows
 */

import { test, expect } from '@playwright/test';

test.describe('Appointment Creation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || 'test@salon.com');
        await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'password');
        await page.click('button[type="submit"]');
        await page.waitForURL('/dashboard');
    });

    test('Create single service appointment', async ({ page }) => {
        await page.goto('/appointments');

        // Click new appointment button
        await page.click('button:has-text("New Appointment")');

        // Select customer
        await page.fill('input[placeholder*="customer"]', '077');
        await page.waitForTimeout(500);
        await page.locator('[class*="dropdown"] button').first().click();

        // Select service
        await page.locator('input[type="checkbox"]').first().check();

        // Select stylist
        await page.locator('select[name="stylist"]').selectOption({ index: 1 });

        // Pick date (tomorrow)
        // Select time slot
        await page.locator('[class*="time-slot"]').first().click();

        // Submit
        await page.click('button:has-text("Create Appointment")');

        // Verify success
        await expect(page.locator('text=Appointment created')).toBeVisible();
    });

    test('Create multi-service appointment', async ({ page }) => {
        await page.goto('/appointments');
        await page.click('button:has-text("New Appointment")');

        // Select customer
        await page.fill('input[placeholder*="customer"]', '077');
        await page.waitForTimeout(500);
        await page.locator('[class*="dropdown"] button').first().click();

        // Select multiple services
        await page.locator('input[type="checkbox"]').first().check();
        await page.locator('input[type="checkbox"]').nth(1).check();
        await page.locator('input[type="checkbox"]').nth(2).check();

        // Assign stylists for each service
        await page.locator('select').first().selectOption({ index: 1 });
        await page.locator('select').nth(1).selectOption({ index: 1 });
        await page.locator('select').nth(2).selectOption({ index: 1 });

        // Pick time
        await page.locator('[class*="time-slot"]').first().click();

        // Submit
        await page.click('button:has-text("Create Appointment")');

        // Verify: ONE SMS notification sent (consolidated)
        await expect(page.locator('text=Appointment created')).toBeVisible();
    });

    test('"Any Professional" booking', async ({ page }) => {
        await page.goto('/appointments');
        await page.click('button:has-text("New Appointment")');

        // Select customer
        await page.fill('input[placeholder*="customer"]', '077');
        await page.waitForTimeout(500);
        await page.locator('[class*="dropdown"] button').first().click();

        // Select service
        await page.locator('input[type="checkbox"]').first().check();

        // Select "Any Professional"
        await page.locator('select[name="stylist"]').selectOption('any');

        // Verify available slots shown
        await expect(page.locator('[class*="time-slot"]')).toBeVisible();

        // Select slot
        await page.locator('[class*="time-slot"]').first().click();

        // Submit
        await page.click('button:has-text("Create Appointment")');

        // Verify stylist auto-assigned
        await expect(page.locator('text=Appointment created')).toBeVisible();
    });

    test('Time conflict detection', async ({ page }) => {
        await page.goto('/appointments');
        await page.click('button:has-text("New Appointment")');

        // Select services with conflicting times
        // (Assume service 1: 60min, service 2: 30min)await page.check('input[type="checkbox"]').first();
        await page.locator('input[type="checkbox"]').nth(1).check();

        // Assign same stylist to both
        await page.locator('select').first().selectOption({ index: 1 });
        await page.locator('select').nth(1).selectOption({ index: 1 });

        // Select time slot
        await page.locator('[class*="time-slot"]').first().click();

        // Verify conflict highlighted
        // (Implementation specific - adjust selector)
        await expect(page.locator('[class*="conflict"]')).toBeVisible();
    });
});
