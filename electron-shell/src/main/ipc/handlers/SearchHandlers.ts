/**
 * Search IPC Handlers
 * Handles file search and grep operations
 */

import { IpcMainInvokeEvent } from 'electron';
import { getIpcRegistry } from '../IpcRegistry';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const SearchHandlers = {
  /**
   * Execute grep search
   */
  async searchGrep(event: IpcMainInvokeEvent, options: { path: string; pattern: string; args: string[] }) {
    const { path, pattern, args } = options;

    try {
      // Build grep command
      const grepArgs = [...args, pattern, path];
      const command = `grep ${grepArgs.join(' ')}`;

      // Execute grep
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 30000, // 30 second timeout
      });

      return {
        success: true,
        data: stdout,
      };
    } catch (error: any) {
      // Grep returns non-zero exit code when no matches found
      // This is not an error, just no results
      if (error.code === 1 && !error.stderr) {
        return {
          success: true,
          data: '',
        };
      }

      return {
        success: false,
        error: error.message || 'Search failed',
      };
    }
  },

  /**
   * Search for files by name
   */
  async findFiles(event: IpcMainInvokeEvent, options: { path: string; pattern: string }) {
    const { path, pattern } = options;

    try {
      const command = `find "${path}" -name "${pattern}" -type f`;
      const { stdout } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
      });

      const files = stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.trim());

      return {
        success: true,
        data: files,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Find failed',
      };
    }
  },

  /**
   * Search for files by content (ripgrep fallback)
   */
  async searchRipgrep(event: IpcMainInvokeEvent, options: { path: string; pattern: string; args: string[] }) {
    const { path, pattern, args } = options;

    try {
      // Try ripgrep first (faster)
      const command = `rg ${args.join(' ')} ${pattern} ${path}`;
      const { stdout } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
      });

      return {
        success: true,
        data: stdout,
      };
    } catch (error: any) {
      // Ripgrep not found, fall back to grep
      if (error.code === 127 || error.errno === 'ENOENT') {
        return this.searchGrep(event, options);
      }

      return {
        success: false,
        error: error.message || 'Search failed',
      };
    }
  },
};

/**
 * Register search handlers
 */
export function registerSearchHandlers() {
  const registry = getIpcRegistry();
  registry.invoke('search:grep', SearchHandlers.searchGrep);
  registry.invoke('search:files', SearchHandlers.findFiles);
  registry.invoke('search:ripgrep', SearchHandlers.searchRipgrep);
}
