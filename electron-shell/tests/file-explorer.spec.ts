import { test, expect } from '@playwright/test';
import { cleanupTestContext, launchWithFixtures, TestContext } from './test-fixtures';

test.describe('File Explorer', () => {
    let context: TestContext | null = null;

    test.beforeEach(async () => {
        context = await launchWithFixtures(1);
    });

    test.afterEach(async () => {
        await cleanupTestContext(context);
        context = null;
    });

    test('renders the explorer controls for the active workspace', async () => {
        const page = context!.page;

        await expect(page.locator('#explorer-tree')).toBeVisible();
        await expect(page.locator('#explorer-filter')).toBeVisible();
        await expect(page.locator('.sort-btn').filter({ hasText: 'Name' })).toBeVisible();
        await expect(page.locator('.sort-btn').filter({ hasText: 'Type' })).toBeVisible();
        await expect(page.locator('.sort-btn').filter({ hasText: 'Date' })).toBeVisible();
        await expect(page.locator('.sort-btn').filter({ hasText: 'Size' })).toBeVisible();
    });

    test('shows seeded directories and files', async () => {
        const page = context!.page;
        const explorerTree = page.locator('#explorer-tree');

        await expect(explorerTree.locator('.tree-item')).toHaveCount(3);
        await expect(explorerTree).toContainText('src');
        await expect(explorerTree).toContainText('docs');
        await expect(explorerTree).toContainText('README.md');
    });

    test('expands a directory when clicked', async () => {
        const page = context!.page;
        const srcFolder = page.locator('.tree-item.dir').filter({ hasText: 'src' }).first();
        const explorerTree = page.locator('#explorer-tree');

        await srcFolder.click();

        await expect(explorerTree).toContainText('sample-1.ts');
    });

    test('filters the explorer tree', async () => {
        const page = context!.page;
        const explorerTree = page.locator('#explorer-tree');
        const filterInput = page.locator('#explorer-filter');

        await filterInput.fill('readme');

        await expect(explorerTree).toContainText('README.md');
        await expect(explorerTree).not.toContainText('docs');
    });

    test('opens a file into the viewer when clicked', async () => {
        const page = context!.page;
        const readme = page.locator('.tree-item').filter({ hasText: 'README.md' }).first();

        await readme.click();

        await expect(page.locator('#viewer-filepath')).not.toHaveText('No file open');
        await expect(page.locator('#viewer-content')).toContainText('Fixture workspace 1.');
    });
});
