/**
 * Renderer-side type definitions
 */

import { TerminalState, Workspace, FileEntry, ThemeId, RightView } from '../../shared/types';

// ─── Terminal Tab ───────────────────────────────────────────────────────────

export interface TerminalTab {
  id: string;
  workspaceId: string;
  title: string;
  ptyId: string;
  isActive: boolean;
  createdAt: number;
  lastActiveAt: number;
}

// ─── Command Palette ────────────────────────────────────────────────────────

export interface CommandPaletteAction {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  category: string;
  action: () => void | Promise<void>;
}

export interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  filteredActions: CommandPaletteAction[];
}

// ─── Toast Notification ───────────────────────────────────────────────────────

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  actions?: ToastAction[];
}

export interface ToastAction {
  label: string;
  action: () => void;
}

// ─── App State ───────────────────────────────────────────────────────────────

export interface AppState {
  // Workspaces
    workspaces: Workspace[];
    activeWorkspaceId: string | null;

  // Terminal
    terminalTabs: Map<string, TerminalTab[]>;
    activeTabId: string | null;

  // UI State
    activeRightView: RightView;
    commandPalette: CommandPaletteState;

  // Theme
    theme: ThemeId;

  // Misc
    isWorkspaceBarCollapsed: boolean;
    broadcastMode: boolean;
}

// ─── Terminal View Events ─────────────────────────────────────────────────

export interface TerminalViewEvents {
  'tab:create': { workspaceId: string };
  'tab:close': { tabId: string };
  'tab:switch': { tabId: string };
  'tab:rename': { tabId: string; newTitle: string };
  'tab:duplicate': { tabId: string };
}

// ─── File Sort State ────────────────────────────────────────────────────────────

export interface FileSortState {
  key: 'name' | 'type' | 'date' | 'size';
  asc: boolean;
  filter: string;
}

// ─── Renderer-specific IPC Bridge ─────────────────────────────────────────────

export interface IpcBridge {
  // Terminal
  ptyCreate: (args: { id: string; cwd: string; cols: number; rows: number; shell?: string; shellArgs?: string[] }) => Promise<{ ok: boolean }>;
  ptyInput: (args: { id: string; data: string }) => void;
  ptyResize: (args: { id: string; cols: number; rows: number }) => void;
  ptyKill: (args: { id: string }) => void;

  // Workspaces
  workspacesLoad: () => Promise<Workspace[]>;
  workspacesSave: (workspaces: Workspace[]) => Promise<{ ok: boolean }>;
  workspacesAdd: () => Promise<Workspace | null>;
  workspacesRename: (id: string, name: string) => Promise<{ ok: boolean }>;
  workspacesDelete: (id: string) => Promise<{ ok: boolean }>;

  // File System
  fsReadDir: (path: string) => Promise<FileEntry[]>;
  fsReadFile: (path: string) => Promise<string>;

  // Config
  configGet: () => Promise<any>;
  configSet: (config: any) => Promise<any>;

  // Shell
  execRun: (cmd: string) => Promise<{ stdout: string; stderr: string }>;

  // Extensions
  extSearch: (query: string) => Promise<any>;
  tmuxIsAvailable: () => Promise<{ ok: boolean }>;

  // Listeners
  onPtyData: (callback: (data: { id: string; data: string }) => void) => void;
  onPtyExit: (callback: (data: { id: string; exitCode: number }) => void) => void;
  onExtensionInstall: (callback: (id: string) => void) => void;

}
