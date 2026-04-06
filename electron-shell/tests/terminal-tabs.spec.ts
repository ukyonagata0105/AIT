import { test, expect } from '@playwright/test';
import { cleanupTestContext, launchWithFixtures, TestContext } from './test-fixtures';

test.describe('Terminal Tabs Management', () => {
    let context: TestContext | null = null;

    test.beforeEach(async () => {
        context = await launchWithFixtures(2);
    });

    test.afterEach(async () => {
        await cleanupTestContext(context);
        context = null;
    });

    test('renders the terminal tab header controls', async () => {
        const page = context!.page;

        await expect(page.locator('#terminal-tabs-header')).toBeVisible();
        await expect(page.locator('#terminal-tabs-list')).toBeVisible();
        await expect(page.locator('#terminal-tab-add')).toHaveText('+');
    });

    test('creates a new terminal tab for the active workspace', async () => {
        const page = context!.page;
        const tabs = page.locator('.terminal-tab');
        const initialCount = await tabs.count();

        await page.locator('#terminal-tab-add').click();

        await expect(tabs).toHaveCount(initialCount + 1);
    });

    test('switches between terminal tabs', async () => {
        const page = context!.page;

        await page.locator('#terminal-tab-add').click();
        const tabs = page.locator('.terminal-tab');

        await tabs.first().click();
        await expect(tabs.first()).toHaveClass(/active/);

        await tabs.nth(1).click();
        await expect(tabs.nth(1)).toHaveClass(/active/);
    });

    test('closes a terminal tab from its close button', async () => {
        const page = context!.page;

        await page.locator('#terminal-tab-add').click();
        const tabs = page.locator('.terminal-tab');
        const initialCount = await tabs.count();

        await tabs.nth(1).locator('.terminal-tab-close').click();

        await expect(tabs).toHaveCount(initialCount - 1);
    });

    test('keeps tab sets independent across workspace switches', async () => {
        const page = context!.page;

        await page.locator('#terminal-tab-add').click();
        await expect(page.locator('.terminal-tab')).toHaveCount(2);

        await page.locator('.workspace-item').nth(1).click();
        await expect(page.locator('#workspace-heading')).toHaveText('workspace-2');
        await expect(page.locator('.terminal-tab')).toHaveCount(1);

        await page.locator('.workspace-item').first().click();
        await expect(page.locator('#workspace-heading')).toHaveText('workspace-1');
        await expect(page.locator('.terminal-tab')).toHaveCount(2);
    });
});
