/**
 * WorkspaceService - Workspace management operations
 */

import { dialog, BrowserWindow } from 'electron';
import * as path from 'path';
import { Workspace } from '../../shared/types';
import { generateId } from '../../shared/utils';
import { getLogger, Logger } from '../../shared/Logger';
import { ok, err, Result } from '../../shared/types';
import { getConfigManager, ConfigManager } from './ConfigManager';

export class WorkspaceService {
  private logger: Logger;
  private configManager: ConfigManager;

  constructor() {
    this.logger = getLogger('WorkspaceService');
    this.configManager = getConfigManager();
  }

  /**
   * Get all workspaces
   */
  getAll(): Workspace[] {
    return this.configManager.getWorkspaces();
  }

  /**
   * Get a workspace by ID
   */
  getById(id: string): Workspace | null {
    return this.configManager.getWorkspaces().find(w => w.id === id) ?? null;
  }

  /**
   * Add a new workspace via folder picker
   */
  async addFolder(): Promise<Result<Workspace>> {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) {
      return err(new Error('No focused window'));
    }

    this.logger.debug('Opening folder picker dialog');

    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Workspace Folder',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return err(new Error('Dialog canceled'));
    }

    const folderPath = result.filePaths[0];
    return this.addFromPath(folderPath);
  }

  /**
   * Add a workspace from a path
   */
  addFromPath(folderPath: string, name?: string): Result<Workspace> {
    const fs = require('fs');

    // Validate path
    if (!fs.existsSync(folderPath)) {
      return err(new Error(`Path does not exist: ${folderPath}`));
    }

    const stat = fs.statSync(folderPath);
    if (!stat.isDirectory()) {
      return err(new Error(`Path is not a directory: ${folderPath}`));
    }

    // Generate workspace info
    const wsName = name ?? path.basename(folderPath);
    const wsId = generateId('ws');

    const workspace: Workspace = {
      id: wsId,
      name: wsName,
      path: folderPath,
    };

    const saveResult = this.configManager.addWorkspace(workspace);
    if (!saveResult.ok) {
      return saveResult;
    }

    this.logger.info('Workspace added', { id: wsId, name: wsName, path: folderPath });
    return ok(workspace);
  }

  /**
   * Update a workspace
   */
  update(id: string, updates: Partial<Workspace>): Result<void> {
    const workspace = this.getById(id);
    if (!workspace) {
      return err(new Error(`Workspace not found: ${id}`));
    }

    const result = this.configManager.updateWorkspace(id, updates);
    if (result.ok) {
      this.logger.info('Workspace updated', { id, updates });
    }
    return result;
  }

  /**
   * Rename a workspace
   */
  rename(id: string, newName: string): Result<void> {
    if (!newName || newName.trim().length === 0) {
      return err(new Error('Name cannot be empty'));
    }
    return this.update(id, { name: newName.trim() });
  }

  /**
   * Update workspace color
   */
  setColor(id: string, color: string): Result<void> {
    return this.update(id, { color });
  }

  /**
   * Remove a workspace
   */
  remove(id: string): Result<void> {
    const workspace = this.getById(id);
    if (!workspace) {
      return err(new Error(`Workspace not found: ${id}`));
    }

    const result = this.configManager.removeWorkspace(id);
    if (result.ok) {
      this.logger.info('Workspace removed', { id, name: workspace.name });
    }
    return result;
  }

  /**
   * Check if a path is already a workspace
   */
  isWorkspacePath(folderPath: string): boolean {
    const normalizedPath = path.resolve(folderPath);
    return this.configManager.getWorkspaces().some(
      ws => path.resolve(ws.path) === normalizedPath
    );
  }
}

// Singleton instance
let workspaceServiceInstance: WorkspaceService | null = null;

export function getWorkspaceService(): WorkspaceService {
  if (!workspaceServiceInstance) {
    workspaceServiceInstance = new WorkspaceService();
  }
  return workspaceServiceInstance;
}
