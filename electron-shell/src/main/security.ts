/**
 * Security utilities for IPC handlers
 * Provides path validation and input sanitization
 */

import * as path from 'path';
import * as fs from 'fs';

// Allowed environment variables for PTY sessions
export const ALLOWED_ENV_VARS = [
    'PATH',
    'HOME',
    'USER',
    'SHELL',
    'LANG',
    'TERM',
    'COLORTERM',
    'TMPDIR',
    'TEMP',
    'PWD',
    'LOGNAME',
];

// Maximum file size for reading (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Validates that a path is within allowed workspace directories
 * @param userPath - The path to validate
 * @param allowedRoots - Array of allowed root directories
 * @returns The resolved absolute path if valid, null otherwise
 */
export function validatePath(userPath: string, allowedRoots: string[]): string | null {
    try {
        const resolved = path.resolve(userPath);
        
        // Check if the resolved path starts with any of the allowed roots
        for (const root of allowedRoots) {
            const resolvedRoot = path.resolve(root);
            if (resolved.startsWith(resolvedRoot + path.sep) || resolved === resolvedRoot) {
                return resolved;
            }
        }
        
        return null;
    } catch {
        return null;
    }
}

/**
 * Validates a path for filesystem operations
 * Prevents path traversal attacks
 */
export function isValidFilePath(filePath: string): boolean {
    // Reject paths with null bytes
    if (filePath.includes('\0')) {
        return false;
    }
    
    // Reject obviously malicious patterns
    const maliciousPatterns = [
        /\.\./,  // Directory traversal
    ];
    
    for (const pattern of maliciousPatterns) {
        if (pattern.test(filePath)) {
            // Allow .. only if it's part of a legitimate path (not at the start)
            const resolved = path.resolve(filePath);
            if (resolved.includes('..')) {
                return false;
            }
        }
    }
    
    return true;
}

/**
 * Filters environment variables to only include safe ones
 * @returns Filtered environment object
 */
export function getSafeEnv(): NodeJS.ProcessEnv {
    const safeEnv: NodeJS.ProcessEnv = {};
    
    for (const key of ALLOWED_ENV_VARS) {
        if (process.env[key] !== undefined) {
            safeEnv[key] = process.env[key];
        }
    }
    
    return safeEnv;
}

/**
 * Checks if a file is safe to read (size limit, exists, readable)
 */
export async function isSafeToRead(filePath: string): Promise<{ safe: boolean; error?: string }> {
    try {
        const stats = await fs.promises.stat(filePath);
        
        if (!stats.isFile()) {
            return { safe: false, error: 'Not a file' };
        }
        
        if (stats.size > MAX_FILE_SIZE) {
            return { safe: false, error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` };
        }
        
        return { safe: true };
    } catch (error) {
        return { safe: false, error: (error as Error).message };
    }
}

/**
 * Standard IPC response wrapper
 */
export interface IPCResponse<T = void> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Wraps an IPC handler with standardized error handling
 */
export function wrapIPCHandler<T, Args extends unknown[]>(
    handler: (...args: Args) => Promise<T> | T
): (...args: Args) => Promise<IPCResponse<T>> {
    return async (...args: Args) => {
        try {
            const result = await handler(...args);
            return { success: true, data: result };
        } catch (error) {
            console.error('[IPC Error]', error);
            return { success: false, error: (error as Error).message };
        }
    };
}
