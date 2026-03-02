/**
 * Store - Frontend state management for TermNexus
 * Lightweight reactive state management (no framework dependencies)
 */

import { EventBus } from '../../shared/EventBus';

type Listener<T> = (value: T) => void;
type Unsubscribe = () => void;

interface StoreConfig<T> {
  default: T;
  persistKey?: string;
}

/**
 * Create a reactive store slice
 */
export function createStoreSlice<T>(
  config: StoreConfig<T>
) {
  let state = { ...config.default };
  const listeners = new Set<Listener<T>>();
  const eventBus = new EventBus<{ key: string; value: T }>();

  // Load from localStorage if key provided
  if (config.persistKey) {
    try {
      const saved = localStorage.getItem(config.persistKey);
      if (saved) {
        state = { ...state, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn(`Failed to load ${config.persistKey} from localStorage:`, e);
    }
  }

  const get = (): T => ({ ...state });

  const set = (partial: Partial<T> | ((prev: T) => Partial<T>)): T => {
    const prevState = { ...state };
    const newState = typeof partial === 'function'
      ? { ...state, ...partial(prevState) }
      : { ...state, ...partial };

    state = newState;

    // Notify listeners
    listeners.forEach(listener => listener(newState));

    // Emit event for global bus
    eventBus.emit('change', { value: newState });

    // Persist if key provided
    if (config.persistKey) {
      try {
        localStorage.setItem(config.persistKey, JSON.stringify(newState));
      } catch (e) {
        console.warn(`Failed to persist ${config.persistKey}:`, e);
      }
    }

    return newState;
  };

  const subscribe = (listener: Listener<T>): Unsubscribe => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    get,
    set,
    subscribe,
  };
}

/**
 * Main application store
 */
interface AppStoreState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  terminalTabs: Map<string, TerminalTab[]>;
  activeTabId: string | null;
  theme: ThemeId;
  isWorkspaceBarCollapsed: boolean;
  broadcastMode: boolean;
  activeRightView: RightView;
}

interface Workspace {
  id: string;
  name: string;
  path: string;
  color?: string;
}

interface TerminalTab {
  id: string;
  workspaceId: string;
  title: string;
  ptyId: string;
  isActive: boolean;
  createdAt: number;
  lastActiveAt: number;
}

type ThemeId = 'dark' | 'tokyo-night' | 'light' | 'solarized-light';
type RightView = 'explorer' | 'pdf' | 'image' | 'browser' | 'editor';

// ─── Store Slices ───────────────────────────────────────────────────────────

export const workspacesSlice = createStoreSlice<{
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
}>({
  default: {
    workspaces: [],
    activeWorkspaceId: null,
  },
  persistKey: 'termnexus-workspaces',
});

export const terminalTabsSlice = createStoreSlice<{
  terminalTabs: Map<string, TerminalTab[]>;
  activeTabId: string | null;
}>({
  default: {
    terminalTabs: new Map(),
    activeTabId: null,
  },
  persistKey: 'termnexus-terminal-tabs',
});

export const uiSlice = createStoreSlice<{
  theme: ThemeId;
  isWorkspaceBarCollapsed: boolean;
  broadcastMode: boolean;
  activeRightView: RightView;
  commandPaletteOpen: boolean;
}>({
  default: {
    theme: 'dark',
    isWorkspaceBarCollapsed: false,
    broadcastMode: false,
    activeRightView: 'explorer',
    commandPaletteOpen: false,
  },
  persistKey: 'termnexus-ui',
});

// ─── Convenience Functions ─────────────────────────────────────────────────

export const store = {
  // Workspaces
  get workspaces() { return workspacesSlice.get().workspaces; },
  set workspaces(value) { workspacesSlice.set({ workspaces: value }); return workspacesSlice.get(); },
  get activeWorkspaceId() { return workspacesSlice.get().activeWorkspaceId; },
  set activeWorkspaceId(value) { workspacesSlice.set({ activeWorkspaceId: value }); },

  // Terminal Tabs
  get terminalTabs() { return terminalTabsSlice.get().terminalTabs; },
  set terminalTabs(value) { terminalTabsSlice.set({ terminalTabs: value }); },
  get activeTabId() { return terminalTabsSlice.get().activeTabId; },
  set activeTabId(value) { terminalTabsSlice.set({ activeTabId: value }); },

  // UI
  get theme() { return uiSlice.get().theme; },
  set theme(value) { uiSlice.set({ theme: value }); },
  get isWorkspaceBarCollapsed() { return uiSlice.get().isWorkspaceBarCollapsed; },
  set isWorkspaceBarCollapsed(value) { uiSlice.set({ isWorkspaceBarCollapsed: value }); },
  get broadcastMode() { return uiSlice.get().broadcastMode; },
  set broadcastMode(value) { uiSlice.set({ broadcastMode: value }); },
  get activeRightView() { return uiSlice.get().activeRightView; },
  set activeRightView(value) { uiSlice.set({ activeRightView: value }); },
  get commandPaletteOpen() { return uiSlice.get().commandPaletteOpen; },
  set commandPaletteOpen(value) { uiSlice.set({ commandPaletteOpen: value }); },

  // Subscribe to changes
  subscribe(listener: (state: AppStoreState) => void) {
    let current = {
      workspaces: workspacesSlice.get(),
      terminalTabs: terminalTabsSlice.get(),
      ui: uiSlice.get(),
    };

    const unsub1 = workspacesSlice.subscribe(() => {
      current.workspaces = workspacesSlice.get();
      listener(current);
    });

    const unsub2 = terminalTabsSlice.subscribe(() => {
      current.terminalTabs = terminalTabsSlice.get();
      listener(current);
    });

    const unsub3 = uiSlice.subscribe(() => {
      current.ui = uiSlice.get();
      listener(current);
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  },
};

// ─── Terminal Tab Management ───────────────────────────────────────────────────

export function createTerminalTab(
  workspaceId: string,
  title: string,
  ptyId: string
): TerminalTab {
  return {
    id: `tab-${workspaceId}-${Date.now()}`,
    workspaceId,
    title,
    ptyId,
    isActive: false,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };
}

export function getWorkspaceTabs(workspaceId: string): TerminalTab[] {
  return store.terminalTabs.get(workspaceId) || [];
}

export function addTerminalTab(tab: TerminalTab): void {
  const tabs = store.terminalTabs;
  const workspaceTabs = getWorkspaceTab(tab.workspaceId) || [];

  // Deactivate other tabs in the same workspace
  workspaceTabs.forEach(t => t.isActive = false);
  tab.isActive = true;

  workspaceTabs.push(tab);
  tabs.set(tab.workspaceId, workspaceTabs);
  store.terminalTabs = tabs;
  store.activeTabId = tab.id;
}

export function removeTerminalTab(tabId: string): void {
  const tabs = store.terminalTabs;

  for (const [workspaceId, workspaceTabs] of tabs.entries()) {
    const index = workspaceTabs.findIndex(t => t.id === tabId);
    if (index !== -1) {
      const wasActive = workspaceTabs[index].isActive;
      workspaceTabs.splice(index, 1);

      // If we removed the active tab, activate another
      if (wasActive && workspaceTabs.length > 0) {
        const newActive = workspaceTabs[Math.max(0, index - 1)];
        newActive.isActive = true;
      }

      if (workspaceTabs.length === 0) {
        tabs.delete(workspaceId);
      }

      break;
    }
  }

  store.terminalTabs = tabs;

  if (store.activeTabId === tabId) {
    const allTabs = Array.from(tabs.values()).flat();
    store.activeTabId = allTabs.length > 0 ? allTabs[0].id : null;
  }
}

export function switchTerminalTab(tabId: string): void {
  const tabs = store.terminalTabs;

  for (const [workspaceId, workspaceTabs] of tabs.entries()) {
    workspaceTabs.forEach(t => {
      t.isActive = (t.id === tabId);
      if (t.isActive) {
        t.lastActiveAt = Date.now();
      }
    });
  }

  store.terminalTabs = tabs;
  store.activeTabId = tabId;
}

export function renameTerminalTab(tabId: string, newTitle: string): void {
  const tabs = store.terminalTabs;

  for (const workspaceTabs of tabs.values()) {
    const tab = workspaceTabs.find(t => t.id === tabId);
    if (tab) {
      tab.title = newTitle;
      break;
    }
  }

  store.terminalTabs = tabs;
}

function getWorkspaceTab(workspaceId: string): TerminalTab[] | undefined {
  return store.terminalTabs.get(workspaceId);
}
