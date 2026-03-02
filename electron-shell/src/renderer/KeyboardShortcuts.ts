/**
 * Keyboard Shortcuts Manager
 * Manages global keyboard shortcuts
 */

import { KEYBOARD_SHORTCUTS } from '../../shared/constants';

type ShortcutHandler = () => void | Promise<void>;

interface ShortcutBinding {
  keys: string[];
  handler: ShortcutHandler;
  description: string;
}

export class KeyboardShortcutsManager {
  private bindings = new Map<string, ShortcutBinding>();
  private isCommandPaletteOpen = false;

  constructor() {
    this.initDefaultShortcuts();
  }

  bind(keys: string[], handler: ShortcutHandler, description: string): void {
    const key = this.normalizeKeys(keys);
    this.bindings.set(key, { keys, handler, description });
  }

  unbind(keys: string[]): void {
    const key = this.normalizeKeys(keys);
    this.bindings.delete(key);
  }

  handleEvent(event: KeyboardEvent): boolean {
    // Ignore if typing in an input field
    const target = event.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' ||
                         target.tagName === 'TEXTAREA' ||
                         target.isContentEditable;

    if (isInputField && !event.metaKey && !event.ctrlKey) {
      return false;
    }

    // Check for matching shortcut
    for (const [key, binding] of this.bindings.entries()) {
      if (this.matchesEvent(event, key)) {
        event.preventDefault();
        event.stopPropagation();
        binding.handler();
        return true;
      }
    }

    return false;
  }

  private matchesEvent(event: KeyboardEvent, key: string): boolean {
    const eventKey = this.formatEventKey(event);
    return eventKey === key;
  }

  private formatEventKey(event: KeyboardEvent): string {
    const parts: string[] = [];

    if (event.metaKey) parts.push('Cmd');
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');

    // Handle special keys
    const key = event.key;
    if (key === ' ') {
      parts.push('Space');
    } else if (key.length === 1) {
      parts.push(key.toUpperCase());
    } else {
      parts.push(key);
    }

    return parts.join('+');
  }

  private normalizeKeys(keys: string[]): string {
    return keys.map(k => {
      // Normalize shorthand like "CmdOrCtrl"
      k = k.replace('CmdOrCtrl', navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl');
      return k;
    }).sort().join('+');
  }

  private initDefaultShortcuts(): void {
    // Command Palette
    this.bind(
      this.parseShortcut(KEYBOARD_SHORTCUTS.COMMAND_PALETTE),
      () => this.toggleCommandPalette(),
      'Open Command Palette'
    );

    // Workspace
    this.bind(
      this.parseShortcut(KEYBOARD_SHORTCUTS.WORKSPACE_SWITCH_NEXT),
      () => this.switchNextWorkspace(),
      'Switch to Next Workspace'
    );

    this.bind(
      this.parseShortcut(KEYBOARD_SHORTCUTS.WORKSPACE_SWITCH_PREV),
      () => this.switchPreviousWorkspace(),
      'Switch to Previous Workspace'
    );

    // Terminal
    this.bind(
      this.parseShortcut(KEYBOARD_SHORTCUTS.TERMINAL_NEW_TAB),
      () => this.newTerminalTab(),
      'New Terminal Tab'
    );

    this.bind(
      this.parseShortcut(KEYBOARD_SHORTCUTS.TERMINAL_CLOSE_TAB),
      () => this.closeCurrentTab(),
      'Close Current Tab'
    );

    // View
    this.bind(
      this.parseShortcut(KEYBOARD_SHORTCUTS.TOGGLE_SIDEBAR),
      () => this.toggleSidebar(),
      'Toggle Sidebar'
    );

    this.bind(
      this.parseShortcut(KEYBOARD_SHORTCUTS.SETTINGS_OPEN),
      () => this.openSettings(),
      'Open Settings'
    );

    // App
    this.bind(
      this.parseShortcut(KEYBOARD_SHORTCUTS.RELOAD_APP),
      () => this.reloadApp(),
      'Reload App'
    );

    this.bind(
      this.parseShortcut(KEYBOARD_SHORTCUTS.DEVTOOLS),
      () => this.toggleDevTools(),
      'Toggle DevTools'
    );
  }

  private parseShortcut(shortcut: string): string[] {
    // Parse shortcuts like "CmdOrCtrl+Shift+P"
    const normalized = navigator.platform.includes('Mac')
      ? shortcut.replace(/CmdOrCtrl/g, 'Cmd')
      : shortcut.replace(/CmdOrCtrl/g, 'Ctrl');

    return normalized.split('+').map(k => k.trim());
  }

  // Event handlers - to be connected to actual implementations
  private toggleCommandPalette(): void {
    window.dispatchEvent(new CustomEvent('command-palette:toggle'));
  }

  private switchNextWorkspace(): void {
    window.dispatchEvent(new CustomEvent('workspace:switch-next'));
  }

  private switchPreviousWorkspace(): void {
    window.dispatchEvent(new CustomEvent('workspace:switch-previous'));
  }

  private newTerminalTab(): void {
    window.dispatchEvent(new CustomEvent('terminal:new-tab'));
  }

  private closeCurrentTab(): void {
    window.dispatchEvent(new CustomEvent('terminal:close-current-tab'));
  }

  private toggleSidebar(): void {
    window.dispatchEvent(new CustomEvent('sidebar:toggle'));
  }

  private openSettings(): void {
    window.dispatchEvent(new CustomEvent('settings:open'));
  }

  private reloadApp(): void {
    window.location.reload();
  }

  private toggleDevTools(): void {
    const { electronAPI } = window as any;
    if (electronAPI?.toggleDevTools) {
      electronAPI.toggleDevTools();
    }
  }
}
