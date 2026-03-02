/**
 * Search Manager
 * Advanced search functionality with grep integration
 */

export interface SearchResult {
  filePath: string;
  line: number;
  column: number;
  content: string;
  matches: MatchRange[];
}

export interface MatchRange {
  start: number;
  end: number;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  filePattern?: string;
  maxResults?: number;
}

export interface SearchProgress {
  searched: number;
  total: number;
  results: SearchResult[];
  isComplete: boolean;
}

export class SearchManager {
  private currentSearch: AbortController | null = null;
  private results: SearchResult[] = [];
  private onProgressCallback: ((progress: SearchProgress) => void) | null = null;

  constructor() {
    // Initialize
  }

  /**
   * Search for a pattern in files
   */
  async search(
    rootPath: string,
    pattern: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    // Cancel any existing search
    this.cancelSearch();

    this.currentSearch = new AbortController();
    this.results = [];

    const {
      caseSensitive = false,
      wholeWord = false,
      regex = false,
      filePattern = '*',
      maxResults = 1000,
    } = options;

    try {
      // Build grep command
      const grepArgs = this.buildGrepArgs(pattern, {
        caseSensitive,
        wholeWord,
        regex,
        filePattern,
        maxResults,
      });

      // Execute search via IPC
      const response = await window.electronAPI.searchGrep({
        path: rootPath,
        pattern,
        args: grepArgs,
        signal: this.currentSearch.signal,
      });

      if (response.success) {
        this.results = this.parseGrepOutput(response.data, pattern);
        return this.results;
      } else {
        throw new Error(response.error || 'Search failed');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return []; // Search was cancelled
      }
      throw error;
    }
  }

  /**
   * Search in a specific file
   */
  async searchInFile(
    filePath: string,
    pattern: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    try {
      const content = await window.electronAPI.fsReadFile(filePath);
      const results: SearchResult[] = [];

      const regex = this.buildSearchRegex(pattern, options);
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        regex.lastIndex = 0;

        let match;
        while ((match = regex.exec(line)) !== null) {
          results.push({
            filePath,
            line: i + 1,
            column: match.index + 1,
            content: line.trim(),
            matches: [{ start: match.index, end: match.index + match[0].length }],
          });
        }
      }

      return results;
    } catch (error) {
      console.error(`Failed to search in file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Replace matches in a file
   */
  async replaceInFile(
    filePath: string,
    pattern: string,
    replacement: string,
    options: SearchOptions = {}
  ): Promise<number> {
    try {
      const content = await window.electronAPI.fsReadFile(filePath);
      const regex = this.buildSearchRegex(pattern, { ...options, global: true });

      const newContent = content.replace(regex, replacement);
      const matches = content.match(regex);

      if (matches && matches.length > 0) {
        await window.electronAPI.fsWriteFile(filePath, newContent);
        return matches.length;
      }

      return 0;
    } catch (error) {
      console.error(`Failed to replace in file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Cancel current search
   */
  cancelSearch(): void {
    if (this.currentSearch) {
      this.currentSearch.abort();
      this.currentSearch = null;
    }
  }

  /**
   * Get current results
   */
  getResults(): SearchResult[] {
    return this.results;
  }

  /**
   * Clear results
   */
  clearResults(): void {
    this.results = [];
  }

  /**
   * Set progress callback
   */
  onProgress(callback: (progress: SearchProgress) => void): void {
    this.onProgressCallback = callback;
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private buildGrepArgs(pattern: string, options: SearchOptions): string[] {
    const args: string[] = [];

    // Add options
    if (!options.caseSensitive) {
      args.push('-i');
    }

    if (options.wholeWord) {
      args.push('-w');
    }

    if (!options.regex) {
      args.push('-F'); // Fixed strings (faster)
    }

    // Output format
    args.push('-n'); // Line numbers
    args.push('-H'); // Always show filename
    args.push('--color=never');

    // File pattern
    if (options.filePattern) {
      args.push('--include=' + options.filePattern);
    }

    // Max results (context)
    if (options.maxResults) {
      args.push('-m');
      args.push(String(options.maxResults));
    }

    // Pattern
    args.push(pattern);

    return args;
  }

  private buildSearchRegex(pattern: string, options: SearchOptions): RegExp {
    let regexPattern = pattern;

    if (!options.regex) {
      // Escape special regex characters
      regexPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    if (options.wholeWord) {
      regexPattern = `\\b${regexPattern}\\b`;
    }

    const flags = options.caseSensitive ? 'g' : 'gi';
    return new RegExp(regexPattern, flags);
  }

  private parseGrepOutput(output: string, pattern: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Parse grep output: "filepath:lineNumber:content"
      const match = line.match(/^([^:]+):(\d+):(.*)$/);
      if (match) {
        const [, filePath, lineNumber, content] = match;

        // Find match positions
        const matches = this.findMatchPositions(content, pattern, {
          caseSensitive: false,
        });

        results.push({
          filePath,
          line: parseInt(lineNumber, 10),
          column: 1,
          content: content.trim(),
          matches,
        });
      }
    }

    return results;
  }

  private findMatchPositions(
    text: string,
    pattern: string,
    options: SearchOptions
  ): MatchRange[] {
    const matches: MatchRange[] = [];
    const regex = this.buildSearchRegex(pattern, options);

    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    return matches;
  }
}

// Extend the window.electronAPI interface for search
declare global {
  interface Window {
    electronAPI: {
      searchGrep: (options: {
        path: string;
        pattern: string;
        args: string[];
        signal?: AbortSignal;
      }) => Promise<{ success: boolean; data: string; error?: string }>;
    };
  }
}
