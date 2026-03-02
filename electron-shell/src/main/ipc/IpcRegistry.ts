/**
 * IpcRegistry - Centralized IPC handler registration
 */

import { ipcMain, IpcMainInvokeEvent, IpcMainEvent } from 'electron';
import { getLogger, Logger } from '../../shared/Logger';
import { IPC_CHANNELS } from '../../shared/types';
import { ok, err, Result } from '../../shared/types';

type IpcInvokeHandler = (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any;
type IpcSendHandler = (event: IpcMainEvent, ...args: any[]) => void;

interface HandlerRegistration {
  channel: string;
  type: 'invoke' | 'on' | 'handle';
  handler: IpcInvokeHandler | IpcSendHandler;
  once?: boolean;
}

/**
 * Centralized IPC handler registry
 * Provides type safety and logging for all IPC communications
 */
export class IpcRegistry {
  private logger: Logger;
  private registrations: Map<string, HandlerRegistration[]> = new Map();

  constructor() {
    this.logger = getLogger('IpcRegistry');
  }

  /**
   * Register an invoke handler (request/response)
   */
  invoke<T extends any[] = any[], R = any>(
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: T) => Promise<Result<R>> | Result<R> | R
  ): void {
    const wrappedHandler = async (event: IpcMainInvokeEvent, ...args: T): Promise<R> => {
      const requestId = `ipc:${channel}:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      this.logger.debug('IPC invoke', { channel, args, requestId });

      try {
        const result = await handler(event, ...args);

        // Handle Result type
        if (result && typeof result === 'object' && 'ok' in result) {
          if (result.ok) {
            this.logger.debug('IPC invoke success', { channel, requestId });
            return result.value;
          } else {
            this.logger.warn('IPC invoke error (Result)', {
              channel,
              requestId,
              error: result.error?.message ?? String(result.error),
            });
            throw result.error;
          }
        }

        return result;
      } catch (error) {
        const errObj = error instanceof Error ? error : new Error(String(error));
        this.logger.error('IPC invoke error', {
          channel,
          requestId,
          error: errObj.message,
          stack: errObj.stack,
        });
        throw errObj;
      }
    };

    ipcMain.handle(channel, wrappedHandler);

    this.trackRegistration({
      channel,
      type: 'invoke',
      handler: wrappedHandler,
    });

    this.logger.debug('Registered IPC invoke handler', { channel });
  }

  /**
   * Register a send handler (one-way)
   */
  on<T extends any[] = any[]>(
    channel: string,
    handler: (event: IpcMainEvent, ...args: T) => void
  ): void {
    const wrappedHandler = (event: IpcMainEvent, ...args: T): void => {
      this.logger.debug('IPC on', { channel, args });

      try {
        handler(event, ...args);
      } catch (error) {
        this.logger.error('IPC on error', {
          channel,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    ipcMain.on(channel, wrappedHandler);

    this.trackRegistration({
      channel,
      type: 'on',
      handler: wrappedHandler,
    });

    this.logger.debug('Registered IPC on handler', { channel });
  }

  /**
   * Register a once handler
   */
  once<T extends any[] = any[]>(
    channel: string,
    handler: (event: IpcMainEvent, ...args: T) => void
  ): void {
    const wrappedHandler = (event: IpcMainEvent, ...args: T): void => {
      this.logger.debug('IPC once', { channel, args });

      try {
        handler(event, ...args);
      } catch (error) {
        this.logger.error('IPC once error', {
          channel,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    ipcMain.once(channel, wrappedHandler);

    this.trackRegistration({
      channel,
      type: 'on',
      handler: wrappedHandler,
      once: true,
    });

    this.logger.debug('Registered IPC once handler', { channel });
  }

  /**
   * Send a message to the renderer process
   */
  send(channel: string, ...args: any[]): void {
    // This would require access to BrowserWindow
    // Use MainWindowManager for this
    this.logger.debug('IPC send', { channel, args });
  }

  /**
   * Remove all handlers for a channel
   */
  remove(channel: string): void {
    ipcMain.removeAllListeners(channel);

    const registrations = this.registrations.get(channel) ?? [];
    this.registrations.delete(channel);

    this.logger.info('Removed IPC handlers', { channel, count: registrations.length });
  }

  /**
   * Remove all handlers
   */
  removeAll(): void {
    const channels = Array.from(this.registrations.keys());
    channels.forEach(channel => ipcMain.removeAllListeners(channel));
    this.registrations.clear();

    this.logger.info('Removed all IPC handlers', { count: channels.length });
  }

  /**
   * Get list of registered channels
   */
  getRegisteredChannels(): string[] {
    return Array.from(this.registrations.keys());
  }

  /**
   * Get handler count for a channel
   */
  getHandlerCount(channel: string): number {
    return this.registrations.get(channel)?.length ?? 0;
  }

  private trackRegistration(registration: HandlerRegistration): void {
    const existing = this.registrations.get(registration.channel) ?? [];
    existing.push(registration);
    this.registrations.set(registration.channel, existing);
  }
}

// Singleton instance
let ipcRegistryInstance: IpcRegistry | null = null;

export function getIpcRegistry(): IpcRegistry {
  if (!ipcRegistryInstance) {
    ipcRegistryInstance = new IpcRegistry();
  }
  return ipcRegistryInstance;
}
