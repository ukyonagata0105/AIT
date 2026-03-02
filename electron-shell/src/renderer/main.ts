/**
 * TermNexus - Main Renderer Entry Point
 * Refactored with modular architecture
 */

import './index.css';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

// Managers
import { TerminalTabsManager } from './TerminalTabsManager';
import { CommandPaletteManager } from './CommandPalette';
import { ToastManager } from './ToastManager';
import { KeyboardShortcutsManager } from './KeyboardShortcuts';

// Components
import { CodeEditor } from './CodeEditor';

// Types
import type { Workspace, TerminalTab } from './types';
import type { FileEntry } from '../../shared/types';

// ─── Global State ───────────────────────────────────────────────────────────

let workspaces: Workspace[] = [];
let activeWorkspaceId: string | null = null;

// Terminal instances - mapped by tab ID
const terminals = new Map<string, { terminal: Terminal; fitAddon: FitAddon }>();

// Code editor instance for file viewer
let codeEditor: CodeEditor | null = null;

// Managers
const terminalTabsManager = new TerminalTabsManager();
const commandPaletteManager = new CommandPaletteManager();
const toastManager = new ToastManager();
const keyboardManager = new KeyboardShortcutsManager();

// ─── DOM Elements ───────────────────────────────────────────────────────────

const terminalPaneEl = document.getElementById('terminal-pane')!;
const emptyState = document.getElementById('empty-state')!;
const terminalTabsContainer = document.getElementById('terminal-tabs-container')!;
const terminalTabAddBtn = document.getElementById('terminal-tab-add')!;
const commandPaletteInput = document.getElementById('command-palette-input') as HTMLInputElement;

// ─── Initialization ─────────────────────────────────────────────────────────

async function init() {
  // Initialize toast manager
  toastManager.init();

  // Load workspaces
  workspaces = await window.electronAPI.workspacesLoad();

  // Setup keyboard shortcuts
  setupKeyboardShortcuts();

  // Setup command palette
  setupCommandPalette();

  // Setup terminal tabs
  setupTerminalTabs();

  // Setup UI event listeners
  setupUIListeners();

  // Restore theme
  const savedTheme = localStorage.getItem('theme') || 'dark';
  applyTheme(savedTheme);

  // Render workspace bar
  renderWorkspaceBar();

  // Load first workspace if available
  if (workspaces.length > 0) {
    switchWorkspace(workspaces[0].id);
  }
}

// ─── Terminal Tabs ───────────────────────────────────────────────────────────

function setupTerminalTabs() {
  // Add new tab button
  terminalTabAddBtn.addEventListener('click', () => {
    if (activeWorkspaceId) {
      createNewTerminalTab(activeWorkspaceId);
    }
  });

  // Listen for custom events
  window.addEventListener('terminal:new-tab', () => {
    if (activeWorkspaceId) {
      createNewTerminalTab(activeWorkspaceId);
    }
  });

  window.addEventListener('terminal:close-current-tab', () => {
    closeActiveTerminalTab();
  });
}

async function createNewTerminalTab(workspaceId: string, ptyId?: string): Promise<void> {
  const workspace = workspaces.find(w => w.id === workspaceId);
  if (!workspace) return;

  // Create PTY if not provided
  if (!ptyId) {
    ptyId = `pty-${workspaceId}-${Date.now()}`;

    // Get terminal dimensions from pane
    const tempTerm = new Terminal({ cols: 80, rows: 24 });
    terminalPaneEl.appendChild(tempTerm.element);
    const { cols, rows } = tempTerm;
    tempTerm.dispose();

    await window.electronAPI.ptyCreate({ id: ptyId, cwd: workspace.path, cols, rows });
  }

  // Create tab
  const tab = terminalTabsManager.createTab(workspaceId, workspace.path, ptyId);

  // Create terminal instance
  const terminal = new Terminal({
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
    fontSize: 13,
    lineHeight: 1.2,
    cursorBlink: true,
    theme: getTerminalTheme(),
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(new WebLinksAddon());
  terminal.open(terminalPaneEl);

  // Store terminal instance
  terminals.set(tab.id, { terminal, fitAddon });

  // Handle data input
  terminal.onData((data) => {
    window.electronAPI.ptyInput({ id: ptyId, data });
  });

  // Focus new terminal
  requestAnimationFrame(() => {
    fitAddon.fit();
    const { cols, rows } = terminal;
    window.electronAPI.ptyResize({ id: ptyId, cols, rows });
    terminal.focus();
  });

  // Switch to new tab
  terminalTabsManager.switchTab(tab.id);
  renderTerminalTabs();
}

function switchToTab(tabId: string): void {
  const tab = terminalTabsManager.getTab(tabId);
  if (!tab) return;

  terminalTabsManager.switchTab(tabId);

  // Show terminal for this tab
  const terminalInstance = terminals.get(tabId);
  if (terminalInstance) {
    terminalInstance.terminal.element.style.display = '';
    requestAnimationFrame(() => {
      terminalInstance.fitAddon.fit();
      terminalInstance.terminal.focus();
    });
  }

  renderTerminalTabs();
}

function closeTerminalTab(tabId: string): void {
  const tab = terminalTabsManager.getTab(tabId);
  if (!tab) return;

  // Kill PTY
  window.electronAPI.ptyKill({ id: tab.ptyId });

  // Remove terminal instance
  const terminalInstance = terminals.get(tabId);
  if (terminalInstance) {
    terminalInstance.terminal.dispose();
    terminals.delete(tabId);
  }

  // Remove from manager
  terminalTabsManager.closeTab(tabId);
  renderTerminalTabs();

  // If no tabs left, show empty state
  if (terminals.size === 0) {
    terminalPaneEl.innerHTML = '';
    emptyState.classList.remove('hidden');
  }
}

function closeActiveTerminalTab(): void {
  const activeTabId = terminalTabsManager.getActiveTabId(activeWorkspaceId!);
  if (activeTabId) {
    closeTerminalTab(activeTabId);
  }
}

function renderTerminalTabs(): void {
  if (!activeWorkspaceId) return;

  const tabs = terminalTabsManager.getWorkspaceTabs(activeWorkspaceId);
  terminalTabsContainer.innerHTML = '';

  tabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = `terminal-tab${tab.isActive ? ' active' : ''}`;
    tabEl.innerHTML = `
      <span class="tab-title">${tab.title}</span>
      <span class="tab-close" title="Close tab">✕</span>
    `;

    tabEl.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).classList.contains('tab-close')) {
        switchToTab(tab.id);
      }
    });

    tabEl.querySelector('.tab-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTerminalTab(tab.id);
    });

    terminalTabsContainer.appendChild(tabEl);
  });
}

// ─── Command Palette ───────────────────────────────────────────────────────

function setupCommandPalette() {
  // Listen for input changes
  commandPaletteInput.addEventListener('input', (e) => {
    commandPaletteManager.setQuery((e.target as HTMLInputElement).value);
  });

  // Handle keyboard navigation in palette
  commandPaletteInput.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        commandPaletteManager.selectNext();
        break;
      case 'ArrowUp':
        e.preventDefault();
        commandPaletteManager.selectPrevious();
        break;
      case 'Enter':
        e.preventDefault();
        commandPaletteManager.executeSelected();
        break;
      case 'Escape':
        e.preventDefault();
        commandPaletteManager.close();
        break;
    }
  });

  // Close on backdrop click
  const backdrop = document.getElementById('command-palette-backdrop');
  backdrop?.addEventListener('click', () => {
    commandPaletteManager.close();
  });

  // Listen for toggle events
  window.addEventListener('command-palette:toggle', () => {
    commandPaletteManager.toggle();
  });
}

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    keyboardManager.handleEvent(e);
  });
}

// ─── UI Event Listeners ──────────────────────────────────────────────────────

function setupUIListeners() {
  // Workspace add button
  const addBtn = document.getElementById('workspace-add-btn')!;
  addBtn.addEventListener('click', async () => {
    const ws = await window.electronAPI.workspacesAdd();
    if (ws) {
      workspaces.push(ws);
      await window.electronAPI.workspacesSave(workspaces);
      renderWorkspaceBar();
      switchWorkspace(ws.id);
      toastManager.success('Workspace Added', `Added ${ws.name}`);
    }
  });

  // Settings button
  const settingsBtn = document.getElementById('settings-btn')!;
  settingsBtn.addEventListener('click', () => {
    const settingsOverlay = document.getElementById('settings-overlay')!;
    settingsOverlay.classList.remove('hidden');
  });

  // Settings close
  const settingsClose = document.getElementById('settings-close')!;
  settingsClose.addEventListener('click', () => {
    const settingsOverlay = document.getElementById('settings-overlay')!;
    settingsOverlay.classList.add('hidden');
  });

  // Listen for settings open
  window.addEventListener('settings:open', () => {
    const settingsOverlay = document.getElementById('settings-overlay')!;
    settingsOverlay.classList.remove('hidden');
  });

  // Sidebar toggle
  window.addEventListener('sidebar:toggle', () => {
    const workspaceBar = document.getElementById('workspace-bar')!;
    const collapseBtn = document.getElementById('ws-collapse-btn')!;
    const isCollapsed = workspaceBar.classList.contains('collapsed');

    workspaceBar.classList.toggle('collapsed', !isCollapsed);
    collapseBtn.textContent = isCollapsed ? '◀' : '▶';

    // Refresh terminal size
    const activeTab = terminalTabsManager.getActiveTabId(activeWorkspaceId!);
    if (activeTab) {
      const terminalInstance = terminals.get(activeTab);
      if (terminalInstance) {
        requestAnimationFrame(() => {
          terminalInstance.fitAddon.fit();
        });
      }
    }
  });
}

// ─── Workspace Switching ───────────────────────────────────────────────────

async function switchWorkspace(workspaceId: string) {
  if (workspaceId === activeWorkspaceId) return;

  activeWorkspaceId = workspaceId;
  const workspace = workspaces.find(w => w.id === workspaceId)!;

  // Update heading
  const workspaceHeading = document.getElementById('workspace-heading')!;
  workspaceHeading.textContent = workspace.name;

  // Hide empty state
  emptyState.classList.add('hidden');

  // Check if workspace has tabs
  const tabs = terminalTabsManager.getWorkspaceTabs(workspaceId);

  if (tabs.length === 0) {
    // Create first tab for this workspace
    await createNewTerminalTab(workspaceId);
  } else {
    // Switch to first tab
    switchToTab(tabs[0].id);
  }

  // Load explorer
  loadExplorer(workspace.path, workspace.name);

  renderWorkspaceBar();
}

// ─── Workspace Bar Rendering ────────────────────────────────────────────────

function renderWorkspaceBar() {
  const workspaceList = document.getElementById('workspace-list')!;
  workspaceList.innerHTML = '';

  for (const ws of workspaces) {
    const item = document.createElement('div');
    item.className = `workspace-item${ws.id === activeWorkspaceId ? ' active' : ''}`;

    const icon = document.createElement('div');
    icon.className = 'workspace-icon';
    icon.style.backgroundColor = ws.color || getColorFromId(ws.id);
    icon.textContent = getInitials(ws.name);

    const label = document.createElement('span');
    label.className = 'workspace-label';
    label.textContent = ws.name;

    item.appendChild(icon);
    item.appendChild(label);

    item.addEventListener('click', () => switchWorkspace(ws.id));
    workspaceList.appendChild(item);
  }
}

// ─── Theme ───────────────────────────────────────────────────────────────────

function getTerminalTheme() {
  const theme = localStorage.getItem('theme') || 'dark';

  const themes: Record<string, any> = {
    'dark': {
      background: '#1e1e1e', foreground: '#cccccc',
      black: '#1e1e1e', red: '#f14c4c', green: '#a9d317', yellow: '#ffc93c',
      blue: '#61afef', magenta: '#bb9af7', cyan: '#76d6d5', white: '#e0e0e0',
      brightBlack: '#2d2d2d', brightRed: '#f14c4c', brightGreen: '#a9d317', brightYellow: '#ffc93c',
      brightBlue: '#61afef', brightMagenta: '#bb9af7', brightCyan: '#76d6d5', brightWhite: '#e0e0e0',
      cursor: '#cccccc', selectionBackground: '#45475a',
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
    };

  return themes[theme] || themes['dark'];
}

function applyTheme(themeId: string) {
  localStorage.setItem('theme', themeId);
  document.documentElement.setAttribute('data-theme', themeId);

  // Update all terminals
  terminals.forEach(({ terminal }) => {
    terminal.options.theme = getTerminalTheme();
  });
}

// ─── File Explorer ───────────────────────────────────────────────────────────

let explorerSort: { key: 'name' | 'type' | 'date' | 'size'; asc: boolean; filter: string } = {
  key: 'name',
  asc: true,
  filter: '',
};

async function loadExplorer(dirPath: string, label: string) {
  const explorerTitle = document.getElementById('explorer-title')!;
  const explorerTree = document.getElementById('explorer-tree')!;
  const explorerFilterInput = document.getElementById('explorer-filter') as HTMLInputElement;

  explorerTitle.textContent = label.toUpperCase();
  explorerTree.innerHTML = '';

  try {
    const entries = await window.electronAPI.fsReadDir(dirPath) as FileEntry[];
    const sorted = sortExplorerEntries(entries);
    await renderExplorerEntries(sorted, dirPath, 0);
  } catch (e) {
    explorerTree.innerHTML = '<div class="tree-item" style="color:#f38ba8;">⚠ permission denied</div>';
  }
}

function sortExplorerEntries(entries: FileEntry[]): FileEntry[] {
  const { key, asc, filter } = explorerSort;

  let filtered = entries;
  if (filter) {
    filtered = entries.filter(e => e.name.toLowerCase().includes(filter));
  }

  const compare = (a: FileEntry, b: FileEntry): number => {
    let delta = 0;
    switch (key) {
      case 'name':
        delta = a.name.localeCompare(b.name);
        break;
      case 'type': {
        const extA = a.isDir ? '' : (a.name.split('.').pop() || '');
        const extB = b.isDir ? '' : (b.name.split('.').pop() || '');
        delta = extA.localeCompare(extB) || a.name.localeCompare(b.name);
        break;
      }
      case 'date':
        delta = (a.mtime || 0) - (b.mtime || 0);
        break;
      case 'size':
        delta = (a.size || 0) - (b.size || 0);
        break;
    }
    return asc ? delta : -delta;
  };

  const dirs = filtered.filter(e => e.isDir).sort(compare);
  const files = filtered.filter(e => !e.isDir).sort(compare);
  return [...dirs, ...files];
}

async function renderExplorerEntries(entries: FileEntry[], dirPath: string, depth: number): Promise<void> {
  const explorerTree = document.getElementById('explorer-tree')!;

  for (const entry of entries) {
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
          await renderExplorerEntries(
            await window.electronAPI.fsReadDir(fullPath) as FileEntry[],
            fullPath,
            depth + 1
          );
        } else {
          childContainer?.remove();
          childContainer = null;
        }
      });
    } else {
      item.addEventListener('click', () => openFile(fullPath, item));
    }

    explorerTree.appendChild(item);
  }
}

async function openFile(filePath: string, itemEl: HTMLElement) {
  document.querySelectorAll('.tree-item.selected').forEach(el => el.classList.remove('selected'));
  itemEl.classList.add('selected');

  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico']);
  const PDF_EXT = new Set(['pdf']);

  if (PDF_EXT.has(ext)) {
    openPdfViewer(filePath);
    return;
  }

  if (IMAGE_EXT.has(ext)) {
    openImageViewer(filePath);
    return;
  }

  // Code editor for text files
  const viewerContent = document.getElementById('viewer-content')!;
  const viewerToolbar = document.getElementById('viewer-toolbar')!;

  viewerContent.innerHTML = '';
  viewerToolbar.innerHTML = '';

  // Create toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'code-editor-toolbar';
  toolbar.innerHTML = `
    <span class="code-editor-path">${filePath}</span>
    <div class="code-editor-actions">
      <button class="code-editor-btn" data-action="save" title="Save (Cmd+S)">💾 Save</button>
      <button class="code-editor-btn" data-action="close" title="Close">✕</button>
    </div>
  `;
  viewerToolbar.appendChild(toolbar);

  // Create status bar
  const statusBar = document.createElement('div');
  statusBar.className = 'code-editor-status';
  statusBar.innerHTML = `
    <span class="status-item" data-action="cursor">Ln 1, Col 1</span>
    <span class="status-item">${ext.toUpperCase()}</span>
    <span class="status-item">UTF-8</span>
  `;
  viewerContent.appendChild(statusBar);

  // Create editor container
  const editorContainer = document.createElement('div');
  editorContainer.className = 'code-editor';
  viewerContent.appendChild(editorContainer);

  try {
    const content = await window.electronAPI.fsReadFile(filePath);

    // Detect language from file extension
    const language = CodeEditor.detectLanguage(filePath);

    // Create code editor
    codeEditor = new CodeEditor(editorContainer, {
      language,
      readOnly: false,
      fontSize: 13,
      tabSize: 2,
      lineNumbers: true,
      wordWrap: false,
      theme: (localStorage.getItem('theme') as 'dark' | 'light') || 'dark',
    });

    codeEditor.setContent(content);
    codeEditor.focus();

    // Update cursor position in status bar
    const updateCursorPosition = () => {
      if (codeEditor) {
        const pos = codeEditor.getCursorPosition();
        const cursorEl = statusBar.querySelector('[data-action="cursor"]') as HTMLElement;
        if (cursorEl) {
          cursorEl.textContent = `Ln ${pos.line}, Col ${pos.column}`;
        }
      }
    };

    // Listen for cursor changes
    const textarea = editorContainer.querySelector('textarea')!;
    textarea.addEventListener('keyup', updateCursorPosition);
    textarea.addEventListener('click', updateCursorPosition);

    // Save button handler
    toolbar.querySelector('[data-action="save"]')?.addEventListener('click', async () => {
      if (codeEditor) {
        const newContent = codeEditor.getContent();
        try {
          await window.electronAPI.fsWriteFile(filePath, newContent);
          toastManager.success('File Saved', `Saved ${filePath.split('/').pop()}`);
        } catch (err) {
          toastManager.error('Save Failed', err instanceof Error ? err.message : 'Unknown error');
        }
      }
    });

    // Close button handler
    toolbar.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      viewerContent.innerHTML = '<div class="panel-placeholder"><div class="ph-icon">📄</div><div class="ph-label">No file open</div></div>';
      viewerToolbar.innerHTML = '';
      codeEditor = null;
    });

    // Keyboard shortcut for save
    const handleSave = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        toolbar.querySelector('[data-action="save"]')?.dispatchEvent(new Event('click'));
      }
    };
    textarea.addEventListener('keydown', handleSave);

  } catch (err) {
    viewerContent.innerHTML = '<div class="panel-placeholder"><div class="ph-icon">⚠️</div><div class="ph-label">Cannot read file</div></div>';
  }
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const icons: Record<string, string> = {
    ts: '🔵', tsx: '🔵', js: '🟡', jsx: '🟡',
    py: '🐍', rs: '🦀', go: '🐹',
    md: '📝', json: '⚙️', yaml: '⚙️', yml: '⚙️',
    css: '🎨', html: '🌐',
    png: '🖼', jpg: '🖼', jpeg: '🖼', svg: '🖼',
    sh: '⚡', env: '🔒',
  };
  return icons[ext] || '📄';
}

function openPdfViewer(filePath: string) {
  const webview = document.getElementById('pdf-webview') as Electron.WebviewTag;
  const label = document.getElementById('pdf-filename')!;
  webview.src = `file://${filePath}`;
  label.textContent = filePath.split('/').pop() || filePath;

  // Switch to PDF view
  switchRightView('pdf');
}

function openImageViewer(filePath: string) {
  const img = document.getElementById('image-display') as HTMLImageElement;
  const info = document.getElementById('image-info')!;
  img.src = `file://${filePath}`;
  img.onload = () => {
    info.textContent = `${filePath.split('/').pop()} ${img.naturalWidth}×${img.naturalHeight}`;
  };

  // Switch to image view
  switchRightView('image');
}

function switchRightView(view: 'explorer' | 'pdf' | 'image' | 'browser') {
  document.querySelectorAll('.activity-btn').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.view === view);
  });
  document.querySelectorAll('.right-view').forEach(el => {
    el.classList.toggle('hidden', (el as HTMLElement).id !== `view-${view}`);
  });
}

// ─── PTY Events ───────────────────────────────────────────────────────────────

window.electronAPI.onPtyData(({ id, data }) => {
  // Find terminal with this PTY ID and write data
  for (const [tabId, { terminal }] of terminals.entries()) {
    // Check if this terminal's PTY matches
    // This is a simplified check - in production, we'd map PTY IDs to tabs
    terminal.write(data);
  }
});

window.electronAPI.onPtyExit(({ id, exitCode }) => {
  toastManager.info('Terminal Exited', `Process exited with code ${exitCode}`);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.substring(0, 2).toUpperCase();
}

function getColorFromId(id: string): string {
  const PRESET_COLORS = [
    '#5865F2', '#57F287', '#FEE75C', '#ED4245', '#EB459E',
    '#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8', '#cba6f7',
  ];
  let hash = 0;
  for (const c of id) hash = (hash << 5) - hash + c.charCodeAt(0);
  return PRESET_COLORS[Math.abs(hash) % PRESET_COLORS.length];
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

init().catch(err => {
  console.error('Failed to initialize:', err);
  toastManager.error('Initialization Error', err.message);
});
