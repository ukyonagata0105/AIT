/**
 * Shared type definitions for TermNexus
 * Used by both main and renderer processes
 */

// ─── Result Type for Error Handling ─────────────────────────────────────────

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<E = Error>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T>(result: Result<T>): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<E>(result: Result<unknown, E>): result is { ok: false; error: E } {
  return !result.ok;
}

export async function safeRun<T>(fn: () => Promise<T> | T): Promise<Result<T>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

// ─── Workspace Types ───────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  path: string;
  color?: string;
}

// ─── Terminal Types ───────────────────────────────────────────────────────────

export interface TerminalState {
  ptyId: string;
  cols: number;
  rows: number;
  shell: string;
  cwd?: string;
}

export interface PtyCreateOptions {
  id: string;
  cwd: string;
  cols: number;
  rows: number;
  shell?: string;
}

export interface PtyInputData {
  id: string;
  data: string;
}

export interface PtyResizeData {
  id: string;
  cols: number;
  rows: number;
}

export interface PtyKillData {
  id: string;
}

export interface PtyDataEvent {
  id: string;
  data: string;
}

export interface PtyExitEvent {
  id: string;
  exitCode: number;
}

// ─── File System Types ────────────────────────────────────────────────────────

export interface FileEntry {
  name: string;
  isDir: boolean;
  mtime?: number;
  size?: number;
  path?: string;
}

export interface ReadDirOptions {
  showHidden?: boolean;
  depth?: number;
}

// ─── Theme Types ───────────────────────────────────────────────────────────────

export type ThemeId = 'dark' | 'tokyo-night' | 'light' | 'solarized-light';

export interface Theme {
  background: string;
  foreground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
  cursor: string;
  selectionBackground: string;
}

// ─── Config Types ───────────────────────────────────────────────────────────────

export interface AppConfig {
  workspaces: Workspace[];
  theme: ThemeId;
  autoDeploySkills: boolean;
  terminal: {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    cursorBlink: boolean;
  };
}

export const DEFAULT_CONFIG: AppConfig = {
  workspaces: [],
  theme: 'dark',
  autoDeploySkills: true,
  terminal: {
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
    fontSize: 13,
    lineHeight: 1.2,
    cursorBlink: true,
  },
};

// ─── IPC Channel Names ─────────────────────────────────────────────────────────

export const IPC_CHANNELS = {
  // Pty
  PTY_CREATE: 'pty:create',
  PTY_INPUT: 'pty:input',
  PTY_RESIZE: 'pty:resize',
  PTY_KILL: 'pty:kill',
  PTY_DATA: 'pty:data',
  PTY_EXIT: 'pty:exit',

  // Workspaces
  WORKSPACES_LOAD: 'workspaces:load',
  WORKSPACES_SAVE: 'workspaces:save',
  WORKSPACES_ADD: 'workspaces:add',
  WORKSPACES_RENAME: 'workspaces:rename',
  WORKSPACES_DELETE: 'workspaces:delete',

  // File System
  FS_READ_DIR: 'fs:readDir',
  FS_READ_FILE: 'fs:readFile',
  FS_WRITE_FILE: 'fs:writeFile',
  FS_STAT: 'fs:stat',

  // Shell
  EXEC_RUN: 'exec:run',
  SHELL_OPEN_EXTERNAL: 'shell:openExternal',
  SHELL_SHOW_CONTEXT_MENU: 'shell:showContextMenu',

  // Server
  SERVER_GET_STATUS: 'server:getStatus',

  // Extensions
  EXT_SEARCH: 'ext:search',
  EXTENSION_INSTALL: 'extension:install',

  // Config
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_RESET: 'config:reset',

  // App
  APP_GET_VERSION: 'app:getVersion',
  APP_QUIT: 'app:quit',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

// ─── Event Types ───────────────────────────────────────────────────────────────

export interface AppEvent {
  type: string;
  payload?: unknown;
  timestamp: number;
}

export type EventListener<T = unknown> = (payload: T) => void;

// ─── Sort/Filter Types ─────────────────────────────────────────────────────────

export type SortKey = 'name' | 'type' | 'date' | 'size';

export interface SortState {
  key: SortKey;
  asc: boolean;
  filter: string;
}

// ─── View Types ────────────────────────────────────────────────────────────────

export type RightView = 'explorer' | 'pdf' | 'image' | 'browser' | 'editor';

export type PanelLayout = {
  workspaceBarWidth: number;
  terminalFlexBasis: number;
  viewerFlexBasis: number;
  rightPanelWidth: number;
};
