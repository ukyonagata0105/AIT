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
    electronAPI: {
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
        fsReadDir: (path: string) => Promise<{ name: string; isDir: boolean }[]>;
        fsReadFile: (path: string) => Promise<string>;
        execRun: (cmd: string) => Promise<{ stdout: string; stderr: string }>;
        extSearch: (query: string) => Promise<any>;
        serverGetStatus: () => Promise<{ running: boolean; port: number; localIp: string; networkIps: string[]; error: string | null }>;
        onExtensionInstall?: (callback: (id: string) => void) => void;
        stateUpdate?: (state: any) => void;
    };
};

// ─── State ──────────────────────────────────────────────────────────────────

let workspaces: Workspace[] = [];
let activeWorkspaceId: string | null = null;
let activeTerm: Terminal | null = null;
let activeFitAddon: FitAddon | null = null;
let activePtyId: string | null = null;
// Map workspace IDs to their saved terminal state (PTY ID + dimensions)
const workspaceTerminalStates = new Map<string, TerminalState>();

// Terminal tabs state
interface TerminalTab {
    id: string;
    name: string;
    ptyId: string;
    terminal: Terminal;
    fitAddon: FitAddon;
    element: HTMLElement;
}

const workspaceTerminalTabs = new Map<string, TerminalTab[]>();
let activeTerminalTabId: string | null = null;

// ─── Grid Layout State ─────────────────────────────────────────────────────────────

type LayoutMode = 'tabs' | 'horizontal' | 'vertical' | 'grid';

interface GridLayout {
    mode: LayoutMode;
    columns: number;  // for grid mode
}

let currentLayout: GridLayout = {
    mode: 'tabs',
    columns: 2
};

// Load saved layout
const savedLayout = localStorage.getItem('terminal-layout');
if (savedLayout) {
    try {
        currentLayout = JSON.parse(savedLayout);
    } catch {}
}

function saveLayout() {
    localStorage.setItem('terminal-layout', JSON.stringify(currentLayout));
}

function setLayoutMode(mode: LayoutMode) {
    currentLayout.mode = mode;
    saveLayout();
    renderTerminalArea();
}

function setGridColumns(cols: number) {
    currentLayout.columns = cols;
    saveLayout();
    renderTerminalArea();
}

// Theme state
let currentTheme = localStorage.getItem('theme') || 'dark';

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const workspaceBar = document.getElementById('workspace-bar')!;
const workspaceList = document.getElementById('workspace-list')!;
const addBtn = document.getElementById('workspace-add-btn')!;
const collapseBtn = document.getElementById('ws-collapse-btn')!;
const settingsBtn = document.getElementById('settings-btn')!;
const workspaceHeading = document.getElementById('workspace-heading')!;
const terminalPaneEl = document.getElementById('terminal-pane')!;
const emptyState = document.getElementById('empty-state')!;
const broadcastToggle = document.getElementById('broadcast-toggle') as HTMLInputElement;
const explorerTree = document.getElementById('explorer-tree')!;
const explorerTitle = document.getElementById('explorer-title')!;
const viewerContent = document.getElementById('viewer-content')!;
const viewerFilepath = document.getElementById('viewer-filepath')!;
const ctxMenu = document.getElementById('ws-context-menu')!;
const ctxRename = document.getElementById('ctx-rename')!;
const ctxDelete = document.getElementById('ctx-delete')!;
const fileContextMenu = document.getElementById('file-context-menu')!;
const ctxCopyPath = document.getElementById('ctx-copy-path')!;
const ctxCopyRelPath = document.getElementById('ctx-copy-rel-path')!;
const settingsOverlay = document.getElementById('settings-overlay')!;
const settingsClose = document.getElementById('settings-close')!;
const settingsWsList = document.getElementById('settings-ws-list')!;
const settingsAddWs = document.getElementById('settings-add-ws')!;
const extStatus = document.getElementById('ext-status')!;

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
    btn.addEventListener('click', async () => {
        const tab = (btn as HTMLElement).dataset.tab!;
        document.querySelectorAll('.settings-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.settings-section').forEach(s => s.classList.add('hidden'));
        document.getElementById(`tab-${tab}`)?.classList.remove('hidden');

        // Load server URLs when server tab is activated
        if (tab === 'server') {
            await loadServerUrls();
        }
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

    // Ensure add button is after the list (inside workspace-bar but after workspace-list)
    if (addBtn.parentElement !== workspaceBar) {
        workspaceBar.appendChild(addBtn);
    }
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

function showContextMenu(x: number, y: number) {
    ctxMenu.style.left = `${x}px`;
    ctxMenu.style.top = `${y}px`;
    ctxMenu.classList.remove('hidden');
}

function showFileContextMenu(x: number, y: number) {
    fileContextMenu.style.left = `${x}px`;
    fileContextMenu.style.top = `${y}px`;
    fileContextMenu.classList.remove('hidden');
}

function hideContextMenu() {
    ctxMenu.classList.add('hidden');
    fileContextMenu.classList.add('hidden');
}

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
    await window.electronAPI.workspacesSave(workspaces);
    renderWorkspaceBar();
    if (ws.id === activeWorkspaceId) workspaceHeading.textContent = ws.name;
});

ctxDelete.addEventListener('click', async () => {
    hideContextMenu();
    if (!ctxTargetWsId) return;
    await deleteWorkspace(ctxTargetWsId);
});

// File context menu handlers
ctxCopyPath.addEventListener('click', async () => {
    hideContextMenu();
    const filePath = (fileContextMenu as any).dataset.targetPath;
    if (filePath) {
        await navigator.clipboard.writeText(filePath);
        // Optional: show a brief toast/notification
    }
});

ctxCopyRelPath.addEventListener('click', async () => {
    hideContextMenu();
    const filePath = (fileContextMenu as any).dataset.targetPath;
    if (filePath && activeWorkspaceId) {
        const ws = workspaces.find(w => w.id === activeWorkspaceId);
        if (ws) {
            const relPath = filePath.replace(ws.path + '/', '');
            await navigator.clipboard.writeText(relPath);
        }
    }
});

async function deleteWorkspace(wsId: string) {
    const ws = workspaces.find(w => w.id === wsId);
    if (!ws || !confirm(`Remove workspace "${ws.name}"?`)) return;

    // Kill all PTY sessions and clean up all terminal tabs for this workspace
    const tabs = getTerminalTabs(wsId);
    for (const tab of tabs) {
        window.electronAPI.ptyKill({ id: tab.ptyId });
        tab.terminal.dispose();
        tab.element.remove();
    }
    workspaceTerminalTabs.delete(wsId);

    // Clean up old terminal states
    const savedState = workspaceTerminalStates.get(wsId);
    if (savedState && savedState.ptyId) {
        window.electronAPI.ptyKill({ id: savedState.ptyId });
        workspaceTerminalStates.delete(wsId);
    }

    if (wsId === activeWorkspaceId) {
        // Clean up active state
        activePtyId = null;
        activeTerm = null;
        activeFitAddon = null;
        activeTerminalTabId = null;
        terminalPaneEl.innerHTML = '';
        emptyState.classList.remove('hidden');
        activeWorkspaceId = null;
        workspaceHeading.textContent = '';
    }

    workspaces = workspaces.filter(w => w.id !== wsId);
    await window.electronAPI.workspacesSave(workspaces);
    renderWorkspaceBar();
    renderSettingsPanel();
    if (workspaces.length > 0 && !activeWorkspaceId) switchWorkspace(workspaces[0].id);
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

async function renderSettingsPanel() {
    // Render workspace list
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
            await window.electronAPI.workspacesSave(workspaces);
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
                await window.electronAPI.workspacesSave(workspaces);
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
            await window.electronAPI.workspacesSave(workspaces);
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

// ─── Server URLs ─────────────────────────────────────────────────────────────

async function loadServerUrls() {
    const status = await window.electronAPI.serverGetStatus();
    const container = document.getElementById('server-urls')!;
    container.innerHTML = '';

    if (!status.running) {
        container.innerHTML = '<p style="color: var(--text-muted);">Server not running</p>';
        return;
    }

    // Local URL
    addServerUrlItem(container, 'Local', `http://localhost:${status.port}`);

    // Network URLs
    for (const ip of status.networkIps) {
        addServerUrlItem(container, 'Network', `http://${ip}:${status.port}`);
    }
}

function addServerUrlItem(container: HTMLElement, label: string, url: string) {
    const item = document.createElement('div');
    item.className = 'server-url-item';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'url-label';
    labelSpan.textContent = label;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'url-input';
    input.value = url;
    input.readOnly = true;

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-url-btn';
    copyBtn.textContent = '📋';
    copyBtn.title = 'Copy to clipboard';
    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(url);
            copyBtn.textContent = '✅';
            setTimeout(() => copyBtn.textContent = '📋', 1500);
        } catch {
            // Fallback for older browsers
            input.select();
            document.execCommand('copy');
            copyBtn.textContent = '✅';
            setTimeout(() => copyBtn.textContent = '📋', 1500);
        }
    });

    item.appendChild(labelSpan);
    item.appendChild(input);
    item.appendChild(copyBtn);
    container.appendChild(item);
}

settingsAddWs.addEventListener('click', async () => {
    const ws = await window.electronAPI.workspacesAdd();
    if (ws) {
        const existingIndex = workspaces.findIndex(existing => existing.id === ws.id || existing.path === ws.path);
        if (existingIndex >= 0) {
            workspaces[existingIndex] = ws;
        } else {
            workspaces.push(ws);
        }
        await window.electronAPI.workspacesSave(workspaces);
        renderWorkspaceBar();
        renderSettingsPanel();
        switchWorkspace(ws.id);
    }
});

// ─── WebSocket State Sync (for web mode) ───────────────────────────────────────

let stateWs: WebSocket | null = null;

// Detect if running in Electron
const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

function connectStateWebSocket() {
    // Only connect in web mode (not Electron)
    if (isElectron) {
        return; // Electron mode - use IPC instead
    }

    // Check if we're accessing via web server
    const isWebMode = window.location.protocol === 'http:' || window.location.protocol === 'https:';

    if (!isWebMode) return;

    const wsUrl = `ws://${window.location.hostname}:4096`;
    stateWs = new WebSocket(wsUrl);

    stateWs.onopen = () => {
        console.log('[StateSync] Connected to server');
    };

    stateWs.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'state-sync') {
                handleStateSync(msg.state);
            } else if (msg.type === 'data') {
                // PTY data - write to terminal
                for (const [, tabs] of workspaceTerminalTabs) {
                    const tab = tabs.find(t => t.ptyId === msg.id);
                    if (tab) {
                        tab.terminal.write(msg.data);
                        return;
                    }
                }
            } else if (msg.type === 'exit') {
                // PTY exit
                for (const [, tabs] of workspaceTerminalTabs) {
                    const tab = tabs.find(t => t.ptyId === msg.id);
                    if (tab) {
                        tab.terminal.write(`\r\n\x1b[90m[exited: ${msg.exitCode}]\x1b[0m\r\n`);
                        return;
                    }
                }
            } else if (msg.type === 'sync') {
                // Initial PTY sync - auto-attach to existing PTY
                if (msg.ptyId) {
                    activePtyId = msg.ptyId;
                }

                // Create terminals for all sessions (web mode only)
                if (msg.sessions && !isElectron) {
                    // Ensure we have workspace data first
                    if (!activeWorkspaceId) {
                        // Load workspaces first, then create terminals
                        fetch('/api/workspaces')
                            .then(r => r.json())
                            .then((data: Workspace[]) => {
                                workspaces = data;
                                if (data.length > 0) {
                                    activeWorkspaceId = data[0].id;
                                    const ws = data[0];
                                    workspaceHeading.textContent = ws.name;
                                    renderWorkspaceBar();
                                }

                                // Now create terminals
                                msg.sessions.forEach((ptyId: string, index: number) => {
                                    setTimeout(() => {
                                        createWebTerminalTab(ptyId, index);
                                    }, index * 100);
                                });
                                setTimeout(() => {
                                    renderTerminalTabs();
                                    renderTerminalArea();
                                }, msg.sessions.length * 100 + 50);
                            })
                            .catch(e => console.error('[StateSync] Failed to load workspaces:', e));
                    } else {
                        // Workspace already set, just create terminals
                        msg.sessions.forEach((ptyId: string, index: number) => {
                            setTimeout(() => {
                                createWebTerminalTab(ptyId, index);
                            }, index * 100);
                        });
                        setTimeout(() => {
                            renderTerminalTabs();
                            renderTerminalArea();
                        }, msg.sessions.length * 100 + 50);
                    }
                }
            }
        } catch (e) {
            console.error('[StateSync] Error parsing message:', e);
        }
    };

    stateWs.onclose = () => {
        console.log('[StateSync] Disconnected, reconnecting in 3s...');
        stateWs = null;
        setTimeout(connectStateWebSocket, 3000);
    };

    stateWs.onerror = (error) => {
        console.error('[StateSync] WebSocket error:', error);
    };
}

function handleStateSync(state: any) {
    console.log('[StateSync] Received state:', state);

    if (state.activeWorkspaceId && state.activeWorkspaceId !== activeWorkspaceId) {
        activeWorkspaceId = state.activeWorkspaceId;

        // In web mode, we need to load workspaces data and create terminal displays
        if (!isElectron) {
            fetch('/api/workspaces')
                .then(r => r.json())
                .then((data: Workspace[]) => {
                    workspaces = data;

                    const ws = workspaces.find(w => w.id === activeWorkspaceId);
                    if (ws) {
                        workspaceHeading.textContent = ws.name;
                        emptyState.classList.add('hidden');
                        renderWorkspaceBar();

                        // Use terminalTabs from state if available, otherwise fallback to PTY list
                        if (state.terminalTabs && state.terminalTabs.length > 0) {
                            // Create tabs from synced state (with names)
                            const workspaceTabs = state.terminalTabs.filter(
                                (tab: any) => tab.workspaceId === activeWorkspaceId
                            );
                            workspaceTabs.forEach((tab: any, index: number) => {
                                createWebTerminalTab(tab.ptyId, index, tab.name, tab.id);
                            });
                            if (state.activeTerminalTabId) {
                                activeTerminalTabId = state.activeTerminalTabId;
                            }
                            renderTerminalTabs();
                            renderTerminalArea();
                        } else {
                            // Fallback: Request active PTY sessions from server
                            return fetch('/api/pty/list');
                        }
                    }
                })
                .then(r => r?.json ? r.json() : null)
                .then((ptyData: { sessions: string[] } | null) => {
                    if (ptyData && ptyData.sessions.length > 0) {
                        console.log('[StateSync] Fallback PTY sessions:', ptyData.sessions);
                        ptyData.sessions.forEach((ptyId, index) => {
                            createWebTerminalTab(ptyId, index);
                        });
                        renderTerminalTabs();
                        renderTerminalArea();
                    }
                })
                .catch(e => console.error('[StateSync] Failed to load state:', e));
        } else {
            renderWorkspaceBar();
            renderTerminalTabs();
            renderTerminalArea();
        }
    } else if (state.terminalTabs && !isElectron) {
        // Tab-only update (workspace didn't change)
        const workspaceTabs = state.terminalTabs.filter(
            (tab: any) => tab.workspaceId === activeWorkspaceId
        );
        
        // Get current tabs for this workspace
        const currentTabs = getTerminalTabs(activeWorkspaceId || '');
        const currentPtyIds = new Set(currentTabs.map(t => t.ptyId));
        
        // Create tabs that don't exist yet
        workspaceTabs.forEach((tab: any, index: number) => {
            if (!currentPtyIds.has(tab.ptyId)) {
                createWebTerminalTab(tab.ptyId, index, tab.name, tab.id);
            }
        });
        
        if (state.activeTerminalTabId) {
            activeTerminalTabId = state.activeTerminalTabId;
        }
        
        renderTerminalTabs();
        renderTerminalArea();
    }
}

// Create a web terminal tab (for viewing existing PTY)
function createWebTerminalTab(ptyId: string, index: number, name?: string, id?: string) {
    if (!activeWorkspaceId) {
        console.log('[WebTerminal] No active workspace, skipping terminal creation');
        return;
    }

    const tabId = id || `web-tab-${ptyId}`;
    const tabName = name || `Terminal ${index + 1}`;

    // Check if tab already exists
    const tabs = getTerminalTabs(activeWorkspaceId);
    if (tabs.find(t => t.ptyId === ptyId)) {
        return; // Already exists
    }

    // Create terminal element
    const termContainer = document.createElement('div');
    termContainer.className = 'terminal-container';
    termContainer.id = `terminal-${tabId}`;
    termContainer.style.display = 'none';
    terminalPaneEl.appendChild(termContainer);

    // Create xterm.js instance
    const term = new Terminal({
        fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
        fontSize: 13,
        lineHeight: 1.2,
        cursorBlink: true,
        theme: THEMES[currentTheme],
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termContainer);

    // Handle input - send via WebSocket
    term.onData((data) => {
        if (stateWs && stateWs.readyState === WebSocket.OPEN) {
            stateWs.send(JSON.stringify({
                type: 'input',
                id: ptyId,
                data
            }));
        }
    });

    // Create tab object
    const tab: TerminalTab = {
        id: tabId,
        name: tabName,
        ptyId,
        terminal: term,
        fitAddon,
        element: termContainer,
    };

    tabs.push(tab);

    // Switch to first tab
    if (index === 0) {
        switchTerminalTab(tabId);
    }
}

function sendStateUpdate() {
    // Collect serializable terminal tab info
    const allTabs: { id: string; name: string; ptyId: string; workspaceId: string }[] = [];
    workspaceTerminalTabs.forEach((tabs, workspaceId) => {
        tabs.forEach(tab => {
            allTabs.push({
                id: tab.id,
                name: tab.name,
                ptyId: tab.ptyId,
                workspaceId
            });
        });
    });

    const stateUpdate = {
        activeWorkspaceId,
        terminalTabs: allTabs,
        activeTerminalTabId
    };

    // Electron mode: use IPC
    if (window.electronAPI && window.electronAPI.stateUpdate) {
        window.electronAPI.stateUpdate(stateUpdate);
    }
    // Web mode: use WebSocket
    else if (stateWs && stateWs.readyState === WebSocket.OPEN) {
        stateWs.send(JSON.stringify({
            type: 'state-update',
            state: stateUpdate
        }));
    }
}


// Initialize WebSocket connection on load
connectStateWebSocket();

// ─── Extensions Management ──────────────────────────────────────────────────

async function installExtension(id: string) {
    if (!id) return;
    extStatus.style.display = 'block';
    extStatus.textContent = `Installing ${id}...`;
    extStatus.style.color = 'var(--accent)';
    try {
        const { stderr } = await window.electronAPI.execRun(`code --install-extension ${id}`);
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

// Ensure window.electronAPI.onExtensionInstall is bound (Electron only)
if (window.electronAPI && window.electronAPI.onExtensionInstall) {
    window.electronAPI.onExtensionInstall((id: string) => installExtension(id));
}



// ─── Add workspace button ─────────────────────────────────────────────────────

addBtn.addEventListener('click', async () => {
    const ws = await window.electronAPI.workspacesAdd();
    if (ws) {
        const existingIndex = workspaces.findIndex(existing => existing.id === ws.id || existing.path === ws.path);
        if (existingIndex >= 0) {
            workspaces[existingIndex] = ws;
        } else {
            workspaces.push(ws);
        }
        await window.electronAPI.workspacesSave(workspaces);
        renderWorkspaceBar();
        switchWorkspace(ws.id);
    }
});

// ─── Workspace Switch ─────────────────────────────────────────────────────────

async function switchWorkspace(wsId: string) {
    if (wsId === activeWorkspaceId) return;

    // Ensure terminal pane always has valid colors
    if (currentTheme !== 'dark' && currentTheme !== 'tokyo-night') {
        applyTheme('dark');
    }

    // Update active workspace reference
    activeWorkspaceId = wsId;
    const ws = workspaces.find(w => w.id === wsId)!;

    workspaceHeading.textContent = ws.name;
    emptyState.classList.add('hidden');
    renderWorkspaceBar();

    // Hide all terminals
    document.querySelectorAll('.terminal-container').forEach(el => {
        (el as HTMLElement).style.display = 'none';
    });

    // Check if workspace has tabs
    const tabs = getTerminalTabs(wsId);

    if (tabs.length === 0) {
        // Create first tab if none exist
        await createTerminalTab('Terminal 1');
    } else {
        // Switch to first tab or last active tab
        const tabToSwitch = tabs.find(t => t.id === activeTerminalTabId) || tabs[0];
        switchTerminalTab(tabToSwitch.id);
    }

    loadExplorer(ws.path, ws.name);

    // Broadcast state change to other clients
    sendStateUpdate();
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
        if (currentExplorerPath) loadExplorer(currentExplorerPath, currentExplorerLabel);
    });
});

explorerFilterInput?.addEventListener('input', () => {
    explorerSort.filter = explorerFilterInput.value.toLowerCase();
    if (currentExplorerPath) loadExplorer(currentExplorerPath, currentExplorerLabel);
});

async function loadExplorer(dirPath: string, label?: string) {
    currentExplorerPath = dirPath;
    currentExplorerLabel = label || dirPath;
    explorerTitle.textContent = currentExplorerLabel.toUpperCase();
    explorerTree.innerHTML = '';
    await renderDir(dirPath, explorerTree, 0);
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
        let raw: { name: string; isDir: boolean; mtime: number; size: number }[];

        if (window.electronAPI && window.electronAPI.fsReadDir) {
            // Electron mode
            raw = await window.electronAPI.fsReadDir(dirPath) as { name: string; isDir: boolean; mtime: number; size: number }[];
        } else {
            // Web mode - use HTTP API
            const response = await fetch(`/api/fs/readDir?path=${encodeURIComponent(dirPath)}`);
            if (!response.ok) {
                throw new Error(`Failed to read directory: ${response.statusText}`);
            }
            raw = await response.json();
        }
        // Only filter dotfiles at root when no filter active
        const entries = depth === 0 && !explorerSort.filter
            ? raw.filter(e => !e.name.startsWith('.'))
            : raw;

        const sorted = sortEntries(entries);

        for (const entry of sorted) {
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
            // Store path for context menu
            (item as any).dataset.filePath = fullPath;

            // Add context menu
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                (fileContextMenu as any).dataset.targetPath = fullPath;
                showFileContextMenu(e.clientX, e.clientY);
            });

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
            container.appendChild(item);
        }
    } catch {
        const err = document.createElement('div');
        err.className = 'tree-item';
        err.style.color = '#f38ba8';
        err.textContent = '⚠ permission denied';
        container.appendChild(err);
    }
}

function getFileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
        ts: '🔵', tsx: '🔵', js: '🟡', jsx: '🟡', py: '🐍', rs: '🦀', go: '🐹',
        md: '📝', json: '⚙️', yaml: '⚙️', yml: '⚙️', css: '🎨', html: '🌐',
        png: '🖼', jpg: '🖼', svg: '🖼', gif: '🖼', sh: '⚡', env: '🔒',
    };
    return map[ext] || '📄';
}

async function openFile(filePath: string, itemEl: HTMLElement) {
    document.querySelectorAll('.tree-item.selected').forEach(el => el.classList.remove('selected'));
    itemEl.classList.add('selected');

    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff']);
    const PDF_EXT = new Set(['pdf']);

    if (PDF_EXT.has(ext)) {
        openPdfViewer(filePath);
        return;
    }
    if (IMAGE_EXT.has(ext)) {
        openImageViewer(filePath);
        return;
    }

    // Text viewer (stays in Explorer view)
    switchRightView('explorer');
    viewerFilepath.textContent = filePath.split('/').slice(-2).join('/');
    viewerContent.innerHTML = '';
    try {
        let content: string;

        if (window.electronAPI && window.electronAPI.fsReadFile) {
            // Electron mode
            content = await window.electronAPI.fsReadFile(filePath);
        } else {
            // Web mode - use HTTP API
            const response = await fetch(`/api/fs/readFile?path=${encodeURIComponent(filePath)}`);
            if (!response.ok) {
                throw new Error(`Failed to read file: ${response.statusText}`);
            }
            content = await response.text();
        }

        const pre = document.createElement('pre');
        pre.textContent = content;
        viewerContent.appendChild(pre);
    } catch {
        viewerContent.innerHTML = '<pre style="color:#f38ba8;padding:12px">⚠ Binary or unreadable file</pre>';
    }
}

// ─── PTY IPC ─────────────────────────────────────────────────────────────────

// Only in Electron mode
if (window.electronAPI && window.electronAPI.onPtyData) {
    window.electronAPI.onPtyData(({ id, data }) => {
    // Find the terminal tab with this PTY ID
    for (const [, tabs] of workspaceTerminalTabs) {
        const tab = tabs.find(t => t.ptyId === id);
        if (tab) {
            tab.terminal.write(data);
            return;
        }
    }
    // Fallback to active terminal
    if (id === activePtyId) activeTerm?.write(data);
    });
}

if (window.electronAPI && window.electronAPI.onPtyExit) {
    window.electronAPI.onPtyExit(({ id, exitCode }) => {
        // Find the terminal tab with this PTY ID
        for (const [, tabs] of workspaceTerminalTabs) {
            const tab = tabs.find(t => t.ptyId === id);
            if (tab) {
                tab.terminal.write(`\r\n\x1b[90m[exited: ${exitCode}]\x1b[0m\r\n`);
                return;
            }
        }
        // Fallback to active terminal
        if (id === activePtyId) activeTerm?.write(`\r\n\x1b[90m[exited: ${exitCode}]\x1b[0m\r\n`);
    });
}

// ─── Sash resizing ────────────────────────────────────────────────────────────

function setupColSash(sashId: string, targetEl: HTMLElement, min: number, max: number) {
    const sash = document.getElementById(sashId)!;
    let dragging = false;
    let startX = 0;
    let startWidth = 0;

    sash.addEventListener('mousedown', (e) => {
        dragging = true;
        startX = e.clientX;
        startWidth = targetEl.offsetWidth;
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
        e.stopPropagation();
    });

    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const deltaX = e.clientX - startX;
        const newWidth = Math.min(Math.max(startWidth + deltaX, min), max);
        targetEl.style.width = `${newWidth}px`;
        refreshTerminal();
    });

    window.addEventListener('mouseup', () => {
        if (dragging) {
            dragging = false;
            document.body.style.cursor = '';
        }
    });
}

function setupFlexColSash(sashId: string, targetEl: HTMLElement, min: number, max: number) {
    const sash = document.getElementById(sashId)!;
    let dragging = false;
    let startX = 0;
    let startWidth = 0;

    sash.addEventListener('mousedown', (e) => {
        dragging = true;
        startX = e.clientX;
        startWidth = targetEl.offsetWidth;
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
        e.stopPropagation();
    });

    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const deltaX = e.clientX - startX;
        const newWidth = Math.min(Math.max(startWidth + deltaX, min), max);
        targetEl.style.flexBasis = `${newWidth}px`;
        targetEl.style.flex = `0 0 ${newWidth}px`;
        refreshTerminal();
    });

    window.addEventListener('mouseup', () => {
        if (dragging) {
            dragging = false;
            document.body.style.cursor = '';
        }
    });
}

function setupRowSash(sashId: string, targetEl: HTMLElement, min: number, max: number) {
    const sash = document.getElementById(sashId)!;
    let dragging = false;
    sash.addEventListener('mousedown', (e) => { dragging = true; document.body.style.cursor = 'row-resize'; e.preventDefault(); });
    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const rect = targetEl.parentElement!.getBoundingClientRect();
        const val = Math.min(Math.max(e.clientY - rect.top, min), max);
        targetEl.style.flexBasis = `${val}px`;
    });
    window.addEventListener('mouseup', () => { if (dragging) { dragging = false; document.body.style.cursor = ''; } });
}

// Initialize sash resizing after DOM is ready
function initializeSashes() {
    setupColSash('workspace-sash', workspaceBar, 48, 280);
    const terminalSection = document.getElementById('terminal-section')!;
    setupFlexColSash('vertical-sash', terminalSection, 200, window.innerWidth - 200);
    setupRowSash('horizontal-sash', document.getElementById('viewer-section')!, 60, window.innerHeight - 80);

    }

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSashes);
} else {
    initializeSashes();
}

// ─── Terminal Layout Rendering ─────────────────────────────────────────────────────

function renderTerminalArea() {
    const tabs = workspaceTerminalTabs.get(activeWorkspaceId || '') || [];

    // Update layout button states
    document.querySelectorAll('.layout-btn').forEach(btn => {
        btn.classList.toggle('active', (btn as HTMLElement).dataset.layout === currentLayout.mode);
    });

    // Clear terminal pane
    terminalPaneEl.innerHTML = '';
    terminalPaneEl.className = '';

    if (tabs.length === 0) {
        return; // empty state shown separately
    }

    switch (currentLayout.mode) {
        case 'tabs':
            renderTabsMode(tabs);
            break;
        case 'horizontal':
            renderSplitMode(tabs, 'row');
            break;
        case 'vertical':
            renderSplitMode(tabs, 'column');
            break;
        case 'grid':
            renderGridMode(tabs);
            break;
    }

    // Re-attach terminal elements to new DOM positions
    const reattached: TerminalTab[] = [];
    tabs.forEach(tab => {
        const container = document.getElementById(`terminal-container-${tab.id}`);
        if (container) {
            container.appendChild(tab.terminal.element);
            reattached.push(tab);
        }
    });

    if (reattached.length > 0) {
        requestAnimationFrame(() => {
            reattached.forEach(tab => {
                try {
                    tab.fitAddon.fit();
                    resizePty(tab.ptyId, tab.terminal.cols, tab.terminal.rows);
                } catch { /* ignore */ }
            });
        });
    }
}

function renderTabsMode(tabs: TerminalTab[]) {
    // Tab mode: show only active terminal
    terminalPaneEl.classList.remove('grid-layout', 'horizontal-layout', 'vertical-layout');
    const activeTab = tabs.find(t => t.id === activeTerminalTabId) || tabs[0];
    if (activeTab) {
        const container = document.createElement('div');
        container.id = `terminal-container-${activeTab.id}`;
        container.className = 'terminal-container';
        container.style.cssText = 'height: 100%; width: 100%;';
        terminalPaneEl.appendChild(container);
    }
}

function renderSplitMode(tabs: TerminalTab[], direction: 'row' | 'column') {
    terminalPaneEl.classList.add(direction === 'row' ? 'horizontal-layout' : 'vertical-layout');
    terminalPaneEl.classList.remove('grid-layout');

    tabs.forEach(tab => {
        const cell = createGridCell(tab);
        terminalPaneEl.appendChild(cell);
    });
}

function renderGridMode(tabs: TerminalTab[]) {
    terminalPaneEl.classList.add('grid-layout');
    terminalPaneEl.classList.remove('horizontal-layout', 'vertical-layout');

    const cols = currentLayout.columns || 2;
    terminalPaneEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    tabs.forEach(tab => {
        const cell = createGridCell(tab);
        terminalPaneEl.appendChild(cell);
    });
}

function createGridCell(tab: TerminalTab): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.dataset.tabId = tab.id;

    // Make cell draggable
    cell.draggable = true;

    // Header with tab name and close button
    const header = document.createElement('div');
    header.className = 'grid-cell-header';

    const label = document.createElement('span');
    label.textContent = tab.name;
    label.className = 'grid-cell-label';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-cell-btn';
    closeBtn.textContent = '×';
    closeBtn.title = 'Close terminal';
    closeBtn.addEventListener('click', () => closeTerminalTab(tab.id));

    header.appendChild(label);
    header.appendChild(closeBtn);

    // Content container for terminal
    const content = document.createElement('div');
    content.className = 'grid-cell-content';
    content.id = `terminal-container-${tab.id}`;

    cell.appendChild(header);
    cell.appendChild(content);

    // Drag events
    cell.addEventListener('dragstart', (e) => {
        e.dataTransfer!.setData('text/plain', tab.id);
        cell.style.opacity = '0.5';
    });

    cell.addEventListener('dragend', () => {
        cell.style.opacity = '1';
        document.querySelectorAll('.grid-cell-header').forEach(h => h.classList.remove('drag-over'));
    });

    cell.addEventListener('dragover', (e) => {
        e.preventDefault();
        const targetHeader = cell.querySelector('.grid-cell-header') as HTMLElement;
        if (targetHeader) targetHeader.classList.add('drag-over');
    });

    cell.addEventListener('dragleave', () => {
        const targetHeader = cell.querySelector('.grid-cell-header') as HTMLElement;
        if (targetHeader) targetHeader.classList.remove('drag-over');
    });

    cell.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedTabId = e.dataTransfer!.getData('text/plain');
        const targetHeader = cell.querySelector('.grid-cell-header') as HTMLElement;
        if (targetHeader) targetHeader.classList.remove('drag-over');

        if (draggedTabId && draggedTabId !== tab.id) {
            swapTerminalTabs(draggedTabId, tab.id);
        }
    });

    // Click to activate
    cell.addEventListener('click', (e) => {
        if (e.target === cell || e.target === header || e.target === label) {
            switchTerminalTab(tab.id);
        }
    });

    return cell;
}

function swapTerminalTabs(tabId1: string, tabId2: string) {
    const tabs = workspaceTerminalTabs.get(activeWorkspaceId || '') || [];
    const i1 = tabs.findIndex(t => t.id === tabId1);
    const i2 = tabs.findIndex(t => t.id === tabId2);

    if (i1 >= 0 && i2 >= 0) {
        // Swap positions
        [tabs[i1], tabs[i2]] = [tabs[i2], tabs[i1]];
        workspaceTerminalTabs.set(activeWorkspaceId || '', tabs);
        renderTerminalArea();
    }
}

function closeTerminalTab(tabId: string) {
    const tabs = workspaceTerminalTabs.get(activeWorkspaceId || '') || [];
    const index = tabs.findIndex(t => t.id === tabId);

    if (index >= 0) {
        const tab = tabs[index];

        // Kill PTY
        if (window.electronAPI && window.electronAPI.ptyKill) {
            // Electron mode
            window.electronAPI.ptyKill({ id: tab.ptyId });
        } else {
            // Web mode
            if (stateWs && stateWs.readyState === WebSocket.OPEN) {
                stateWs.send(JSON.stringify({
                    type: 'kill',
                    id: tab.ptyId
                }));
            }
        }

        // Dispose terminal
        tab.terminal.dispose();

        // Remove from array
        tabs.splice(index, 1);
        workspaceTerminalTabs.set(activeWorkspaceId || '', tabs);

        // Set new active tab
        if (activeTerminalTabId === tabId) {
            activeTerminalTabId = tabs.length > 0 ? tabs[0].id : null;
        }

        // Update UI
        if (tabs.length === 0) {
            emptyState.classList.remove('hidden');
        }

        renderTerminalTabs();
        renderTerminalArea();

        // Sync state to web clients
        sendStateUpdate();
    }
}

function resizePty(ptyId: string, cols: number, rows: number): void {
    if (window.electronAPI && window.electronAPI.ptyResize) {
        window.electronAPI.ptyResize({ id: ptyId, cols, rows });
    } else if (stateWs && stateWs.readyState === WebSocket.OPEN) {
        stateWs.send(JSON.stringify({ type: 'resize', id: ptyId, cols, rows }));
    }
}

function refreshTerminal() {
    const tabs = workspaceTerminalTabs.get(activeWorkspaceId || '') || [];

    if (currentLayout.mode === 'tabs') {
        if (activeFitAddon) {
            requestAnimationFrame(() => {
                try {
                    activeFitAddon!.fit();
                    if (activePtyId && activeTerm) {
                        resizePty(activePtyId, activeTerm.cols, activeTerm.rows);
                    }
                } catch { /* ignore */ }
            });
        }
    } else {
        requestAnimationFrame(() => {
            tabs.forEach(tab => {
                try {
                    tab.fitAddon.fit();
                    resizePty(tab.ptyId, tab.terminal.cols, tab.terminal.rows);
                } catch { /* ignore */ }
            });
        });
    }

    renderWorkspaceBar();
}

const resizeObserver = new ResizeObserver(() => refreshTerminal());
resizeObserver.observe(terminalPaneEl);

// ─── Right Activity Bar ───────────────────────────────────────────────────────

type RightView = 'explorer' | 'pdf' | 'image' | 'browser';

function switchRightView(view: RightView) {
    document.querySelectorAll('.activity-btn').forEach(b => {
        b.classList.toggle('active', (b as HTMLElement).dataset.view === view);
    });
    document.querySelectorAll('.right-view').forEach(el => {
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

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function init() {
    applyTheme(currentTheme);

    // Electron mode: load workspaces from API
    if (window.electronAPI && window.electronAPI.workspacesLoad) {
        workspaces = await window.electronAPI.workspacesLoad();
        renderWorkspaceBar();
        if (workspaces.length > 0) switchWorkspace(workspaces[0].id);
    }
    // Web mode: load workspaces from HTTP API
    else {
        try {
            const response = await fetch('/api/workspaces');
            workspaces = await response.json();
            renderWorkspaceBar();
            if (workspaces.length > 0) switchWorkspace(workspaces[0].id);
        } catch (e) {
            console.error('[Init] Failed to load workspaces:', e);
        }
    }
}

init();

// ─── Web Mode UI Adjustments ─────────────────────────────────────────────────────

if (!isElectron) {
    // Add remote control indicator
    const header = document.querySelector('#terminal-tabs-header') as HTMLElement;
    if (header) {
        const indicator = document.createElement('span');
        indicator.style.cssText = 'font-size: 11px; color: var(--text-muted); margin-right: 12px;';
        indicator.textContent = '📡 Remote Control Mode';
        header.insertBefore(indicator, terminalTabsList);
    }

    console.log('[WebMode] Running in remote control mode (can create terminals)');
}

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

// ─── Terminal Tabs ─────────────────────────────────────────────────────────────

const terminalTabsHeader = document.getElementById('terminal-tabs-header')!;
const terminalTabsList = document.getElementById('terminal-tabs-list')!;
const terminalTabAdd = document.getElementById('terminal-tab-add')!;


terminalTabAdd.addEventListener('click', () => {
    if (!activeWorkspaceId) return;
    createTerminalTab();
});

// Layout control buttons
document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const layout = (btn as HTMLElement).dataset.layout as LayoutMode;
        if (layout) setLayoutMode(layout);
    });
});

function getTerminalTabs(workspaceId: string): TerminalTab[] {
    if (!workspaceTerminalTabs.has(workspaceId)) {
        workspaceTerminalTabs.set(workspaceId, []);
    }
    return workspaceTerminalTabs.get(workspaceId)!;
}

function renderTerminalTabs() {
    if (!activeWorkspaceId) {
        terminalTabsHeader.classList.add('hidden');
        return;
    }

    terminalTabsHeader.classList.remove('hidden');
    terminalTabsList.innerHTML = '';

    const tabs = getTerminalTabs(activeWorkspaceId);

    tabs.forEach(tab => {
        const tabEl = document.createElement('div');
        tabEl.className = 'terminal-tab' + (tab.id === activeTerminalTabId ? ' active' : '');
        tabEl.dataset.tabId = tab.id;

        const nameEl = document.createElement('span');
        nameEl.className = 'terminal-tab-name';
        nameEl.textContent = tab.name;
        tabEl.appendChild(nameEl);

        const closeEl = document.createElement('span');
        closeEl.className = 'terminal-tab-close';
        closeEl.textContent = '×';
        closeEl.title = 'Close tab';
        closeEl.addEventListener('click', (e) => {
            e.stopPropagation();
            closeTerminalTab(tab.id);
        });
        tabEl.appendChild(closeEl);

        tabEl.addEventListener('click', () => switchTerminalTab(tab.id));
        terminalTabsList.appendChild(tabEl);
    });

    // Update terminal area layout
    renderTerminalArea();
}

async function createTerminalTab(name?: string) {
    if (!activeWorkspaceId) return;

    const ws = workspaces.find(w => w.id === activeWorkspaceId);
    if (!ws) {
        console.error('[Terminal] Workspace not found');
        return null;
    }

    const tabs = getTerminalTabs(activeWorkspaceId);

    const tabId = `tab-${activeWorkspaceId}-${Date.now()}`;
    const tabName = name || `Terminal ${tabs.length + 1}`;
    const ptyId = `pty-${tabId}`;

    // Create terminal element
    const termContainer = document.createElement('div');
    termContainer.className = 'terminal-container';
    termContainer.id = `terminal-${tabId}`;
    termContainer.style.display = 'none';
    terminalPaneEl.appendChild(termContainer);

    // Create xterm.js instance
    const term = new Terminal({
        fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
        fontSize: 13,
        lineHeight: 1.2,
        cursorBlink: true,
        theme: THEMES[currentTheme],
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(termContainer);

    // Create PTY (different methods for Electron vs Web)
    const { cols, rows } = term;

    try {
        if (window.electronAPI && window.electronAPI.ptyCreate) {
            // Electron mode
            const result = await window.electronAPI.ptyCreate({ id: ptyId, cwd: ws.path, cols, rows });
            if (!result.ok) {
                throw new Error('PTY creation failed');
            }
        } else {
            // Web mode - create PTY via WebSocket
            if (stateWs && stateWs.readyState === WebSocket.OPEN) {
                stateWs.send(JSON.stringify({
                    type: 'create',
                    id: ptyId,
                    cwd: ws.path,
                    cols,
                    rows
                }));
            } else {
                console.error('[Terminal] WebSocket not connected');
                termContainer.remove();
                return null;
            }
        }
    } catch (error) {
        console.error('[Terminal] Failed to create PTY:', error);
        termContainer.remove();
        alert(`Failed to create terminal: ${error}`);
        return null;
    }

    // Handle input
    term.onData((data) => {
        if (window.electronAPI && window.electronAPI.ptyInput) {
            // Electron mode
            window.electronAPI.ptyInput({ id: ptyId, data });
        } else {
            // Web mode
            if (stateWs && stateWs.readyState === WebSocket.OPEN) {
                stateWs.send(JSON.stringify({
                    type: 'input',
                    id: ptyId,
                    data
                }));
            }
        }
    });

    // Create tab object
    const tab: TerminalTab = {
        id: tabId,
        name: tabName,
        ptyId,
        terminal: term,
        fitAddon,
        element: termContainer,
    };

    tabs.push(tab);
    switchTerminalTab(tabId);
    renderTerminalTabs();

    // Sync state to web clients
    sendStateUpdate();

    return tab;
}

function switchTerminalTab(tabId: string) {
    const tabs = getTerminalTabs(activeWorkspaceId!);
    const tab = tabs.find(t => t.id === tabId);

    if (!tab) return;

    // In tabs mode, hide/show terminals; in other layouts, all are visible
    if (currentLayout.mode === 'tabs') {
        tabs.forEach(t => {
            t.element.style.display = 'none';
            t.terminal.element?.classList.add('hidden');
        });

        tab.element.style.display = 'block';
        tab.terminal.element?.classList.remove('hidden');
    }

    // Update state
    activeTerminalTabId = tabId;
    activeTerm = tab.terminal;
    activeFitAddon = tab.fitAddon;
    activePtyId = tab.ptyId;

    // Sync state to web clients (activeTerminalTabId changed)
    sendStateUpdate();

    // Fit terminal
    requestAnimationFrame(() => {
        tab.fitAddon.fit();

        // Resize PTY
        if (window.electronAPI && window.electronAPI.ptyResize) {
            // Electron mode
            window.electronAPI.ptyResize({
                id: tab.ptyId,
                cols: tab.terminal.cols,
                rows: tab.terminal.rows,
            });
        } else {
            // Web mode
            if (stateWs && stateWs.readyState === WebSocket.OPEN) {
                stateWs.send(JSON.stringify({
                    type: 'resize',
                    id: tab.ptyId,
                    cols: tab.terminal.cols,
                    rows: tab.terminal.rows
                }));
            }
        }

        tab.terminal.focus();
    });

    renderTerminalTabs();
}
