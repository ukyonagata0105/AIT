/**
 * Test utilities for TermNexus
 */

import { Result, ok, err } from '../shared/types';

/**
 * Create a mock function that tracks calls
 */
export function mockFn<T extends (...args: any[]) => any>() {
  const calls: Parameters<T>[] = [];
  const results: ReturnType<T>[] = [];

  const fn = (...args: Parameters<T>): ReturnType<T> => {
    calls.push(args);
    const lastResult = results[calls.length - 1];
    if (lastResult !== undefined) {
      return lastResult;
    }
    return undefined as ReturnType<T>;
  };

  fn.mockCalls = () => calls;
  fn.mockCallCount = () => calls.length;
  fn.mockLastCall = () => calls[calls.length - 1];
  fn.mockClear = () => {
    calls.length = 0;
    results.length = 0;
  };
  fn.mockReturnValueOnce = (value: ReturnType<T>) => {
    results.push(value);
    return fn;
  };
  fn.mockResolvedValueOnce = (value: ReturnType<T>) => {
    results.push(Promise.resolve(value) as ReturnType<T>);
    return fn;
  };
  fn.mockRejectedValueOnce = (error: Error) => {
    results.push(Promise.reject(error) as ReturnType<T>);
    return fn;
  };

  return fn;
}

/**
 * Wait for async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait until a condition is true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await wait(interval);
  }

  throw new Error(`waitFor timed out after ${timeout}ms`);
}

/**
 * Create a mock event emitter
 */
export class MockEventEmitter {
  private listeners = new Map<string, Set<Function>>();

  on(event: string, listener: Function): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  off(event: string, listener: Function): this {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(...args));
      return true;
    }
    return false;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

/**
 * Create a fake file system for testing
 */
export class FakeFs {
  private files = new Map<string, { content: string; isDir: boolean; mtime: number }>();

  writeFile(path: string, content: string): void {
    this.files.set(path, { content, isDir: false, mtime: Date.now() });
  }

  writeDir(path: string): void {
    this.files.set(path, { content: '', isDir: true, mtime: Date.now() });
  }

  readFile(path: string): string | undefined {
    const file = this.files.get(path);
    return file?.content;
  }

  readDir(path: string): string[] | undefined {
    const prefix = path.endsWith('/') ? path : path + '/';
    return Array.from(this.files.keys())
      .filter(p => p.startsWith(prefix))
      .map(p => p.slice(prefix.length))
      .filter(p => !p.includes('/'));
  }

  exists(path: string): boolean {
    return this.files.has(path);
  }

  stat(path: string): { isDirectory: () => boolean; mtimeMs: number } | null {
    const file = this.files.get(path);
    if (!file) return null;
    return {
      isDirectory: () => file.isDir,
      mtimeMs: file.mtime,
    };
  }

  clear(): void {
    this.files.clear();
  }
}

/**
 * Assert helpers
 */
export function assertOk<T>(result: Result<T>): asserts result is { ok: true; value: T } {
  if (!result.ok) {
    throw new Error(`Expected ok, got error: ${result.error}`);
  }
}

export function assertErr<E>(result: Result<unknown, E>): asserts result is { ok: false; error: E } {
  if (result.ok) {
    throw new Error('Expected error, got ok');
  }
}

export function assertThrows(fn: () => any): Error {
  let thrown: Error | null = null;
  try {
    fn();
  } catch (e) {
    thrown = e instanceof Error ? e : new Error(String(e));
  }
  if (!thrown) {
    throw new Error('Expected function to throw');
  }
  return thrown;
}

/**
 * Test runner helpers
 */
export function describe(name: string, fn: () => void): void {
  console.log(`\n📦 ${name}`);
  fn();
}

export function it(name: string, fn: () => void | Promise<void>): void {
  const promise = fn();
  if (promise instanceof Promise) {
    promise
      .then(() => console.log(`  ✓ ${name}`))
      .catch((e) => console.error(`  ✗ ${name}`, e.message));
  } else {
    try {
      fn();
      console.log(`  ✓ ${name}`);
    } catch (e) {
      console.error(`  ✗ ${name}`, e instanceof Error ? e.message : String(e));
    }
  }
}

export async function run(): Promise<void> {
  console.log('\n🧪 Running tests...\n');
}
