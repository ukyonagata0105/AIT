/**
 * PtyHandlers - IPC handlers for PTY operations
 */

import { IPC_CHANNELS, PtyCreateOptions, PtyInputData, PtyResizeData } from '../../../shared/types';
import { getIpcRegistry } from '../IpcRegistry';
import { getTerminalService } from '../../services/TerminalService';

export function registerPtyHandlers(): void {
  const registry = getIpcRegistry();
  const terminalService = getTerminalService();

  // Create PTY session
  registry.invoke(
    IPC_CHANNELS.PTY_CREATE,
    async (_event, options: PtyCreateOptions) => {
      return terminalService.create(options);
    }
  );

  // Send input to PTY
  registry.on(
    IPC_CHANNELS.PTY_INPUT,
    (_event, { id, data }: PtyInputData) => {
      terminalService.write(id, data);
    }
  );

  // Resize PTY
  registry.on(
    IPC_CHANNELS.PTY_RESIZE,
    (_event, { id, cols, rows }: PtyResizeData) => {
      terminalService.resize(id, cols, rows);
    }
  );

  // Kill PTY
  registry.on(
    IPC_CHANNELS.PTY_KILL,
    (_event, { id }: { id: string }) => {
      terminalService.kill(id);
    }
  );
}
