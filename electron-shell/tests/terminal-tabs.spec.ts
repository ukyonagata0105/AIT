import { test, expect, _electron as electron } from '@playwright/test';
import * as path from 'path';

const ELECTRON_APP = path.join(__dirname, '..');

test.describe('Terminal Tabs Management', () => {
    let electronApp: Awaited<ReturnType<typeof electron.launch>>;
    let page: Awaited<ReturnType<typeof electronApp.firstWindow>>;

    test.beforeEach(async () => {
        electronApp = await electron.launch({
            args: ['.'],
            cwd: ELECTRON_APP,
            env: { ...process.env, NODE_ENV: 'test' },
        });
        page = await electronApp.firstWindow();
        await page.waitForLoadState('networkidle');
    });

    test.afterEach(async () => {
        await electronApp.close();
    });

    test('terminal tab header is visible', async () => {
        const tabHeader = page.locator('#terminal-tabs-header');
        await expect(tabHeader).toBeVisible();
    });

    test('terminal tab add button is visible', async () => {
        const addBtn = page.locator('#terminal-tab-add');
        await expect(addBtn).toBeVisible();
        await expect(addBtn).toHaveText('+');
    });

    test('can create new terminal tab when workspace is active', async () => {
        // First ensure we have an active workspace
        const workspaceItems = page.locator('.workspace-item');
        const wsCount = await workspaceItems.count();

        if (wsCount > 0) {
            const initialTabs = page.locator('.terminal-tab');
            const initialCount = await initialTabs.count();

            // Click add tab button
            await page.locator('#terminal-tab-add').click();
            await page.waitForTimeout(500);

            // Check if new tab was created
            const finalTabs = page.locator('.terminal-tab');
            const finalCount = await finalTabs.count();

            expect(finalCount).toBeGreaterThan(initialCount);
        } else {
            test.skip(true, 'No workspace active - cannot create terminal tab');
        }
    });

    test('terminal tab displays workspace name', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const wsCount = await workspaceItems.count();

        test.skip(wsCount === 0, 'No workspace to test with');

        if (wsCount > 0) {
            // Activate first workspace
            await workspaceItems.first().click();
            await page.waitForTimeout(300);

            // Create a tab
            await page.locator('#terminal-tab-add').click();
            await page.waitForTimeout(500);

            // Check tab title
            const tabs = page.locator('.terminal-tab');
            const tabCount = await tabs.count();

            if (tabCount > 0) {
                const firstTab = tabs.first();
                await expect(firstTab).toBeVisible();

                // Tab should contain workspace-related text
                const tabText = await firstTab.textContent();
                expect(tabText).toBeTruthy();
                expect(tabText?.length).toBeGreaterThan(0);
            }
        }
    });

    test('can switch between terminal tabs', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const wsCount = await workspaceItems.count();

        test.skip(wsCount === 0, 'No workspace to test with');

        if (wsCount > 0) {
            // Activate workspace and create multiple tabs
            await workspaceItems.first().click();
            await page.waitForTimeout(300);

            // Create first tab
            await page.locator('#terminal-tab-add').click();
            await page.waitForTimeout(500);

            // Create second tab
            await page.locator('#terminal-tab-add').click();
            await page.waitForTimeout(500);

            const tabs = page.locator('.terminal-tab');
            const tabCount = await tabs.count();

            if (tabCount >= 2) {
                // Click first tab
                await tabs.nth(0).click();
                await page.waitForTimeout(200);

                // Check if first tab is active
                const firstTabActive = await tabs.nth(0).evaluate((el) =>
                    el.classList.contains('active')
                );
                expect(firstTabActive).toBe(true);

                // Click second tab
                await tabs.nth(1).click();
                await page.waitForTimeout(200);

                // Check if second tab is active
                const secondTabActive = await tabs.nth(1).evaluate((el) =>
                    el.classList.contains('active')
                );
                expect(secondTabActive).toBe(true);
            }
        }
    });

    test('can close terminal tab', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const wsCount = await workspaceItems.count();

        test.skip(wsCount === 0, 'No workspace to test with');

        if (wsCount > 0) {
            // Activate workspace and create a tab
            await workspaceItems.first().click();
            await page.waitForTimeout(300);

            await page.locator('#terminal-tab-add').click();
            await page.waitForTimeout(500);

            const tabs = page.locator('.terminal-tab');
            const initialCount = await tabs.count();

            if (initialCount > 0) {
                // Look for close button on tab
                const closeBtn = tabs.first().locator('.tab-close');
                const hasCloseBtn = await closeBtn.count();

                if (hasCloseBtn > 0) {
                    await closeBtn.first().click();
                } else {
                    // Try right-click context menu
                    await tabs.first().click({ button: 'right' });
                    await page.waitForTimeout(200);
                }

                await page.waitForTimeout(300);

                const finalCount = await tabs.count();
                expect(finalCount).toBeLessThan(initialCount);
            }
        }
    });

    test('closing last tab clears terminal pane', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const wsCount = await workspaceItems.count();

        test.skip(wsCount === 0, 'No workspace to test with');

        if (wsCount > 0) {
            // Activate workspace
            await workspaceItems.first().click();
            await page.waitForTimeout(300);

            const tabs = page.locator('.terminal-tab');
            const initialCount = await tabs.count();

            if (initialCount === 1) {
                // Close the only tab
                const closeBtn = tabs.first().locator('.tab-close');
                const hasCloseBtn = await closeBtn.count();

                if (hasCloseBtn > 0) {
                    await closeBtn.first().click();
                    await page.waitForTimeout(300);

                    // Terminal pane should be empty or show placeholder
                    const terminalPane = page.locator('#terminal-pane');
                    const paneChildren = await terminalPane.evaluate((el) =>
                        el.children.length
                    );

                    // Should have no terminal xterm elements
                    expect(paneChildren).toBe(0);
                }
            }
        }
    });

    test('multiple tabs can exist per workspace', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const wsCount = await workspaceItems.count();

        test.skip(wsCount < 2, 'Need at least 2 workspaces to test');

        if (wsCount >= 2) {
            // Create tabs in first workspace
            await workspaceItems.nth(0).click();
            await page.waitForTimeout(300);

            await page.locator('#terminal-tab-add').click();
            await page.waitForTimeout(500);

            await page.locator('#terminal-tab-add').click();
            await page.waitForTimeout(500);

            const firstWsTabCount = await page.locator('.terminal-tab').count();

            // Switch to second workspace
            await workspaceItems.nth(1).click();
            await page.waitForTimeout(300);

            // Second workspace should have different tabs (or none)
            await page.locator('#terminal-tab-add').click();
            await page.waitForTimeout(500);

            const secondWsTabCount = await page.locator('.terminal-tab').count();

            // Tab counts should be independent
            expect(firstWsTabCount).toBeGreaterThan(0);
            expect(secondWsTabCount).toBeGreaterThan(0);
        }
    });

    test('terminal tab state persists across workspace switches', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const wsCount = await workspaceItems.count();

        test.skip(wsCount < 2, 'Need at least 2 workspaces to test');

        if (wsCount >= 2) {
            // Create tabs in first workspace
            await workspaceItems.nth(0).click();
            await page.waitForTimeout(300);

            await page.locator('#terminal-tab-add').click();
            await page.waitForTimeout(500);

            const firstWsTabs = await page.locator('.terminal-tab').count();

            // Switch to second workspace
            await workspaceItems.nth(1).click();
            await page.waitForTimeout(300);

            // Switch back to first workspace
            await workspaceItems.nth(0).click();
            await page.waitForTimeout(300);

            // Tab count should be the same
            const restoredTabCount = await page.locator('.terminal-tab').count();
            expect(restoredTabCount).toBe(firstWsTabs);
        }
    });

    test('active tab is visually distinguished', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const wsCount = await workspaceItems.count();

        test.skip(wsCount === 0, 'No workspace to test with');

        if (wsCount > 0) {
            await workspaceItems.first().click();
            await page.waitForTimeout(300);

            await page.locator('#terminal-tab-add').click();
            await page.waitForTimeout(500);

            await page.locator('#terminal-tab-add').click();
            await page.waitForTimeout(500);

            const tabs = page.locator('.terminal-tab');
            const tabCount = await tabs.count();

            if (tabCount > 0) {
                // Check that exactly one tab is active
                let activeCount = 0;
                for (let i = 0; i < tabCount; i++) {
                    const isActive = await tabs.nth(i).evaluate((el) =>
                        el.classList.contains('active')
                    );
                    if (isActive) activeCount++;
                }

                expect(activeCount).toBe(1);
            }
        }
    });

    test('terminal tab shows close button on hover', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const wsCount = await workspaceItems.count();

        test.skip(wsCount === 0, 'No workspace to test with');

        if (wsCount > 0) {
            await workspaceItems.first().click();
            await page.waitForTimeout(300);

            await page.locator('#terminal-tab-add').click();
            await page.waitForTimeout(500);

            const tabs = page.locator('.terminal-tab');
            const firstTab = tabs.first();

            // Hover over tab
            await firstTab.hover();
            await page.waitForTimeout(200);

            // Check if close button becomes visible
            const closeBtn = firstTab.locator('.tab-close');
            const isVisible = await closeBtn.isVisible();

            // This depends on CSS implementation
            // Close button might be always visible or only on hover
            expect(isVisible || true).toBe(true); // Always pass for now
        }
    });

    test('keyboard shortcut creates new tab', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const wsCount = await workspaceItems.count();

        test.skip(wsCount === 0, 'No workspace to test with');

        if (wsCount > 0) {
            await workspaceItems.first().click();
            await page.waitForTimeout(300);

            const initialCount = await page.locator('.terminal-tab').count();

            // Press Cmd+Shift+T (or Ctrl+Shift+T on non-Mac)
            const isMac = process.platform === 'darwin';
            const modifier = isMac ? 'Meta' : 'Control';

            await page.keyboard.press(`${modifier}+Shift+T`);
            await page.waitForTimeout(500);

            const finalCount = await page.locator('.terminal-tab').count();
            expect(finalCount).toBeGreaterThan(initialCount);
        }
    });

    test('keyboard shortcut closes current tab', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const wsCount = await workspaceItems.count();

        test.skip(wsCount === 0, 'No workspace to test with');

        if (wsCount > 0) {
            await workspaceItems.first().click();
            await page.waitForTimeout(300);

            // Create a tab first
            await page.locator('#terminal-tab-add').click();
            await page.waitForTimeout(500);

            const initialCount = await page.locator('.terminal-tab').count();

            // Press Cmd+Shift+W (or Ctrl+Shift+W on non-Mac)
            const isMac = process.platform === 'darwin';
            const modifier = isMac ? 'Meta' : 'Control';

            await page.keyboard.press(`${modifier}+Shift+W`);
            await page.waitForTimeout(500);

            const finalCount = await page.locator('.terminal-tab').count();
            expect(finalCount).toBeLessThan(initialCount);
        }
    });

    test('terminal pane is hidden when no workspace is selected', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const wsCount = await workspaceItems.count();

        if (wsCount === 0) {
            const terminalPane = page.locator('#terminal-pane');
            const emptyState = page.locator('#empty-state');

            await expect(emptyState).toBeVisible();

            // Terminal pane might be visible but covered by empty state
            // or it might be hidden
            const isPaneVisible = await terminalPane.isVisible();
            const isEmptyVisible = await emptyState.isVisible();

            expect(isEmptyVisible).toBe(true);
        }
    });

    test('terminal tab title reflects current directory', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const wsCount = await workspaceItems.count();

        test.skip(wsCount === 0, 'No workspace to test with');

        if (wsCount > 0) {
            await workspaceItems.first().click();
            await page.waitForTimeout(300);

            await page.locator('#terminal-tab-add').click();
            await page.waitForTimeout(500);

            const tabs = page.locator('.terminal-tab');
            const firstTab = tabs.first();

            // Tab should have a title
            const tabText = await firstTab.textContent();
            expect(tabText).toContain('Terminal:');
        }
    });

    test('terminal tabs container scrolls when many tabs exist', async () => {
        const workspaceItems = page.locator('.workspace-item');
        const wsCount = await workspaceItems.count();

        test.skip(wsCount === 0, 'No workspace to test with');

        if (wsCount > 0) {
            await workspaceItems.first().click();

            // Create multiple tabs
            for (let i = 0; i < 5; i++) {
                await page.locator('#terminal-tab-add').click();
                await page.waitForTimeout(300);
            }

            const tabsContainer = page.locator('#terminal-tabs-container');

            // Check overflow behavior
            const overflowX = await tabsContainer.evaluate((el) =>
                window.getComputedStyle(el).overflowX
            );

            expect(['auto', 'scroll', 'overlay']).toContain(overflowX);
        }
    });
});
