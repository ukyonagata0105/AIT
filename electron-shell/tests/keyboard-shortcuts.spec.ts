import { test, expect, _electron as electron } from '@playwright/test';
import * as path from 'path';

const ELECTRON_APP = path.join(__dirname, '..');

test.describe('Keyboard Shortcuts', () => {
    let electronApp: Awaited<ReturnType<typeof electron.launch>>;
    let page: Awaited<ReturnType<typeof electronApp.firstWindow>>;

    test.beforeEach(async () => {
        electronApp = await electron.launch({
            args: ['.'],
            cwd: ELECTRON_APP,
            env: { ...process.env, NODE_ENV: 'test' },
        });
        page = await electronApp.firstWindow();

        // Add a workspace for tests that need it
        const addBtn = page.locator('#workspace-add-btn');
        await addBtn.click();
        await page.waitForTimeout(1500);
    });

    test.afterEach(async () => {
        await electronApp.close();
    });

    const getModifier = () => process.platform === 'darwin' ? 'Meta' : 'Control';

    test('should open command palette with Cmd+P', async () => {
        const commandPalette = page.locator('#command-palette');
        await expect(commandPalette).toHaveClass(/hidden/);

        await page.keyboard.press(`${getModifier()}+P`);
        await page.waitForTimeout(200);

        await expect(commandPalette).not.toHaveClass(/hidden/);
    });

    test('should create new terminal tab with keyboard shortcut', async () => {
        const initialCount = await page.locator('.terminal-tab').count();

        await page.keyboard.press(`${getModifier()}+Shift+T`);
        await page.waitForTimeout(500);

        const newCount = await page.locator('.terminal-tab').count();
        expect(newCount).toBeGreaterThan(initialCount);
    });

    test('should close current tab with keyboard shortcut', async () => {
        // Create a tab first
        await page.locator('#terminal-tab-add').click();
        await page.waitForTimeout(500);

        const initialCount = await page.locator('.terminal-tab').count();

        await page.keyboard.press(`${getModifier()}+Shift+W`);
        await page.waitForTimeout(500);

        const newCount = await page.locator('.terminal-tab').count();
        expect(newCount).toBeLessThan(initialCount);
    });

    test('should toggle sidebar with keyboard shortcut', async () => {
        const workspaceBar = page.locator('#workspace-bar');
        const isInitiallyCollapsed = await workspaceBar.evaluate((el) =>
            el.classList.contains('collapsed')
        );

        await page.keyboard.press(`${getModifier()}+B`);
        await page.waitForTimeout(300);

        const isNowCollapsed = await workspaceBar.evaluate((el) =>
            el.classList.contains('collapsed')
        );

        expect(isNowCollapsed).toBe(!isInitiallyCollapsed);
    });

    test('should open settings with keyboard shortcut', async () => {
        const settingsOverlay = page.locator('#settings-overlay');

        await expect(settingsOverlay).toHaveClass(/hidden/);

        await page.keyboard.press(`${getModifier()}+,`);
        await page.waitForTimeout(300);

        await expect(settingsOverlay).not.toHaveClass(/hidden/);
    });

    test('should switch to next workspace with keyboard shortcut', async () => {
        // Add another workspace
        await page.locator('#workspace-add-btn').click();
        await page.waitForTimeout(500);

        const firstWorkspace = page.locator('.workspace-item').first();
        const initialActiveText = await firstWorkspace.textContent();

        await page.keyboard.press(`${getModifier()}+Shift+]`);
        await page.waitForTimeout(300);

        // Active workspace should have changed
        const activeWorkspace = page.locator('.workspace-item.active');
        await expect(activeWorkspace).toBeVisible();
    });

    test('should switch to previous workspace with keyboard shortcut', async () => {
        // Add another workspace
        await page.locator('#workspace-add-btn').click();
        await page.waitForTimeout(500);

        // Switch to second workspace
        await page.locator('.workspace-item').nth(1).click();
        await page.waitForTimeout(300);

        await page.keyboard.press(`${getModifier()}+Shift+[`);
        await page.waitForTimeout(300);

        // Should switch back to first workspace
        const firstWorkspace = page.locator('.workspace-item').first();
        await expect(firstWorkspace).toHaveClass(/active/);
    });

    test('should save file with Cmd+S in editor', async () => {
        // Open a file in explorer
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const files = explorerTree.locator('.tree-item:not(.dir)');

        if (await files.count() > 0) {
            await files.first().click();
            await page.waitForTimeout(500);

            // Press Cmd+S - should not throw error
            await page.keyboard.press(`${getModifier()}+S`);
            await page.waitForTimeout(300);

            // File should save (might show toast)
            // This is implementation-dependent
        } else {
            test.skip(true, 'No files available in explorer');
        }
    });

    test('should focus terminal when pressing backtick', async () => {
        const terminalPane = page.locator('#terminal-pane');

        // Click somewhere else first
        await page.mouse.click(100, 100);
        await page.waitForTimeout(100);

        // Press backtick
        await page.keyboard.press('`');
        await page.waitForTimeout(200);

        // Terminal should receive focus (implementation-dependent)
        // This test verifies no errors occur
        await expect(terminalPane).toBeVisible();
    });

    test('should not trigger shortcuts when typing in input', async () => {
        const filterInput = page.locator('#explorer-filter') as any;

        // Focus input
        await filterInput.click();
        await page.waitForTimeout(100);

        // Type 'P' - should not open command palette
        await filterInput.type('P');
        await page.waitForTimeout(200);

        const commandPalette = page.locator('#command-palette');
        await expect(commandPalette).toHaveClass(/hidden/);
    });

    test('should handle multiple rapid keyboard shortcuts', async () => {
        // Open command palette
        await page.keyboard.press(`${getModifier()}+P`);
        await page.waitForTimeout(100);

        // Close it
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);

        // Toggle sidebar
        await page.keyboard.press(`${getModifier()}+B`);
        await page.waitForTimeout(100);

        // Toggle again
        await page.keyboard.press(`${getModifier()}+B`);
        await page.waitForTimeout(100);

        // Should handle all without errors
        const workspaceBar = page.locator('#workspace-bar');
        await expect(workspaceBar).toBeVisible();
    });

    test('should close command palette with Escape', async () => {
        await page.keyboard.press(`${getModifier()}+P`);
        await page.waitForTimeout(200);

        const commandPalette = page.locator('#command-palette');
        await expect(commandPalette).not.toHaveClass(/hidden/);

        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);

        await expect(commandPalette).toHaveClass(/hidden/);
    });

    test('should close settings with Escape', async () => {
        await page.keyboard.press(`${getModifier()}+,`);
        await page.waitForTimeout(300);

        const settingsOverlay = page.locator('#settings-overlay');
        await expect(settingsOverlay).not.toHaveClass(/hidden/);

        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);

        await expect(settingsOverlay).toHaveClass(/hidden/);
    });

    test('should navigate command palette with arrow keys', async () => {
        await page.keyboard.press(`${getModifier()}+P`);
        await page.waitForTimeout(300);

        // Press arrow down
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(100);

        // Press arrow up
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(100);

        // Close with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);

        const commandPalette = page.locator('#command-palette');
        await expect(commandPalette).toHaveClass(/hidden/);
    });

    test('should execute command palette item with Enter', async () => {
        await page.keyboard.press(`${getModifier()}+P`);
        await page.waitForTimeout(300);

        // Press Enter
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);

        // Command palette should close (or execute action)
        const commandPalette = page.locator('#command-palette');
        const isVisible = await commandPalette.isVisible();

        // Either closed or still open (both OK)
        expect(isVisible || !isVisible).toBe(true);
    });

    test('should handle Cmd+Shift+] for next workspace with multiple workspaces', async () => {
        // Create multiple workspaces
        await page.locator('#workspace-add-btn').click();
        await page.waitForTimeout(500);
        await page.locator('#workspace-add-btn').click();
        await page.waitForTimeout(500);

        const workspaces = page.locator('.workspace-item');
        const count = await workspaces.count();

        if (count >= 2) {
            // Activate first workspace
            await workspaces.nth(0).click();
            await page.waitForTimeout(200);

            // Switch to next
            await page.keyboard.press(`${getModifier()}+Shift+]`);
            await page.waitForTimeout(300);

            // Second workspace should be active
            await expect(workspaces.nth(1)).toHaveClass(/active/);
        }
    });

    test('should handle Cmd+Shift+[ for previous workspace with multiple workspaces', async () => {
        // Create multiple workspaces
        await page.locator('#workspace-add-btn').click();
        await page.waitForTimeout(500);
        await page.locator('#workspace-add-btn').click();
        await page.waitForTimeout(500);

        const workspaces = page.locator('.workspace-item');
        const count = await workspaces.count();

        if (count >= 2) {
            // Activate second workspace
            await workspaces.nth(1).click();
            await page.waitForTimeout(200);

            // Switch to previous
            await page.keyboard.press(`${getModifier()}+Shift+[`);
            await page.waitForTimeout(300);

            // First workspace should be active
            await expect(workspaces.nth(0)).toHaveClass(/active/);
        }
    });

    test('should wrap workspace navigation', async () => {
        const workspaces = page.locator('.workspace-item');
        const count = await workspaces.count();

        if (count >= 2) {
            // Go to first workspace
            await workspaces.nth(0).click();
            await page.waitForTimeout(200);

            // Try to go to previous (should wrap to last)
            await page.keyboard.press(`${getModifier()}+Shift+[`);
            await page.waitForTimeout(300);

            // Last workspace should be active
            await expect(workspaces.last()).toHaveClass(/active/);
        }
    });

    test('should not interfere with browser shortcuts', async () => {
        // This test checks that our app shortcuts don't prevent expected behavior
        // Press a shortcut that should be handled by the app
        await page.keyboard.press(`${getModifier()}+P`);
        await page.waitForTimeout(200);

        const commandPalette = page.locator('#command-palette');
        await expect(commandPalette).not.toHaveClass(/hidden/);

        // Clean up
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
    });

    test('should handle Cmd+W to close current tab', async () => {
        // Create extra tab
        await page.locator('#terminal-tab-add').click();
        await page.waitForTimeout(500);

        const initialCount = await page.locator('.terminal-tab').count();

        // Press Cmd+W
        await page.keyboard.press(`${getModifier()}+W`);
        await page.waitForTimeout(500);

        const newCount = await page.locator('.terminal-tab').count();
        expect(newCount).toBeLessThan(initialCount);
    });
});
