import { test, expect, _electron as electron } from '@playwright/test';
import * as path from 'path';

const ELECTRON_APP = path.join(__dirname, '..');

test.describe('Workspace Management', () => {
    let electronApp: Awaited<ReturnType<typeof electron.launch>>;
    let page: Awaited<ReturnType<typeof electronApp.firstWindow>>;

    test.beforeEach(async () => {
        electronApp = await electron.launch({
            args: ['.'],
            cwd: ELECTRON_APP,
            env: { ...process.env, NODE_ENV: 'test' },
        });
        page = await electronApp.firstWindow();
    });

    test.afterEach(async () => {
        await electronApp.close();
    });

    test('should display workspace bar', async () => {
        const workspaceBar = page.locator('#workspace-bar');
        await expect(workspaceBar).toBeVisible();
    });

    test('should display add workspace button', async () => {
        const addBtn = page.locator('#workspace-add-btn');
        await expect(addBtn).toBeVisible();
        await expect(addBtn).toHaveText('+');
    });

    test('should add a new workspace when clicking add button', async () => {
        // Get initial count
        const workspaceList = page.locator('.workspace-item');
        const initialCount = await workspaceList.count();

        // Click add button
        const addBtn = page.locator('#workspace-add-btn');
        await addBtn.click();

        // Wait for new workspace to appear
        await page.waitForTimeout(1000);

        // Verify workspace was added
        const newCount = await workspaceList.count();
        expect(newCount).toBe(initialCount + 1);
    });

    test('should switch to workspace when clicking workspace item', async () => {
        // First add a workspace if none exist
        const workspaceList = page.locator('.workspace-item');
        const count = await workspaceList.count();

        if (count === 0) {
            const addBtn = page.locator('#workspace-add-btn');
            await addBtn.click();
            await page.waitForTimeout(1000);
        }

        // Get workspace heading
        const workspaceHeading = page.locator('#workspace-heading');

        // Click first workspace
        const firstWorkspace = page.locator('.workspace-item').first();
        await firstWorkspace.click();

        // Wait for switch
        await page.waitForTimeout(500);

        // Verify workspace is active
        await expect(firstWorkspace).toHaveClass(/active/);

        // Verify heading is updated
        const headingText = await workspaceHeading.textContent();
        expect(headingText).not.toBe('');
    });

    test('should show workspace context menu on right-click', async () => {
        // Add a workspace first
        const addBtn = page.locator('#workspace-add-btn');
        await addBtn.click();
        await page.waitForTimeout(1000);

        // Right-click on workspace
        const workspace = page.locator('.workspace-item').first();
        await workspace.click({ button: 'right' });

        // Check context menu appears
        const contextMenu = page.locator('#ws-context-menu');
        await expect(contextMenu).not.toHaveClass(/hidden/);

        // Check menu items
        await expect(contextMenu.locator('#ctx-rename')).toBeVisible();
        await expect(contextMenu.locator('#ctx-delete')).toBeVisible();
    });

    test('should hide context menu when clicking elsewhere', async () => {
        // Add a workspace and show context menu
        const addBtn = page.locator('#workspace-add-btn');
        await addBtn.click();
        await page.waitForTimeout(1000);

        const workspace = page.locator('.workspace-item').first();
        await workspace.click({ button: 'right' });

        // Click elsewhere
        await page.mouse.click(10, 10);

        // Context menu should be hidden
        const contextMenu = page.locator('#ws-context-menu');
        await expect(contextMenu).toHaveClass(/hidden/);
    });

    test('should toggle workspace bar collapse', async () => {
        const collapseBtn = page.locator('#ws-collapse-btn');
        const workspaceBar = page.locator('#workspace-bar');

        // Initial state - button shows left arrow
        await expect(collapseBtn).toHaveText('◀');

        // Click to collapse
        await collapseBtn.click();
        await expect(workspaceBar).toHaveClass(/collapsed/);
        await expect(collapseBtn).toHaveText('▶');

        // Click to expand
        await collapseBtn.click();
        await expect(workspaceBar).not.toHaveClass(/collapsed/);
        await expect(collapseBtn).toHaveText('◀');
    });

    test('should display workspace color icon', async () => {
        // Add workspace
        const addBtn = page.locator('#workspace-add-btn');
        await addBtn.click();
        await page.waitForTimeout(1000);

        // Check workspace icon
        const workspaceIcon = page.locator('.workspace-item').first().locator('.workspace-icon');
        await expect(workspaceIcon).toBeVisible();

        // Verify it has a background color
        const backgroundColor = await workspaceIcon.evaluate((el) => {
            return window.getComputedStyle(el).backgroundColor;
        });
        expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(backgroundColor).not.toBe('transparent');
    });

    test('should display workspace label', async () => {
        // Add workspace
        const addBtn = page.locator('#workspace-add-btn');
        await addBtn.click();
        await page.waitForTimeout(1000);

        // Check workspace label
        const workspaceLabel = page.locator('.workspace-item').first().locator('.workspace-label');
        await expect(workspaceLabel).toBeVisible();

        const labelText = await workspaceLabel.textContent();
        expect(labelText).not.toBe('');
        expect(labelText?.length).toBeGreaterThan(0);
    });

    test('should show empty state when no workspace is selected', async () => {
        const emptyState = page.locator('#empty-state');

        // If there are no workspaces or none selected
        const workspaceItems = page.locator('.workspace-item');
        const count = await workspaceItems.count();

        if (count === 0) {
            await expect(emptyState).toBeVisible();
            await expect(emptyState.locator('.empty-icon')).toHaveText('⌨️');
            await expect(emptyState.locator('.empty-title')).toHaveText('No workspace selected');
        }
    });

    test('should hide empty state when workspace is active', async () => {
        // Add and activate a workspace
        const addBtn = page.locator('#workspace-add-btn');
        await addBtn.click();
        await page.waitForTimeout(1000);

        const emptyState = page.locator('#empty-state');
        await expect(emptyState).toHaveClass(/hidden/);
    });

    test('should update workspace heading when switching workspaces', async () => {
        // Add two workspaces
        const addBtn = page.locator('#workspace-add-btn');
        await addBtn.click();
        await page.waitForTimeout(500);
        await addBtn.click();
        await page.waitForTimeout(500);

        const workspaceHeading = page.locator('#workspace-heading');

        // Switch to first workspace
        const firstWorkspace = page.locator('.workspace-item').nth(0);
        await firstWorkspace.click();
        await page.waitForTimeout(200);
        const firstHeading = await workspaceHeading.textContent();

        // Switch to second workspace
        const secondWorkspace = page.locator('.workspace-item').nth(1);
        await secondWorkspace.click();
        await page.waitForTimeout(200);
        const secondHeading = await workspaceHeading.textContent();

        // Headings should be different (workspaces have different names)
        expect(firstHeading).not.toBe(secondHeading);
    });
});
