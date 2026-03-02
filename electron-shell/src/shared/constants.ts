/**
 * Shared constants for TermNexus
 */

import { Theme } from './types';

// ─── File Paths ────────────────────────────────────────────────────────────────

export const CONFIG_DIR = '.ai-terminal-ide';
export const WORKSPACES_FILE = 'workspaces.json';
export const SKILLS_FILE = 'skills.json';
export const GLOBAL_SKILLS_DIR = '.claude/skills';

// ─── Default Colors ─────────────────────────────────────────────────────────────

export const PRESET_COLORS = [
  // Discord colors
  '#5865F2', '#57F287', '#FEE75C', '#ED4245', '#EB459E', '#FF8C00', '#00B0F4',
  // Bright colors
  '#F28C28', '#A020F0', '#00FF00', '#FF00FF', '#00FFFF', '#FFD700', '#FF4500',
  // Catppuccin Mocha
  '#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8', '#cba6f7', '#fab387', '#94e2d5',
  '#74c7ec', '#89dceb', '#b4befe'
] as const;

// ─── File Icons ────────────────────────────────────────────────────────────────

export const FILE_ICONS: Record<string, string> = {
  // TypeScript/JavaScript
  ts: '🔵', tsx: '🔵', js: '🟡', jsx: '🟡',
  // Other languages
  py: '🐍', rs: '🦀', go: '🐹', java: '☕',
  // Config/Data
  md: '📝', json: '⚙️', yaml: '⚙️', yml: '⚙️', toml: '⚙️',
  xml: '📋', csv: '📊',
  // Web
  css: '🎨', html: '🌐', sass: '🎨', scss: '🎨', less: '🎨',
  // Media
  png: '🖼', jpg: '🖼', jpeg: '🖼', svg: '🖼', gif: '🖼', webp: '🖼', bmp: '🖼', ico: '🖼',
  // Docs
  pdf: '📕', doc: '📘', docx: '📘', txt: '📄',
  // Other
  sh: '⚡', zsh: '⚡', bash: '⚡', fish: '⚡',
  env: '🔒', lock: '🔒',
  git: '📦', docker: '🐳',
} as const;

// ─── Terminal Themes ────────────────────────────────────────────────────────────

export const TERMINAL_THEMES: Record<string, Theme> = {
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
  'solarized-light': {
    background: '#fdf6e3', foreground: '#657b83',
    black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900',
    blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
    brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83',
    brightBlue: '#839496', brightMagenta: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3',
    cursor: '#657b83', selectionBackground: '#eee8d5',
  },
};

// ─── Image Extensions ────────────────────────────────────────────────────────────

export const IMAGE_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'avif'
]);

export const PDF_EXTS = new Set(['pdf']);

// ─── UI Constants ───────────────────────────────────────────────────────────────

export const UI_CONSTANTS = {
  WORKSPACE_BAR: {
    MIN_WIDTH: 48,
    DEFAULT_WIDTH: 180,
    MAX_WIDTH: 280,
    COLLAPSED_WIDTH: 56,
  },
  TERMINAL: {
    DEFAULT_COLS: 80,
    DEFAULT_ROWS: 24,
    MIN_COLS: 40,
    MIN_ROWS: 10,
  },
  RIGHT_PANEL: {
    DEFAULT_WIDTH_RATIO: 0.36,
    MIN_WIDTH: 150,
  },
  VIEWER: {
    MIN_HEIGHT: 80,
    DEFAULT_HEIGHT: 200,
  },
  EXPLORER: {
    MIN_HEIGHT: 80,
    DEFAULT_HEIGHT: 200,
  },
} as const;

// ─── Keyboard Shortcuts ─────────────────────────────────────────────────────────

export const KEYBOARD_SHORTCUTS = {
  // Command Palette
  COMMAND_PALETTE: 'CmdOrCtrl+P',
  // Workspace
  WORKSPACE_SWITCH_NEXT: 'CmdOrCtrl+Shift+]',
  WORKSPACE_SWITCH_PREV: 'CmdOrCtrl+Shift+[',
  WORKSPACE_ADD: 'CmdOrCtrl+Shift+N',
  // Terminal
  TERMINAL_NEW_TAB: 'CmdOrCtrl+Shift+T',
  TERMINAL_CLOSE_TAB: 'CmdOrCtrl+Shift+W',
  TERMINAL_FOCUS_NEXT: 'CmdOrCtrl+Alt+]',
  TERMINAL_FOCUS_PREV: 'CmdOrCtrl+Alt+[',
  // Editor
  EDITOR_SAVE: 'CmdOrCtrl+S',
  EDITOR_FIND: 'CmdOrCtrl+F',
  EDITOR_CLOSE: 'CmdOrCtrl+W',
  // App
  SETTINGS_OPEN: 'CmdOrCtrl+,',
  TOGGLE_SIDEBAR: 'CmdOrCtrl+B',
  TOGGLE_EXPLORER: 'CmdOrCtrl+Shift+E',
  QUICK_OPEN: 'CmdOrCtrl+P',
  RELOAD_APP: 'CmdOrCtrl+R',
  DEVTOOLS: 'CmdOrCtrl+Shift+I',
  QUIT: 'CmdOrCtrl+Q',
} as const;

// ─── MIME Types ─────────────────────────────────────────────────────────────────

export const BINARY_EXTENSIONS = new Set([
  'exe', 'dll', 'so', 'dylib', 'bin', 'o', 'a', 'lib',
  'zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'pdf',
  'mp3', 'mp4', 'wav', 'ogg', 'flac', 'avi', 'mov', 'mkv',
]);

// ─── Error Messages ─────────────────────────────────────────────────────────────

export const ERROR_MESSAGES = {
  PERMISSION_DENIED: 'Permission denied',
  FILE_NOT_FOUND: 'File not found',
  INVALID_PATH: 'Invalid path',
  WORKSPACE_EXISTS: 'Workspace already exists',
  WORKSPACE_NOT_FOUND: 'Workspace not found',
  PTY_CREATE_FAILED: 'Failed to create terminal session',
  PTY_NOT_FOUND: 'Terminal session not found',
  INVALID_CONFIG: 'Invalid configuration',
} as const;
