/**
 * Terminal Tabs Manager
 * Manages terminal tabs for workspaces
 */

import { TerminalTab } from './types';
import { generateId } from '../../shared/utils';

export class TerminalTabsManager {
  private tabs = new Map<string, TerminalTab[]>(); // workspaceId -> tabs
  private activeTabIds = new Map<string, string>(); // workspaceId -> active tab id

  getWorkspaceTabs(workspaceId: string): TerminalTab[] {
    return this.tabs.get(workspaceId) || [];
  }

  getActiveTabId(workspaceId: string): string | null {
    return this.activeTabIds.get(workspaceId) || null;
  }

  createTab(workspaceId: string, cwd: string, ptyId: string): TerminalTab {
    const tabs = this.getWorkspaceTabs(workspaceId);

    const newTab: TerminalTab = {
      id: generateId('tab'),
      workspaceId,
      title: this.getDefaultTitle(cwd),
      ptyId,
      isActive: false,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    // Deactivate all other tabs
    tabs.forEach(t => t.isActive = false);
    newTab.isActive = true;

    tabs.push(newTab);
    this.tabs.set(workspaceId, tabs);
    this.activeTabIds.set(workspaceId, newTab.id);

    return newTab;
  }

  switchTab(tabId: string): void {
    for (const [workspaceId, tabs] of this.tabs.entries()) {
      const tab = tabs.find(t => t.id === tabId);
      if (tab) {
        // Deactivate all tabs in workspace
        tabs.forEach(t => t.isActive = false);
        // Activate selected tab
        tab.isActive = true;
        tab.lastActiveAt = Date.now();
        this.activeTabIds.set(workspaceId, tabId);
        break;
      }
    }
  }

  closeTab(tabId: string): TerminalTab | null {
    for (const [workspaceId, tabs] of this.tabs.entries()) {
      const index = tabs.findIndex(t => t.id === tabId);
      if (index !== -1) {
        const removed = tabs.splice(index, 1)[0];

        if (tabs.length === 0) {
          this.tabs.delete(workspaceId);
          this.activeTabIds.delete(workspaceId);
        } else if (removed.isActive) {
          // Activate another tab
          const newIndex = Math.min(index, tabs.length - 1);
          tabs[newIndex].isActive = true;
          this.activeTabIds.set(workspaceId, tabs[newIndex].id);
        }

        return removed;
      }
    }
    return null;
  }

  renameTab(tabId: string, newTitle: string): boolean {
    for (const tabs of this.tabs.values()) {
      const tab = tabs.find(t => t.id === tabId);
      if (tab) {
        tab.title = newTitle;
        return true;
      }
    }
    return false;
  }

  getTab(tabId: string): TerminalTab | null {
    for (const tabs of this.tabs.values()) {
      const tab = tabs.find(t => t.id === tabId);
      if (tab) return tab;
    }
    return null;
  }

  private getDefaultTitle(cwd: string): string {
    // Extract folder name from path
    const parts = cwd.split('/');
    const folder = parts[parts.length - 1] || cwd;
    return `Terminal: ${folder}`;
  }

  getAllTabs(): TerminalTab[] {
    const allTabs: TerminalTab[] = [];
    for (const tabs of this.tabs.values()) {
      allTabs.push(...tabs);
    }
    return allTabs;
  }
}
