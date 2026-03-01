import { app, BrowserWindow, ipcMain, dialog, shell, Menu, clipboard, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { exec } from 'child_process';
import * as https from 'https';
import { PtyManager } from './ptyManager';
import { PlaywrightAltMcp } from './mcpServer';
import { deploySkillsToWorkspace, deployGlobalSkills, markShutdown } from './skillsManager';
import { startWebServer, setSharedPtyManager } from './webServer';
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

// Export for web server to share PTY sessions
export { ptyManager };

// Server status tracking
let serverStatus = {
    running: false,
    port: 4096,
    localIp: 'localhost',
    networkIps: [] as string[],
    error: null as string | null
};

// Get network IPs
function getNetworkIps(): string[] {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];
    Object.values(interfaces).forEach(ifaces => {
        ifaces?.forEach(iface => {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push(iface.address);
            }
        });
    });
    return ips;
}
function createWindow() {
    console.log('[createWindow] Starting...');
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

    console.log('[createWindow] BrowserWindow created');

    // __dirname = dist/main/ → ../renderer/ = dist/renderer/
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    
    // Handle load errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('[Window] Load failed:', errorCode, errorDescription);
    });
    
    // Always open DevTools for debugging during development
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    
    console.log('[createWindow] Done');
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

// Server: get status and IP address
ipcMain.handle('server:getStatus', async () => {
    return {
        running: serverStatus.running,
        port: webPort,
        localIp: 'localhost',
        networkIps: serverStatus.networkIps,
        error: serverStatus.error
    };
});

// Shell: open file in system default application
ipcMain.handle('shell:openExternal', async (_event, filePath: string) => {
    await shell.openPath(filePath);
    return { ok: true };
});

// Shell: show context menu for file/folder
ipcMain.handle('shell:showContextMenu', async (event, filePath: string, isDir: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { action: null };
    
    const template: Electron.MenuItemConstructorOptions[] = [
        {
            label: 'Copy Path',
            click: () => {
                clipboard.writeText(filePath);
            }
        },
        {
            label: 'Copy File Name',
            click: () => {
                clipboard.writeText(path.basename(filePath));
            }
        },
        { type: 'separator' },
        {
            label: 'Open in Finder',
            click: async () => {
                if (isDir) {
                    await shell.openPath(filePath);
                } else {
                    await shell.showItemInFolder(filePath);
                }
            }
        },
        {
            label: 'Open with Default App',
            click: async () => {
                await shell.openPath(filePath);
            }
        },
        { type: 'separator' },
        {
            label: 'Get Info',
            click: async () => {
                // macOS: open Get Info dialog
                if (process.platform === 'darwin') {
                    exec(`open -R "${filePath}"`);
                } else {
                    await shell.showItemInFolder(filePath);
                }
            }
        }
    ];
    
    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: win });
    return { action: 'shown' };
    });

// ─── Browser Panel IPC (for MCP) ─────────────────────────────────────────────

// Browser: navigate to URL
ipcMain.handle('browser:navigate', async (_event, url: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('browser:doNavigate', url);
        return { ok: true, url };
    }
    return { ok: false, error: 'No main window' };
});

// Browser: take screenshot
ipcMain.handle('browser:screenshot', async () => {
    return new Promise((resolve) => {
        if (!mainWindow || mainWindow.isDestroyed()) {
            resolve({ ok: false, error: 'No main window' });
            return;
        }
        const handler = (_event: any, result: { ok: boolean; data?: string; error?: string }) => {
            ipcMain.removeListener('browser:screenshotResult', handler);
            resolve(result);
        };
        ipcMain.on('browser:screenshotResult', handler);
        mainWindow.webContents.send('browser:doScreenshot');
        // Timeout after 10 seconds
        setTimeout(() => {
            ipcMain.removeListener('browser:screenshotResult', handler);
            resolve({ ok: false, error: 'Screenshot timeout' });
        }, 10000);
    });
});

// Browser: click element
ipcMain.handle('browser:click', async (_event, selector: string) => {
    return new Promise((resolve) => {
        if (!mainWindow || mainWindow.isDestroyed()) {
            resolve({ ok: false, error: 'No main window' });
            return;
        }
        const handler = (_event: any, result: { ok: boolean; error?: string }) => {
            ipcMain.removeListener('browser:clickResult', handler);
            resolve(result);
        };
        ipcMain.on('browser:clickResult', handler);
        mainWindow.webContents.send('browser:doClick', selector);
        setTimeout(() => {
            ipcMain.removeListener('browser:clickResult', handler);
            resolve({ ok: false, error: 'Click timeout' });
        }, 10000);
    });
});

// Browser: get DOM
ipcMain.handle('browser:getDom', async () => {
    return new Promise((resolve) => {
        if (!mainWindow || mainWindow.isDestroyed()) {
            resolve({ ok: false, error: 'No main window' });
            return;
        }
        const handler = (_event: any, result: { ok: boolean; data?: string; error?: string }) => {
            ipcMain.removeListener('browser:domResult', handler);
            resolve(result);
        };
        ipcMain.on('browser:domResult', handler);
        mainWindow.webContents.send('browser:doGetDom');
        setTimeout(() => {
            ipcMain.removeListener('browser:domResult', handler);
            resolve({ ok: false, error: 'Get DOM timeout' });
        }, 10000);
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

// Check for --web flag
const isWebMode = process.argv.includes('--web');
const webPort = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || '4096');

if (isWebMode) {
    // Web server mode - no Electron window
    app.whenReady().then(() => {
        deployGlobalSkills();
        
        // Start web server
        setSharedPtyManager(ptyManager);  // Share PTY with web server
        startWebServer(webPort);
        
        // Start Playwright ALT MCP Server
        const mcp = new PlaywrightAltMcp();
        mcp.run().catch(err => console.error("Failed to run MCP server:", err));
    });
    
    // Don't quit when all windows are closed in web mode
    app.on('window-all-closed', () => {});
} else {
    // Normal Electron mode - also start web server for remote access
    app.whenReady().then(() => {
        console.log('[App] Ready, creating window...');
        deployGlobalSkills();
        createWindow();
        
        // Request folder access permissions for all workspaces
        if (process.platform === 'darwin') {
            const workspaces = loadWorkspaces();
            for (const ws of workspaces) {
                try {
                    // Try to read the directory - this triggers macOS permission dialog
                    fs.readdirSync(ws.path);
                    console.log(`[Permission] Granted for: ${ws.path}`);
                } catch (e: any) {
                    console.log(`[Permission] Denied or error for ${ws.path}:`, e.message);
                }
            }
        }
    
        // Start web server in normal mode too (for remote access)
        try {
            serverStatus.running = true;
            serverStatus.networkIps = getNetworkIps();
            setSharedPtyManager(ptyManager);  // Share PTY with web server
            startWebServer(webPort);
        } catch (e: any) {
            serverStatus.running = false;
            serverStatus.error = e.message;
            console.error('Failed to start web server:', e);
        }
        
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
}

app.on('window-all-closed', () => {
    ptyManager.killAll();
    if (process.platform !== 'darwin') app.quit();
});

// Mark shutdown before quitting to prevent EPIPE errors
app.on('will-quit', () => {
    markShutdown();
});

// Export for testing
