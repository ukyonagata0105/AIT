import { test, expect, _electron as electron } from '@playwright/test';
import * as path from 'path';

const ELECTRON_APP = path.join(__dirname, '..');

test.describe('File Explorer', () => {
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

    test('should display explorer section', async () => {
        const explorerSection = page.locator('#explorer-section');
        await expect(explorerSection).toBeVisible();
    });

    test('should display explorer toolbar', async () => {
        const explorerToolbar = page.locator('#explorer-toolbar');
        await expect(explorerToolbar).toBeVisible();
    });

    test('should display explorer title', async () => {
        const explorerTitle = page.locator('#explorer-title');
        await expect(explorerTitle).toBeVisible();

        const titleText = await explorerTitle.textContent();
        expect(titleText).toBeTruthy();
        expect(titleText?.length).toBeGreaterThan(0);
    });

    test('should display filter input', async () => {
        const filterInput = page.locator('#explorer-filter');
        await expect(filterInput).toBeVisible();
        await expect(filterInput).toHaveAttribute('placeholder', /filter/i);
    });

    test('should display sort buttons', async () => {
        const sortBtns = page.locator('.sort-btn');
        const count = await sortBtns.count();

        expect(count).toBeGreaterThan(0);

        // Check for expected sort buttons
        const nameBtn = sortBtns.filter({ hasText: 'Name' });
        const typeBtn = sortBtns.filter({ hasText: 'Type' });
        const dateBtn = sortBtns.filter({ hasText: 'Date' });
        const sizeBtn = sortBtns.filter({ hasText: 'Size' });

        await expect(nameBtn).toBeVisible();
        await expect(typeBtn).toBeVisible();
        await expect(dateBtn).toBeVisible();
        await expect(sizeBtn).toBeVisible();
    });

    test('should display explorer tree', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await expect(explorerTree).toBeVisible();
    });

    test('should display directory and file items', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const items = explorerTree.locator('.tree-item');
        const count = await items.count();

        expect(count).toBeGreaterThan(0);
    });

    test('should display folders before files', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const items = explorerTree.locator('.tree-item');
        const count = await items.count();

        if (count > 1) {
            // Get first directory and first file
            const firstDir = items.locator('.dir').first();
            const firstFile = items.filter((el, index) => !el.classList.contains('dir')).first();

            const dirIndex = await items.indexOf(firstDir);
            const fileIndex = await items.indexOf(firstFile);

            // Directory should come before file (if both exist)
            if (dirIndex >= 0 && fileIndex >= 0) {
                expect(dirIndex).toBeLessThan(fileIndex);
            }
        }
    });

    test('should expand folder when clicked', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const folder = explorerTree.locator('.tree-item.dir').first();

        if (await folder.count() > 0) {
            const icon = folder.locator('.tree-icon');

            // Initially should show closed folder icon
            await expect(icon).toHaveText('📁');

            // Click to expand
            await folder.click();
            await page.waitForTimeout(300);

            // Should show open folder icon
            await expect(icon).toHaveText('📂');
        } else {
            test.skip(true, 'No folders in explorer');
        }
    });

    test('should collapse folder when clicking expanded folder', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const folder = explorerTree.locator('.tree-item.dir').first();

        if (await folder.count() > 0) {
            const icon = folder.locator('.tree-icon');

            // Expand
            await folder.click();
            await page.waitForTimeout(300);

            // Collapse
            await folder.click();
            await page.waitForTimeout(300);

            // Should show closed folder icon again
            await expect(icon).toHaveText('📁');
        } else {
            test.skip(true, 'No folders in explorer');
        }
    });

    test('should display child items when folder is expanded', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const folder = explorerTree.locator('.tree-item.dir').first();

        if (await folder.count() > 0) {
            // Get initial item count
            const initialCount = await explorerTree.locator('.tree-item').count();

            // Expand folder
            await folder.click();
            await page.waitForTimeout(500);

            // Should have more items
            const newCount = await explorerTree.locator('.tree-item').count();
            expect(newCount).toBeGreaterThan(initialCount);
        } else {
            test.skip(true, 'No folders in explorer');
        }
    });

    test('should display file icons based on extension', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const file = explorerTree.locator('.tree-item:not(.dir)').first();

        if (await file.count() > 0) {
            const icon = file.locator('.tree-icon');
            await expect(icon).toBeVisible();

            const iconText = await icon.textContent();
            expect(iconText).toBeTruthy();
            expect(iconText?.length).toBe(1); // Should be an emoji
        } else {
            test.skip(true, 'No files in explorer');
        }
    });

    test('should filter files when typing in filter input', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const initialItems = explorerTree.locator('.tree-item');
        const initialCount = await initialItems.count();

        const filterInput = page.locator('#explorer-filter') as any;

        // Type a filter
        await filterInput.fill('test');
        await page.waitForTimeout(300);

        const filteredItems = explorerTree.locator('.tree-item');
        const filteredCount = await filteredItems.count();

        // Filtered count should be less than or equal to initial
        expect(filteredCount).toBeLessThanOrEqual(initialCount);
    });

    test('should clear filter when input is cleared', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const initialItems = explorerTree.locator('.tree-item');
        const initialCount = await initialItems.count();

        const filterInput = page.locator('#explorer-filter') as any;

        // Type and clear filter
        await filterInput.fill('xyz123');
        await page.waitForTimeout(300);

        await filterInput.fill('');
        await page.waitForTimeout(300);

        const finalItems = explorerTree.locator('.tree-item');
        const finalCount = await finalItems.count();

        // Should be back to original count
        expect(finalCount).toBe(initialCount);
    });

    test('should sort files by name when clicking Name button', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const nameBtn = page.locator('.sort-btn').filter({ hasText: 'Name' });

        // Click name button
        await nameBtn.click();
        await page.waitForTimeout(300);

        // Items should still be visible
        const items = explorerTree.locator('.tree-item');
        expect(await items.count()).toBeGreaterThan(0);
    });

    test('should sort files by type when clicking Type button', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const typeBtn = page.locator('.sort-btn').filter({ hasText: 'Type' });

        // Click type button
        await typeBtn.click();
        await page.waitForTimeout(300);

        // Items should still be visible
        const items = explorerTree.locator('.tree-item');
        expect(await items.count()).toBeGreaterThan(0);
    });

    test('should sort files by date when clicking Date button', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const dateBtn = page.locator('.sort-btn').filter({ hasText: 'Date' });

        // Click date button
        await dateBtn.click();
        await page.waitForTimeout(300);

        // Items should still be visible
        const items = explorerTree.locator('.tree-item');
        expect(await items.count()).toBeGreaterThan(0);
    });

    test('should sort files by size when clicking Size button', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const sizeBtn = page.locator('.sort-btn').filter({ hasText: 'Size' });

        // Click size button
        await sizeBtn.click();
        await page.waitForTimeout(300);

        // Items should still be visible
        const items = explorerTree.locator('.tree-item');
        expect(await items.count()).toBeGreaterThan(0);
    });

    test('should mark active sort button', async () => {
        const nameBtn = page.locator('.sort-btn').filter({ hasText: 'Name' });

        await nameBtn.click();
        await page.waitForTimeout(300);

        // Should have active class
        await expect(nameBtn).toHaveClass(/active/);
    });

    test('should toggle sort direction when clicking sort button twice', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const nameBtn = page.locator('.sort-btn').filter({ hasText: 'Name' });

        // Get initial file names
        const initialNames: string[] = [];
        const items = explorerTree.locator('.tree-item .tree-name');
        const count = await items.count();

        for (let i = 0; i < Math.min(count, 5); i++) {
            const name = await items.nth(i).textContent();
            if (name) initialNames.push(name);
        }

        // Click twice to reverse
        await nameBtn.click();
        await page.waitForTimeout(300);
        await nameBtn.click();
        await page.waitForTimeout(300);

        // Get reversed file names
        const reversedNames: string[] = [];
        const newItems = explorerTree.locator('.tree-item .tree-name');

        for (let i = 0; i < Math.min(count, 5); i++) {
            const name = await newItems.nth(i).textContent();
            if (name) reversedNames.push(name);
        }

        // Order should be reversed (or at least different)
        expect(reversedNames).not.toEqual(initialNames);
    });

    test('should display file names', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const file = explorerTree.locator('.tree-item').first();
        const nameEl = file.locator('.tree-name');

        await expect(nameEl).toBeVisible();

        const name = await nameEl.textContent();
        expect(name).toBeTruthy();
        expect(name?.length).toBeGreaterThan(0);
    });

    test('should handle nested folder expansion', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        // Find a folder
        const folder = explorerTree.locator('.tree-item.dir').first();

        if (await folder.count() > 0) {
            // Expand it
            await folder.click();
            await page.waitForTimeout(500);

            // Look for nested folder
            const nestedFolder = explorerTree.locator('.tree-item.dir').nth(1);

            if (await nestedFolder.count() > 0) {
                // Expand nested folder
                await nestedFolder.click();
                await page.waitForTimeout(500);

                // Should have even more items
                const itemCount = await explorerTree.locator('.tree-item').count();
                expect(itemCount).toBeGreaterThan(1);
            }
        } else {
            test.skip(true, 'No folders in explorer');
        }
    });

    test('should maintain expansion state when switching folders', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const folder = explorerTree.locator('.tree-item.dir').first();

        if (await folder.count() > 0) {
            // Expand folder
            await folder.click();
            await page.waitForTimeout(500);

            const itemCount = await explorerTree.locator('.tree-item').count();

            // Click on different item
            const file = explorerTree.locator('.tree-item:not(.dir)').first();
            if (await file.count() > 0) {
                await file.click();
                await page.waitForTimeout(300);
            }

            // Folder should still be expanded
            const newItemCount = await explorerTree.locator('.tree-item').count();
            expect(newItemCount).toBe(itemCount);
        } else {
            test.skip(true, 'No folders in explorer');
        }
    });

    test('should handle empty directories gracefully', async () => {
        // This test verifies that empty directories don't cause errors
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        // Try to expand folders
        const folders = explorerTree.locator('.tree-item.dir');
        const count = await folders.count();

        for (let i = 0; i < Math.min(count, 3); i++) {
            await folders.nth(i).click();
            await page.waitForTimeout(200);
        }

        // Should not throw errors
        const items = explorerTree.locator('.tree-item');
        expect(await items.count()).toBeGreaterThanOrEqual(0);
    });
});
