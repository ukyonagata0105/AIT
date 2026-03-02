/**
 * Command Palette Manager
 * Manages command palette UI and actions
 */

import { CommandPaletteAction } from './types';
import { KEYBOARD_SHORTCUTS } from '../../shared/constants';

export class CommandPaletteManager {
  private actions: CommandPaletteAction[] = [];
  private filteredActions: CommandPaletteAction[] = [];
  private selectedIndex = 0;
  private isOpen = false;

  constructor() {
    this.registerDefaultActions();
  }

  registerAction(action: CommandPaletteAction): void {
    this.actions.push(action);
  }

  registerActions(actions: CommandPaletteAction[]): void {
    this.actions.push(...actions);
  }

  open(): void {
    this.isOpen = true;
    this.filteredActions = [...this.actions];
    this.selectedIndex = 0;
    this.render();
  }

  close(): void {
    this.isOpen = false;
    this.render();
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  setQuery(query: string): void {
    if (!query) {
      this.filteredActions = [...this.actions];
    } else {
      const lowerQuery = query.toLowerCase();
      this.filteredActions = this.actions.filter(action =>
        action.label.toLowerCase().includes(lowerQuery) ||
        action.category.toLowerCase().includes(lowerQuery)
      );
    }
    this.selectedIndex = 0;
    this.renderResults();
  }

  selectNext(): void {
    if (this.filteredActions.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.filteredActions.length;
    this.renderResults();
  }

  selectPrevious(): void {
    if (this.filteredActions.length === 0) return;
    this.selectedIndex = (this.selectedIndex - 1 + this.filteredActions.length) % this.filteredActions.length;
    this.renderResults();
  }

  async executeSelected(): Promise<void> {
    if (this.filteredActions.length === 0) return;
    const action = this.filteredActions[this.selectedIndex];
    this.close();
    await action.action();
  }

  private registerDefaultActions(): void {
    // Workspace actions
    this.registerActions([
      {
        id: 'workspace.switch',
        label: 'Switch Workspace...',
        icon: '📂',
        shortcut: KEYBOARD_SHORTCUTS.WORKSPACE_SWITCH_NEXT,
        category: 'Workspace',
        action: () => this.showWorkspaceSwitcher(),
      },
      {
        id: 'workspace.add',
        label: 'Add New Workspace',
        icon: '➕',
        shortcut: KEYBOARD_SHORTCUTS.WORKSPACE_ADD,
        category: 'Workspace',
        action: () => this.addWorkspace(),
      },
    ]);

    // Terminal actions
    this.registerActions([
      {
        id: 'terminal.new-tab',
        label: 'New Terminal Tab',
        icon: '📑',
        shortcut: KEYBOARD_SHORTCUTS.TERMINAL_NEW_TAB,
        category: 'Terminal',
        action: () => this.newTerminalTab(),
      },
      {
        id: 'terminal.close-tab',
        label: 'Close Current Tab',
        icon: '✕',
        shortcut: KEYBOARD_SHORTCUTS.TERMINAL_CLOSE_TAB,
        category: 'Terminal',
        action: () => this.closeTerminalTab(),
      },
      {
        id: 'terminal.focus-next',
        label: 'Focus Next Terminal',
        icon: '→',
        shortcut: KEYBOARD_SHORTCUTS.TERMINAL_FOCUS_NEXT,
        category: 'Terminal',
        action: () => this.focusNextTerminal(),
      },
      {
        id: 'terminal.focus-prev',
        label: 'Focus Previous Terminal',
        icon: '←',
        shortcut: KEYBOARD_SHORTCUTS.TERMINAL_FOCUS_PREV,
        category: 'Terminal',
        action: () => this.focusPreviousTerminal(),
      },
    ]);

    // View actions
    this.registerActions([
      {
        id: 'view.toggle-sidebar',
        label: 'Toggle Sidebar',
        icon: '📋',
        shortcut: KEYBOARD_SHORTCUTS.TOGGLE_SIDEBAR,
        category: 'View',
        action: () => this.toggleSidebar(),
      },
      {
        id: 'view.toggle-explorer',
        label: 'Toggle Explorer',
        icon: '📁',
        shortcut: KEYBOARD_SHORTCUTS.TOGGLE_EXPLORER,
        category: 'View',
        action: () => this.toggleExplorer(),
      },
      {
        id: 'view.open-settings',
        label: 'Open Settings',
        icon: '⚙️',
        shortcut: KEYBOARD_SHORTCUTS.SETTINGS_OPEN,
        category: 'View',
        action: () => this.openSettings(),
      },
    ]);

    // Theme actions
    this.registerActions([
      {
        id: 'theme.dark',
        label: 'Dark Theme',
        icon: '🌙',
        category: 'Theme',
        action: () => this.setTheme('dark'),
      },
      {
        id: 'theme.tokyo-night',
        label: 'Tokyo Night Theme',
        icon: '🌃',
        category: 'Theme',
        action: () => this.setTheme('tokyo-night'),
      },
      {
        id: 'theme.light',
        label: 'Light Theme',
        icon: '☀️',
        category: 'Theme',
        action: () => this.setTheme('light'),
      },
    ]);
  }

  private render(): void {
    const palette = document.getElementById('command-palette');
    if (!palette) return;

    if (!this.isOpen) {
      palette.classList.add('hidden');
      return;
    }

    palette.classList.remove('hidden');
    this.renderResults();

    // Focus input
    const input = document.getElementById('command-palette-input') as HTMLInputElement;
    if (input) {
      input.value = '';
      input.focus();
    }
  }

  private renderResults(): void {
    const resultsContainer = document.getElementById('command-palette-results');
    if (!resultsContainer) return;

    // Group by category
    const grouped = new Map<string, CommandPaletteAction[]>();
    for (const action of this.filteredActions) {
      if (!grouped.has(action.category)) {
        grouped.set(action.category, []);
      }
      grouped.get(action.category)!.push(action);
    }

    let html = '';
    for (const [category, actions] of grouped.entries()) {
      html += `<div class="command-palette-group">`;
      html += `<div class="command-palette-group-header">${category}</div>`;
      html += actions.map((action, index) => {
        const globalIndex = this.filteredActions.indexOf(action);
        const isSelected = globalIndex === this.selectedIndex;
        html += `
          <div class="command-palette-item${isSelected ? ' selected' : ''}"
               data-action-id="${action.id}"
               data-index="${globalIndex}">
            <div class="command-palette-item-icon">${action.icon || ''}</div>
            <div class="command-palette-item-content">
              <div class="command-palette-item-label">${action.label}</div>
            </div>
            ${action.shortcut ? `<div class="command-palette-item-shortcut">${action.shortcut}</div>` : ''}
          </div>
        `;
        return html;
      }).join('');
      html += `</div>`;
    }

    resultsContainer.innerHTML = html;

    // Attach click listeners
    resultsContainer.querySelectorAll('.command-palette-item').forEach(item => {
      item.addEventListener('click', () => {
        const actionId = item.getAttribute('data-action-id');
        const action = this.filteredActions.find(a => a.id === actionId);
        if (action) {
          this.selectedIndex = parseInt(item.getAttribute('data-index')!);
          this.executeSelected();
        }
      });
    });
  }

  // Placeholder methods - to be implemented
  private showWorkspaceSwitcher(): void { console.log('Show workspace switcher'); }
  private addWorkspace(): void { console.log('Add workspace'); }
  private newTerminalTab(): void { console.log('New terminal tab'); }
  private closeTerminalTab(): void { console.log('Close terminal tab'); }
  private focusNextTerminal(): void { console.log('Focus next terminal'); }
  private focusPreviousTerminal(): void { console.log('Focus previous terminal'); }
  private toggleSidebar(): void { console.log('Toggle sidebar'); }
  private toggleExplorer(): void { console.log('Toggle explorer'); }
  private openSettings(): void { console.log('Open settings'); }
  private setTheme(theme: string): void { console.log('Set theme:', theme); }
}
