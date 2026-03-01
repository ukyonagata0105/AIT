/**
 * Constants for the renderer process
 * Extracts magic numbers and configuration values
 */

// ─── Color Presets ───────────────────────────────────────────────────────────

export const COLOR_PRESET_COUNT = 14;

export const PRESET_COLORS = [
    '#e74c3c', // Red
    '#e67e22', // Orange
    '#f1c40f', // Yellow
    '#2ecc71', // Green
    '#1abc9c', // Teal
    '#3498db', // Blue
    '#9b59b6', // Purple
    '#34495e', // Dark Gray
    '#16a085', // Dark Teal
    '#27ae60', // Dark Green
    '#2980b9', // Dark Blue
    '#8e44ad', // Dark Purple
    '#c0392b', // Dark Red
    '#d35400', // Dark Orange
];

// ─── File Types ───────────────────────────────────────────────────────────────

export const IMAGE_EXTENSIONS = new Set([
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff'
]);

export const PDF_EXTENSIONS = new Set(['pdf']);

export const HIDDEN_FILE_PREFIX = '.';

// ─── UI Layout ───────────────────────────────────────────────────────────────

// Space for macOS traffic lights (red/yellow/green window buttons)
export const MACOS_TRAFFIC_LIGHTS_WIDTH = 80;

// Default terminal dimensions
export const DEFAULT_TERMINAL_COLS = 80;
export const DEFAULT_TERMINAL_ROWS = 24;

// Resize debounce delay (ms)
export const RESIZE_DEBOUNCE_DELAY = 100;

// ─── Browser Panel ───────────────────────────────────────────────────────────

export const DEFAULT_BROWSER_ZOOM = 50; // percent
export const BROWSER_ZOOM_STEP = 10; // percent

// ─── Terminal ────────────────────────────────────────────────────────────────

export const TERMINAL_REFRESH_DELAY = 50; // ms - for setTimeout instead of RAF
