import { test, expect } from '@playwright/test';
import { cleanupTestContext, launchWithFixtures, TestContext } from './test-fixtures';

async function openAppearanceTab(context: TestContext) {
    const page = context.page;
    await page.locator('#settings-btn').click();
    await expect(page.locator('#settings-overlay')).not.toHaveClass(/hidden/);
    await page.locator('.settings-tab').filter({ hasText: 'Appearance' }).click();
    await expect(page.locator('#tab-appearance')).toBeVisible();
}

test.describe('Theme Switching', () => {
    let context: TestContext | null = null;

    test.beforeEach(async () => {
        context = await launchWithFixtures(1);
    });

    test.afterEach(async () => {
        await cleanupTestContext(context);
        context = null;
    });

    test('opens the settings overlay', async () => {
        const page = context!.page;
        await page.locator('#settings-btn').click();
        await expect(page.locator('#settings-overlay')).not.toHaveClass(/hidden/);
    });

    test('shows all available themes in appearance settings', async () => {
        await openAppearanceTab(context!);
        const page = context!.page;

        await expect(page.locator('.theme-card')).toHaveCount(4);
        await expect(page.locator('.theme-card[data-theme="dark"]')).toBeVisible();
        await expect(page.locator('.theme-card[data-theme="tokyo-night"]')).toBeVisible();
        await expect(page.locator('.theme-card[data-theme="light"]')).toBeVisible();
        await expect(page.locator('.theme-card[data-theme="solarized-light"]')).toBeVisible();
    });

    test('applies a theme immediately', async () => {
        await openAppearanceTab(context!);
        const page = context!.page;

        const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        await page.locator('.theme-card[data-theme="light"]').click();
        const nextTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));

        expect(initialTheme).not.toBe(nextTheme);
        expect(nextTheme).toBe('light');
    });

    test('persists theme selection while the app stays open', async () => {
        await openAppearanceTab(context!);
        const page = context!.page;

        await page.locator('.theme-card[data-theme="solarized-light"]').click();
        await page.locator('#settings-close').click();
        await expect(page.locator('#settings-overlay')).toHaveClass(/hidden/);

        await openAppearanceTab(context!);
        const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        expect(theme).toBe('solarized-light');
    });

    test('closes settings with Escape', async () => {
        const page = context!.page;

        await page.locator('#settings-btn').click();
        await expect(page.locator('#settings-overlay')).not.toHaveClass(/hidden/);
        await page.keyboard.press('Escape');
        await expect(page.locator('#settings-overlay')).toHaveClass(/hidden/);
    });
});
