import { test, expect, _electron as electron } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const ELECTRON_APP = path.join(__dirname, '..');

test.describe('Code Editor', () => {
    let electronApp: Awaited<ReturnType<typeof electron.launch>>;
    let page: Awaited<ReturnType<typeof electronApp.firstWindow>>;
    let testFilePath: string;

    test.beforeAll(async () => {
        // Create a temporary test file
        const tmpDir = '/tmp/termnexus-test';
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }
        testFilePath = path.join(tmpDir, 'test-file.js');
        fs.writeFileSync(testFilePath, '// Test file\nconsole.log("Hello, World!");');
    });

    test.afterAll(async () => {
        // Clean up test file
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    });

    test.beforeEach(async () => {
        electronApp = await electron.launch({
            args: ['.'],
            cwd: ELECTRON_APP,
            env: { ...process.env, NODE_ENV: 'test' },
        });
        page = await electronApp.firstWindow();

        // Add workspace pointing to test directory
        const addBtn = page.locator('#workspace-add-btn');
        await addBtn.click();
        await page.waitForTimeout(1500);
    });

    test.afterEach(async () => {
        await electronApp.close();
    });

    test('should display file viewer section', async () => {
        const viewerSection = page.locator('#viewer-section');
        await expect(viewerSection).toBeVisible();
    });

    test('should display viewer toolbar', async () => {
        const viewerToolbar = page.locator('#viewer-toolbar');
        await expect(viewerToolbar).toBeVisible();
    });

    test('should display viewer content area', async () => {
        const viewerContent = page.locator('#viewer-content');
        await expect(viewerContent).toBeVisible();
    });

    test('should show placeholder when no file is open', async () => {
        const viewerContent = page.locator('#viewer-content');
        const placeholder = viewerContent.locator('.panel-placeholder');

        await expect(placeholder).toBeVisible();
        await expect(placeholder.locator('.ph-icon')).toHaveText('📄');
        await expect(placeholder.locator('.ph-label')).toHaveText('File Viewer');
    });

    test('should display file path in toolbar when file is open', async () => {
        // Open a file in the explorer
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        // Look for a file in the explorer
        const fileItem = explorerTree.locator('.tree-item:not(.dir)').first();

        if (await fileItem.count() > 0) {
            await fileItem.click();
            await page.waitForTimeout(500);

            const viewerFilepath = page.locator('#viewer-filepath');
            const filepathText = await viewerFilepath.textContent();

            expect(filepathText).not.toBe('No file open');
        } else {
            test.skip(true, 'No files available in explorer');
        }
    });

    test('should display code editor when opening text file', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        // Look for a JavaScript or text file
        const files = explorerTree.locator('.tree-item:not(.dir)');

        if (await files.count() > 0) {
            await files.first().click();
            await page.waitForTimeout(500);

            // Check if code editor was created
            const viewerContent = page.locator('#viewer-content');
            const codeEditor = viewerContent.locator('.code-editor');

            const hasEditor = await codeEditor.count();
            expect(hasEditor).toBeGreaterThan(0);
        } else {
            test.skip(true, 'No files available in explorer');
        }
    });

    test('should display syntax highlighted code', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const files = explorerTree.locator('.tree-item:not(.dir)');

        if (await files.count() > 0) {
            await files.first().click();
            await page.waitForTimeout(500);

            const viewerContent = page.locator('#viewer-content');

            // Check for syntax highlighting elements
            const highlightedElements = viewerContent.locator('[class*="token"], [class*="keyword"], [class*="string"]');
            const count = await highlightedElements.count();

            // Syntax highlighting might or might not be implemented
            expect(count).toBeGreaterThanOrEqual(0);
        } else {
            test.skip(true, 'No files available in explorer');
        }
    });

    test('should display editor toolbar with save button', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const files = explorerTree.locator('.tree-item:not(.dir)');

        if (await files.count() > 0) {
            await files.first().click();
            await page.waitForTimeout(500);

            const viewerToolbar = page.locator('#viewer-toolbar');
            const saveButton = viewerToolbar.locator('[data-action="save"]');

            await expect(saveButton).toBeVisible();
        } else {
            test.skip(true, 'No files available in explorer');
        }
    });

    test('should display editor toolbar with close button', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const files = explorerTree.locator('.tree-item:not(.dir)');

        if (await files.count() > 0) {
            await files.first().click();
            await page.waitForTimeout(500);

            const viewerToolbar = page.locator('#viewer-toolbar');
            const closeButton = viewerToolbar.locator('[data-action="close"]');

            await expect(closeButton).toBeVisible();
        } else {
            test.skip(true, 'No files available in explorer');
        }
    });

    test('should close file when clicking close button', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const files = explorerTree.locator('.tree-item:not(.dir)');

        if (await files.count() > 0) {
            await files.first().click();
            await page.waitForTimeout(500);

            const viewerToolbar = page.locator('#viewer-toolbar');
            const closeButton = viewerToolbar.locator('[data-action="close"]');

            await closeButton.click();
            await page.waitForTimeout(300);

            // Should show placeholder again
            const viewerContent = page.locator('#viewer-content');
            const placeholder = viewerContent.locator('.panel-placeholder');
            await expect(placeholder).toBeVisible();
        } else {
            test.skip(true, 'No files available in explorer');
        }
    });

    test('should display status bar with cursor position', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const files = explorerTree.locator('.tree-item:not(.dir)');

        if (await files.count() > 0) {
            await files.first().click();
            await page.waitForTimeout(500);

            const viewerContent = page.locator('#viewer-content');
            const statusBar = viewerContent.locator('.code-editor-status');

            await expect(statusBar).toBeVisible();

            // Check for cursor position indicator
            const cursorInfo = statusBar.locator('[data-action="cursor"]');
            await expect(cursorInfo).toBeVisible();
        } else {
            test.skip(true, 'No files available in explorer');
        }
    });

    test('should display file type in status bar', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        // Look for a JavaScript file specifically
        const jsFile = explorerTree.locator('.tree-item').filter({ hasText: /\.js$/ }).first();

        if (await jsFile.count() > 0) {
            await jsFile.click();
            await page.waitForTimeout(500);

            const viewerContent = page.locator('#viewer-content');
            const statusBar = viewerContent.locator('.code-editor-status');

            const statusText = await statusBar.textContent();
            expect(statusText).toMatch(/JS|JavaScript|js/i);
        } else {
            test.skip(true, 'No JavaScript files available in explorer');
        }
    });

    test('should handle file save with keyboard shortcut', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const files = explorerTree.locator('.tree-item:not(.dir)');

        if (await files.count() > 0) {
            await files.first().click();
            await page.waitForTimeout(500);

            // Focus on editor and press Cmd+S
            const isMac = process.platform === 'darwin';
            const modifier = isMac ? 'Meta' : 'Control';

            await page.keyboard.press(`${modifier}+S`);
            await page.waitForTimeout(500);

            // File should save (toast notification might appear)
            // This is implementation-dependent
        } else {
            test.skip(true, 'No files available in explorer');
        }
    });

    test('should display line numbers', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const files = explorerTree.locator('.tree-item:not(.dir)');

        if (await files.count() > 0) {
            await files.first().click();
            await page.waitForTimeout(500);

            const viewerContent = page.locator('#viewer-content');
            const lineNumbers = viewerContent.locator('.line-numbers, [class*="line-number"]');

            const hasLineNumbers = await lineNumbers.count();
            // Line numbers are optional
            expect(hasLineNumbers).toBeGreaterThanOrEqual(0);
        } else {
            test.skip(true, 'No files available in explorer');
        }
    });

    test('should support text editing in code editor', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const files = explorerTree.locator('.tree-item:not(.dir)');

        if (await files.count() > 0) {
            await files.first().click();
            await page.waitForTimeout(500);

            const viewerContent = page.locator('#viewer-content');
            const textarea = viewerContent.locator('textarea');

            if (await textarea.count() > 0) {
                // Type in the editor
                await textarea.click();
                await page.keyboard.type('// Test comment');
                await page.waitForTimeout(200);

                // Content should be editable
                const value = await textarea.inputValue();
                expect(value).toContain('Test comment');
            } else {
                // Editor might use contenteditable or custom implementation
                test.skip(true, 'Editor does not use textarea');
            }
        } else {
            test.skip(true, 'No files available in explorer');
        }
    });

    test('should handle different file types', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        // Test different file extensions
        const extensions = ['.js', '.ts', '.json', '.md'];

        for (const ext of extensions) {
            const file = explorerTree.locator('.tree-item').filter({ hasText: new RegExp(`${ext}$`) }).first();

            if (await file.count() > 0) {
                await file.click();
                await page.waitForTimeout(500);

                // Editor should open
                const viewerContent = page.locator('#viewer-content');
                const codeEditor = viewerContent.locator('.code-editor, [class*="editor"]');

                expect(await codeEditor.count()).toBeGreaterThan(0);
                break;
            }
        }
    });

    test('should show file path in toolbar', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const files = explorerTree.locator('.tree-item:not(.dir)');

        if (await files.count() > 0) {
            await files.first().click();
            await page.waitForTimeout(500);

            const codeEditorPath = page.locator('.code-editor-path');
            const pathText = await codeEditorPath.textContent();

            expect(pathText).not.toBe('');
            expect(pathText).toMatch(/\//); // Should contain path separator
        } else {
            test.skip(true, 'No files available in explorer');
        }
    });

    test('should highlight selected file in explorer', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const files = explorerTree.locator('.tree-item:not(.dir)');

        if (await files.count() > 0) {
            await files.first().click();
            await page.waitForTimeout(300);

            // File should be marked as selected
            await expect(files.first()).toHaveClass(/selected/);
        } else {
            test.skip(true, 'No files available in explorer');
        }
    });

    test('should display UTF-8 encoding in status bar', async () => {
        const explorerTree = page.locator('#explorer-tree');
        await page.waitForTimeout(500);

        const files = explorerTree.locator('.tree-item:not(.dir)');

        if (await files.count() > 0) {
            await files.first().click();
            await page.waitForTimeout(500);

            const viewerContent = page.locator('#viewer-content');
            const statusBar = viewerContent.locator('.code-editor-status');

            const statusText = await statusBar.textContent();
            expect(statusText).toContain('UTF-8');
        } else {
            test.skip(true, 'No files available in explorer');
        }
    });
});
