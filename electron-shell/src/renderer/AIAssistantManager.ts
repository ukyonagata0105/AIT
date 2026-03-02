/**
 * AI Assistant Manager
 * Enhanced AI integration with context awareness and tool usage
 */

export type AIMessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface AIMessage {
  id: string;
  role: AIMessageRole;
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolResult?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
}

export interface AIContext {
  workspacePath?: string;
  currentFile?: {
    path: string;
    content: string;
    language: string;
  };
  terminalOutput?: string[];
  selectedText?: string;
}

export interface AIAssistantOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enableTools?: boolean;
}

export class AIAssistantManager {
  private messages: AIMessage[] = [];
  private context: AIContext = {};
  private options: AIAssistantOptions = {
    model: 'claude-sonnet-4-6',
    temperature: 0.7,
    maxTokens: 4096,
    enableTools: true,
  };
  private messageCounter = 0;

  constructor(options?: Partial<AIAssistantOptions>) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
  }

  /**
   * Send a message to the AI assistant
   */
  async sendMessage(content: string, context?: Partial<AIContext>): Promise<AIMessage> {
    // Update context
    if (context) {
      this.context = { ...this.context, ...context };
    }

    // Create user message
    const userMessage: AIMessage = {
      id: this.generateMessageId(),
      role: 'user',
      content: this.enrichMessageWithContext(content),
      timestamp: Date.now(),
    };

    this.messages.push(userMessage);

    // Get response from AI
    try {
      const response = await this.callAI(userMessage);
      this.messages.push(response);
      return response;
    } catch (error) {
      const errorMessage: AIMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      };
      this.messages.push(errorMessage);
      return errorMessage;
    }
  }

  /**
   * Execute a tool call
   */
  async executeToolCall(toolCall: ToolCall): Promise<string> {
    try {
      const result = await window.electronAPI.aiExecuteTool(toolCall);

      // Create tool result message
      const toolMessage: AIMessage = {
        id: this.generateMessageId(),
        role: 'tool',
        content: JSON.stringify(result),
        timestamp: Date.now(),
        toolResult: result.data || result.error,
      };

      this.messages.push(toolMessage);
      return toolMessage.content;
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : 'Tool execution failed',
      });
    }
  }

  /**
   * Get conversation history
   */
  getHistory(): AIMessage[] {
    return [...this.messages];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.messages = [];
    this.context = {};
  }

  /**
   * Update context
   */
  updateContext(context: Partial<AIContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Get current context
   */
  getContext(): AIContext {
    return { ...this.context };
  }

  /**
   * Stream response (for future implementation)
   */
  async *streamMessage(content: string): AsyncGenerator<string> {
    // Placeholder for streaming implementation
    yield 'Streaming not yet implemented';
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private generateMessageId(): string {
    return `msg-${++this.messageCounter}-${Date.now()}`;
  }

  private enrichMessageWithContext(content: string): string {
    let enriched = content;

    if (this.context.currentFile) {
      enriched += `\n\nCurrent file: ${this.context.currentFile.path}`;
      enriched += `\nLanguage: ${this.context.currentFile.language}`;
      if (this.context.selectedText) {
        enriched += `\nSelected text:\n${this.context.selectedText}`;
      }
    }

    if (this.context.workspacePath) {
      enriched += `\n\nWorkspace: ${this.context.workspacePath}`;
    }

    return enriched;
  }

  private async callAI(message: AIMessage): Promise<AIMessage> {
    // Build conversation context
    const conversation = [
      {
        role: 'system',
        content: this.getSystemPrompt(),
      },
      ...this.messages.slice(-10), // Keep last 10 messages for context
      message,
    ];

    try {
      // Call AI through IPC
      const response = await window.electronAPI.aiChat({
        messages: conversation,
        model: this.options.model,
        temperature: this.options.temperature,
        maxTokens: this.options.maxTokens,
        enableTools: this.options.enableTools,
      });

      const assistantMessage: AIMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: response.content || '',
        timestamp: Date.now(),
        toolCalls: response.toolCalls,
      };

      return assistantMessage;
    } catch (error) {
      throw error;
    }
  }

  private getSystemPrompt(): string {
    return `You are TermNexus AI Assistant, an intelligent coding assistant integrated into a terminal IDE.

Your capabilities include:
- Analyzing and writing code across multiple languages
- Explaining terminal output and error messages
- Suggesting commands and workflows
- Helping debug issues
- Executing tools when needed (file operations, terminal commands, etc.)

When providing code:
- Include syntax highlighting hints
- Add brief explanations for complex logic
- Follow the project's existing style and patterns

When suggesting terminal commands:
- Explain what each command does
- Highlight potential risks (e.g., destructive operations)
- Suggest safer alternatives when available

Be concise, helpful, and context-aware.`;
  }
}

// Extend window.electronAPI for AI operations
declare global {
  interface Window {
    electronAPI: {
      aiChat: (options: {
        messages: Array<{ role: string; content: string }>;
        model?: string;
        temperature?: number;
        maxTokens?: number;
        enableTools?: boolean;
      }) => Promise<{
        content: string;
        toolCalls?: ToolCall[];
      }>;
      aiExecuteTool: (toolCall: ToolCall) => Promise<{
        success: boolean;
        data?: unknown;
        error?: string;
      }>;
    };
  }
}
