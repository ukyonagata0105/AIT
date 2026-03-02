/**
 * ShellHandlers - IPC handlers for shell operations
 */

import { exec, spawn } from 'child_process';
import { IPC_CHANNELS } from '../../../shared/types';
import { getIpcRegistry } from '../IpcRegistry';
import { getLogger } from '../../../shared/Logger';

export function registerShellHandlers(): void {
  const registry = getIpcRegistry();
  const logger = getLogger('ShellHandlers');

  // Run command and get output
  registry.invoke(
    IPC_CHANNELS.EXEC_RUN,
    async (_event, cmd: string) => {
      logger.debug('Executing command', { cmd });

      return new Promise<{ stdout: string; stderr: string }>((resolve) => {
        exec(cmd, {
          env: {
            ...process.env,
            PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin`,
          },
        }, (err, stdout, stderr) => {
          if (err) {
            logger.warn('Command execution failed', { cmd, error: err.message });
            return { stdout: stdout || '', stderr: stderr || err.message };
          } else {
            return { stdout: stdout || '', stderr: stderr || '' };
          }
        });
      });
    }
  );

  // Open file in default app
  // Note: This uses electron's shell.openExternal, handled in main.ts
  // Registration here is for consistency
}

// Helper functions for shell operations
export async function openFile(filePath: string): Promise<void> {
  const { shell } = require('electron');
  await shell.openPath(filePath);
}

export async function showItemInFolder(filePath: string): Promise<void> {
  const { shell } = require('electron');
  await shell.showItemInFolder(filePath);
}

export async function openExternal(url: string): Promise<void> {
  const { shell } = require('electron');
  await shell.openExternal(url);
}
