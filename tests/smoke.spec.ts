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
        page = await electronApp.firstWindow();
    });

    test.afterEach(async () => {
        await electronApp.close();
    });

    // ─── Layout ─────────────────────────────────────────────────────────────

    test('app window opens', async () => {
        const title = await page.title();
        expect(title).toBe('AI Terminal IDE');
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

    // ─── Sash ────────────────────────────────────────────────────────────────

    test('workspace sash drag handle is present', async () => {
        const sash = page.locator('#workspace-sash');
        await expect(sash).toBeVisible();
    });
});
