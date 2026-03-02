import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

/**
 * esbuild plugin to handle shared module resolution
 */
export const sharedModulePlugin = {
  name: 'shared-modules',

  setup(build) {
    // Get the project root directory (works in ESM)
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const projectRoot = path.resolve(__dirname, '..');

    // Resolve all imports from shared directory
    build.onResolve({ filter: /^\.\/\.\.\/shared\// }, (args) => {
      const resolved = path.resolve(args.resolveDir, args.path);
      // Add .ts extension if not present
      const withExt = resolved.endsWith('.ts') ? resolved : resolved + '.ts';
      if (fs.existsSync(withExt)) {
        return { path: withExt };
      }
    });

    // Handle relative imports like ../../shared/types
    build.onResolve({ filter: /^\.\.\/\.\.\/shared\// }, (args) => {
      const resolved = path.resolve(args.resolveDir, args.path);
      const withExt = resolved.endsWith('.ts') ? resolved : resolved + '.ts';
      if (fs.existsSync(withExt)) {
        return { path: withExt };
      }
    });

    // Also handle direct shared/ imports if used
    build.onResolve({ filter: /^shared\// }, (args) => {
      const moduleName = args.path.replace(/^shared\//, '');
      const resolved = path.join(projectRoot, 'src', 'shared', moduleName + '.ts');
      if (fs.existsSync(resolved)) {
        return { path: resolved };
      }
    });

    // Fallback for any shared path
    build.onResolve({ filter: /shared/ }, (args) => {
      // Try to resolve from project root
      const importPath = args.path.replace(/^\.?\.\//, ''); // Remove leading ./
      const resolved = path.join(projectRoot, 'src', importPath);

      // Check if it's a file or directory
      if (fs.existsSync(resolved + '.ts')) {
        return { path: resolved + '.ts' };
      }
      if (fs.existsSync(resolved)) {
        return { path: resolved };
      }

      // Try in shared directory
      const sharedResolved = path.join(projectRoot, 'src', 'shared', path.basename(importPath) + '.ts');
      if (fs.existsSync(sharedResolved)) {
        return { path: sharedResolved };
      }
    });
  },
};
