/**
 * AppHandlers - IPC handlers for application-level operations
 */

import { app } from 'electron';
import { IPC_CHANNELS } from '../../../shared/types';
import { getIpcRegistry } from '../IpcRegistry';
import { getLogger } from '../../../shared/Logger';

export function registerAppHandlers(): void {
  const registry = getIpcRegistry();
  const logger = getLogger('AppHandlers');

  // Get app version
  registry.invoke(
    IPC_CHANNELS.APP_GET_VERSION,
    async () => {
      return {
        version: app.getVersion(),
        name: app.getName(),
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
        chromeVersion: process.versions.chrome,
      };
    }
  );

  // Quit app
  registry.on(
    IPC_CHANNELS.APP_QUIT,
    () => {
      logger.info('Quit requested via IPC');
      app.quit();
    }
  );
}
