import { _electron as electron, ElectronApplication, Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ELECTRON_APP = path.join(__dirname, '..');

export interface TestWorkspace {
    id: string;
    name: string;
    path: string;
    color: string;
}

export interface TestContext {
    electronApp: ElectronApplication;
    page: Page;
    homeDir: string;
    rootDir: string;
    configPath: string;
    workspaces: TestWorkspace[];
}

function createWorkspace(rootDir: string, index: number): TestWorkspace {
    const name = `workspace-${index + 1}`;
    const workspacePath = path.join(rootDir, name);
    fs.mkdirSync(workspacePath, { recursive: true });
    fs.mkdirSync(path.join(workspacePath, 'src'), { recursive: true });
    fs.mkdirSync(path.join(workspacePath, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(workspacePath, 'README.md'), `# ${name}\n\nFixture workspace ${index + 1}.\n`);
    fs.writeFileSync(path.join(workspacePath, 'src', `sample-${index + 1}.ts`), `export const value${index + 1} = ${index + 1};\n`);
    fs.writeFileSync(path.join(workspacePath, 'docs', `notes-${index + 1}.md`), `workspace ${index + 1} notes\n`);

    return {
        id: `ws-fixture-${index + 1}`,
        name,
        path: workspacePath,
        color: ['#7aa2f7', '#9ece6a', '#f7768e'][index % 3],
    };
}

export async function launchWithFixtures(workspaceCount = 1): Promise<TestContext> {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'termnexus-home-'));
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'termnexus-workspaces-'));
    const configDir = path.join(homeDir, '.ai-terminal-ide');
    fs.mkdirSync(configDir, { recursive: true });

    const workspaces = Array.from({ length: workspaceCount }, (_, index) => createWorkspace(rootDir, index));
    fs.writeFileSync(
        path.join(configDir, 'workspaces.json'),
        JSON.stringify(workspaces, null, 2),
    );
    const configPath = path.join(configDir, 'workspaces.json');

    const electronApp = await electron.launch({
        args: ['.'],
        cwd: ELECTRON_APP,
        env: {
            ...process.env,
            NODE_ENV: 'test',
            HOME: homeDir,
        },
    });

    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    return { electronApp, page, homeDir, rootDir, configPath, workspaces };
}

export function readSavedWorkspaces(context: TestContext): TestWorkspace[] {
    return JSON.parse(fs.readFileSync(context.configPath, 'utf8')) as TestWorkspace[];
}

export async function cleanupTestContext(context: TestContext | null): Promise<void> {
    if (!context) return;

    await context.electronApp.close();
    fs.rmSync(context.homeDir, { recursive: true, force: true });
    fs.rmSync(context.rootDir, { recursive: true, force: true });
}
