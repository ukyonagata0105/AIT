/**
 * FileHandlers - IPC handlers for file system operations
 */

import { IPC_CHANNELS } from '../../../shared/types';
import { getIpcRegistry } from '../IpcRegistry';
import { getFileService } from '../../services/FileService';

export function registerFileHandlers(): void {
  const registry = getIpcRegistry();
  const fileService = getFileService();

  // Read directory
  registry.invoke(
    IPC_CHANNELS.FS_READ_DIR,
    async (_event, dirPath: string) => {
      return fileService.readDir(dirPath);
    }
  );

  // Read file
  registry.invoke(
    IPC_CHANNELS.FS_READ_FILE,
    async (_event, filePath: string) => {
      return fileService.readFile(filePath);
    }
  );

  // Write file
  registry.invoke(
    IPC_CHANNELS.FS_WRITE_FILE,
    async (_event, filePath: string, content: string) => {
      return fileService.writeFile(filePath, content);
    }
  );

  // Get file stats
  registry.invoke(
    IPC_CHANNELS.FS_STAT,
    async (_event, filePath: string) => {
      return fileService.stat(filePath);
    }
  );
}
