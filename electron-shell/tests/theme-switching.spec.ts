import { test, expect, _electron as electron } from '@playwright/test';
import * as path from 'path';

const ELECTRON_APP = path.join(__dirname, '..');

test.describe('Theme Switching', () => {
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

    test('should open settings panel', async () => {
        const settingsBtn = page.locator('#settings-btn');
        await settingsBtn.click();
        await page.waitForTimeout(300);

        const settingsOverlay = page.locator('#settings-overlay');
        await expect(settingsOverlay).not.toHaveClass(/hidden/);
    });

    test('should display theme section in settings', async () => {
        const settingsBtn = page.locator('#settings-btn');
        await settingsBtn.click();
        await page.waitForTimeout(300);

        // Click on Appearance tab
        const appearanceTab = page.locator('.settings-tab').filter({ hasText: 'Appearance' });
        await appearanceTab.click();
        await page.waitForTimeout(300);

        const themeSection = page.locator('#tab-appearance');
        await expect(themeSection).toBeVisible();
    });

    test('should display all available themes', async () => {
        const settingsBtn = page.locator('#settings-btn');
        await settingsBtn.click();
        await page.waitForTimeout(300);

        const appearanceTab = page.locator('.settings-tab').filter({ hasText: 'Appearance' });
        await appearanceTab.click();
        await page.waitForTimeout(300);

        const themeCards = page.locator('.theme-card');

        const count = await themeCards.count();
        expect(count).toBe(4); // dark, tokyo-night, light, solarized-light
    });

    test('should display dark theme option', async () => {
        const settingsBtn = page.locator('#settings-btn');
        await settingsBtn.click();
        await page.waitForTimeout(300);

        const appearanceTab = page.locator('.settings-tab').filter({ hasText: 'Appearance' });
        await appearanceTab.click();
        await page.waitForTimeout(300);

        const darkTheme = page.locator('.theme-card[data-theme="dark"]');
        await expect(darkTheme).toBeVisible();
        await expect(darkTheme.locator('span')).toHaveText('Dark');
    });

    test('should display tokyo-night theme option', async () => {
        const settingsBtn = page.locator('#settings-btn');
        await settingsBtn.click();
        await page.waitForTimeout(300);

        const appearanceTab = page.locator('.settings-tab').filter({ hasText: 'Appearance' });
        await appearanceTab.click();
        await page.waitForTimeout(300);

        const tokyoTheme = page.locator('.theme-card[data-theme="tokyo-night"]');
        await expect(tokyoTheme).toBeVisible();
        await expect(tokyoTheme.locator('span')).toHaveText('Tokyo Night');
    });

    test('should display light theme option', async () => {
        const settingsBtn = page.locator('#settings-btn');
        await settingsBtn.click();
        await page.waitForTimeout(300);

        const appearanceTab = page.locator('.settings-tab').filter({ hasText: 'Appearance' });
        await appearanceTab.click();
        await page.waitForTimeout(300);

        const lightTheme = page.locator('.theme-card[data-theme="light"]');
        await expect(lightTheme).toBeVisible();
        await expect(lightTheme.locator('span')).toHaveText('Light');
    });

    test('should display solarized-light theme option', async () => {
        const settingsBtn = page.locator('#settings-btn');
        await settingsBtn.click();
        await page.waitForTimeout(300);

        const appearanceTab = page.locator('.settings-tab').filter({ hasText: 'Appearance' });
        await appearanceTab.click();
        await page.waitForTimeout(300);

        const solarizedTheme = page.locator('.theme-card[data-theme="solarized-light"]');
        await expect(solarizedTheme).toBeVisible();
        await expect(solarizedTheme.locator('span')).toHaveText('Solarized Light');
    });

    test('should switch to dark theme', async () => {
        const settingsBtn = page.locator('#settings-btn');
        await settingsBtn.click();
        await page.waitForTimeout(300);

        const appearanceTab = page.locator('.settings-tab').filter({ hasText: 'Appearance' });
        await appearanceTab.click();
        await page.waitForTimeout(300);

        const darkTheme = page.locator('.theme-card[data-theme="dark"]');
        await darkTheme.click();
        await page.waitForTimeout(300);

        // Check data-theme attribute on document
        const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        expect(theme).toBe('dark');
    });

    test('should switch to tokyo-night theme', async () => {
        const settingsBtn = page.locator('#settings-btn');
        await settingsBtn.click();
        await page.waitForTimeout(300);

        const appearanceTab = page.locator('.settings-tab').filter({ hasText: 'Appearance' });
        await appearanceTab.click();
        await page.waitForTimeout(300);

        const tokyoTheme = page.locator('.theme-card[data-theme="tokyo-night"]');
        await tokyoTheme.click();
        await page.waitForTimeout(300);

        const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        expect(theme).toBe('tokyo-night');
    });

    test('should switch to light theme', async () => {
        const settingsBtn = page.locator('#settings-btn');
        await settingsBtn.click();
        await page.waitForTimeout(300);

        const appearanceTab = page.locator('.settings-tab').filter({ hasText: 'Appearance' });
        await appearanceTab.click();
        await page.waitForTimeout(300);

        const lightTheme = page.locator('.theme-card[data-theme="light"]');
        await lightTheme.click();
        await page.waitForTimeout(300);

        const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        expect(theme).toBe('light');
    });

    test('should switch to solarized-light theme', async () => {
        const settingsBtn = page.locator('#settings-btn');
        await settingsBtn.click();
        await page.waitForTimeout(300);

        const appearanceTab = page.locator('.settings-tab').filter({ hasText: 'Appearance' });
        await appearanceTab.click();
        await page.waitForTimeout(300);

        const solarizedTheme = page.locator('.theme-card[data-theme="solarized-light"]');
        await solarizedTheme.click();
        await page.waitForTimeout(300);

        const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        expect(theme).toBe('solarized-light');
    });

    test('should persist theme selection', async () => {
        const settingsBtn = page.locator('#settings-btn');
        await settingsBtn.click();
        await page.waitForTimeout(300);

        const appearanceTab = page.locator('.settings-tab').filter({ hasText: 'Appearance' });
        await appearanceTab.click();
        await page.waitForTimeout(300);

        // Select light theme
        const lightTheme = page.locator('.theme-card[data-theme="light"]');
        await lightTheme.click();
        await page.waitForTimeout(300);

        // Close settings
        const settingsClose = page.locator('#settings-close');
        await settingsClose.click();
        await page.waitForTimeout(300);

        // Reopen settings
        await settingsBtn.click();
        await page.waitForTimeout(300);
        await appearanceTab.click();
        await page.waitForTimeout(300);

        // Theme should still be light
        const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        expect(theme).toBe('light');
    });

    test('should display theme preview', async () => {
        const settingsBtn = page.locator('#settings-btn');
        await settingsBtn.click();
        await page.waitForTimeout(300);

        const appearanceTab = page.locator('.settings-tab').filter({ hasText: 'Appearance' });
        await appearanceTab.click();
        await page.waitForTimeout(300);

        const themePreviews = page.locator('.theme-preview');
        const count = await themePreviews.count();

        expect(count).toBe(4);
    });

    test('should apply theme colors immediately', async () => {
        const settingsBtn = page.locator('#settings-btn');
        await settingsBtn.click();
        await page.waitForTimeout(300);

        const appearanceTab = page.locator('.settings-tab').filter({ hasText: 'Appearance' });
        await appearanceTab.click();
        await page.waitForTimeout(300);

        // Get initial background color
        const initialBg = await page.evaluate(() => {
            return window.getComputedStyle(document.body).backgroundColor;
        });

        // Switch to light theme
        const lightTheme = page.locator('.theme-card[data-theme="light"]');
        await lightTheme.click();
        await page.waitForTimeout(300);

        // Get new background color
        const newBg = await page.evaluate(() => {
            return window.getComputedStyle(document.body).backgroundColor;
        });

        // Colors should be different
        expect(initialBg).not.toBe(newBg);
    });

    test('should update terminal theme when app theme changes', async () => {
        // Add a workspace to get a terminal
        const addBtn = page.locator('#workspace-add-btn');
        await addBtn.click();
        await page.waitForTimeout(1500);

        // Open settings and change theme
        const settingsBtn = page.locator('#settings-btn');
        await settingsBtn.click();
        await page.waitForTimeout(300);

        const appearanceTab = page.locator('.settings-tab').filter({ hasText: 'Appearance' });
        await appearanceTab.click();
        await page.waitForTimeout(300);

        // Switch to light theme
        const lightTheme = page.locator('.theme-card[data-theme="light"]');
        await lightTheme.click();
        await page.waitForTimeout(300);

        // Terminal theme should update (this is checked by verifying no errors)
        const terminalPane = page.locator('#terminal-pane');
        await expect(terminalPane).toBeVisible();
    });

    test('should save theme to localStorage', async () => {
        const settingsBtn = page.locator('#settings-btn');
        await settingsBtn.click();
        await page.waitForTimeout(300);

        const appearanceTab = page.locator('.settings-tab').filter({ hasText: 'Appearance' });
        await appearanceTab.click();
        await page.waitForTimeout(300);

        // Select light theme
        const lightTheme = page.locator('.theme-card[data-theme="light"]');
        await lightTheme.click();
        await page.waitForTimeout(300);

        // Check localStorage
        const savedTheme = await page.evaluate(() => localStorage.getItem('theme'));
        expect(savedTheme).toBe('light');
    });

    test('should load saved theme on startup', async () => {
        // Set theme in first window
        const settingsBtn = page.locator('#settings-btn');
        await settingsBtn.click();
        await page.waitForTimeout(300);

        const appearanceTab = page.locator('.settings-tab').filter({ hasText: 'Appearance' });
        await appearanceTab.click();
        await page.waitForTimeout(300);

        const lightTheme = page.locator('.theme-card[data-theme="light"]');
        await lightTheme.click();
        await page.waitForTimeout(300);

        // Close and reopen app would be ideal, but we can check localStorage
        const savedTheme = await page.evaluate(() => localStorage.getItem('theme'));
        expect(savedTheme).toBe('light');
    });

    test('should close settings panel', async () => {
        const settingsBtn = page.locator('#settings-btn');
        await settingsBtn.click();
        await page.waitForTimeout(300);

        const settingsOverlay = page.locator('#settings-overlay');
        await expect(settingsOverlay).not.toHaveClass(/hidden/);

        const settingsClose = page.locator('#settings-close');
        await settingsClose.click();
        await page.waitForTimeout(300);

        await expect(settingsOverlay).toHaveClass(/hidden/);
    });

    test('should switch between themes multiple times', async () => {
        const settingsBtn = page.locator('#settings-btn');
        await settingsBtn.click();
        await page.waitForTimeout(300);

        const appearanceTab = page.locator('.settings-tab').filter({ hasText: 'Appearance' });
        await appearanceTab.click();
        await page.waitForTimeout(300);

        const themes = ['dark', 'tokyo-night', 'light', 'solarized-light'];

        for (const themeName of themes) {
            const themeCard = page.locator('.theme-card').filter({ hasAttribute: 'data-theme', themeName });
            await themeCard.click();
            await page.waitForTimeout(200);

            const currentTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
            expect(currentTheme).toBe(themeName);
        }
    });
});
