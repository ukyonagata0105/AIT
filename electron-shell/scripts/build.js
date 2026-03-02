#!/usr/bin/env node

/**
 * Build script for TermNexus
 * Handles complex build scenarios with proper module resolution
 */

const { build } = require('esbuild');
const { globSync } = require('glob');
const path = require('path');
const fs = require('fs');

// Shared files to include in main bundle
const sharedFiles = globSync('src/shared/*.ts');

async function buildMain() {
  console.log('Building main process...');

  // Build a temporary combined entry point that includes shared modules
  const entryPoints = [
    ...sharedFiles,
    'src/main/main.ts',
  ];

  await build({
    entryPoints,
    bundle: true,
    platform: 'node',
    external: ['electron', 'node-pty', 'playwright-core', '@modelcontextprotocol/sdk', 'express', 'ws'],
    outdir: 'dist/main',
    format: 'cjs',
    sourcemap: true,
    treeShaking: true,
    logLevel: 'info',
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
