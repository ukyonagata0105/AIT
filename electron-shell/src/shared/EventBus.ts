/**
 * EventBus - Type-safe event bus for intra-process communication
 * Works in both main and renderer processes
 */

export type EventListener<T = unknown> = (payload: T) => void;
export type Disposable = { dispose: () => void };

interface EventHandler<T> {
  listener: EventListener<T>;
  once: boolean;
}

/**
 * Type-safe event bus for internal application events
 */
export class EventBus<EventMap extends Record<string, any> = Record<string, any>> {
  private listeners = new Map<keyof EventMap, EventHandler<any>[]>();
  private wildcardListeners: Array<EventHandler<{ key: string; payload: any }>> = [];

  /**
   * Subscribe to an event
   */
  on<K extends keyof EventMap>(
    event: K,
    listener: EventListener<EventMap[K]>
  ): Disposable {
    const handlers = this.listeners.get(event) ?? [];
    handlers.push({ listener, once: false });
    this.listeners.set(event, handlers);

    return {
      dispose: () => this.off(event, listener),
    };
  }

  /**
   * Subscribe to an event once (auto-dispose after first emission)
   */
  once<K extends keyof EventMap>(
    event: K,
    listener: EventListener<EventMap[K]>
  ): Disposable {
    const handlers = this.listeners.get(event) ?? [];
    handlers.push({ listener, once: true });
    this.listeners.set(event, handlers);

    return {
      dispose: () => this.off(event, listener),
    };
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof EventMap>(
    event: K,
    listener: EventListener<EventMap[K]>
  ): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    const index = handlers.findIndex(h => h.listener === listener);
    if (index !== -1) {
      handlers.splice(index, 1);
    }

    if (handlers.length === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Emit an event to all subscribers
   */
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    // Wildcard listeners
    for (const handler of [...this.wildcardListeners]) {
      handler.listener({ key: event as string, payload });
    }

    // Specific event listeners
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    // Create a copy to avoid issues if listeners are modified during iteration
    for (const handler of [...handlers]) {
      handler.listener(payload);

      if (handler.once) {
        this.off(event, handler.listener);
      }
    }
  }

  /**
   * Subscribe to all events (wildcard)
   */
  onWildcard(listener: (event: { key: string; payload: unknown }) => void): Disposable {
    this.wildcardListeners.push({ listener, once: false });

    return {
      dispose: () => {
        const index = this.wildcardListeners.findIndex(h => h.listener === listener);
        if (index !== -1) {
          this.wildcardListeners.splice(index, 1);
        }
      },
    };
  }

  /**
   * Remove all listeners for an event or all events
   */
  clear<K extends keyof EventMap>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
      this.wildcardListeners = [];
    }
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount<K extends keyof EventMap>(event: K): number {
    return this.listeners.get(event)?.length ?? 0;
  }

  /**
   * Check if there are any listeners for an event
   */
  hasListeners<K extends keyof EventMap>(event: K): boolean {
    return this.listenerCount(event) > 0;
  }

  /**
   * Get all event names that have listeners
   */
  eventNames(): Array<keyof EventMap> {
    return Array.from(this.listeners.keys());
  }

  /**
   * Async version of emit - waits for all async listeners to complete
   */
  async emitAsync<K extends keyof EventMap>(
    event: K,
    payload: EventMap[K]
  ): Promise<void> {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    const promises = handlers.map(async (handler) => {
      const result = handler.listener(payload);
      // Support async listeners
      if (result instanceof Promise) {
        await result;
      }
    });

    await Promise.all(promises);
  }

  /**
   * Create a promise that resolves when an event is emitted
   */
  waitFor<K extends keyof EventMap>(
    event: K,
    timeout?: number,
    predicate?: (payload: EventMap[K]) => boolean
  ): Promise<EventMap[K]> {
    return new Promise((resolve, reject) => {
      const disposable = this.once((eventData: EventMap[K]) => {
        if (predicate && !predicate(eventData)) {
          // If predicate fails, wait for next event
          disposable.dispose();
          return;
        }
        resolve(eventData);
      });

      if (timeout) {
        setTimeout(() => {
          disposable.dispose();
          reject(new Error(`Timeout waiting for event: ${String(event)}`));
        }, timeout);
      }
    });
  }
}

/**
 * Create a typed event bus
 */
export function createEventBus<EventMap extends Record<string, any>>() {
  return new EventBus<EventMap>();
}
