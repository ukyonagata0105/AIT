/**
 * Tests for shared utilities
 */

import { describe, it } from './helpers';
import { generateId, hashString, getColorFromId, sortEntries, truncatePath } from '../shared/utils';
import { IMAGE_EXTS, PRESET_COLORS } from '../shared/constants';
import { ok, err } from '../shared/types';

describe('generateId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateId('test');
    const id2 = generateId('test');
    if (id1 === id2) {
      throw new Error('IDs should be unique');
    }
  });

  it('should include prefix', () => {
    const id = generateId('ws');
    if (!id.startsWith('ws-')) {
      throw new Error('ID should start with prefix');
    }
  });
});

describe('hashString', () => {
  it('should return consistent hashes', () => {
    const hash1 = hashString('test');
    const hash2 = hashString('test');
    if (hash1 !== hash2) {
      throw new Error('Hashes should be consistent');
    }
  });

  it('should return different hashes for different strings', () => {
    const hash1 = hashString('test1');
    const hash2 = hashString('test2');
    if (hash1 === hash2) {
      throw new Error('Different strings should have different hashes');
    }
  });
});

describe('getColorFromId', () => {
  it('should return a valid color from preset', () => {
    const color = getColorFromId('test-id');
    if (!PRESET_COLORS.includes(color)) {
      throw new Error('Color should be from preset');
    }
  });

  it('should return consistent color for same ID', () => {
    const color1 = getColorFromId('test-id');
    const color2 = getColorFromId('test-id');
    if (color1 !== color2) {
      throw new Error('Color should be consistent for same ID');
    }
  });
});

describe('sortEntries', () => {
  it('should sort by name', () => {
    const entries = [
      { name: 'zebra', isDir: false },
      { name: 'apple', isDir: false },
      { name: 'banana', isDir: false },
    ];
    const sorted = sortEntries(entries, 'name', true);
    if (sorted[0].name !== 'apple' || sorted[2].name !== 'zebra') {
      throw new Error('Entries should be sorted alphabetically');
    }
  });

  it('should put directories first', () => {
    const entries = [
      { name: 'a.txt', isDir: false },
      { name: 'folder', isDir: true },
      { name: 'b.txt', isDir: false },
    ];
    const sorted = sortEntries(entries, 'name', true);
    if (sorted[0].name !== 'folder') {
      throw new Error('Directories should come first');
    }
  });

  it('should sort descending when asc is false', () => {
    const entries = [
      { name: 'apple', isDir: false },
      { name: 'banana', isDir: false },
      { name: 'cherry', isDir: false },
    ];
    const sorted = sortEntries(entries, 'name', false);
    if (sorted[0].name !== 'cherry' || sorted[2].name !== 'apple') {
      throw new Error('Entries should be sorted in descending order');
    }
  });
});

describe('truncatePath', () => {
  it('should not truncate short paths', () => {
    const path = '/Users/user/file.txt';
    const truncated = truncatePath(path, 50);
    if (truncated !== path) {
      throw new Error('Short paths should not be truncated');
    }
  });

  it('should truncate long paths', () => {
    const path = '/Users/user/very/long/path/that/needs/to/be/truncated/because/it/is/too/long/file.txt';
    const truncated = truncatePath(path, 40);
    if (truncated.length > 45) {
      throw new Error('Long paths should be truncated');
    }
    if (!truncated.startsWith('...')) {
      throw new Error('Truncated path should start with ...');
    }
  });
});

describe('Result type', () => {
  it('should create ok result', () => {
    const result = ok(42);
    if (!result.ok || result.value !== 42) {
      throw new Error('ok() should create a successful result');
    }
  });

  it('should create error result', () => {
    const error = new Error('test error');
    const result = err(error);
    if (result.ok) {
      throw new Error('err() should create an error result');
    }
    if (result.error !== error) {
      throw new Error('error should match');
    }
  });
});

// Export for running
export async function run() {
  console.log('\n🧪 Testing shared utilities...');
}
