/**
 * ConfigManager - Application configuration management
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AppConfig, DEFAULT_CONFIG, Workspace } from '../../shared/types';
import { getConfigPath, ensureDir } from '../../shared/utils';
import { getLogger, Logger } from '../../shared/Logger';
import { ok, err, Result } from '../../shared/types';

const CONFIG_FILE = 'config.json';

export class ConfigManager {
  private logger: Logger;
  private configPath: string;
  private config: AppConfig;
  private watchers: Set<() => void> = new Set();

  constructor() {
    this.logger = getLogger('ConfigManager');
    this.configPath = getConfigPath(CONFIG_FILE);
    this.config = { ...DEFAULT_CONFIG };
    this.load();
  }

  /**
   * Load configuration from disk
   */
  load(): Result<AppConfig> {
    try {
      ensureDir(path.dirname(this.configPath));

      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const loaded = JSON.parse(data) as Partial<AppConfig>;

        // Merge with defaults to handle new fields
        this.config = {
          ...DEFAULT_CONFIG,
          ...loaded,
          terminal: {
            ...DEFAULT_CONFIG.terminal,
            ...(loaded.terminal ?? {}),
          },
        };

        this.logger.info('Configuration loaded', { theme: this.config.theme });
      } else {
        // Create default config
        this.save();
      }

      return ok(this.config);
    } catch (e) {
      this.logger.error('Failed to load configuration', e);
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Save configuration to disk
   */
  save(): Result<void> {
    try {
      ensureDir(path.dirname(this.configPath));
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      this.logger.debug('Configuration saved');
      this.notifyWatchers();
      return ok(undefined);
    } catch (e) {
      this.logger.error('Failed to save configuration', e);
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Get current configuration
   */
  get(): AppConfig {
    return { ...this.config };
  }

  /**
   * Get workspaces
   */
  getWorkspaces(): Workspace[] {
    return [...this.config.workspaces];
  }

  /**
   * Set workspaces
   */
  setWorkspaces(workspaces: Workspace[]): Result<void> {
    this.config.workspaces = workspaces;
    return this.save();
  }

  /**
   * Add a workspace
   */
  addWorkspace(workspace: Workspace): Result<void> {
    const exists = this.config.workspaces.some(w => w.id === workspace.id);
    if (exists) {
      return err(new Error(`Workspace with id ${workspace.id} already exists`));
    }

    this.config.workspaces.push(workspace);
    return this.save();
  }

  /**
   * Update a workspace
   */
  updateWorkspace(id: string, updates: Partial<Workspace>): Result<void> {
    const index = this.config.workspaces.findIndex(w => w.id === id);
    if (index === -1) {
      return err(new Error(`Workspace with id ${id} not found`));
    }

    this.config.workspaces[index] = {
      ...this.config.workspaces[index],
      ...updates,
    };
    return this.save();
  }

  /**
   * Remove a workspace
   */
  removeWorkspace(id: string): Result<void> {
    const index = this.config.workspaces.findIndex(w => w.id === id);
    if (index === -1) {
      return err(new Error(`Workspace with id ${id} not found`));
    }

    this.config.workspaces.splice(index, 1);
    return this.save();
  }

  /**
   * Get theme
   */
  getTheme(): string {
    return this.config.theme;
  }

  /**
   * Set theme
   */
  setTheme(theme: string): Result<void> {
    this.config.theme = theme as any;
    return this.save();
  }

  /**
   * Get terminal config
   */
  getTerminalConfig() {
    return { ...this.config.terminal };
  }

  /**
   * Set terminal config
   */
  setTerminalConfig(updates: Partial<AppConfig['terminal']>): Result<void> {
    this.config.terminal = {
      ...this.config.terminal,
      ...updates,
    };
    return this.save();
  }

  /**
   * Watch for configuration changes
   */
  onChange(callback: () => void): () => void {
    this.watchers.add(callback);
    return () => this.watchers.delete(callback);
  }

  private notifyWatchers(): void {
    this.watchers.forEach(cb => {
      try {
        cb();
      } catch (e) {
        this.logger.error('Error in config watcher callback', e);
      }
    });
  }

  /**
   * Reset to defaults
   */
  reset(): Result<void> {
    this.config = { ...DEFAULT_CONFIG };
    return this.save();
  }
}

// Singleton instance
let configManagerInstance: ConfigManager | null = null;

export function getConfigManager(): ConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager();
  }
  return configManagerInstance;
}
