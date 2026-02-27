import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    timeout: 30_000,
    use: {
        // Electron-specific config via _electron helper in test files
    },
    reporter: [['list']],
});
