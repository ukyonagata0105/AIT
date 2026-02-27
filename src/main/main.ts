import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { exec } from 'child_process';
import * as https from 'https';
import { PtyManager } from './ptyManager';
import { PlaywrightAltMcp } from './mcpServer';
import { deploySkillsToWorkspace, deployGlobalSkills } from './skillsManager';

const CONFIG_PATH = path.join(os.homedir(), '.ai-terminal-ide', 'workspaces.json');

// Enable remote debugging for Playwright ALT integration
app.commandLine.appendSwitch('remote-debugging-port', '9223');

interface WorkspaceConfig {
    id: string;
    name: string;
    path: string;
    color?: string;
}

function loadWorkspaces(): WorkspaceConfig[] {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        }
    } catch (e) {
        console.error('Failed to load workspaces', e);
    }
    return [];
}

function saveWorkspaces(workspaces: WorkspaceConfig[]) {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(workspaces, null, 2));
}

let mainWindow: BrowserWindow | null = null;
const ptyManager = new PtyManager();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 500,
        titleBarStyle: 'hiddenInset', // macOS native traffic lights
        backgroundColor: '#1a1a1a',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: true,
        },
    });

    // __dirname = dist/main/ → ../renderer/ = dist/renderer/
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    // Always open DevTools for debugging during development
    mainWindow.webContents.openDevTools({ mode: 'detach' });
}

// ─── Webview Interception ────────────────────────────────────────────────────

app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler((details) => {
        if (details.url.startsWith('vscode:extension/')) {
            const extId = details.url.split('vscode:extension/')[1];
            mainWindow?.webContents.send('extension:install', extId);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    contents.on('will-navigate', (event, navigationUrl) => {
        if (navigationUrl.startsWith('vscode:extension/')) {
            event.preventDefault();
            const extId = navigationUrl.split('vscode:extension/')[1];
            mainWindow?.webContents.send('extension:install', extId);
        }
    });
});

// ─── IPC Handlers ──────────────────────────────────────────────────────────

// Terminal: create a new PTY session
ipcMain.handle('pty:create', async (_event, args: { id: string; cwd: string; cols: number; rows: number }) => {
    // Auto-deploy skills from ~/.ai-terminal-ide/skills.json to this workspace
    deploySkillsToWorkspace(args.cwd);
    ptyManager.create(args.id, args.cwd, args.cols, args.rows);
    return { ok: true };
});

// Terminal: send input to PTY
ipcMain.on('pty:input', (_event, args: { id: string; data: string }) => {
    ptyManager.write(args.id, args.data);
});

// Terminal: resize PTY
ipcMain.on('pty:resize', (_event, args: { id: string; cols: number; rows: number }) => {
    ptyManager.resize(args.id, args.cols, args.rows);
});

// Terminal: kill a PTY
ipcMain.on('pty:kill', (_event, args: { id: string }) => {
    ptyManager.kill(args.id);
});

// Terminal: PTY output → renderer
ptyManager.on('data', (id: string, data: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty:data', { id, data });
    }
});

ptyManager.on('exit', (id: string, exitCode: number) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty:exit', { id, exitCode });
    }
});

// Workspaces: load config
ipcMain.handle('workspaces:load', async () => {
    return loadWorkspaces();
});

// Workspaces: save config
ipcMain.handle('workspaces:save', async (_event, workspaces: WorkspaceConfig[]) => {
    saveWorkspaces(workspaces);
    return { ok: true };
});

// Workspaces: open folder picker
ipcMain.handle('workspaces:add', async () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    console.log('[workspace:add] dialog opening, window:', win?.id);
    const result = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory'],
        title: 'Select Workspace Folder',
    });
    console.log('[workspace:add] dialog result:', result);
    if (!result.canceled && result.filePaths.length > 0) {
        const folderPath = result.filePaths[0];
        const name = path.basename(folderPath);
        const id = `ws-${Date.now()}`;
        const newWs: WorkspaceConfig = { id, name, path: folderPath };
        const workspaces = loadWorkspaces();
        workspaces.push(newWs);
        saveWorkspaces(workspaces);
        console.log('[workspace:add] saved workspace:', newWs);
        return newWs;
    }
    return null;
});

// Workspaces: rename
ipcMain.handle('workspaces:rename', async (_event, id: string, name: string) => {
    const workspaces = loadWorkspaces();
    const ws = workspaces.find(w => w.id === id);
    if (ws) {
        ws.name = name;
        saveWorkspaces(workspaces);
    }
    return { ok: true };
});

// Workspaces: delete
ipcMain.handle('workspaces:delete', async (_event, id: string) => {
    const workspaces = loadWorkspaces().filter(w => w.id !== id);
    saveWorkspaces(workspaces);
    return { ok: true };
});

// FS: read directory
ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map(e => {
        let mtime = 0, size = 0;
        try {
            const stat = fs.statSync(`${dirPath}/${e.name}`);
            mtime = stat.mtimeMs;
            size = stat.size;
        } catch { }
        return { name: e.name, isDir: e.isDirectory(), mtime, size };
    });
});

// FS: read file
ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    return fs.readFileSync(filePath, 'utf8');
});

// Shell: run arbitrary command and get stdout/stderr
ipcMain.handle('exec:run', async (_event, cmd: string) => {
    return new Promise<{ stdout: string; stderr: string }>((resolve) => {
        exec(cmd, { env: { ...process.env, PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin` } }, (err, stdout, stderr) => {
            resolve({ stdout: stdout || '', stderr: stderr || (err?.message ?? '') });
        });
    });
});

// Extensions: search VS Code Marketplace
ipcMain.handle('ext:search', async (_event, query: string) => {
    const data = JSON.stringify({
        filters: [{
            criteria: [
                { filterType: 10, value: query },
                { filterType: 8, value: "Microsoft.VisualStudio.Code" },
                { filterType: 12, value: "4096" }
            ],
            pageNumber: 1,
            pageSize: 24,
            sortBy: 0,
            sortOrder: 0
        }],
        assetTypes: [],
        flags: 914
    });

    const options = {
        hostname: 'marketplace.visualstudio.com',
        path: '/_apis/public/gallery/extensionquery',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json;api-version=3.0-preview.1',
            'Content-Length': data.length
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
});

// ─── App Lifecycle ─────────────────────────────────────────────────────────

app.whenReady().then(() => {
    // Ensure skills are registered in oh-my-opencode's global registry
    deployGlobalSkills();
    createWindow();

    // Start Playwright ALT MCP Server
    const mcp = new PlaywrightAltMcp();
    mcp.run().catch(err => console.error("Failed to run MCP server:", err));

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    ptyManager.killAll();
    if (process.platform !== 'darwin') app.quit();
});

// Export for testing
module.exports = { createWindow, loadWorkspaces, saveWorkspaces };
