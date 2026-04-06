import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    timeout: 30_000,
    workers: 1,
    use: {
        // Electron-specific config via _electron helper in test files
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        trace: 'retain-on-failure',
    },
    reporter: [
        ['list'],
        ['html', { outputFolder: 'test-results/report', open: 'never' }],
        ['json', { outputFile: 'test-results/results.json' }],
        ['junit', { outputFile: 'test-results/junit.xml' }],
    ],
    outputDir: 'test-results/artifacts',
});
