import { test, expect } from '@playwright/test';
import { cleanupTestContext, launchWithFixtures, TestContext } from './test-fixtures';

test.describe('File Viewer', () => {
    let context: TestContext | null = null;

    test.beforeEach(async () => {
        context = await launchWithFixtures(1);
    });

    test.afterEach(async () => {
        await cleanupTestContext(context);
        context = null;
    });

    test('shows the default viewer placeholder before a file is opened', async () => {
        const page = context!.page;

        await expect(page.locator('#viewer-toolbar')).toBeVisible();
        await expect(page.locator('#viewer-filepath')).toHaveText('No file open');
        await expect(page.locator('#viewer-content')).toContainText('File Viewer');
    });

    test('updates the viewer toolbar when opening a markdown file', async () => {
        const page = context!.page;
        const readme = page.locator('.tree-item').filter({ hasText: 'README.md' }).first();

        await readme.click();

        await expect(page.locator('#viewer-filepath')).toContainText('README.md');
        await expect(page.locator('#viewer-content')).toContainText('Fixture workspace 1.');
    });

    test('opens nested source files after expanding the directory', async () => {
        const page = context!.page;
        const srcFolder = page.locator('.tree-item.dir').filter({ hasText: 'src' }).first();

        await srcFolder.click();
        await page.locator('.tree-item').filter({ hasText: 'sample-1.ts' }).first().click();

        await expect(page.locator('#viewer-filepath')).toContainText('sample-1.ts');
        await expect(page.locator('#viewer-content')).toContainText('export const value1 = 1;');
    });

    test('keeps the viewer usable after switching between files', async () => {
        const page = context!.page;
        const readme = page.locator('.tree-item').filter({ hasText: 'README.md' }).first();
        const docsFolder = page.locator('.tree-item.dir').filter({ hasText: 'docs' }).first();

        await readme.click();
        await docsFolder.click();
        await page.locator('.tree-item').filter({ hasText: 'notes-1.md' }).first().click();

        await expect(page.locator('#viewer-filepath')).toContainText('notes-1.md');
        await expect(page.locator('#viewer-content')).toContainText('workspace 1 notes');
    });
});
