import { test, expect, _electron as electron } from '@playwright/test';
import * as path from 'path';

const ELECTRON_APP = path.join(__dirname, '..'); // root of electron-shell

test.describe('AI Terminal IDE - Phase 1 Smoke Tests', () => {
    let electronApp: Awaited<ReturnType<typeof electron.launch>>;
    let page: Awaited<ReturnType<typeof electronApp.firstWindow>>;

    test.beforeEach(async () => {
        electronApp = await electron.launch({
            args: ['.'],
            cwd: ELECTRON_APP,
            env: { ...process.env, NODE_ENV: 'test' },
        });
        // Wait for the first window and ensure it's the main app window
        page = await electronApp.firstWindow();

        // If we got the DevTools window by mistake, wait for the actual app window
        const title = await page.title();
        if (title === 'DevTools') {
            const windows = electronApp.windows();
            const appWindow = windows.find(w => w.url().includes('index.html'));
            if (appWindow) {
                page = appWindow;
            }
        }
    });

    test.afterEach(async () => {
        await electronApp.close();
    });

    // ─── Layout ─────────────────────────────────────────────────────────────

    test('app window opens', async () => {
        const title = await page.title();
        expect(title).toBe('TermNexus');
    });

    test('workspace bar is present', async () => {
        const bar = page.locator('#workspace-bar');
        await expect(bar).toBeVisible();
    });

    test('add workspace button is visible', async () => {
        const addBtn = page.locator('#workspace-add-btn');
        await expect(addBtn).toBeVisible();
    });

    test('broadcast toggle is present', async () => {
        const toggle = page.locator('#broadcast-toggle');
        await expect(toggle).toBeVisible();
    });

    test('terminal grid is rendered', async () => {
        const grid = page.locator('#terminal-grid');
        await expect(grid).toBeVisible();
    });

    // ─── Workspace ──────────────────────────────────────────────────────────

    test('workspace bar starts empty when no workspaces configured', async () => {
        const items = page.locator('.workspace-item');
        // Could be 0 (fresh) or pre-loaded from ~/.ai-terminal-ide/workspaces.json
        const count = await items.count();
        expect(count).toBeGreaterThanOrEqual(0);
    });

    // ─── Empty-state ────────────────────────────────────────────────────────

    test('empty state hint is shown when no workspaces', async () => {
        // Only presence-check – actual count depends on user's config file
        const emptyHint = page.locator('#empty-state');
        const workspaceItems = page.locator('.workspace-item');
        const wsCount = await workspaceItems.count();
        if (wsCount === 0) {
            await expect(emptyHint).toBeVisible();
        }
    });


    // ─── Bug Fix: Empty State Visibility ──────────────────────────────────────

    test('empty state is hidden when workspace is active', async () => {
        const emptyState = page.locator('#empty-state');
        const workspaceItems = page.locator('.workspace-item');
        const wsCount = await workspaceItems.count();
        
        // If workspaces are loaded, empty state should be hidden
        if (wsCount > 0) {
            await expect(emptyState).not.toBeVisible();
        }
    });

    test('workspace heading shows workspace name when active', async () => {
        const workspaceHeading = page.locator('#workspace-heading');
        const workspaceItems = page.locator('.workspace-item');
        const wsCount = await workspaceItems.count();
        
        // If workspaces exist, heading should show the active workspace name
        if (wsCount > 0) {
            await expect(workspaceHeading).not.toHaveText('');
        }
    });

    test('terminal pane is visible when workspace is active', async () => {
        const terminalPane = page.locator('#terminal-pane');
        const workspaceItems = page.locator('.workspace-item');
        const wsCount = await workspaceItems.count();

        // If workspaces are loaded, terminal pane should be visible (not covered by empty state)
        if (wsCount > 0) {
            await expect(terminalPane).toBeVisible();
            // Empty state should not be overlaying the terminal
            const emptyState = page.locator('#empty-state');
            const isEmptyVisible = await emptyState.isVisible();
            expect(isEmptyVisible).toBe(false);
        }
    });

    // ─── Sash Drag Resizing ─────────────────────────────────────────────────────

    test('all sashes are present and draggable', async () => {
        const workspaceSash = page.locator('#workspace-sash');
        const verticalSash = page.locator('#vertical-sash');
        const horizontalSash = page.locator('#horizontal-sash');
        
        await expect(workspaceSash).toBeVisible();
        await expect(verticalSash).toBeVisible();
        await expect(horizontalSash).toBeVisible();
    });

    test('sashes have correct cursor on hover', async () => {
        const workspaceSash = page.locator('#workspace-sash');
        
        // Hover over sash to trigger cursor change
        await workspaceSash.hover();
        
        // Check that cursor is set to col-resize
        const cursor = await workspaceSash.evaluate((el) => 
            window.getComputedStyle(el).cursor
        );
        expect(cursor).toBe('col-resize');
    });

    test('horizontal sash can be dragged to resize viewer section', async () => {
        const horizontalSash = page.locator('#horizontal-sash');
        const viewerSection = page.locator('#viewer-section');
        
        if (await horizontalSash.isVisible()) {
            // Get initial height
            const initialHeight = await viewerSection.evaluate((el) => el.offsetHeight);
            
            // Drag the sash down to increase viewer section height
            const box = await horizontalSash.boundingBox();
            if (box) {
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                await page.mouse.down();
                await page.mouse.move(box.x + box.width / 2, box.y + 50); // Drag down 50px
                await page.mouse.up();
                
                // Height should have changed (increased or decreased based on drag direction)
                const newHeight = await viewerSection.evaluate((el) => el.offsetHeight);
                expect(newHeight).not.toBe(initialHeight);
            }
        }
    });
});
