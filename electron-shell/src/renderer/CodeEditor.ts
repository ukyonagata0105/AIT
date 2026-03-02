/**
 * Code Editor Component
 * Lightweight code editor with syntax highlighting and line numbers
 */

import { getFileExtension, isBinaryFile } from '../../shared/utils';

interface EditorOptions {
  language?: string;
  readOnly?: boolean;
  fontSize?: number;
  tabSize?: number;
  lineNumbers?: boolean;
  wordWrap?: boolean;
  theme?: 'dark' | 'light';
}

interface EditorState {
  content: string;
  cursorLine?: number;
  cursorColumn?: number;
  selectionStart?: number;
  selectionEnd?: number;
}

export class CodeEditor {
  private container: HTMLElement;
  private textarea: HTMLTextAreaElement;
  private lineNumbers: HTMLElement;
  private highlightLayer: HTMLElement;
  private state: EditorState;
  private options: EditorOptions;

  // Simple syntax highlighting patterns
  private static syntaxPatterns = {
    javascript: [
      { regex: /\/\/.*$/gm, class: 'comment' },
      { regex: /\/\*[\s\S]*?\*\//g, class: 'comment' },
      { regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, class: 'string' },
      { regex: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|new|this)\b/g, class: 'keyword' },
      { regex: /\b(true|false|null|undefined)\b/g, class: 'literal' },
      { regex: /\b\d+\.?\d*\b/g, class: 'number' },
      { regex: /\b([A-Z][a-zA-Z0-9]*)\b/g, class: 'type' },
    ],
    typescript: [
      { regex: /\/\/.*$/gm, class: 'comment' },
      { regex: /\/\*[\s\S]*?\*\//g, class: 'comment' },
      { regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, class: 'string' },
      { regex: /\b(const|let|var|function|return|if|else|for|while|class|interface|type|import|export|from|async|await|new|this|extends|implements)\b/g, class: 'keyword' },
      { regex: /\b(true|false|null|undefined)\b/g, class: 'literal' },
      { regex: /\b\d+\.?\d*\b/g, class: 'number' },
      { regex: /\b([A-Z][a-zA-Z0-9]*)\b/g, class: 'type' },
    ],
    python: [
      { regex: /#.*/gm, class: 'comment' },
      { regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, class: 'string' },
      { regex: /\b(def|class|return|if|else|elif|for|while|import|from|as|try|except|finally|with|lambda|True|False|None)\b/g, class: 'keyword' },
      { regex: /\b\d+\.?\d*\b/g, class: 'number' },
      { regex: /\b([A-Z][a-zA-Z0-9_]*)\b/g, class: 'type' },
    ],
    json: [
      { regex: /"(?:[^"\\]|\\.)*"/g, class: 'string' },
      { regex: /\b(true|false|null)\b/g, class: 'literal' },
      { regex: /\b-?\d+\.?\d*\b/g, class: 'number' },
      { regex: /\b([a-zA-Z_][a-zA-Z0-9_]*)\b(?=\s*:)/g, class: 'key' },
    ],
  };

  constructor(container: HTMLElement, options: EditorOptions = {}) {
    this.container = container;
    this.options = {
      language: 'javascript',
      readOnly: false,
      fontSize: 13,
      tabSize: 2,
      lineNumbers: true,
      wordWrap: false,
      theme: 'dark',
      ...options,
    };

    this.state = { content: '' };
    this.render();
  }

  private render(): void {
    this.container.className = 'code-editor';
    this.container.innerHTML = `
      <div class="editor-wrapper">
        ${this.options.lineNumbers ? '<div class="line-numbers"></div>' : ''}
        <div class="editor-content">
          <div class="highlight-layer"></div>
          <textarea class="editor-textarea" spellcheck="false"></textarea>
        </div>
      </div>
    `;

    this.lineNumbers = this.container.querySelector('.line-numbers') as HTMLElement;
    this.highlightLayer = this.container.querySelector('.highlight-layer') as HTMLElement;
    this.textarea = this.container.querySelector('.editor-textarea') as HTMLTextAreaElement;

    // Setup textarea
    this.textarea.readOnly = this.options.readOnly;
    this.textarea.style.fontSize = `${this.options.fontSize}px`;
    this.textarea.style.tabSize = this.options.tabSize.toString();

    // Event listeners
    this.textarea.addEventListener('input', () => this.handleInput());
    this.textarea.addEventListener('scroll', () => this.handleScroll());
    this.textarea.addEventListener('keydown', (e) => this.handleKeyDown(e));

    // Handle tab key
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const spaces = ' '.repeat(this.options.tabSize!);
        this.textarea.setRangeText(spaces, start, end);
        this.textarea.selectionStart = this.textarea.selectionEnd = start + spaces.length;
      }
    });
  }

  private handleInput(): void {
    this.state.content = this.textarea.value;
    this.updateHighlight();
    this.updateLineNumbers();
  }

  private handleScroll(): void {
    this.highlightLayer.scrollTop = this.textarea.scrollTop;
    this.highlightLayer.scrollLeft = this.textarea.scrollLeft;
    if (this.lineNumbers) {
      this.lineNumbers.scrollTop = this.textarea.scrollTop;
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Keyboard shortcuts
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      // Save would be triggered here
      return;
    }

    // Ctrl+F for search
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      // Search would be triggered here
      return;
    }
  }

  private updateHighlight(): void {
    const language = this.options.language || 'javascript';
    const patterns = CodeEditor.syntaxPatterns[language as keyof typeof CodeEditor.syntaxPatterns] ||
                      CodeEditor.syntaxPatterns.javascript;

    let highlighted = this.escapeHtml(this.state.content);

    // Apply syntax highlighting
    for (const pattern of patterns) {
      highlighted = highlighted.replace(pattern.regex, (match) => {
        return `<span class="syntax-${pattern.class}">${match}</span>`;
      });
    }

    this.highlightLayer.innerHTML = highlighted;
    // Copy font properties to textarea
    this.syncScroll();
  }

  private updateLineNumbers(): void {
    if (!this.lineNumbers) return;

    const lines = this.state.content.split('\n');
    const lineNumbersHtml = lines.map((_, i) => `<div class="line-number">${i + 1}</div>`).join('');
    this.lineNumbers.innerHTML = lineNumbersHtml;
  }

  private syncScroll(): void {
    // Ensure highlight layer matches textarea dimensions
    this.highlightLayer.style.height = this.textarea.scrollHeight + 'px';
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  setContent(content: string): void {
    this.state.content = content;
    this.textarea.value = content;
    this.updateHighlight();
    this.updateLineNumbers();
  }

  getContent(): string {
    return this.state.content;
  }

  focus(): void {
    this.textarea.focus();
  }

  insertAtCursor(text: string): void {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    this.textarea.setRangeText(text, start, end);
    this.textarea.selectionStart = this.textarea.selectionEnd = start + text.length;
    this.handleInput();
    this.focus();
  }

  getSelectedText(): string {
    return this.textarea.value.substring(this.textarea.selectionStart, this.textarea.selectionEnd);
  }

  getCursorPosition(): { line: number; column: number } {
    const text = this.textarea.value;
    const pos = this.textarea.selectionStart;

    const lines = text.substring(0, pos).split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length;

    return { line, column };
  }

  goToLine(line: number, column?: number): void {
    const lines = this.state.content.split('\n');
    if (line < 1 || line > lines.length) return;

    let pos = 0;
    for (let i = 0; i < line - 1; i++) {
      pos += lines[i].length + 1;
    }
    pos += Math.min(column || 0, lines[line - 1].length);

    this.textarea.setSelectionRange(pos, pos);
    this.textarea.focus();
  }

  static detectLanguage(filePath: string): string {
    const ext = getFileExtension(filePath);

    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      toml: 'toml',
      md: 'markdown',
      css: 'css',
      html: 'html',
      sh: 'bash',
    };

    return languageMap[ext] || 'plaintext';
  }
}
