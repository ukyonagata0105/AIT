/**
 * FileService - File system operations
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileEntry, ReadDirOptions } from '../../shared/types';
import { getLogger, Logger } from '../../shared/Logger';
import { ok, err, Result } from '../../shared/types';
import { BINARY_EXTENSIONS } from '../../shared/constants';

export class FileService {
  private logger: Logger;

  constructor() {
    this.logger = getLogger('FileService');
  }

  /**
   * Read directory contents
   */
  readDir(dirPath: string, options: ReadDirOptions = {}): Result<FileEntry[]> {
    try {
      const { showHidden = false, depth = 0 } = options;

      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const result: FileEntry[] = [];

      for (const entry of entries) {
        // Filter hidden files if requested
        if (!showHidden && entry.name.startsWith('.')) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);
        const fileEntry: FileEntry = {
          name: entry.name,
          isDir: entry.isDirectory(),
          path: fullPath,
        };

        // Get stats
        try {
          const stat = fs.statSync(fullPath);
          fileEntry.mtime = stat.mtimeMs;
          fileEntry.size = stat.size;
        } catch (e) {
          // Stats unavailable, skip
        }

        result.push(fileEntry);
      }

      return ok(result);
    } catch (e) {
      this.logger.error('Failed to read directory', { path: dirPath, error: e });
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Read a file's content
   */
  readFile(filePath: string, encoding: BufferEncoding = 'utf8'): Result<string> {
    try {
      const content = fs.readFileSync(filePath, encoding);
      return ok(content);
    } catch (e) {
      this.logger.error('Failed to read file', { path: filePath, error: e });
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Read a file as base64 (for binary files)
   */
  readFileAsBase64(filePath: string): Result<string> {
    try {
      const content = fs.readFileSync(filePath);
      const base64 = content.toString('base64');
      return ok(base64);
    } catch (e) {
      this.logger.error('Failed to read file as base64', { path: filePath, error: e });
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Write a file
   */
  writeFile(filePath: string, content: string): Result<void> {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, content, 'utf8');
      this.logger.debug('File written', { path: filePath });
      return ok(undefined);
    } catch (e) {
      this.logger.error('Failed to write file', { path: filePath, error: e });
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Get file stats
   */
  stat(filePath: string): Result<fs.Stats> {
    try {
      const stats = fs.statSync(filePath);
      return ok(stats);
    } catch (e) {
      this.logger.error('Failed to stat file', { path: filePath, error: e });
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Check if a file exists
   */
  exists(filePath: string): boolean {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  /**
   * Check if a file is binary
   */
  isBinary(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase().substring(1);
    return BINARY_EXTENSIONS.has(ext);
  }

  /**
   * Get file extension
   */
  getExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase().substring(1);
  }

  /**
   * Resolve a path to absolute
   */
  resolvePath(filePath: string): string {
    return path.resolve(filePath);
  }

  /**
   * Join path segments
   */
  joinPath(...segments: string[]): string {
    return path.join(...segments);
  }

  /**
   * Get the directory name of a path
   */
  getDirName(filePath: string): string {
    return path.dirname(filePath);
  }

  /**
   * Get the base name of a path
   */
  getBaseName(filePath: string): string {
    return path.basename(filePath);
  }

  /**
   * Normalize a path
   */
  normalizePath(filePath: string): string {
    return path.normalize(filePath);
  }

  /**
   * Watch a file or directory for changes
   */
  watch(filePath: string, callback: (event: string, filename: string | null) => void): Result<fs.FSWatcher> {
    try {
      const watcher = fs.watch(filePath, callback);
      return ok(watcher);
    } catch (e) {
      this.logger.error('Failed to watch file', { path: filePath, error: e });
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Delete a file
   */
  delete(filePath: string): Result<void> {
    try {
      fs.unlinkSync(filePath);
      this.logger.debug('File deleted', { path: filePath });
      return ok(undefined);
    } catch (e) {
      this.logger.error('Failed to delete file', { path: filePath, error: e });
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Create a directory
   */
  createDirectory(dirPath: string, recursive: boolean = true): Result<void> {
    try {
      fs.mkdirSync(dirPath, { recursive });
      this.logger.debug('Directory created', { path: dirPath });
      return ok(undefined);
    } catch (e) {
      this.logger.error('Failed to create directory', { path: dirPath, error: e });
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Move/rename a file
   */
  move(oldPath: string, newPath: string): Result<void> {
    try {
      fs.renameSync(oldPath, newPath);
      this.logger.debug('File moved', { from: oldPath, to: newPath });
      return ok(undefined);
    } catch (e) {
      this.logger.error('Failed to move file', { from: oldPath, to: newPath, error: e });
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Copy a file
   */
  copy(sourcePath: string, destPath: string): Result<void> {
    try {
      fs.copyFileSync(sourcePath, destPath);
      this.logger.debug('File copied', { from: sourcePath, to: destPath });
      return ok(undefined);
    } catch (e) {
      this.logger.error('Failed to copy file', { from: sourcePath, to: destPath, error: e });
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

// Singleton instance
let fileServiceInstance: FileService | null = null;

export function getFileService(): FileService {
  if (!fileServiceInstance) {
    fileServiceInstance = new FileService();
  }
  return fileServiceInstance;
}
