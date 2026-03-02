/**
 * WorkspaceHandlers - IPC handlers for workspace operations
 */

import { IPC_CHANNELS, Workspace } from '../../../shared/types';
import { getIpcRegistry } from '../IpcRegistry';
import { getWorkspaceService } from '../../services/WorkspaceService';

export function registerWorkspaceHandlers(): void {
  const registry = getIpcRegistry();
  const workspaceService = getWorkspaceService();

  // Load workspaces
  registry.invoke(
    IPC_CHANNELS.WORKSPACES_LOAD,
    async () => {
      return workspaceService.getAll();
    }
  );

  // Save workspaces
  registry.invoke(
    IPC_CHANNELS.WORKSPACES_SAVE,
    async (_event, workspaces: Workspace[]) => {
      const configManager = require('../../services/ConfigManager').getConfigManager();
      return configManager.setWorkspaces(workspaces);
    }
  );

  // Add workspace
  registry.invoke(
    IPC_CHANNELS.WORKSPACES_ADD,
    async () => {
      return workspaceService.addFolder();
    }
  );

  // Rename workspace
  registry.invoke(
    IPC_CHANNELS.WORKSPACES_RENAME,
    async (_event, id: string, name: string) => {
      return workspaceService.rename(id, name);
    }
  );

  // Delete workspace
  registry.invoke(
    IPC_CHANNELS.WORKSPACES_DELETE,
    async (_event, id: string) => {
      return workspaceService.remove(id);
    }
  );
}
