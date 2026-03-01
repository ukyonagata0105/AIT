import './index.css';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TerminalState {
    ptyId: string;
    cols: number;
    rows: number;
}

interface Workspace {
    id: string;
    name: string;
    path: string;
    color?: string;
    terminalState?: TerminalState;
}

declare const window: Window & {
    electronAPI?: {
        ptyCreate: (a: { id: string; cwd: string; cols: number; rows: number }) => Promise<{ ok: boolean }>;
        ptyInput: (a: { id: string; data: string }) => void;
        ptyResize: (a: { id: string; cols: number; rows: number }) => void;
        ptyKill: (a: { id: string }) => void;
        onPtyData: (cb: (a: { id: string; data: string }) => void) => void;
        onPtyExit: (cb: (a: { id: string; exitCode: number }) => void) => void;
        workspacesLoad: () => Promise<Workspace[]>;
        workspacesSave: (ws: Workspace[]) => Promise<{ ok: boolean }>;
        workspacesAdd: () => Promise<Workspace | null>;
        workspacesRename: (id: string, name: string) => Promise<{ ok: boolean }>;
        workspacesDelete: (id: string) => Promise<{ ok: boolean }>;
        fsReadDir: (path: string) => Promise<{ name: string; isDir: boolean; mtime: number; size: number }[]>;
        fsReadFile: (path: string) => Promise<string>;
        execRun: (cmd: string) => Promise<{ stdout: string; stderr: string }>;
        extSearch: (query: string) => Promise<any>;
        onExtensionInstall?: (callback: (id: string) => void) => void;
        serverGetStatus: () => Promise<{ running: boolean; port: number; localIp: string; networkIps: string[]; error: string | null }>;
        shellOpenExternal: (filePath: string) => Promise<{ ok: boolean }>;
        shellShowContextMenu: (filePath: string, isDir: boolean) => Promise<{ action: string | null }>;
    };
};

// ─── Environment Detection ────────────────────────────────────────────────────

const isElectron = typeof window.electronAPI !== 'undefined';

// Hybrid API: Works in both Electron and Web mode
const api = {
    // PTY operations (WebSocket in web mode)
    ptyCreate: async (args: { id: string; cwd: string; cols: number; rows: number }) => {
        if (isElectron) return window.electronAPI!.ptyCreate(args);
        // Web mode: WebSocket will handle this
        return { ok: true };
    },
    ptyInput: (args: { id: string; data: string }) => {
        if (isElectron) window.electronAPI!.ptyInput(args);
        // Web mode: WebSocket will handle this
    },
    ptyResize: (args: { id: string; cols: number; rows: number }) => {
        if (isElectron) window.electronAPI!.ptyResize(args);
    },
    ptyKill: (args: { id: string }) => {
        if (isElectron) window.electronAPI!.ptyKill(args);
    },
    onPtyData: (cb: (a: { id: string; data: string }) => void) => {
        if (isElectron) window.electronAPI!.onPtyData(cb);
    },
    onPtyExit: (cb: (a: { id: string; exitCode: number }) => void) => {
        if (isElectron) window.electronAPI!.onPtyExit(cb);
    },

    // Workspace operations
    workspacesLoad: async (): Promise<Workspace[]> => {
        if (isElectron) return window.electronAPI!.workspacesLoad();
        // Web mode: fetch from API
        try {
            const res = await fetch('/api/workspaces');
            return res.json();
        } catch {
            return [];
        }
    },
    workspacesSave: async (ws: Workspace[]): Promise<{ ok: boolean }> => {
        if (isElectron) return window.electronAPI!.workspacesSave(ws);
        // Web mode: POST to API
        try {
            await fetch('/api/workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ws) });
            return { ok: true };
        } catch {
            return { ok: false };
        }
    },
    workspacesAdd: async (): Promise<Workspace | null> => {
        if (isElectron) return window.electronAPI!.workspacesAdd();
        // Web mode: not supported (can't open folder picker)
        console.warn('workspacesAdd not available in web mode');
        return null;
    },
    workspacesRename: async (id: string, name: string): Promise<{ ok: boolean }> => {
        if (isElectron) return window.electronAPI!.workspacesRename(id, name);
        return { ok: true };
    },
    workspacesDelete: async (id: string): Promise<{ ok: boolean }> => {
        if (isElectron) return window.electronAPI!.workspacesDelete(id);
        return { ok: true };
    },

    // File system
    fsReadDir: async (path: string) => {
        if (isElectron) return window.electronAPI!.fsReadDir(path);
        // Web mode: fetch from API
        try {
            const res = await fetch(`/api/fs/readDir?path=${encodeURIComponent(path)}`);
            return res.json();
        } catch {
            return [];
        }
    },
    fsReadFile: async (path: string) => {
        if (isElectron) return window.electronAPI!.fsReadFile(path);
        try {
            const res = await fetch(`/api/fs/readFile?path=${encodeURIComponent(path)}`);
            return res.text();
        } catch {
            return '';
        }
    },

    // Shell
    execRun: async (cmd: string) => {
        if (isElectron) return window.electronAPI!.execRun(cmd);
        return { stdout: '', stderr: 'Not available in web mode' };
    },
    extSearch: async (query: string) => {
        if (isElectron) return window.electronAPI!.extSearch(query);
        return {};
    },
    onExtensionInstall: (cb: (id: string) => void) => {
        if (isElectron && window.electronAPI!.onExtensionInstall) {
            window.electronAPI!.onExtensionInstall(cb);
        }
    },
    serverGetStatus: async () => {
        if (isElectron) return window.electronAPI!.serverGetStatus();
        return { running: false, port: 0, localIp: '', networkIps: [], error: 'Web mode' };
    },
    shellOpenExternal: async (filePath: string) => {
        if (isElectron) return window.electronAPI!.shellOpenExternal(filePath);
        // Web mode: open in new tab?
        window.open(`file://${filePath}`, '_blank');
        return { ok: true };
    },
    shellShowContextMenu: async (filePath: string, isDir: boolean) => {
        if (isElectron) return window.electronAPI!.shellShowContextMenu(filePath, isDir);
        // Web mode: no context menu support
        return { action: null };
    }
};

// ─── State ──────────────────────────────────────────────────────────────────

let workspaces: Workspace[] = [];
let activeWorkspaceId: string | null = null;
let wsBarCollapsed = false;
let activeTerm: Terminal | null = null;
let activeFitAddon: FitAddon | null = null;
let activePtyId: string | null = null;
// Map workspace IDs to their saved terminal state (PTY ID + dimensions)
const workspaceTerminalStates = new Map<string, TerminalState>();

// Terminal Tab structure
interface TerminalTab {
    id: string;
    title: string;
    term: Terminal;
    fitAddon: FitAddon;
    ptyId: string;
    container: HTMLElement; // Container element for the terminal
    cell?: HTMLElement; // Grid cell element (for layout mode)
}

// Map workspace IDs to array of terminal tabs
const workspaceTerminals = new Map<string, TerminalTab[]>();

// Current active tab ID
let activeTabId: string | null = null;

// Generate unique tab ID
function generateTabId(): string {
    return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}


// ─── File Categories ──────────────────────────────────────────────────────────

const FILE_CATEGORIES = {
    pdf: new Set(['pdf']),
    image: new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff']),
    text: new Set(['txt', 'md', 'json', 'yaml', 'yml', 'ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'sh', 'css', 'html', 'xml', 'toml', 'ini', 'env', 'gitignore', 'dockerignore', 'editorconfig', 'eslintrc', 'prettierrc']),
    external: new Set(['pkg', 'dmg', 'app', 'zip', 'tar', 'gz', 'rar', '7z', 'mp3', 'mp4', 'mov', 'avi', 'mkv', 'wav', 'flac', 'iso', 'exe', 'msi', 'deb', 'rpm'])
};

type FileCategory = 'pdf' | 'image' | 'text' | 'external' | 'binary';

function getFileCategory(filePath: string): FileCategory {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    if (FILE_CATEGORIES.pdf.has(ext)) return 'pdf';
    if (FILE_CATEGORIES.image.has(ext)) return 'image';
    if (FILE_CATEGORIES.text.has(ext)) return 'text';
    if (FILE_CATEGORIES.external.has(ext)) return 'external';
    return 'binary'; // Unknown files treated as binary (open in system app)
}

// Theme state
let currentTheme = localStorage.getItem('theme') || 'dark';


// ─── DOM refs ─────────────────────────────────────────────────────────────────

const workspaceBar = document.getElementById('workspace-bar')!;
const workspaceList = document.getElementById('workspace-list')!;
const collapseBtn = document.getElementById('ws-collapse-btn')!;
const settingsBtn = document.getElementById('settings-btn')!;
const workspaceHeading = document.getElementById('workspace-heading')!;
const terminalPaneEl = document.getElementById('terminal-pane')!;
const emptyState = document.getElementById('empty-state')!;
const broadcastToggle = document.getElementById('broadcast-toggle') as HTMLInputElement;
const explorerTree = document.getElementById('explorer-tree')!;
const explorerTitle = document.getElementById('explorer-title')!;
const explorerBreadcrumb = document.getElementById('explorer-breadcrumb')!;
const viewerContent = document.getElementById('viewer-content')!;
const viewerFilepath = document.getElementById('viewer-filepath')!;
const ctxMenu = document.getElementById('ws-context-menu')!;
const ctxRename = document.getElementById('ctx-rename')!;
const ctxDelete = document.getElementById('ctx-delete')!;
const explorerCtxMenu = document.getElementById('explorer-context-menu')!;
const ctxCopyRelative = document.getElementById('ctx-copy-relative')!;
const ctxCopyAbsolute = document.getElementById('ctx-copy-absolute')!;
const ctxCopyName = document.getElementById('ctx-copy-name')!;
const ctxOpenExternal = document.getElementById('ctx-open-external')!;
const settingsOverlay = document.getElementById('settings-overlay')!;
const settingsClose = document.getElementById('settings-close')!;
const settingsWsList = document.getElementById('settings-ws-list')!;
const settingsAddWs = document.getElementById('settings-add-ws')!;
const terminalTabsEl = document.getElementById('terminal-tabs')!;
const terminalAddBtn = document.getElementById('terminal-add-btn')!;
const extStatus = document.getElementById('ext-status')!;
const serverStatusIndicator = document.getElementById('server-status-indicator')!;
const serverIpEl = document.getElementById('server-ip')!;

// ─── Server Status ─────────────────────────────────────────────────────────────

async function updateServerStatus() {
    try {
        const status = await api.serverGetStatus();
        if (status.running) {
            serverStatusIndicator.className = 'status-ok';
            serverStatusIndicator.title = `Server running on port ${status.port}`;
            // Show first network IP, or localhost if no network IP
            const displayIp = status.networkIps.length > 0 ? status.networkIps[0] : status.localIp;
            serverIpEl.textContent = `${displayIp}:${status.port}`;
        } else {
            serverStatusIndicator.className = 'status-off';
            serverStatusIndicator.title = status.error || 'Server not running';
            serverIpEl.textContent = '--';
        }
    } catch (e) {
        serverStatusIndicator.className = 'status-error';
        serverStatusIndicator.title = 'Error checking server status';
        serverIpEl.textContent = 'err';
    }
}

// Update server status on load and periodically
updateServerStatus();
setInterval(updateServerStatus, 30000); // Check every 30 seconds

// Click to copy server URL
serverIpEl.addEventListener('click', async () => {
    const status = await api.serverGetStatus();
    if (!status.running) return;
    
    const displayIp = status.networkIps.length > 0 ? status.networkIps[0] : status.localIp;
    const url = `http://${displayIp}:${status.port}`;
    
    try {
        await navigator.clipboard.writeText(url);
        const originalText = serverIpEl.textContent;
        serverIpEl.textContent = 'Copied!';
        serverIpEl.style.color = 'var(--accent)';
        setTimeout(() => {
            serverIpEl.textContent = originalText;
            serverIpEl.style.color = '';
        }, 1500);
    } catch (e) {
        console.error('Failed to copy URL:', e);
    }
});

// ─── Top Bar ─────────────────────────────────────────────────────────────────

collapseBtn.addEventListener('click', () => {
    wsBarCollapsed = !wsBarCollapsed;
    workspaceBar.classList.toggle('collapsed', wsBarCollapsed);
    collapseBtn.textContent = wsBarCollapsed ? '▶' : '◀';
    refreshTerminal();
});

settingsBtn.addEventListener('click', () => {
    renderSettingsPanel();
    settingsOverlay.classList.remove('hidden');
});

// Settings tab switching
document.querySelectorAll('.settings-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset.tab!;
        document.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.settings-section').forEach(s => s.classList.add('hidden'));
        document.getElementById(`tab-${tab}`)?.classList.remove('hidden');
    });
});

settingsClose.addEventListener('click', () => settingsOverlay.classList.add('hidden'));
settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) settingsOverlay.classList.add('hidden');
});

// ─── Theme System ─────────────────────────────────────────────────────────────

interface Theme {
    background: string; foreground: string;
    black: string; red: string; green: string; yellow: string;
    blue: string; magenta: string; cyan: string; white: string;
    brightBlack: string; brightRed: string; brightGreen: string; brightYellow: string;
    brightBlue: string; brightMagenta: string; brightCyan: string; brightWhite: string;
    cursor: string; selectionBackground: string;
}

const THEMES: Record<string, Theme> = {
    'dark': {
        background: '#1a1a1a', foreground: '#d4d4d4',
        black: '#1a1a1a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
        blue: '#89b4fa', magenta: '#cba6f7', cyan: '#89dceb', white: '#cdd6f4',
        brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1', brightYellow: '#f9e2af',
        brightBlue: '#89b4fa', brightMagenta: '#cba6f7', brightCyan: '#89dceb', brightWhite: '#a6adc8',
        cursor: '#cdd6f4', selectionBackground: '#45475a',
    },
    'tokyo-night': {
        background: '#1a1b26', foreground: '#a9b1d6',
        black: '#1a1b26', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68',
        blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#a9b1d6',
        brightBlack: '#414868', brightRed: '#f7768e', brightGreen: '#9ece6a', brightYellow: '#e0af68',
        brightBlue: '#7aa2f7', brightMagenta: '#bb9af7', brightCyan: '#7dcfff', brightWhite: '#c0caf5',
        cursor: '#c0caf5', selectionBackground: '#33467C',
    },
    'light': {
        background: '#ffffff', foreground: '#333333',
        black: '#000000', red: '#cd3131', green: '#00bc00', yellow: '#949800',
        blue: '#0451a5', magenta: '#bc05bc', cyan: '#0598bc', white: '#555555',
        brightBlack: '#666666', brightRed: '#cd3131', brightGreen: '#14e314', brightYellow: '#b5ba00',
        brightBlue: '#0451a5', brightMagenta: '#bc05bc', brightCyan: '#0598bc', brightWhite: '#a5a5a5',
        cursor: '#333333', selectionBackground: '#add6ff',
    },
    'solarized-light': {
        background: '#fdf6e3', foreground: '#657b83',
        black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900',
        blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
        brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83',
        brightBlue: '#839496', brightMagenta: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3',
        cursor: '#657b83', selectionBackground: '#eee8d5',
    }
};

function applyTheme(themeId: string) {
    currentTheme = themeId;
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('theme', themeId);

    // Update active terminal theme if any
    if (activeTerm) {
        activeTerm.options.theme = THEMES[themeId];
    }

    // Update theme card UI
    document.querySelectorAll('.theme-card').forEach(card => {
        card.classList.toggle('active', (card as HTMLElement).dataset.theme === themeId);
    });

    // Update VS Code Webview Theme
    const webview = document.getElementById('marketplace-webview') as Electron.WebviewTag;
    if (webview) {
        let vsTheme = 'Default Dark+';
        if (themeId === 'light') vsTheme = 'Default Light+';
        else if (themeId === 'solarized-light') vsTheme = 'Solarized Light';
        else if (themeId === 'tokyo-night') vsTheme = 'Default High Contrast'; // Closest built-in match for now

        const currentSrc = new URL(webview.src || 'http://localhost:8080/');
        currentSrc.searchParams.set('theme', vsTheme);
        if (webview.src !== currentSrc.toString()) {
            webview.src = currentSrc.toString();
        }
    }
}

document.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
        applyTheme((card as HTMLElement).dataset.theme!);
    });
});

// ─── Workspace Bar ────────────────────────────────────────────────────────────

function getInitials(name: string) { return name.substring(0, 2).toUpperCase(); }

const PRESET_COLORS = [
    '#5865F2', '#57F287', '#FEE75C', '#ED4245', '#EB459E', '#FF8C00', '#00B0F4', // Discord
    '#F28C28', '#A020F0', '#00FF00', '#FF00FF', '#00FFFF', '#FFD700', '#FF4500', // Bright
    '#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8', '#cba6f7', '#fab387', '#94e2d5', // Catppuccin
    '#74c7ec', '#89dceb', '#b4befe'
];

function getColor(id: string): string {
    let h = 0;
    for (const c of id) h = (h << 5) - h + c.charCodeAt(0);
    return PRESET_COLORS[Math.abs(h) % PRESET_COLORS.length];
}

function resolveColor(ws: Workspace) { return ws.color || getColor(ws.id); }

function renderWorkspaceBar() {
    workspaceList.innerHTML = '';
    for (const ws of workspaces) {
        const item = document.createElement('div');
        item.className = 'workspace-item' + (ws.id === activeWorkspaceId ? ' active' : '');
        item.title = ws.path;

        const icon = document.createElement('div');
        icon.className = 'workspace-icon';
        icon.style.backgroundColor = resolveColor(ws);
        icon.textContent = getInitials(ws.name);
        item.appendChild(icon);

        const lbl = document.createElement('span');
        lbl.className = 'workspace-label';
        lbl.textContent = ws.name;
        item.appendChild(lbl);

        item.addEventListener('click', () => switchWorkspace(ws.id));
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            ctxTargetWsId = ws.id;
            showContextMenu(e.clientX, e.clientY);
        });
        workspaceList.appendChild(item);
    }
    
    // Add the + button at the end
    const addBtn = document.createElement('div');
    addBtn.id = 'workspace-add-btn';
    addBtn.title = 'Add Workspace';
    addBtn.innerHTML = '<span>+</span>';
    addBtn.addEventListener('click', async () => {
        const ws = await api.workspacesAdd();
        if (ws) {
            workspaces.push(ws);
            await api.workspacesSave(workspaces);
            renderWorkspaceBar();
            switchWorkspace(ws.id);
        }
    });
    workspaceList.appendChild(addBtn);
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

function showContextMenu(x: number, y: number) {
    ctxMenu.style.left = `${x}px`;
    ctxMenu.style.top = `${y}px`;
    ctxMenu.classList.remove('hidden');
}
function hideContextMenu() { ctxMenu.classList.add('hidden'); }

window.addEventListener('click', () => hideContextMenu());
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hideContextMenu(); settingsOverlay.classList.add('hidden'); } });

ctxRename.addEventListener('click', async () => {
    hideContextMenu();
    if (!ctxTargetWsId) return;
    const ws = workspaces.find(w => w.id === ctxTargetWsId);
    if (!ws) return;
    const newName = prompt('Rename workspace:', ws.name);
    if (!newName || newName === ws.name) return;
    ws.name = newName;
    await api.workspacesSave(workspaces);
    renderWorkspaceBar();
    if (ws.id === activeWorkspaceId) workspaceHeading.textContent = ws.name;
});

ctxDelete.addEventListener('click', async () => {
    hideContextMenu();
    if (!ctxTargetWsId) return;
    await deleteWorkspace(ctxTargetWsId);
});

async function deleteWorkspace(wsId: string) {
    const ws = workspaces.find(w => w.id === wsId);
    if (!ws || !confirm(`Remove workspace "${ws.name}"?`)) return;

    // Kill PTY session for this workspace (if it exists)
    const savedState = workspaceTerminalStates.get(wsId);
    if (savedState && savedState.ptyId) {
        api.ptyKill({ id: savedState.ptyId });
        workspaceTerminalStates.delete(wsId); // Remove from saved state map
    }

    if (wsId === activeWorkspaceId && activePtyId) {
        api.ptyKill({ id: activePtyId });
        activePtyId = null;
        activeTerm?.dispose();
        activeTerm = null;
        activeFitAddon = null;
        terminalPaneEl.innerHTML = '';
        emptyState.classList.remove('hidden');
        activeWorkspaceId = null;
        workspaceHeading.textContent = '';
    }
    workspaces = workspaces.filter(w => w.id !== wsId);
    await api.workspacesSave(workspaces);
    renderWorkspaceBar();
    renderSettingsPanel();
    if (workspaces.length > 0 && !activeWorkspaceId) switchWorkspace(workspaces[0].id);
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function renderSettingsPanel() {
    settingsWsList.innerHTML = '';
    for (const ws of workspaces) {
        const row = document.createElement('div');
        row.className = 'settings-ws-row';

        // Color swatch
        const colorWrap = document.createElement('div');
        colorWrap.className = 'settings-ws-color';
        colorWrap.style.backgroundColor = resolveColor(ws);

        // Color dropdown/grid would be better but let's stick to picker + quick presets
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = resolveColor(ws);
        colorInput.addEventListener('input', async () => {
            ws.color = colorInput.value;
            colorWrap.style.backgroundColor = colorInput.value;
            await api.workspacesSave(workspaces);
            renderWorkspaceBar();
        });
        colorWrap.appendChild(colorInput);
        row.appendChild(colorWrap);

        // Preset colors quick set
        const presetGrid = document.createElement('div');
        presetGrid.className = 'color-presets';
        PRESET_COLORS.slice(0, 14).forEach(c => {
            const p = document.createElement('div');
            p.className = 'color-dot';
            p.style.backgroundColor = c;
            p.onclick = async () => {
                ws.color = c;
                colorInput.value = c;
                colorWrap.style.backgroundColor = c;
                await api.workspacesSave(workspaces);
                renderWorkspaceBar();
            };
            presetGrid.appendChild(p);
        });
        row.appendChild(presetGrid);

        // Name input
        const nameInput = document.createElement('input');
        nameInput.className = 'settings-ws-name';
        nameInput.type = 'text';
        nameInput.value = ws.name;
        nameInput.addEventListener('change', async () => {
            ws.name = nameInput.value.trim() || ws.name;
            nameInput.value = ws.name;
            await api.workspacesSave(workspaces);
            renderWorkspaceBar();
            if (ws.id === activeWorkspaceId) workspaceHeading.textContent = ws.name;
        });
        row.appendChild(nameInput);

        // Path
        const pathSpan = document.createElement('span');
        pathSpan.className = 'settings-ws-path';
        pathSpan.title = ws.path;
        pathSpan.textContent = ws.path.replace(/^.*\//, '…/');
        row.appendChild(pathSpan);

        // Delete
        const delBtn = document.createElement('button');
        delBtn.className = 'settings-ws-del';
        delBtn.textContent = '🗑';
        delBtn.title = 'Remove';
        delBtn.addEventListener('click', () => deleteWorkspace(ws.id));
        row.appendChild(delBtn);

        settingsWsList.appendChild(row);
    }
}

settingsAddWs.addEventListener('click', async () => {
    const ws = await api.workspacesAdd();
    if (ws) {
        workspaces.push(ws);
        await api.workspacesSave(workspaces);
        renderWorkspaceBar();
        renderSettingsPanel();
        switchWorkspace(ws.id);
    }
});

// ─── Extensions Management ──────────────────────────────────────────────────

async function installExtension(id: string) {
    if (!id) return;
    extStatus.style.display = 'block';
    extStatus.textContent = `Installing ${id}...`;
    extStatus.style.color = 'var(--accent)';
    try {
        const { stderr } = await api.execRun(`code --install-extension ${id}`);
        if (stderr.toLowerCase().includes('failed') || stderr.toLowerCase().includes('error')) {
            extStatus.textContent = `Error: ${stderr}`;
            extStatus.style.color = '#f38ba8';
        } else {
            extStatus.textContent = `Successfully installed ${id}.`;
            extStatus.style.color = '#a6e3a1';
        }
    } catch (e) {
        extStatus.textContent = `Failed to install ${id}.`;
        extStatus.style.color = '#f38ba8';
    }
    setTimeout(() => { extStatus.style.display = 'none'; }, 6000);
}

// Ensure api.onExtensionInstall is bound
api.onExtensionInstall((id: string) => installExtension(id));



// ─── Switch Workspace ─────────────────────────────────────────────────────
async function switchWorkspace(wsId: string) {
    if (wsId === activeWorkspaceId) return;

    if (currentTheme !== 'dark' && currentTheme !== 'tokyo-night') {
        applyTheme('dark');
    }

    // STEP 1: Hide current terminal (keep alive)
    if (activeWorkspaceId && activeTerm && activeTerm.element) {
        try {
            activeTerm.element.style.display = 'none';
        } catch (e) {
            console.error('Error hiding terminal:', e);
        }
    }

    // STEP 2: Update workspace reference
    activeWorkspaceId = wsId;
    const ws = workspaces.find(w => w.id === wsId)!;

    emptyState.classList.add('hidden');
    workspaceHeading.textContent = ws.name;
    renderWorkspaceBar();

    // STEP 3: Get or create terminal tabs for this workspace
    try {
        let tabs = workspaceTerminals.get(wsId);
        
        if (!tabs || tabs.length === 0) {
            tabs = [];
            workspaceTerminals.set(wsId, tabs);
            createTerminalTab(ws.path); // Sync now
            tabs = workspaceTerminals.get(wsId)!;
        }

        // Render tabs UI
        renderTerminalTabs();
        
        // Switch to first tab (or active one if exists)
        const tabToActivate = tabs.find(t => t.id === activeTabId) || tabs[0];
        if (tabToActivate) {
            switchTerminalTab(tabToActivate.id);
        }
    } catch (e) {
        console.error('Error setting up terminal tabs:', e);
    }

    // Always load explorer
    loadExplorer(ws.path, ws.name);
}

// ─── Terminal Tab Management ─────────────────────────────────────────────────────

// Update grid layout based on terminal count
function updateTerminalGrid() {
    const tabs = workspaceTerminals.get(activeWorkspaceId!) || [];
    terminalPaneEl.setAttribute('data-count', String(tabs.length));
    
    // Show/hide tabs bar based on count (hide if single terminal in grid mode)
    // terminalTabsEl.style.display = tabs.length <= 1 ? 'flex' : 'flex';
}

// Create a grid cell for a terminal
function createTerminalCell(tab: TerminalTab): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'terminal-cell';
    cell.dataset.tabId = tab.id;
    
    // Header with drag handle
    const header = document.createElement('div');
    header.className = 'terminal-cell-header';
    header.draggable = true;
    header.innerHTML = `
        <span class="terminal-cell-title">${tab.title}</span>
        <button class="terminal-cell-close" title="Close">×</button>
    `;
    
    // Content area
    const content = document.createElement('div');
    content.className = 'terminal-cell-content';
    
    cell.appendChild(header);
    cell.appendChild(content);
    
    // Drag events
    header.addEventListener('dragstart', (e) => {
        cell.classList.add('dragging');
        e.dataTransfer?.setData('text/plain', tab.id);
    });
    
    header.addEventListener('dragend', () => {
        cell.classList.remove('dragging');
    });
    
    cell.addEventListener('dragover', (e) => {
        e.preventDefault();
        cell.classList.add('drag-over');
    });
    
    cell.addEventListener('dragleave', () => {
        cell.classList.remove('drag-over');
    });
    
    cell.addEventListener('drop', (e) => {
        e.preventDefault();
        cell.classList.remove('drag-over');
        const draggedId = e.dataTransfer?.getData('text/plain');
        if (draggedId && draggedId !== tab.id) {
            swapTerminals(draggedId, tab.id);
        }
    });
    
    // Close button
    header.querySelector('.terminal-cell-close')?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTerminalTab(tab.id);
    });
    
    // Click to activate
    cell.addEventListener('click', () => {
        switchTerminalTab(tab.id);
    });
    
    return cell;
}

// Swap two terminals in the layout
function swapTerminals(id1: string, id2: string) {
    const tabs = workspaceTerminals.get(activeWorkspaceId!) || [];
    const idx1 = tabs.findIndex(t => t.id === id1);
    const idx2 = tabs.findIndex(t => t.id === id2);
    
    if (idx1 === -1 || idx2 === -1) return;
    
    // Swap in array
    [tabs[idx1], tabs[idx2]] = [tabs[idx2], tabs[idx1]];
    workspaceTerminals.set(activeWorkspaceId!, tabs);
    
    // Re-render grid
    renderTerminalGrid();
}

// Render all terminals in grid
function renderTerminalGrid() {
    const tabs = workspaceTerminals.get(activeWorkspaceId!) || [];
    terminalPaneEl.innerHTML = '';
    
    tabs.forEach(tab => {
        if (!tab.cell) {
            tab.cell = createTerminalCell(tab);
            const content = tab.cell.querySelector('.terminal-cell-content') as HTMLElement;
            content.appendChild(tab.container);
            tab.container.style.display = '';
            tab.container.style.position = 'absolute';
            tab.container.style.inset = '0';
        }
        terminalPaneEl.appendChild(tab.cell);
    });
    
    updateTerminalGrid();
    
    // Mark active cell
    tabs.forEach(tab => {
        if (tab.cell) {
            tab.cell.classList.toggle('active', tab.id === activeTabId);
        }
    });
}

function renderTerminalTabs() {
    const tabs = workspaceTerminals.get(activeWorkspaceId!) || [];
    terminalTabsEl.innerHTML = '';
    
    tabs.forEach(tab => {
        const tabEl = document.createElement('button');
        tabEl.className = `terminal-tab ${tab.id === activeTabId ? 'active' : ''}`;
        tabEl.innerHTML = `
            <span class="terminal-tab-title">${tab.title}</span>
            <span class="terminal-tab-close" data-tab-id="${tab.id}">×</span>
        `;
        
        tabEl.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('terminal-tab-close')) {
                closeTerminalTab(tab.id);
            } else {
                switchTerminalTab(tab.id);
            }
        });
        
        terminalTabsEl.appendChild(tabEl);
    });
}

function switchTerminalTab(tabId: string) {
    const tabs = workspaceTerminals.get(activeWorkspaceId!) || [];
    const tab = tabs.find(t => t.id === tabId);
    
    if (!tab) return;
    
    // Update active cell classes
    tabs.forEach(t => {
        if (t.cell) {
            t.cell.classList.toggle('active', t.id === tabId);
        }
    });
    
    // Update active references
    activeTabId = tabId;
    activeTerm = tab.term;
    activeFitAddon = tab.fitAddon;
    activePtyId = tab.ptyId;
    
    // Resize to fit
    requestAnimationFrame(() => {
        try {
            activeFitAddon!.fit();
            api.ptyResize({ 
                id: activePtyId!, 
                cols: activeTerm!.cols, 
                rows: activeTerm!.rows 
            });
        } catch (e) {
            console.error('Error resizing terminal:', e);
        }
    });
    
    try {
        activeTerm.focus();
    } catch (e) {
        console.error('Error focusing terminal:', e);
    }
    renderTerminalTabs();
}

function createTerminalTab(cwd: string): TerminalTab {
    const tabId = generateTabId();
    const ptyId = `pty-${activeWorkspaceId}-${tabId}`;
    
    const term = new Terminal({
        fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
        fontSize: 13, lineHeight: 1.2, cursorBlink: true,
        theme: THEMES[currentTheme],
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    
    // Create container for this terminal
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;inset:0;';
    term.open(container);

    const tab: TerminalTab = {
        id: tabId,
        title: 'Terminal',
        term,
        fitAddon,
        ptyId,
        container,
        cell: undefined
    };

    // Add to workspace's tabs
    const tabs = workspaceTerminals.get(activeWorkspaceId!) || [];
    tabs.push(tab);
    workspaceTerminals.set(activeWorkspaceId!, tabs);

    // Create PTY (non-blocking)
    requestAnimationFrame(() => {
        try {
            fitAddon.fit();
            const { cols, rows } = term;
            api.ptyCreate({ id: ptyId, cwd, cols, rows });
        } catch (e) {
            console.error('Error creating PTY:', e);
        }
    });

    term.onData((data) => { 
        if (activePtyId === ptyId) {
            api.ptyInput({ id: ptyId, data }); 
        }
    });

    // Render grid and switch to new tab
    renderTerminalGrid();
    switchTerminalTab(tabId);
    
    return tab;
}

function closeTerminalTab(tabId: string) {
    const tabs = workspaceTerminals.get(activeWorkspaceId!) || [];
    
    if (tabs.length <= 1) {
        // Don't close last tab, reset instead
        resetCurrentTerminal();
        return;
    }
    
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;
    
    const tab = tabs[tabIndex];
    
    // Kill PTY
    api.ptyKill({ id: tab.ptyId });
    
    // Dispose terminal and remove cell
    tab.term.dispose();
    if (tab.cell && tab.cell.parentElement) {
        tab.cell.parentElement.removeChild(tab.cell);
    }
    
    // Remove from array
    tabs.splice(tabIndex, 1);
    workspaceTerminals.set(activeWorkspaceId!, tabs);
    
    // Re-render grid
    renderTerminalGrid();
    
    // If closing active tab, switch to another
    if (tabId === activeTabId && tabs.length > 0) {
        const newActiveTab = tabs[Math.min(tabIndex, tabs.length - 1)];
        switchTerminalTab(newActiveTab.id);
    }
    
    renderTerminalTabs();
}

// Add terminal button handler
terminalAddBtn.addEventListener('click', () => {
    if (!activeWorkspaceId) return;
    const ws = workspaces.find(w => w.id === activeWorkspaceId);
    if (!ws) return;
    
    createTerminalTab(ws.path);
});

function resetCurrentTerminal() {
    if (!activeWorkspaceId || !activeTabId) return;
    
    const tabs = workspaceTerminals.get(activeWorkspaceId!) || [];
    const tabIndex = tabs.findIndex(t => t.id === activeTabId);
    if (tabIndex === -1) return;
    
    const tab = tabs[tabIndex];
    const ws = workspaces.find(w => w.id === activeWorkspaceId);
    if (!ws) return;
    
    // Kill existing PTY
    api.ptyKill({ id: tab.ptyId });
    
    // Dispose old terminal and remove old container
    tab.term.dispose();
    if (tab.container && tab.container.parentElement) {
        tab.container.parentElement.removeChild(tab.container);
    }
    
    // Create new terminal for this tab
    const term = new Terminal({
        fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
        fontSize: 13, lineHeight: 1.2, cursorBlink: true,
        theme: THEMES[currentTheme],
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    
    // Create new container
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;inset:0;';
    terminalPaneEl.appendChild(container);
    term.open(container);

    const newPtyId = `pty-${activeWorkspaceId}-${activeTabId}-${Date.now()}`;
    
    // Update tab
    tab.term = term;
    tab.fitAddon = fitAddon;
    tab.ptyId = newPtyId;
    tab.title = 'Terminal';
    tab.container = container;
    
    // Update active references
    activeTerm = term;
    activeFitAddon = fitAddon;
    activePtyId = newPtyId;

    requestAnimationFrame(() => {
        fitAddon.fit();
        const { cols, rows } = term;
        api.ptyCreate({ id: newPtyId, cwd: ws.path, cols, rows });
    });
    
    term.onData((data) => { 
        if (activePtyId === newPtyId) {
            api.ptyInput({ id: newPtyId, data }); 
        }
    });
    term.focus();
    
    renderTerminalTabs();
}

// ─── File Explorer ────────────────────────────────────────────────────────────

type SortKey = 'name' | 'type' | 'date' | 'size';
interface SortState { key: SortKey; asc: boolean; filter: string; }
let explorerSort: SortState = { key: 'name', asc: true, filter: '' };
let currentExplorerPath = '';
let currentExplorerLabel = '';

// Set up sort buttons
const sortBtns = document.querySelectorAll('.sort-btn');
const explorerFilterInput = document.getElementById('explorer-filter') as HTMLInputElement;

sortBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const key = (btn as HTMLElement).dataset.sort as SortKey;
        if (explorerSort.key === key) {
            explorerSort.asc = !explorerSort.asc;
        } else {
            explorerSort.key = key;
            explorerSort.asc = true;
        }
        sortBtns.forEach(b => {
            b.classList.toggle('active', (b as HTMLElement).dataset.sort === key);
            // Show arrow on active button
            const bEl = b as HTMLElement;
            if (bEl.dataset.sort === key) {
                bEl.textContent = `${bEl.dataset.sort!.charAt(0).toUpperCase()}${bEl.dataset.sort!.slice(1)} ${explorerSort.asc ? '↑' : '↓'}`;
            } else {
                bEl.textContent = `${bEl.dataset.sort!.charAt(0).toUpperCase()}${bEl.dataset.sort!.slice(1)}`;
            }
        });
    });
});

// ─── Explorer Keyboard Navigation ─────────────────────────────────────────────

let selectedExplorerIndex = -1;
let explorerItems: HTMLElement[] = [];

// Get all visible tree items
function updateExplorerItems() {
    explorerItems = Array.from(explorerTree.querySelectorAll('.tree-item:not(.hidden)')) as HTMLElement[];
}

// Update visual selection
function updateExplorerSelection() {
    explorerItems.forEach((item, index) => {
        item.classList.toggle('selected', index === selectedExplorerIndex);
    });
    
    // Scroll into view if needed
    if (selectedExplorerIndex >= 0 && explorerItems[selectedExplorerIndex]) {
        explorerItems[selectedExplorerIndex].scrollIntoView({ block: 'nearest' });
    }
}

// Keyboard navigation handler
explorerTree.addEventListener('keydown', (e) => {
    updateExplorerItems();
    
    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            if (selectedExplorerIndex < explorerItems.length - 1) {
                selectedExplorerIndex++;
                updateExplorerSelection();
            }
            break;
            
        case 'ArrowUp':
            e.preventDefault();
            if (selectedExplorerIndex > 0) {
                selectedExplorerIndex--;
                updateExplorerSelection();
            } else if (selectedExplorerIndex < 0 && explorerItems.length > 0) {
                selectedExplorerIndex = 0;
                updateExplorerSelection();
            }
            break;
            
        case 'Enter':
            e.preventDefault();
            if (selectedExplorerIndex >= 0 && explorerItems[selectedExplorerIndex]) {
                explorerItems[selectedExplorerIndex].click();
            }
            break;
            
        case 'Backspace':
            e.preventDefault();
            // Go up one directory
            if (currentExplorerPath && currentExplorerPath !== '/') {
                const parentPath = currentExplorerPath.split('/').slice(0, -1).join('/') || '/';
                const parentName = parentPath.split('/').pop() || 'Root';
                loadExplorer(parentPath, parentName);
            }
            break;
    }
});

// Focus filter on '/' or Ctrl+F
document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== explorerFilterInput) {
        e.preventDefault();
        explorerFilterInput?.focus();
    }
    if (e.key === 'f' && (e.ctrlKey || e.metaKey) && document.activeElement !== explorerFilterInput) {
        e.preventDefault();
        explorerFilterInput?.focus();
    }
});

// Make explorer tree focusable
explorerTree.setAttribute('tabindex', '0');

// Reset selection when clicking on an item
explorerTree.addEventListener('click', () => {
    updateExplorerItems();
    selectedExplorerIndex = explorerItems.findIndex(item => item.classList.contains('selected'));
});

async function loadExplorer(dirPath: string, label?: string) {
    currentExplorerPath = dirPath;
    currentExplorerLabel = label || dirPath;
    explorerTitle.textContent = currentExplorerLabel.toUpperCase();
    updateBreadcrumb(dirPath);
    explorerTree.innerHTML = '';
    await renderDir(dirPath, explorerTree, 0);
}

// Update breadcrumb navigation
function updateBreadcrumb(dirPath: string) {
    explorerBreadcrumb.innerHTML = '';
    
    // Split path into segments
    const parts = dirPath.split('/').filter(p => p);
    
    // Add root/home icon
    const rootItem = document.createElement('span');
    rootItem.className = 'breadcrumb-item';
    rootItem.innerHTML = '🏠';
    rootItem.title = '/';
    rootItem.addEventListener('click', () => loadExplorer('/', 'Root'));
    explorerBreadcrumb.appendChild(rootItem);
    
    // Build path progressively
    let accumulatedPath = '';
    parts.forEach((part, index) => {
        accumulatedPath += '/' + part;
        const currentPath = accumulatedPath;
        
        // Separator
        const sep = document.createElement('span');
        sep.className = 'breadcrumb-separator';
        sep.textContent = '›';
        explorerBreadcrumb.appendChild(sep);
        
        // Path item
        const item = document.createElement('span');
        item.className = 'breadcrumb-item' + (index === parts.length - 1 ? ' active' : '');
        item.textContent = part;
        item.title = currentPath;
        
        // Click to navigate
        if (index < parts.length - 1) {
            item.addEventListener('click', () => loadExplorer(currentPath, part));
        }
        
        explorerBreadcrumb.appendChild(item);
    });
}

function sortEntries(entries: { name: string; isDir: boolean; mtime: number; size: number }[]): typeof entries {
    const { key, asc, filter } = explorerSort;
    const filtered = filter
        ? entries.filter(e => e.name.toLowerCase().includes(filter))
        : entries;

    const compare = (a: typeof entries[0], b: typeof entries[0]): number => {
        let delta = 0;
        switch (key) {
            case 'name': delta = a.name.localeCompare(b.name); break;
            case 'type': {
                const extA = a.isDir ? '' : (a.name.split('.').pop() || '');
                const extB = b.isDir ? '' : (b.name.split('.').pop() || '');
                delta = extA.localeCompare(extB) || a.name.localeCompare(b.name);
                break;
            }
            case 'date': delta = (a.mtime || 0) - (b.mtime || 0); break;
            case 'size': delta = (a.size || 0) - (b.size || 0); break;
        }
        return asc ? delta : -delta;
    };

    const dirs = filtered.filter(e => e.isDir).sort(compare);
    const files = filtered.filter(e => !e.isDir).sort(compare);
    // Dirs always on top (like Finder)
    return [...dirs, ...files];
}

async function renderDir(dirPath: string, container: HTMLElement, depth: number) {
    try {
        const raw = await api.fsReadDir(dirPath) as { name: string; isDir: boolean; mtime: number; size: number }[];
        // Only filter dotfiles at root when no filter active
        const entries = depth === 0 && !explorerSort.filter
            ? raw.filter(e => !e.name.startsWith('.'))
            : raw;

        // Check if we should group by type
        if (explorerSort.key === 'type' && depth === 0) {
            // Type grouping (hamburger menu style)
            const groups = groupEntriesByType(entries);
            
            for (const [typeLabel, typeEntries] of groups) {
                // Create collapsible group header
                const groupHeader = document.createElement('div');
                groupHeader.className = 'tree-group-header';
                groupHeader.innerHTML = `
                    <span class="group-icon">▼</span>
                    <span class="group-label">${typeLabel}</span>
                    <span class="group-count">(${typeEntries.length})</span>
                `;
                container.appendChild(groupHeader);
                
                // Create group content container
                const groupContent = document.createElement('div');
                groupContent.className = 'tree-group-content';
                
                // Render entries in this group
                for (const entry of typeEntries) {
                    renderEntry(entry, dirPath, groupContent, depth);
                }
                
                container.appendChild(groupContent);
                
                // Toggle group visibility on click
                groupHeader.addEventListener('click', () => {
                    const icon = groupHeader.querySelector('.group-icon')!;
                    const isCollapsed = groupContent.classList.toggle('collapsed');
                    icon.textContent = isCollapsed ? '▶' : '▼';
                });
            }
        } else {
            // Regular sorting
            const sorted = sortEntries(entries);
            for (const entry of sorted) {
                renderEntry(entry, dirPath, container, depth);
            }
        }
    } catch {
        const err = document.createElement('div');
        err.className = 'tree-item';
        err.style.color = '#f38ba8';
        err.textContent = '⚠ permission denied';
        container.appendChild(err);
    }
}

// Render a single entry (file or folder)
function renderEntry(entry: { name: string; isDir: boolean; mtime: number; size: number }, dirPath: string, container: HTMLElement, depth: number) {
    const item = document.createElement('div');
    item.className = 'tree-item' + (entry.isDir ? ' dir' : '');
    item.style.paddingLeft = `${8 + depth * 14}px`;

    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.textContent = entry.isDir ? '📁' : getFileIcon(entry.name);
    item.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'tree-name';
    name.textContent = entry.name;
    item.appendChild(name);

    // Date stamp (shown on hover via CSS, in a metadata span)
    if (entry.mtime) {
        const meta = document.createElement('span');
        meta.className = 'tree-meta';
        const d = new Date(entry.mtime);
        if (explorerSort.key === 'date') {
            meta.textContent = d.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' });
        } else if (explorerSort.key === 'size' && !entry.isDir) {
            meta.textContent = entry.size > 1024 * 1024
                ? `${(entry.size / 1024 / 1024).toFixed(1)}MB`
                : entry.size > 1024 ? `${(entry.size / 1024).toFixed(0)}KB` : `${entry.size}B`;
        }
        item.appendChild(meta);
    }

    const fullPath = `${dirPath}/${entry.name}`;
    if (entry.isDir) {
        let expanded = false;
        let childContainer: HTMLElement | null = null;
        item.addEventListener('click', async (e) => {
            e.stopPropagation();
            expanded = !expanded;
            icon.textContent = expanded ? '📂' : '📁';
            if (expanded) {
                childContainer = document.createElement('div');
                item.after(childContainer);
                await renderDir(fullPath, childContainer, depth + 1);
            } else { childContainer?.remove(); childContainer = null; }
        });
    } else {
        item.addEventListener('click', () => openFile(fullPath, item));
    }
    
    // Right-click context menu
    item.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Use HTML context menu (works in both Electron and web mode)
        showExplorerContextMenu(fullPath, entry.isDir, e.clientX, e.clientY);
    });
    
    container.appendChild(item);
}

// Current context menu target path
let currentContextPath = '';
let currentContextIsDir = false;

// Show HTML context menu for explorer
function showExplorerContextMenu(filePath: string, isDir: boolean, x: number, y: number) {
    currentContextPath = filePath;
    currentContextIsDir = isDir;
    
    // Position and show menu
    explorerCtxMenu.style.left = `${x}px`;
    explorerCtxMenu.style.top = `${y}px`;
    explorerCtxMenu.classList.remove('hidden');
    
    // Adjust position if menu would go off screen
    requestAnimationFrame(() => {
        const rect = explorerCtxMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            explorerCtxMenu.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            explorerCtxMenu.style.top = `${y - rect.height}px`;
        }
    });
}

// Hide context menu on click outside
document.addEventListener('click', () => {
    explorerCtxMenu.classList.add('hidden');
});

// Context menu actions
ctxCopyRelative.addEventListener('click', async () => {
    try {
        const relativePath = getRelativePath(currentContextPath);
        await navigator.clipboard.writeText(relativePath);
    } catch {
        console.error('Failed to copy relative path');
    }
    explorerCtxMenu.classList.add('hidden');
});

ctxCopyAbsolute.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(currentContextPath);
    } catch {
        console.error('Failed to copy absolute path');
    }
    explorerCtxMenu.classList.add('hidden');
});

ctxCopyName.addEventListener('click', async () => {
    const name = currentContextPath.split('/').pop() || '';
    try {
        await navigator.clipboard.writeText(name);
    } catch {
        console.error('Failed to copy name');
    }
    explorerCtxMenu.classList.add('hidden');
});

ctxOpenExternal.addEventListener('click', async () => {
    await api.shellOpenExternal(currentContextPath);
    explorerCtxMenu.classList.add('hidden');
});

// Get relative path from workspace root
function getRelativePath(absolutePath: string): string {
    if (!activeWorkspaceId) return absolutePath;
    
    const ws = workspaces.find(w => w.id === activeWorkspaceId);
    if (!ws || !ws.path) return absolutePath;
    
    const workspacePath = ws.path;
    
    // Check if path starts with workspace path
    if (absolutePath.startsWith(workspacePath)) {
        let relative = absolutePath.slice(workspacePath.length);
        // Remove leading slash if present
        if (relative.startsWith('/')) {
            relative = relative.slice(1);
        }
        return relative || '.';
    }
    
    return absolutePath;
}

function getFileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
        ts: '🔵', tsx: '🔵', js: '🟡', jsx: '🟡', py: '🐍', rs: '🦀', go: '🐹',
        md: '📝', json: '⚙️', yaml: '⚙️', yml: '⚙️', css: '🎨', html: '🌐',
        png: '🖼', jpg: '🖼', svg: '🖼', gif: '🖼', sh: '⚡', env: '🔒',
        pdf: '📕', zip: '📦', tar: '📦', gz: '📦',
    };
    return map[ext] || '📄';
}

// Get file type label for grouping
function getFileTypeLabel(entry: { name: string; isDir: boolean }): string {
    if (entry.isDir) return 'Folders';
    
    const ext = entry.name.split('.').pop()?.toLowerCase() || '';
    
    // Type groups with labels and icons
    const typeGroups: Record<string, { label: string; extensions: Set<string> }> = {
        'TypeScript': { label: 'TypeScript', extensions: new Set(['ts', 'tsx']) },
        'JavaScript': { label: 'JavaScript', extensions: new Set(['js', 'jsx', 'mjs', 'cjs']) },
        'Python': { label: 'Python', extensions: new Set(['py', 'pyw', 'pyi']) },
        'Rust': { label: 'Rust', extensions: new Set(['rs']) },
        'Go': { label: 'Go', extensions: new Set(['go']) },
        'Styles': { label: 'Styles', extensions: new Set(['css', 'scss', 'sass', 'less']) },
        'HTML': { label: 'HTML', extensions: new Set(['html', 'htm', 'xhtml']) },
        'Markup': { label: 'Markup', extensions: new Set(['md', 'mdx', 'rst', 'txt']) },
        'Config': { label: 'Config', extensions: new Set(['json', 'yaml', 'yml', 'toml', 'ini', 'env', 'editorconfig', 'eslintrc', 'prettierrc']) },
        'Images': { label: 'Images', extensions: new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp']) },
        'Documents': { label: 'Documents', extensions: new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']) },
        'Archives': { label: 'Archives', extensions: new Set(['zip', 'tar', 'gz', 'rar', '7z', 'bz2']) },
        'Shell': { label: 'Shell', extensions: new Set(['sh', 'bash', 'zsh', 'fish']) },
    };
    
    for (const [_, group] of Object.entries(typeGroups)) {
        if (group.extensions.has(ext)) {
            return group.label;
        }
    }
    
    // If has extension but not in groups
    if (ext) return `${ext.toUpperCase()} Files`;
    return 'Other';
}

// Group entries by type for hamburger menu style display
function groupEntriesByType(entries: { name: string; isDir: boolean; mtime: number; size: number }[]): Map<string, typeof entries> {
    const groups = new Map<string, typeof entries>();
    
    // First, separate folders
    const folders = entries.filter(e => e.isDir);
    const files = entries.filter(e => !e.isDir);
    
    if (folders.length > 0) {
        groups.set('Folders', folders.sort((a, b) => a.name.localeCompare(b.name)));
    }
    
    // Group files by type
    const fileGroups = new Map<string, typeof entries>();
    for (const file of files) {
        const typeLabel = getFileTypeLabel(file);
        if (!fileGroups.has(typeLabel)) {
            fileGroups.set(typeLabel, []);
        }
        fileGroups.get(typeLabel)!.push(file);
    }
    
    // Sort files within each group and add to main groups map
    const sortedTypes = Array.from(fileGroups.keys()).sort();
    for (const type of sortedTypes) {
        const files = fileGroups.get(type)!;
        files.sort((a, b) => a.name.localeCompare(b.name));
        groups.set(type, files);
    }
    
    return groups;
}

async function openFile(filePath: string, itemEl: HTMLElement) {
    document.querySelectorAll('.tree-item.selected').forEach(el => el.classList.remove('selected'));
    itemEl.classList.add('selected');

    const category = getFileCategory(filePath);

    switch (category) {
        case 'pdf':
            openPdfViewer(filePath);
            return;
        case 'image':
            openImageViewer(filePath);
            return;
        case 'external':
        case 'binary':
            // Open in system default application
            await api.shellOpenExternal(filePath);
            return;
        case 'text':
        default:
            // Text viewer (in File Viewer)
            switchRightView('viewer');
            viewerFilepath.textContent = filePath.split('/').slice(-2).join('/');
            viewerContent.innerHTML = '';
            try {
                const content = await api.fsReadFile(filePath);
                const pre = document.createElement('pre');
                pre.textContent = content;
                viewerContent.appendChild(pre);
            } catch {
                viewerContent.innerHTML = '<pre style="color:#f38ba8;padding:12px">⚠ Binary or unreadable file</pre>';
            }
            return;
    }
}

// ─── PTY IPC ─────────────────────────────────────────────────────────────────

api.onPtyData(({ id, data }) => { if (id === activePtyId) activeTerm?.write(data); });
api.onPtyExit(({ id, exitCode }) => {
    if (id === activePtyId) activeTerm?.write(`\r\n\x1b[90m[exited: ${exitCode}]\x1b[0m\r\n`);
});
// ─── Sash resizing ────────────────────────────────────────────────────────────

// Use requestAnimationFrame for smooth resizing during drag
let rafId: number | null = null;
function scheduleResize(updateFn: () => void) {
    if (rafId !== null) return; // Skip if already scheduled
    
    rafId = requestAnimationFrame(() => {
        updateFn();
        rafId = null;
    });
}

function setupColSash(sashId: string, targetEl: HTMLElement, min: number, max: number) {
    const sash = document.getElementById(sashId)!;
    let dragging = false;
    let dragOffset = 0; // track offset within sash where click occurred
    let startX = 0; // Store initial mouse X position to detect actual drag
    
    sash.addEventListener('mousedown', (e) => {
        dragging = true;
        document.body.style.cursor = 'col-resize';
        const rect = targetEl.parentElement!.getBoundingClientRect();
        dragOffset = e.clientX - rect.left; // capture click position within sash
        startX = e.clientX; // Store initial X for drag detection
        e.preventDefault();
    });
    
    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        e.preventDefault(); // Prevent text selection during drag
        
        // Only resize if mouse moved more than 3 pixels (distinguish click from drag)
        const deltaX = Math.abs(e.clientX - startX);
        if (deltaX < 3) return; // Ignore tiny movements
        
        scheduleResize(() => {
            const rect = targetEl.parentElement!.getBoundingClientRect();
            // Anchor to where user clicked on the sash, so boundary follows cursor exactly
            const val = Math.min(Math.max(targetEl.offsetWidth + (e.clientX - (rect.left + dragOffset)), min), max);
            targetEl.style.width = `${val}px`;
        });
    });
    
    window.addEventListener('mouseup', () => {
        if (dragging) {
            dragging = false;
            document.body.style.cursor = '';
            // Final terminal refresh after drag ends
            refreshTerminal();
        }
    });
}

function setupFlexColSash(sashId: string, targetEl: HTMLElement, min: number, max: number) {
    const sash = document.getElementById(sashId)!;
    let dragging = false;
    let dragStarted = false; // Track if we've actually started dragging
    let startX = 0;
    let initialWidth = 0; // Cache the current width at drag start
    
    sash.addEventListener('mousedown', (e) => {
        dragging = true;
        dragStarted = false;
        startX = e.clientX;
        // Use inline style value if set, otherwise fall back to offsetWidth
        // This prevents the "jump" when offsetWidth differs from flexBasis due to flexbox
        const currentStyleWidth = targetEl.style.flexBasis || targetEl.style.width;
        initialWidth = currentStyleWidth ? parseFloat(currentStyleWidth) : targetEl.offsetWidth;
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    });
    
    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        
        const deltaX = e.clientX - startX;
        
        // Require 3px movement AND don't resize until we've crossed threshold
        if (!dragStarted && Math.abs(deltaX) < 3) {
            return;
        }
        
        dragStarted = true;
        e.preventDefault();
        
        requestAnimationFrame(() => {
            const newWidth = initialWidth + deltaX;
            const val = Math.min(Math.max(newWidth, min), max);
            // Set flex-grow to 0 to prevent flexbox from overriding our width
            targetEl.style.flexGrow = '0';
            targetEl.style.flexShrink = '0';
            targetEl.style.flexBasis = `${val}px`;
            targetEl.style.width = `${val}px`;
        });
    });
    
    window.addEventListener('mouseup', () => {
        if (dragging) {
            dragging = false;
            dragStarted = false;
            document.body.style.cursor = '';
            refreshTerminal();
        }
    });
}

function setupRowSash(sashId: string, targetEl: HTMLElement, min: number, max: number) {
    const sash = document.getElementById(sashId)!;
    let dragging = false;
    let startY = 0; // Store initial mouse Y position to detect actual drag
    
    sash.addEventListener('mousedown', (e) => {
        dragging = true;
        document.body.style.cursor = 'row-resize';
        startY = e.clientY; // Store initial Y for drag detection
        e.preventDefault();
    });
    
    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        e.preventDefault(); // Prevent text selection during drag
        
        // Only resize if mouse moved more than 3 pixels (distinguish click from drag)
        const deltaY = Math.abs(e.clientY - startY);
        if (deltaY < 3) return; // Ignore tiny movements
        
        scheduleResize(() => {
            const rect = targetEl.parentElement!.getBoundingClientRect();
            const val = Math.min(Math.max(e.clientY - rect.top, min), max);
            targetEl.style.flexBasis = `${val}px`;
        });
    });
    
    window.addEventListener('mouseup', () => {
        if (dragging) {
            dragging = false;
            document.body.style.cursor = '';
        }
    });
}

setupColSash('workspace-sash', workspaceBar, 48, 280);
setupFlexColSash('vertical-sash', document.getElementById('terminal-section')!, 200, window.innerWidth - 200);
setupRowSash('horizontal-sash', document.getElementById('viewer-section')!, 60, window.innerHeight - 80);

// ─── Right Activity Bar ───────────────────────────────────────────────────────

type RightView = 'viewer' | 'pdf' | 'image' | 'browser';

function switchRightView(view: RightView) {
    document.querySelectorAll('.activity-btn').forEach(b => {
        b.classList.toggle('active', (b as HTMLElement).dataset.view === view);
    });
    // Only toggle viewer-view elements (explorer is always visible now)
    document.querySelectorAll('.viewer-view').forEach(el => {
        el.classList.toggle('hidden', (el as HTMLElement).id !== `view-${view}`);
    });
}

document.querySelectorAll('.activity-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        switchRightView((btn as HTMLElement).dataset.view as RightView);
    });
});

// ─── PDF Viewer ────────────────────────────────────────────────────────────────

function openPdfViewer(filePath: string) {
    switchRightView('pdf');
    const webview = document.getElementById('pdf-webview') as Electron.WebviewTag;
    const label = document.getElementById('pdf-filename')!;
    const fileName = filePath.split('/').pop() || filePath;
    label.textContent = fileName;
    // Use file:// URL — Chromium's built-in PDF viewer handles the rest
    webview.src = `file://${filePath}`;
}

// ─── Image Viewer ──────────────────────────────────────────────────────────────

let imageZoom = 1.0;

function openImageViewer(filePath: string) {
    switchRightView('image');
    const img = document.getElementById('image-display') as HTMLImageElement;
    const info = document.getElementById('image-info')!;
    imageZoom = 1.0;
    img.style.transform = 'scale(1)';
    img.src = `file://${filePath}`;
    const fileName = filePath.split('/').pop() || filePath;
    img.onload = () => {
        info.textContent = `${fileName}  ${img.naturalWidth}×${img.naturalHeight}`;
    };
    info.textContent = fileName;
}

function applyImageZoom() {
    const img = document.getElementById('image-display') as HTMLImageElement;
    imageZoom = Math.max(0.1, Math.min(10, imageZoom));
    img.style.transform = `scale(${imageZoom})`;
}

document.getElementById('img-zoom-in')?.addEventListener('click', () => { imageZoom *= 1.25; applyImageZoom(); });
document.getElementById('img-zoom-out')?.addEventListener('click', () => { imageZoom /= 1.25; applyImageZoom(); });
document.getElementById('img-zoom-reset')?.addEventListener('click', () => { imageZoom = 1.0; applyImageZoom(); });

document.getElementById('image-canvas-area')?.addEventListener('wheel', (e: Event) => {
    const we = e as WheelEvent;
    we.preventDefault();
    imageZoom *= we.deltaY < 0 ? 1.1 : 0.9;
    applyImageZoom();
}, { passive: false });

// ─── Browser Panel ─────────────────────────────────────────────────────────────

function openBrowserPanel(url?: string) {
    switchRightView('browser');
    const webview = document.getElementById('browser-webview') as Electron.WebviewTag;
    const urlBar = document.getElementById('browser-url-bar') as HTMLInputElement;
    const target = url || urlBar.value || 'http://localhost:3000';
    const normalizedUrl = target.startsWith('http') ? target : `https://${target}`;
    webview.src = normalizedUrl;
    urlBar.value = normalizedUrl;
}

const browserWebview = document.getElementById('browser-webview') as Electron.WebviewTag;
const browserUrlBar = document.getElementById('browser-url-bar') as HTMLInputElement;

browserUrlBar?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') openBrowserPanel(browserUrlBar.value);
});

document.getElementById('browser-back')?.addEventListener('click', () => {
    if (browserWebview?.canGoBack()) browserWebview.goBack();
});
document.getElementById('browser-fwd')?.addEventListener('click', () => {
    if (browserWebview?.canGoForward()) browserWebview.goForward();
});
document.getElementById('browser-reload')?.addEventListener('click', () => {
    browserWebview?.reload();
});
document.getElementById('browser-devtools')?.addEventListener('click', () => {
    browserWebview?.openDevTools();
});

browserWebview?.addEventListener('did-navigate', (e: Event) => {
    const nav = e as any;
    if (browserUrlBar && nav.url) browserUrlBar.value = nav.url;
});
browserWebview?.addEventListener('did-navigate-in-page', (e: Event) => {
    const nav = e as any;
    if (browserUrlBar && nav.url) browserUrlBar.value = nav.url;
});

// ─── Explorer File Type Routing ────────────────────────────────────────────────

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff']);
const PDF_EXTS = new Set(['pdf']);

function routeFileOpen(filePath: string) {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    if (PDF_EXTS.has(ext)) {
        openPdfViewer(filePath);
    } else if (IMAGE_EXTS.has(ext)) {
        openImageViewer(filePath);
    }
    // Otherwise the existing text viewer in the explorer view handles it
}

// ─── Bootstrap ───────────────────────────────────────────────────────

async function init() {
    applyTheme(currentTheme);
    
    // CRITICAL FIX: Show empty state during loading to prevent flicker
    emptyState.classList.remove('hidden');
    workspaceHeading.textContent = '';
    
    try {
        workspaces = await api.workspacesLoad();
        renderWorkspaceBar();
        
        if (workspaces.length > 0) {
            // Switch to first workspace - this will hide empty state
            await switchWorkspace(workspaces[0].id);
        } else {
            // No workspaces - keep empty state visible with clear message
            workspaceHeading.textContent = '';
            emptyState.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Failed to initialize workspaces:', error);
        // Keep empty state visible on error
        emptyState.classList.remove('hidden');
        const emptyTitle = emptyState.querySelector('.empty-title') as HTMLElement;
        if (emptyTitle) {
            emptyTitle.textContent = 'Failed to load workspaces';
        }
    }
}
init();

// ─── Fixed Themes with Guaranteed Contrast (Default Overrides) ─────────────────────────────────
const DEFAULT_THEME: Theme = {
    background: '#1e1e1e',
    foreground: '#cccccc',
    black: '#1e1e1e', red: '#f14c4c', green: '#a9d317', yellow: '#ffc93c',
    blue: '#61afef', magenta: '#bb9af7', cyan: '#76d6d5', white: '#e0e0e0',
    brightBlack: '#2d2d2d', brightRed: '#f14c4c', brightGreen: '#a9d317', brightYellow: '#ffc93c',
    brightBlue: '#61afef', brightMagenta: '#bb9af7', brightCyan: '#76d6d5', brightWhite: '#e0e0e0',
    cursor: '#cccccc', selectionBackground: '#45475a',
};

// Override default theme with guaranteed contrast versions
{ Object.assign(THEMES.dark, DEFAULT_THEME); }
{ Object.assign(THEMES['tokyo-night'], DEFAULT_THEME as any); }

