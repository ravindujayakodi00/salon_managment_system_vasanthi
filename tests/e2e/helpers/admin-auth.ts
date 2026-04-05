import type { Page } from '@playwright/test';

export const ADMIN_LOGIN_TIMEOUT_MS = 60_000;

/** Accept the next `window.confirm` (e.g. notification template delete). */
export function acceptNextConfirm(page: Page) {
    page.once('dialog', (d) => d.accept());
}

/** Logs into admin and lands on dashboard or select-branch. Throws on auth error. */
export async function loginToAdminDashboard(page: Page, email: string, password: string) {
    await page.goto('/admin/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();

    const errorLocator = page.getByText(
        /incorrect email or password|login failed|invalid login credentials|invalid email or password/i
    );

    await Promise.race([
        page.waitForURL(/\/admin\/(dashboard|select-branch)/, { timeout: ADMIN_LOGIN_TIMEOUT_MS }),
        errorLocator.waitFor({ state: 'visible', timeout: ADMIN_LOGIN_TIMEOUT_MS }),
    ]);

    if (await errorLocator.isVisible().catch(() => false)) {
        const msg = (await errorLocator.textContent())?.trim() || 'Login error';
        throw new Error(
            `${msg}. Use credentials that exist in the Supabase project pointed to by NEXT_PUBLIC_SUPABASE_URL in .env.`
        );
    }

    if (!/\/admin\/(dashboard|select-branch)/.test(page.url())) {
        throw new Error(`Expected dashboard or select-branch after login; still on ${page.url()}`);
    }
}

export function crudRolesAllowed(): boolean {
    const r = process.env.TEST_USER_ROLE;
    if (!r) return true;
    return r === 'Owner' || r === 'Manager';
}

/** Staff create/delete is Owner-only in the app. */
export function ownerRoleAllowed(): boolean {
    const r = process.env.TEST_USER_ROLE;
    if (!r) return true;
    return r === 'Owner';
}
