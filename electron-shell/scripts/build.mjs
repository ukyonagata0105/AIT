#!/usr/bin/env node

/**
 * Build script for TermNexus
 * Handles complex build scenarios with proper module resolution
 */

import { build } from 'esbuild';
import { glob } from 'glob';
import path from 'path';
import fs from 'fs';
import { sharedModulePlugin } from './shared-module-plugin.mjs';

async function buildMain() {
  console.log('Building main process...');

  await build({
    entryPoints: ['src/main/main.ts'],
    bundle: true,
    platform: 'node',
    external: ['electron', 'node-pty', 'playwright-core', '@modelcontextprotocol/sdk', 'express', 'ws'],
    outdir: 'dist/main',
    format: 'cjs',
    sourcemap: true,
    logLevel: 'info',
    plugins: [sharedModulePlugin],
  });
}

async function buildPreload() {
  console.log('Building preload script...');

  await build({
    entryPoints: ['src/main/preload.ts'],
    bundle: true,
    platform: 'node',
    external: ['electron', 'playwright-core', '@modelcontextprotocol/sdk'],
    outdir: 'dist/main',
    format: 'cjs',
    sourcemap: true,
    logLevel: 'info',
    plugins: [sharedModulePlugin],
  });
}

async function buildRenderer() {
  console.log('Building renderer process...');

  await build({
    entryPoints: ['src/renderer/index.ts'],
    bundle: true,
    platform: 'browser',
    outdir: 'dist/renderer',
    sourcemap: true,
    loader: {
      '.css': 'css',
    },
    logLevel: 'info',
  });
}

async function copyHtml() {
  console.log('Copying HTML...');

  const src = 'src/renderer/index.html';
  const dest = 'dist/renderer/index.html';

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

async function main() {
  const startTime = Date.now();

  try {
    await Promise.all([
      buildMain(),
      buildPreload(),
      buildRenderer(),
    ]);

    await copyHtml();

    const duration = Date.now() - startTime;
    console.log(`\n✅ Build complete in ${duration}ms`);
  } catch (error) {
    console.error('\n❌ Build failed:', error);
    process.exit(1);
  }
}

main();
