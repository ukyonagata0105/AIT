/**
 * ConfigHandlers - IPC handlers for configuration operations
 */

import { IPC_CHANNELS, AppConfig } from '../../../shared/types';
import { getIpcRegistry } from '../IpcRegistry';
import { getConfigManager } from '../../services/ConfigManager';

export function registerConfigHandlers(): void {
  const registry = getIpcRegistry();
  const configManager = getConfigManager();

  // Get config
  registry.invoke(
    IPC_CHANNELS.CONFIG_GET,
    async () => {
      return configManager.get();
    }
  );

  // Set config (partial update)
  registry.invoke(
    IPC_CHANNELS.CONFIG_SET,
    async (_event, updates: Partial<AppConfig>) => {
      const config = configManager.get();

      // Merge updates
      if (updates.theme) {
        configManager.setTheme(updates.theme);
      }
      if (updates.workspaces) {
        configManager.setWorkspaces(updates.workspaces);
      }
      if (updates.terminal) {
        configManager.setTerminalConfig(updates.terminal);
      }

      return configManager.get();
    }
  );

  // Reset config
  registry.invoke(
    IPC_CHANNELS.CONFIG_RESET,
    async () => {
      return configManager.reset();
    }
  );
}
