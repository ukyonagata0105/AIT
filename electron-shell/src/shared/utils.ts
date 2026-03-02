/**
 * Shared utility functions for TermNexus
 */

import * as path from 'path';
import * as os from 'os';
import { PRESET_COLORS } from './constants';

// ─── Path Utilities ─────────────────────────────────────────────────────────────

export function getConfigPath(...segments: string[]): string {
  const configDir = path.join(os.homedir(), '.ai-terminal-ide');
  return path.join(configDir, ...segments);
}

export function getGlobalSkillsPath(...segments: string[]): string {
  const skillsDir = path.join(os.homedir(), '.claude', 'skills');
  return path.join(skillsDir, ...segments);
}

export function getWorkspaceSkillsPath(workspacePath: string, skillName: string, ...segments: string[]): string {
  return path.join(workspacePath, '.agent', 'skills', skillName, ...segments);
}

export function ensureDir(dirPath: string): void {
  const fs = require('fs');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ─── String Utilities ───────────────────────────────────────────────────────────

export function getInitials(name: string, maxLength: number = 2): string {
  // Remove common prefixes (numbers, special chars)
  const cleaned = name.replace(/^[0-9\-\_]+/, '');
  // Get initials from each word
  const words = cleaned.split(/[\s\-\_]+/).filter(Boolean);
  if (words.length === 0) return name.substring(0, maxLength).toUpperCase();
  if (words.length === 1) return words[0].substring(0, maxLength).toUpperCase();
  return words.slice(0, maxLength).map(w => w[0]).join('').toUpperCase();
}

export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export function truncatePath(filePath: string, maxLength: number = 40): string {
  if (filePath.length <= maxLength) return filePath;

  const parts = filePath.split(path.sep);
  if (parts.length <= 2) return filePath;

  const filename = parts.pop()!;
  const dirname = parts.pop()!;

  const truncated = [`...`, dirname, filename].join(path.sep);
  if (truncated.length <= maxLength) return truncated;

  // Still too long, truncate filename
  const ext = path.extname(filename);
  const nameWithoutExt = filename.substring(0, filename.length - ext.length);
  const maxNameLength = maxLength - 8; // ".../dir/".length + ext.length

  return ['...', dirname, nameWithoutExt.substring(0, maxNameLength) + ext].join(path.sep);
}

// ─── Color Utilities ───────────────────────────────────────────────────────────

export function getColorFromId(id: string): string {
  const hash = hashString(id);
  return PRESET_COLORS[hash % PRESET_COLORS.length];
}

export function isColorLight(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128;
}

// ─── File Utilities ─────────────────────────────────────────────────────────────

export function getFileExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().substring(1);
  return ext;
}

export function isBinaryFile(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  const binaryExts = new Set([
    'exe', 'dll', 'so', 'dylib', 'bin', 'o', 'a', 'lib',
    'zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar',
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico',
    'mp3', 'mp4', 'wav', 'ogg', 'flac', 'avi', 'mov', 'mkv', 'pdf',
  ]);
  return binaryExts.has(ext);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i > 1 ? 1 : 0)}${units[i]}`;
}

export function formatDate(timestamp: number, locale: string = 'ja-JP'): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(locale, {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatTime(timestamp: number, locale: string = 'ja-JP'): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(timestamp: number, locale: string = 'ja-JP'): string {
  const date = new Date(timestamp);
  return date.toLocaleString(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Sort Utilities ─────────────────────────────────────────────────────────────

export interface SortableEntry {
  name: string;
  isDir: boolean;
  mtime?: number;
  size?: number;
}

export function sortEntries(
  entries: SortableEntry[],
  key: 'name' | 'type' | 'date' | 'size',
  asc: boolean
): SortableEntry[] {
  const compare = (a: SortableEntry, b: SortableEntry): number => {
    let delta = 0;
    switch (key) {
      case 'name':
        delta = a.name.localeCompare(b.name);
        break;
      case 'type': {
        const extA = a.isDir ? '' : (a.name.split('.').pop() || '');
        const extB = b.isDir ? '' : (b.name.split('.').pop() || '');
        delta = extA.localeCompare(extB) || a.name.localeCompare(b.name);
        break;
      }
      case 'date':
        delta = (a.mtime || 0) - (b.mtime || 0);
        break;
      case 'size':
        delta = (a.size || 0) - (b.size || 0);
        break;
    }
    return asc ? delta : -delta;
  };

  const dirs = entries.filter(e => e.isDir).sort(compare);
  const files = entries.filter(e => !e.isDir).sort(compare);
  return [...dirs, ...files];
}

// ─── Validation Utilities ───────────────────────────────────────────────────────

export function isValidPath(filePath: string): boolean {
  try {
    path.resolve(filePath);
    return true;
  } catch {
    return false;
  }
}

export function isValidWorkspacePath(dirPath: string): boolean {
  const fs = require('fs');
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

// ─── Debounce & Throttle ───────────────────────────────────────────────────────

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ─── Array Utilities ───────────────────────────────────────────────────────────

export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((result, item) => {
    const key = keyFn(item);
    (result[key] = result[key] || []).push(item);
    return result;
  }, {} as Record<string, T[]>);
}

export function uniqueBy<T>(array: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return array.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Async Utilities ───────────────────────────────────────────────────────────

export async function retry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; delay?: number; onRetry?: (error: Error, attempt: number) => void } = {}
): Promise<T> {
  const { retries = 3, delay = 1000, onRetry } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (attempt === retries) throw err;
      onRetry?.(err, attempt);
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  throw new Error('Retry failed');
}

export async function parallel<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const promise = fn(items[i], i).then(result => {
      results[i] = result;
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(p => p === promise), 1);
    }
  }

  await Promise.all(executing);
  return results;
}

// ─── Network Utilities ─────────────────────────────────────────────────────────

export function getNetworkIps(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];

  Object.values(interfaces).forEach(ifaces => {
    ifaces?.forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    });
  });

  return ips;
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function normalizeUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}
