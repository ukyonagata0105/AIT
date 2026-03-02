/**
 * PtyManager - Low-level PTY session management
 * Infrastructure layer wrapper around node-pty
 */

import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import * as os from 'os';
import { getLogger, Logger } from '../../shared/Logger';
import { ok, err, Result } from '../../shared/types';

interface PtySession {
  pty: pty.IPty;
  createdAt: number;
  cwd: string;
  shell: string;
}

interface PtyCreateOptions {
  id: string;
  cwd: string;
  cols: number;
  rows: number;
  shell?: string;
  env?: Record<string, string>;
}

/**
 * PtyManager manages low-level PTY sessions
 * This is an infrastructure layer component
 */
export class PtyManager extends EventEmitter {
  private logger: Logger;
  private sessions = new Map<string, PtySession>();
  private defaultShell: string;

  constructor() {
    super();
    this.logger = getLogger('PtyManager');
    this.defaultShell = process.env.SHELL || (os.platform() === 'win32' ? 'cmd.exe' : 'bash');
  }

  /**
   * Get the default shell for the platform
   */
  getDefaultShell(): string {
    return this.defaultShell;
  }

  /**
   * Get all active PTY session IDs
   */
  getSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Check if a session exists
   */
  has(id: string): boolean {
    return this.sessions.has(id);
  }

  /**
   * Get a session (internal use)
   */
  private getSession(id: string): PtySession | undefined {
    return this.sessions.get(id);
  }

  /**
   * Create a new PTY session
   */
  create(options: PtyCreateOptions): Result<void> {
    const { id, cwd, cols, rows, shell, env } = options;

    // Kill existing session if any
    if (this.sessions.has(id)) {
      this.kill(id);
    }

    try {
      const shellToUse = shell ?? this.defaultShell;
      const envToUse = {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        BROWSER_CDP_URL: 'http://localhost:9223',
        BROWSER_TYPE: 'internal-browser',
        ...(env ?? {}),
      };

      this.logger.debug('Creating PTY session', {
        id,
        cwd,
        shell: shellToUse,
        cols,
        rows,
      });

      const p = pty.spawn(shellToUse, [], {
        name: 'xterm-256color',
        cols: cols || 80,
        rows: rows || 24,
        cwd,
        env: envToUse as { [key: string]: string },
      });

      // Set up data forwarding
      p.onData((data) => {
        this.emit('data', id, data);
      });

      // Set up exit handling
      p.onExit(({ exitCode }) => {
        this.logger.debug('PTY session exited', { id, exitCode });
        this.sessions.delete(id);
        this.emit('exit', id, exitCode);
      });

      // Store session
      this.sessions.set(id, {
        pty: p,
        createdAt: Date.now(),
        cwd,
        shell: shellToUse,
      });

      return ok(undefined);
    } catch (error) {
      const errObj = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to create PTY session', { id, error: errObj });
      this.emit('error', id, errObj);
      return err(errObj);
    }
  }

  /**
   * Write data to a PTY session
   */
  write(id: string, data: string): Result<void> {
    const session = this.getSession(id);
    if (!session) {
      return err(new Error(`PTY session not found: ${id}`));
    }

    try {
      session.pty.write(data);
      return ok(undefined);
    } catch (error) {
      const errObj = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to write to PTY', { id, error: errObj });
      return err(errObj);
    }
  }

  /**
   * Resize a PTY session
   */
  resize(id: string, cols: number, rows: number): Result<void> {
    const session = this.getSession(id);
    if (!session) {
      return err(new Error(`PTY session not found: ${id}`));
    }

    try {
      session.pty.resize(cols, rows);
      return ok(undefined);
    } catch (error) {
      const errObj = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to resize PTY', { id, cols, rows, error: errObj });
      return err(errObj);
    }
  }

  /**
   * Kill a PTY session
   */
  kill(id: string): Result<void> {
    const session = this.getSession(id);
    if (!session) {
      return err(new Error(`PTY session not found: ${id}`));
    }

    try {
      session.pty.kill();
      this.sessions.delete(id);
      return ok(undefined);
    } catch (error) {
      const errObj = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to kill PTY', { id, error: errObj });
      return err(errObj);
    }
  }

  /**
   * Kill all PTY sessions
   */
  killAll(): Result<void> {
    const errors: Error[] = [];

    for (const [id] of this.sessions) {
      const result = this.kill(id);
      if (!result.ok) {
        errors.push(result.error);
      }
    }

    if (errors.length > 0) {
      return err(new Error(`Failed to kill some sessions: ${errors.map(e => e.message).join(', ')}`));
    }

    return ok(undefined);
  }

  /**
   * Get session info
   */
  getSessionInfo(id: string): { cwd: string; shell: string; createdAt: number } | null {
    const session = this.getSession(id);
    if (!session) return null;

    return {
      cwd: session.cwd,
      shell: session.shell,
      createdAt: session.createdAt,
    };
  }

  /**
   * Get active session count
   */
  getActiveCount(): number {
    return this.sessions.size;
  }
}
