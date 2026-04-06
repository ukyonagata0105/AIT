import { test, expect } from '@playwright/test';
import { cleanupTestContext, launchWithFixtures, TestContext } from './test-fixtures';

test.describe('Workspace Management', () => {
    let context: TestContext | null = null;

    test.beforeEach(async () => {
        context = await launchWithFixtures(2);
    });

    test.afterEach(async () => {
        await cleanupTestContext(context);
        context = null;
    });

    test('shows the seeded workspaces in the bar', async () => {
        const page = context!.page;
        const workspaceItems = page.locator('.workspace-item');

        await expect(page.locator('#workspace-bar')).toBeVisible();
        await expect(workspaceItems).toHaveCount(2);
        await expect(workspaceItems.first()).toContainText('workspace-1');
        await expect(workspaceItems.nth(1)).toContainText('workspace-2');
    });

    test('switches active workspace when clicked', async () => {
        const page = context!.page;
        const secondWorkspace = page.locator('.workspace-item').nth(1);

        await secondWorkspace.click();

        await expect(secondWorkspace).toHaveClass(/active/);
        await expect(page.locator('#workspace-heading')).toHaveText('workspace-2');
    });

});
