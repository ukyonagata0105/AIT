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
        onExtensionInstall?: (callback: (id: string) => void) => void;
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
    await window.electronAPI.workspacesSave(workspaces);
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
        window.electronAPI.ptyKill({ id: savedState.ptyId });
        workspaceTerminalStates.delete(wsId); // Remove from saved state map
    }

    if (wsId === activeWorkspaceId && activePtyId) {
        window.electronAPI.ptyKill({ id: activePtyId });
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
    await window.electronAPI.workspacesSave(workspaces);
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

settingsAddWs.addEventListener('click', async () => {
    const ws = await window.electronAPI.workspacesAdd();
    if (ws) {
        workspaces.push(ws);
        await window.electronAPI.workspacesSave(workspaces);
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

// Ensure window.electronAPI.onExtensionInstall is bound
if (window.electronAPI.onExtensionInstall) {
    window.electronAPI.onExtensionInstall((id: string) => installExtension(id));
}



// ─── Add workspace button ─────────────────────────────────────────────────────

addBtn.addEventListener('click', async () => {
    const ws = await window.electronAPI.workspacesAdd();
    if (ws) {
        workspaces.push(ws);
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

    // STEP 1: Save current workspace's terminal state before switching away
    if (activeWorkspaceId && activePtyId && activeTerm) {
        const savedCols = activeTerm.cols;
        const savedRows = activeTerm.rows;
        workspaceTerminalStates.set(activeWorkspaceId, { ptyId: activePtyId, cols: savedCols, rows: savedRows });
    }

    // STEP 2: Update active workspace reference
    activeWorkspaceId = wsId;
    const ws = workspaces.find(w => w.id === wsId)!;

    workspaceHeading.textContent = ws.name;
    emptyState.classList.add('hidden');
    renderWorkspaceBar();

    // STEP 3: Try to restore saved terminal state for this workspace
    const savedState = workspaceTerminalStates.get(wsId);

    if (savedState && savedState.ptyId) {
        // Restore existing PTY session instead of creating new one
        activePtyId = savedState.ptyId;
        
        const term = new Terminal({
            fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
            fontSize: 13, lineHeight: 1.2, cursorBlink: true,
            theme: THEMES[currentTheme],
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());
        term.open(terminalPaneEl);

        activeTerm = term;
        activeFitAddon = fitAddon;

        requestAnimationFrame(() => {
            fitAddon.fit();
            const { cols, rows } = term;
            // Resize PTY to match saved dimensions if needed
            window.electronAPI.ptyResize({ id: activePtyId, cols: savedState.cols, rows: savedState.rows });
        });
    } else {
        // No saved state - create fresh terminal (backward compatible)
        if (activePtyId) { window.electronAPI.ptyKill({ id: activePtyId }); activePtyId = null; }
        if (activeTerm) { activeTerm.dispose(); activeTerm = null; activeFitAddon = null; }
        terminalPaneEl.innerHTML = '';

        const term = new Terminal({
            fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
            fontSize: 13, lineHeight: 1.2, cursorBlink: true,
            theme: THEMES[currentTheme],
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());
        term.open(terminalPaneEl);

        activeTerm = term;
        activeFitAddon = fitAddon;
        const ptyId = `pty-${wsId}-${Date.now()}`;
        activePtyId = ptyId;

        requestAnimationFrame(() => {
            fitAddon.fit();
            const { cols, rows } = term;
            window.electronAPI.ptyCreate({ id: ptyId, cwd: ws.path, cols, rows });
        });
    }

    if (activeTerm) {
        activeTerm.onData((data) => { window.electronAPI.ptyInput({ id: activePtyId!, data }); });
        activeTerm.focus();
    }

    loadExplorer(ws.path, ws.name);
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
        const raw = await window.electronAPI.fsReadDir(dirPath) as { name: string; isDir: boolean; mtime: number; size: number }[];
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
        const content = await window.electronAPI.fsReadFile(filePath);
        const pre = document.createElement('pre');
        pre.textContent = content;
        viewerContent.appendChild(pre);
    } catch {
        viewerContent.innerHTML = '<pre style="color:#f38ba8;padding:12px">⚠ Binary or unreadable file</pre>';
    }
}

// ─── PTY IPC ─────────────────────────────────────────────────────────────────

window.electronAPI.onPtyData(({ id, data }) => { if (id === activePtyId) activeTerm?.write(data); });
window.electronAPI.onPtyExit(({ id, exitCode }) => {
    if (id === activePtyId) activeTerm?.write(`\r\n\x1b[90m[exited: ${exitCode}]\x1b[0m\r\n`);
});

// ─── Sash resizing ────────────────────────────────────────────────────────────

function setupColSash(sashId: string, targetEl: HTMLElement, min: number, max: number) {
    const sash = document.getElementById(sashId)!;
    let dragging = false;
    let dragOffset = 0; // track offset within sash where click occurred
    
    sash.addEventListener('mousedown', (e) => {
        dragging = true;
        document.body.style.cursor = 'col-resize';
        const rect = targetEl.parentElement!.getBoundingClientRect();
        dragOffset = e.clientX - rect.left; // capture click position within sash
        e.preventDefault();
    });
    
    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const rect = targetEl.parentElement!.getBoundingClientRect();
        // Anchor to where user clicked on the sash, so boundary follows cursor exactly
        const val = Math.min(Math.max(targetEl.offsetWidth + (e.clientX - (rect.left + dragOffset)), min), max);
        targetEl.style.width = `${val}px`;
        refreshTerminal();
    });
    
    window.addEventListener('mouseup', () => { if (dragging) { dragging = false; document.body.style.cursor = ''; } });
}

function setupFlexColSash(sashId: string, targetEl: HTMLElement, min: number, max: number) {
    const sash = document.getElementById(sashId)!;
    let dragging = false;
    let dragOffset = 0; // track offset within vertical-sash where click occurred
    
    sash.addEventListener('mousedown', (e) => {
        dragging = true;
        document.body.style.cursor = 'col-resize';
        const appEl = document.getElementById('app')!;
        const appRect = appEl.getBoundingClientRect();
        dragOffset = e.clientX - appRect.left - workspaceBar.offsetWidth - 4; // capture click position
        e.preventDefault();
    });
    
    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const appEl = document.getElementById('app')!;
        const appRect = appEl.getBoundingClientRect();
        const wsWidth = workspaceBar.offsetWidth + 4; // include sash
        // Anchor to click position on vertical-sash, so width adjusts from anchor point
        const val = Math.min(Math.max(targetEl.offsetWidth + (e.clientX - (appRect.left + dragOffset)), min), max);
        targetEl.style.flexBasis = `${val}px`;
        refreshTerminal();
    });
    
    window.addEventListener('mouseup', () => { if (dragging) { dragging = false; document.body.style.cursor = ''; } });
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

setupColSash('workspace-sash', workspaceBar, 48, 280);
setupFlexColSash('vertical-sash', document.getElementById('terminal-section')!, 200, window.innerWidth - 200);
setupRowSash('horizontal-sash', document.getElementById('viewer-section')!, 60, window.innerHeight - 80);

function refreshTerminal() {
    if (activeFitAddon) {
        requestAnimationFrame(() => {
            try {
                activeFitAddon!.fit();
                if (activePtyId && activeTerm) {
                    window.electronAPI.ptyResize({ id: activePtyId, cols: activeTerm.cols, rows: activeTerm.rows });
                }
            } catch { /* ignore */ }
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
    workspaces = await window.electronAPI.workspacesLoad();
    renderWorkspaceBar();
    if (workspaces.length > 0) switchWorkspace(workspaces[0].id);
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

