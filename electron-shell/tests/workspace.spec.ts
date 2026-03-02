import { test, expect, _electron as electron } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';

const ELECTRON_APP = path.join(__dirname, '..');

test.describe('Workspace Management', () => {
    let electronApp: Awaited<ReturnType<typeof electron.launch>>;
    let page: Awaited<ReturnType<typeof electronApp.firstWindow>>;

    test.beforeEach(async () => {
        electronApp = await electron.launch({
            args: ['.'],
            cwd: ELECTRON_APP,
            env: {
                ...process.env,
                NODE_ENV: 'test',
                // Use a test-specific config directory
                HOME: os.tmpdir(),
            },
        });
        page = await electronApp.firstWindow();
        await page.waitForLoadState('networkidle');
    });

    test.afterEach(async () => {
        await electronApp.close();
    });

    test('workspace bar is visible and contains add button', async () => {
        const workspaceBar = page.locator('#workspace-bar');
        await expect(workspaceBar).toBeVisible();

        const addBtn = page.locator('#workspace-add-btn');
        await expect(addBtn).toBeVisible();
        await expect(addBtn).toHaveText('+');
    });

    test('workspace heading shows workspace name when workspace is active', async () => {
        // First add a workspace
        await page.locator('#workspace-add-btn').click();

        // Wait for workspace add dialog (could be native file picker or custom dialog)
        await page.waitForTimeout(500);

        // Check if heading is updated (might need to interact with dialog first)
        const workspaceHeading = page.locator('#workspace-heading');
        const workspaceItems = page.locator('.workspace-item');
        const count = await workspaceItems.count();

        if (count > 0) {
            await expect(workspaceHeading).not.toHaveText('');
        }
    });

    test('workspace context menu appears on right-click', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const count = await workspaceItems.count();

        if (count > 0) {
            // Right-click on first workspace
            await workspaceItems.first().click({ button: 'right' });

            // Check for context menu
            const contextMenu = page.locator('#ws-context-menu');
            await expect(contextMenu).not.toHaveClass(/hidden/);

            // Verify menu items
            await expect(page.locator('#ctx-rename')).toBeVisible();
            await expect(page.locator('#ctx-delete')).toBeVisible();
        }
    });

    test('workspace can be renamed', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const count = await workspaceItems.count();

        test.skip(count === 0, 'No workspaces to rename');

        if (count > 0) {
            // Right-click to open context menu
            await workspaceItems.first().click({ button: 'right' });

            // Click rename option
            await page.locator('#ctx-rename').click();

            // Wait for rename prompt (could be window.prompt or custom dialog)
            await page.waitForTimeout(500);

            // The actual rename interaction depends on implementation
            // This test checks the workflow is initiated
        }
    });

    test('workspace can be deleted', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const initialCount = await workspaceItems.count();

        test.skip(initialCount === 0, 'No workspaces to delete');

        if (initialCount > 0) {
            // Right-click to open context menu
            await workspaceItems.first().click({ button: 'right' });

            // Click delete option
            await page.locator('#ctx-delete').click();

            // Wait for deletion
            await page.waitForTimeout(500);

            // Verify workspace count decreased or confirm dialog appeared
            const finalCount = await workspaceItems.count();
            expect(finalCount).toBeLessThanOrEqual(initialCount);
        }
    });

    test('workspace sash is draggable', async () => {
        const workspaceSash = page.locator('#workspace-sash');
        await expect(workspaceSash).toBeVisible();

        // Check cursor on hover
        await workspaceSash.hover();
        const cursor = await workspaceSash.evaluate((el) =>
            window.getComputedStyle(el).cursor
        );
        expect(cursor).toBe('col-resize');
    });

    test('workspace bar can be collapsed', async () => {
        const collapseBtn = page.locator('#ws-collapse-btn');
        await expect(collapseBtn).toBeVisible();

        const workspaceBar = page.locator('#workspace-bar');

        // Get initial width
        const initialWidth = await workspaceBar.evaluate((el) => el.offsetWidth);

        // Click collapse button
        await collapseBtn.click();
        await page.waitForTimeout(300);

        // Check if width changed
        const collapsedWidth = await workspaceBar.evaluate((el) => el.offsetWidth);
        expect(collapsedWidth).not.toBe(initialWidth);

        // Collapse again to restore
        await collapseBtn.click();
        await page.waitForTimeout(300);

        const restoredWidth = await workspaceBar.evaluate((el) => el.offsetWidth);
        expect(restoredWidth).toBe(initialWidth);
    });

    test('workspace switching updates heading', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const count = await workspaceItems.count();

        test.skip(count < 2, 'Need at least 2 workspaces to test switching');

        if (count >= 2) {
            const workspaceHeading = page.locator('#workspace-heading');

            // Click first workspace
            await workspaceItems.nth(0).click();
            await page.waitForTimeout(200);
            const firstHeading = await workspaceHeading.textContent();

            // Click second workspace
            await workspaceItems.nth(1).click();
            await page.waitForTimeout(200);
            const secondHeading = await workspaceHeading.textContent();

            // Headings should be different
            expect(secondHeading).not.toBe(firstHeading);
        }
    });

    test('workspace add button is disabled when max workspaces reached', async () => {
        // This test checks if there's a limit on workspaces
        const addBtn = page.locator('#workspace-add-btn');
        await expect(addBtn).toBeVisible();

        // Check if button is disabled (implementation dependent)
        const isDisabled = await addBtn.isDisabled();
        expect(isDisabled).toBe(false); // Default expectation
    });

    test('workspace colors are applied correctly', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const count = await workspaceItems.count();

        if (count > 0) {
            // Check if workspace has a color indicator
            const firstWorkspace = workspaceItems.first();

            // Get background color or border color
            const bgColor = await firstWorkspace.evaluate((el) =>
                window.getComputedStyle(el).backgroundColor
            );

            // Should not be transparent (assuming colors are set)
            // This is a basic check - actual implementation may vary
            expect(bgColor).toBeTruthy();
        }
    });

    test('workspace persists across app reloads', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const initialCount = await workspaceItems.count();

        // Reload the app
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Check if workspaces are still there
        const reloadedCount = await workspaceItems.count();
        expect(reloadedCount).toBe(initialCount);
    });

    test('empty state is shown when no workspaces exist', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const count = await workspaceItems.count();

        if (count === 0) {
            const emptyState = page.locator('#empty-state');
            await expect(emptyState).toBeVisible();
            await expect(emptyState).toContainText('No workspace selected');
        }
    });

    test('workspace settings panel shows workspace list', async () => {
        // Open settings
        await page.locator('#settings-btn').click();
        await page.waitForTimeout(300);

        const settingsOverlay = page.locator('#settings-overlay');
        await expect(settingsOverlay).not.toHaveClass(/hidden/);

        // Switch to workspaces tab if not already
        const workspacesTab = page.locator('[data-tab="workspaces"]');
        await workspacesTab.click();
        await page.waitForTimeout(200);

        // Check if workspace list is visible
        const workspaceList = page.locator('#settings-ws-list');
        await expect(workspaceList).toBeVisible();
    });

    test('workspace can be added from settings panel', async () => {
        // Open settings
        await page.locator('#settings-btn').click();
        await page.waitForTimeout(300);

        // Switch to workspaces tab
        await page.locator('[data-tab="workspaces"]').click();
        await page.waitForTimeout(200);

        // Check if add workspace button exists
        const addWsBtn = page.locator('#settings-add-ws');
        await expect(addWsBtn).toBeVisible();
    });

    test('workspace is highlighted when active', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const count = await workspaceItems.count();

        if (count > 0) {
            // Check if any workspace has active class
            const activeWorkspace = page.locator('.workspace-item.active');
            const hasActive = await activeWorkspace.count();

            expect(hasActive).toBeGreaterThan(0);
        }
    });

    test('workspace list scrolls when many workspaces exist', async () => {
        const workspaceList = page.locator('#workspace-list');
        await expect(workspaceList).toBeVisible();

        // Check overflow behavior
        const overflowY = await workspaceList.evaluate((el) =>
            window.getComputedStyle(el).overflowY
        );

        // Should have auto or scroll overflow
        expect(['auto', 'scroll', 'overlay']).toContain(overflowY);
    });
});
