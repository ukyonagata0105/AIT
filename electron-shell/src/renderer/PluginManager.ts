/**
 * Plugin Manager
 * Extensible plugin system for TermNexus
 */

export type PluginHook = {
  name: string;
  priority: number;
  handler: (...args: unknown[]) => unknown | Promise<unknown>;
};

export type PluginCommand = {
  id: string;
  label: string;
  description: string;
  icon?: string;
  handler: () => void | Promise<void>;
  keybinding?: string;
};

export type PluginSetting = {
  id: string;
  type: 'string' | 'number' | 'boolean' | 'choice' | 'text';
  label: string;
  description?: string;
  default?: unknown;
  choices?: string[]; // For type: 'choice'
  validation?: (value: unknown) => boolean | string;
};

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  settings?: Record<string, PluginSetting>;
  settingsValues?: Record<string, unknown>;
  commands?: PluginCommand[];
  hooks?: Map<string, PluginHook[]>;
  api?: PluginAPI;
}

export interface PluginAPI {
  // Terminal operations
  terminal: {
    write: (data: string) => void;
    onOutput: (callback: (data: string) => void) => () => void;
  };

  // File operations
  files: {
    read: (path: string) => Promise<string>;
    write: (path: string, content: string) => Promise<void>;
    list: (path: string) => Promise<string[]>;
  };

  // UI operations
  ui: {
    showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
    openCommandPalette: () => void;
    registerCommand: (command: PluginCommand) => void;
    unregisterCommand: (commandId: string) => void;
  };

  // Settings operations
  settings: {
    get: (key: string) => unknown;
    set: (key: string, value: unknown) => void;
    getPluginSettings: (pluginId: string) => Record<string, unknown>;
    setPluginSetting: (pluginId: string, key: string, value: unknown) => void;
  };

  // Event system
  events: {
    on: (event: string, handler: (...args: unknown[]) => void) => () => void;
    emit: (event: string, ...args: unknown[]) => void;
    once: (event: string, handler: (...args: unknown[]) => void) => () => void;
  };
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  settings?: Record<string, PluginSetting>;
  permissions?: string[];
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private hooks: Map<string, PluginHook[]> = new Map();
  private eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  constructor() {
    this.registerBuiltInHooks();
  }

  /**
   * Load a plugin from a manifest
   */
  async loadPlugin(manifest: PluginManifest): Promise<boolean> {
    try {
      // Check if plugin is already loaded
      if (this.plugins.has(manifest.id)) {
        return false;
      }

      // Create plugin instance
      const plugin: Plugin = {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        enabled: true,
        settings: manifest.settings || {},
        settingsValues: {},
        commands: [],
        hooks: new Map(),
      };

      // Initialize default settings values
      for (const [key, setting] of Object.entries(manifest.settings || {})) {
        plugin.settingsValues![key] = setting.default;
      }

      // Load plugin code
      const pluginAPI = this.createPluginAPI(manifest.id, manifest.permissions || []);
      const pluginModule = await this.importPluginModule(manifest.main);

      // Initialize plugin
      if (pluginModule.activate) {
        await pluginModule.activate(pluginAPI);
      }

      plugin.api = pluginAPI;
      this.plugins.set(manifest.id, plugin);

      // Emit plugin loaded event
      this.emit('plugin:loaded', manifest.id);

      return true;
    } catch (error) {
      console.error(`Failed to load plugin ${manifest.id}:`, error);
      return false;
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    try {
      // Deactivate plugin
      const pluginModule = await this.getPluginModule(pluginId);
      if (pluginModule?.deactivate) {
        await pluginModule.deactivate();
      }

      // Unregister commands
      for (const command of plugin.commands || []) {
        this.unregisterCommand(command.id);
      }

      // Remove hooks
      for (const [hookName, hooks] of plugin.hooks || []) {
        const globalHooks = this.hooks.get(hookName) || [];
        const filtered = globalHooks.filter(h => !hooks.includes(h));
        this.hooks.set(hookName, filtered);
      }

      // Remove plugin
      this.plugins.delete(pluginId);

      // Emit plugin unloaded event
      this.emit('plugin:unloaded', pluginId);

      return true;
    } catch (error) {
      console.error(`Failed to unload plugin ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    plugin.enabled = true;
    this.emit('plugin:enabled', pluginId);
    return true;
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    plugin.enabled = false;
    this.emit('plugin:disabled', pluginId);
    return true;
  }

  /**
   * Register a hook
   */
  registerHook(hookName: string, handler: PluginHook['handler'], priority = 10): () => void {
    const hook: PluginHook = {
      name: hookName,
      priority,
      handler,
    };

    const hooks = this.hooks.get(hookName) || [];
    hooks.push(hook);
    hooks.sort((a, b) => a.priority - b.priority);
    this.hooks.set(hookName, hooks);

    // Return unregister function
    return () => {
      const hooks = this.hooks.get(hookName) || [];
      const index = hooks.indexOf(hook);
      if (index !== -1) {
        hooks.splice(index, 1);
      }
    };
  }

  /**
   * Execute a hook
   */
  async executeHook(hookName: string, ...args: unknown[]): Promise<unknown[]> {
    const hooks = this.hooks.get(hookName) || [];
    const results: unknown[] = [];

    for (const hook of hooks) {
      try {
        const result = await hook.handler(...args);
        results.push(result);
      } catch (error) {
        console.error(`Hook ${hookName} failed:`, error);
      }
    }

    return results;
  }

  /**
   * Register a command from a plugin
   */
  registerCommand(command: PluginCommand, pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return;
    }

    plugin.commands!.push(command);

    // Emit command registered event
    this.emit('command:registered', command);
  }

  /**
   * Unregister a command
   */
  unregisterCommand(commandId: string): void {
    for (const plugin of this.plugins.values()) {
      const index = plugin.commands?.findIndex(c => c.id === commandId);
      if (index !== undefined && index !== -1) {
        plugin.commands?.splice(index, 1);
        this.emit('command:unregistered', commandId);
        break;
      }
    }
  }

  /**
   * Get all plugins
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get a plugin by ID
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get plugin setting value
   */
  getPluginSetting(pluginId: string, key: string): unknown {
    const plugin = this.plugins.get(pluginId);
    return plugin?.settingsValues?.[key];
  }

  /**
   * Set plugin setting value
   */
  setPluginSetting(pluginId: string, key: string, value: unknown): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    const setting = plugin.settings?.[key];
    if (setting) {
      // Validate value
      if (setting.validation) {
        const valid = setting.validation(value);
        if (valid !== true) {
          console.warn(`Invalid value for ${pluginId}.${key}:`, valid);
          return false;
        }
      }

      plugin.settingsValues![key] = value;
      this.emit('plugin:settingChanged', pluginId, key, value);
      return true;
    }

    return false;
  }

  /**
   * Event emitter
   */
  on(event: string, handler: (...args: unknown[]) => void): () => void {
    const listeners = this.eventListeners.get(event) || new Set();
    listeners.add(handler);
    this.eventListeners.set(event, listeners);

    return () => {
      listeners.delete(handler);
    };
  }

  emit(event: string, ...args: unknown[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Event listener for ${event} failed:`, error);
        }
      }
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private registerBuiltInHooks(): void {
    // Built-in hooks
    this.registerHook('terminal:output', () => {}, 0);
    this.registerHook('file:save', () => {}, 0);
    this.registerHook('file:open', () => {}, 0);
    this.registerHook('workspace:switch', () => {}, 0);
  }

  private createPluginAPI(pluginId: string, permissions: string[]): PluginAPI {
    return {
      terminal: {
        write: (data: string) => {
          this.emit('terminal:write', pluginId, data);
        },
        onOutput: (callback) => {
          return this.on('terminal:output', (data) => callback(data));
        },
      },

      files: {
        read: async (path: string) => {
          return window.electronAPI.fsReadFile(path);
        },
        write: async (path: string, content: string) => {
          return window.electronAPI.fsWriteFile(path, content);
        },
        list: async (path: string) => {
          const entries = await window.electronAPI.fsReadDir(path);
          return entries.map((e: any) => e.name);
        },
      },

      ui: {
        showToast: (message, type = 'info') => {
          this.emit('ui:toast', message, type);
        },
        openCommandPalette: () => {
          this.emit('ui:openCommandPalette');
        },
        registerCommand: (command) => {
          this.registerCommand(command, pluginId);
        },
        unregisterCommand: (commandId) => {
          this.unregisterCommand(commandId);
        },
      },

      settings: {
        get: (key: string) => {
          return localStorage.getItem(key);
        },
        set: (key: string, value: unknown) => {
          localStorage.setItem(key, JSON.stringify(value));
        },
        getPluginSettings: (pluginId: string) => {
          const plugin = this.plugins.get(pluginId);
          return plugin?.settingsValues || {};
        },
        setPluginSetting: (pluginId: string, key: string, value: unknown) => {
          return this.setPluginSetting(pluginId, key, value);
        },
      },

      events: {
        on: (event, handler) => {
          return this.on(event, handler);
        },
        emit: (event, ...args) => {
          this.emit(event, ...args);
        },
        once: (event, handler) => {
          const unsubscribe = this.on(event, (...args) => {
            handler(...args);
            unsubscribe();
          });
          return unsubscribe;
        },
      },
    };
  }

  private async importPluginModule(main: string): Promise<any> {
    // This is a placeholder - in production, you'd dynamically import the plugin
    // For now, return an empty module
    return {
      activate: async (api: PluginAPI) => {
        // Plugin activation logic
      },
      deactivate: async () => {
        // Plugin deactivation logic
      },
    };
  }

  private async getPluginModule(pluginId: string): Promise<any> {
    // Placeholder for getting plugin module
    return null;
  }
}
