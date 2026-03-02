/**
 * Logger - Structured logging for TermNexus
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getConfigPath } from './utils';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',  // green
  warn: '\x1b[33m',  // yellow
  error: '\x1b[31m', // red
  silent: '\x1b[0m',
};

const LOG_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 99,
};

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private level: LogLevel = 'info';
  private logFile?: string;
  private fileStream?: fs.WriteStream;
  private context: string;
  private buffer: LogEntry[] = [];
  private flushInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(context: string, options: { level?: LogLevel; logFile?: string } = {}) {
    this.context = context;
    this.level = options.level ?? this.level;
    this.logFile = options.logFile;

    // Setup file logging if specified
    if (this.logFile) {
      this.setupFileLogging();
    }

    // Flush buffer every 5 seconds
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  private setupFileLogging(): void {
    try {
      const logDir = path.dirname(this.logFile!);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Rotate log file if it's too large (>10MB)
      if (fs.existsSync(this.logFile!)) {
        const stats = fs.statSync(this.logFile!);
        if (stats.size > 10 * 1024 * 1024) {
          const backupPath = `${this.logFile}.${Date.now()}.bak`;
          fs.renameSync(this.logFile!, backupPath);
          // Keep only last 5 backup files
          this.rotateBackups(path.dirname(this.logFile!));
        }
      }

      this.fileStream = fs.createWriteStream(this.logFile!, { flags: 'a' });
    } catch (e) {
      console.error('[Logger] Failed to setup file logging:', e);
    }
  }

  private rotateBackups(dir: string): void {
    try {
      const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.bak'))
        .map(f => ({
          name: f,
          path: path.join(dir, f),
          time: fs.statSync(path.join(dir, f)).mtimeMs,
        }))
        .sort((a, b) => b.time - a.time);

      // Remove old backups (keep last 5)
      files.slice(5).forEach(f => {
        fs.unlinkSync(f.path);
      });
    } catch (e) {
      // Ignore
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_WEIGHTS[level] >= LOG_LEVEL_WEIGHTS[this.level];
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}${dataStr}`;
  }

  private logToConsole(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;

    const color = LOG_LEVEL_COLORS[level];
    const reset = '\x1b[0m';
    const formatted = this.formatMessage(level, message, data);

    switch (level) {
      case 'debug':
      case 'info':
        console.log(`${color}${formatted}${reset}`);
        break;
      case 'warn':
        console.warn(`${color}${formatted}${reset}`);
        break;
      case 'error':
        console.error(`${color}${formatted}${reset}`);
        break;
    }
  }

  private logToFile(entry: LogEntry): void {
    if (this.isShuttingDown || !this.fileStream) return;

    this.buffer.push(entry);

    // Flush immediately for errors
    if (entry.level === 'error') {
      this.flush();
    }
  }

  private flush(): void {
    if (this.buffer.length === 0 || !this.fileStream || this.isShuttingDown) return;

    const entries = [...this.buffer];
    this.buffer = [];

    entries.forEach(entry => {
      this.fileStream!.write(JSON.stringify(entry) + '\n');
    });
  }

  debug(message: string, data?: unknown): void {
    this.logToConsole('debug', message, data);
    this.logToFile({
      timestamp: new Date().toISOString(),
      level: 'debug',
      context: this.context,
      message,
      data,
    });
  }

  info(message: string, data?: unknown): void {
    this.logToConsole('info', message, data);
    this.logToFile({
      timestamp: new Date().toISOString(),
      level: 'info',
      context: this.context,
      message,
      data,
    });
  }

  warn(message: string, data?: unknown): void {
    this.logToConsole('warn', message, data);
    this.logToFile({
      timestamp: new Date().toISOString(),
      level: 'warn',
      context: this.context,
      message,
      data,
    });
  }

  error(message: string, error?: Error | unknown, data?: unknown): void {
    let errorInfo: LogEntry['error'];

    if (error instanceof Error) {
      errorInfo = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
      this.logToConsole('error', message, { ...data, error: error.message });
    } else {
      this.logToConsole('error', message, data);
    }

    this.logToFile({
      timestamp: new Date().toISOString(),
      level: 'error',
      context: this.context,
      message,
      data,
      error: errorInfo,
    });
  }

  /**
   * Create a child logger with a different context
   */
  child(childContext: string): Logger {
    const child = new Logger(`${this.context}:${childContext}`, {
      level: this.level,
      logFile: this.logFile,
    });
    return child;
  }

  /**
   * Clean shutdown - flush and close file stream
   */
  shutdown(): void {
    this.isShuttingDown = true;

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.flush();

    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = undefined;
    }
  }
}

/**
 * Global logger instance
 */
class LoggerManager {
  private loggers = new Map<string, Logger>();
  private globalLevel: LogLevel = 'info';
  private logFile?: string;

  init(options: { level?: LogLevel; logFile?: boolean | string } = {}): void {
    this.globalLevel = options.level ?? 'info';

    if (options.logFile === true) {
      const logDir = getConfigPath('logs');
      this.logFile = path.join(logDir, `termnexus-${Date.now()}.log`);
    } else if (typeof options.logFile === 'string') {
      this.logFile = options.logFile;
    }
  }

  get(context: string): Logger {
    if (!this.loggers.has(context)) {
      this.loggers.set(context, new Logger(context, {
        level: this.globalLevel,
        logFile: this.logFile,
      }));
    }
    return this.loggers.get(context)!;
  }

  setLevel(level: LogLevel): void {
    this.globalLevel = level;
    this.loggers.forEach(logger => logger.setLevel(level));
  }

  shutdown(): void {
    this.loggers.forEach(logger => logger.shutdown());
    this.loggers.clear();
  }
}

export const loggerManager = new LoggerManager();

/**
 * Get a logger instance for a specific context
 */
export function getLogger(context: string): Logger {
  return loggerManager.get(context);
}

/**
 * Initialize the logging system
 */
export function initLogger(options: { level?: LogLevel; logFile?: boolean | string } = {}): void {
  loggerManager.init(options);
}

/**
 * Set global log level
 */
export function setLogLevel(level: LogLevel): void {
  loggerManager.setLevel(level);
}
