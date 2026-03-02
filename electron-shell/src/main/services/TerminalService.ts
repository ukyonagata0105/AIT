/**
 * TerminalService - Terminal/PTY management operations
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import { PtyCreateOptions, PtyDataEvent, PtyExitEvent, TerminalState } from '../../shared/types';
import { getLogger, Logger } from '../../shared/Logger';
import { ok, err, Result } from '../../shared/types';
import { PtyManager } from '../infrastructure/PtyManager';

// Event types for the service
interface TerminalServiceEvents {
  'data': PtyDataEvent;
  'exit': PtyExitEvent;
  'created': { id: string; cwd: string };
  'killed': { id: string };
}

export class TerminalService extends EventEmitter {
  private logger: Logger;
  private ptyManager: PtyManager;
  private terminalStates = new Map<string, TerminalState>();

  constructor(ptyManager: PtyManager) {
    super();
    this.logger = getLogger('TerminalService');
    this.ptyManager = ptyManager;

    // Forward PTY events
    this.ptyManager.on('data', (id, data) => {
      this.emit('data', { id, data });
    });

    this.ptyManager.on('exit', (id, exitCode) => {
      this.terminalStates.delete(id);
      this.emit('exit', { id, exitCode });
    });

    this.ptyManager.on('error', (id, error) => {
      this.logger.error('PTY error', { id, error });
    });
  }

  /**
   * Get the default shell for the platform
   */
  private getDefaultShell(): string {
    return process.env.SHELL || (os.platform() === 'win32' ? 'cmd.exe' : 'bash');
  }

  /**
   * Create a new terminal session
   */
  create(options: PtyCreateOptions): Result<TerminalState> {
    try {
      const shell = options.shell ?? this.getDefaultShell();
      const cwd = options.cwd;

      this.ptyManager.create(options);

      const state: TerminalState = {
        ptyId: options.id,
        cols: options.cols,
        rows: options.rows,
        shell,
        cwd,
      };

      this.terminalStates.set(options.id, state);
      this.emit('created', { id: options.id, cwd });

      this.logger.debug('Terminal created', {
        id: options.id,
        cwd,
        cols: options.cols,
        rows: options.rows,
      });

      return ok(state);
    } catch (e) {
      this.logger.error('Failed to create terminal', e);
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Write data to a terminal
   */
  write(id: string, data: string): Result<void> {
    try {
      this.ptyManager.write(id, data);
      return ok(undefined);
    } catch (e) {
      this.logger.error('Failed to write to terminal', { id, error: e });
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Resize a terminal
   */
  resize(id: string, cols: number, rows: number): Result<void> {
    try {
      this.ptyManager.resize(id, cols, rows);

      // Update state
      const state = this.terminalStates.get(id);
      if (state) {
        state.cols = cols;
        state.rows = rows;
      }

      return ok(undefined);
    } catch (e) {
      this.logger.error('Failed to resize terminal', { id, cols, rows, error: e });
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Kill a terminal session
   */
  kill(id: string): Result<void> {
    try {
      this.ptyManager.kill(id);
      this.terminalStates.delete(id);
      this.emit('killed', { id });
      return ok(undefined);
    } catch (e) {
      this.logger.error('Failed to kill terminal', { id, error: e });
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Get state of a terminal
   */
  getState(id: string): TerminalState | null {
    return this.terminalStates.get(id) ?? null;
  }

  /**
   * Get all active terminal IDs
   */
  getActiveIds(): string[] {
    return this.ptyManager.getSessionIds();
  }

  /**
   * Check if a terminal exists
   */
  has(id: string): boolean {
    return this.terminalStates.has(id);
  }

  /**
   * Get all terminal states
   */
  getAllStates(): Map<string, TerminalState> {
    return new Map(this.terminalStates);
  }

  /**
   * Kill all terminals
   */
  killAll(): Result<void> {
    try {
      this.ptyManager.killAll();
      this.terminalStates.clear();
      return ok(undefined);
    } catch (e) {
      this.logger.error('Failed to kill all terminals', e);
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Get stats about active terminals
   */
  getStats(): { active: number; totalCreated: number } {
    return {
      active: this.terminalStates.size,
      totalCreated: this.terminalStates.size, // Could track total created separately
    };
  }
}

// Singleton instance
let terminalServiceInstance: TerminalService | null = null;

export function getTerminalService(ptyManager?: PtyManager): TerminalService {
  if (!terminalServiceInstance) {
    if (!ptyManager) {
      throw new Error('PtyManager required for first initialization');
    }
    terminalServiceInstance = new TerminalService(ptyManager);
  }
  return terminalServiceInstance;
}
