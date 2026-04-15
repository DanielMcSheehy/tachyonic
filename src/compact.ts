/**
 * Compact - Local TF-IDF context compression
 * 
 * Pure algorithm implementation using the compact-engine.
 * Zero API calls - runs entirely locally.
 * 
 * Features:
 * - Query-conditioned compression (focus on relevant content)
 * - <keepContext> markers for preserving critical sections
 * - Line-range tracking for transparency
 */
import {
  CompactInput,
  CompactResult,
  CompactMessage,
  LineRange,
  ChatMessage,
  SDKError,
} from './types.js';
import { compact as engineCompact } from './core/compact-engine.js';

const DEFAULT_COMPRESSION_RATIO = 0.5;
const DEFAULT_PRESERVE_RECENT = 2;

export class CompactClient {
  private config: { debug?: boolean };

  constructor(config: { debug?: boolean } = {}) {
    this.config = config;
  }

  /**
   * Compress chat history or code context using local TF-IDF algorithm
   * 
   * Example:
   * ```typescript
   * const result = await client.compact({
   *   input: chatHistory,
   *   query: "JWT token validation"
   * });
   * // Use result.output for your LLM prompt
   * ```
   */
  async compact(input: CompactInput): Promise<CompactResult> {
    const startTime = Date.now();

    try {
      // Normalize input format
      const text = this.normalizeToString(input);
      
      // Handle keepContext tags
      const processedText = this.processKeepContextTags(text);

      // Use the local engine
      const engineResult = engineCompact(processedText, input.query, {
        targetRatio: input.compressionRatio ?? DEFAULT_COMPRESSION_RATIO,
        preserveRecent: input.preserveRecent ?? DEFAULT_PRESERVE_RECENT,
        includeMarkers: input.includeMarkers ?? true,
      });

      const processingTimeMs = Date.now() - startTime;

      // Parse the compressed output
      const resultMessages = this.parseCompressedOutput(
        engineResult.output,
        input.includeLineRanges ?? true,
        input.includeMarkers ?? true
      );

      return {
        id: `compact-${Date.now()}`,
        output: engineResult.output,
        messages: resultMessages,
        usage: {
          inputTokens: this.estimateTokens(text),
          outputTokens: this.estimateTokens(engineResult.output),
          compressionRatio: engineResult.compressionRatio,
          processingTimeMs,
        },
        model: 'local-tf-idf',
      };
    } catch (error) {
      if (error instanceof SDKError) {
        throw error;
      }
      throw new SDKError(
        `Compact failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * Batch compress multiple contexts
   */
  async batchCompact(
    inputs: Array<{
      id: string;
      content: string;
      query?: string;
    }>,
    options: {
      compressionRatio?: number;
      globalQuery?: string;
    } = {}
  ): Promise<Array<CompactResult & { id: string }>> {
    const results = await Promise.all(
      inputs.map(async ({ id, content, query }) => {
        const result = await this.compact({
          input: content,
          query: query ?? options.globalQuery,
          compressionRatio: options.compressionRatio,
        });
        return { ...result, id };
      })
    );
    return results;
  }

  /**
   * Compress with aggressive settings for long contexts
   */
  async compactAggressive(input: string, query?: string): Promise<CompactResult> {
    return this.compact({
      input,
      query,
      compressionRatio: 0.3, // Keep only 30%
      preserveRecent: 0,
    });
  }

  /**
   * Compress while preserving specific line ranges
   */
  async compactWithPreservation(
    input: string,
    preserveRanges: Array<{ start: number; end: number }>,
    query?: string
  ): Promise<CompactResult> {
    // Add keepContext tags around ranges to preserve
    const lines = input.split('\n');
    const processedLines: string[] = [];
    let inKeepContext = false;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const shouldPreserve = preserveRanges.some(r => lineNum >= r.start && lineNum <= r.end);

      if (shouldPreserve && !inKeepContext) {
        processedLines.push('<keepContext>');
        inKeepContext = true;
      } else if (!shouldPreserve && inKeepContext) {
        processedLines.push('</keepContext>');
        inKeepContext = false;
      }

      processedLines.push(lines[i]);
    }

    if (inKeepContext) {
      processedLines.push('</keepContext>');
    }

    return this.compact({
      input: processedLines.join('\n'),
      query,
    });
  }

  /**
   * Normalize input to string format
   */
  private normalizeToString(input: CompactInput): string {
    if (input.messages && input.messages.length > 0) {
      return input.messages.map(m => m.content).join('\n');
    }

    if (typeof input.input === 'string') {
      return input.input;
    }

    return input.input.map(m => m.content).join('\n');
  }

  /**
   * Process <keepContext> tags
   */
  private processKeepContextTags(text: string): string {
    // Validate tag pairing (basic check)
    const openTags = (text.match(/<keepContext>/g) || []).length;
    const closeTags = (text.match(/<\/keepContext>/g) || []).length;
    
    if (openTags !== closeTags && openTags > closeTags) {
      // Unclosed tag - close it
      return text + '\n</keepContext>';
    }

    return text;
  }

  /**
   * Parse compressed output and extract line range info
   */
  private parseCompressedOutput(
    compressed: string,
    includeLineRanges: boolean,
    includeMarkers: boolean
  ): CompactMessage[] {
    // If markers are included, we can parse them
    if (includeMarkers) {
      const compactedRanges: LineRange[] = [];
      
      // Parse (filtered N lines) markers
      const markerRegex = /\(filtered (\d+) lines\)/g;
      let currentLine = 1;
      
      const lines = compressed.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/\(filtered (\d+) lines\)/);
        if (match) {
          const filteredCount = parseInt(match[1] || '0');
          if (filteredCount > 0) {
            compactedRanges.push({
              start: currentLine,
              end: currentLine + filteredCount - 1,
            });
          }
        }
        currentLine++;
      }

      return [{
        role: 'assistant',
        content: compressed,
        compacted_line_ranges: includeLineRanges ? compactedRanges : [],
        kept_line_ranges: [],
      }];
    }

    // No markers - return simple result
    return [{
      role: 'assistant',
      content: compressed,
      compacted_line_ranges: [],
      kept_line_ranges: [],
    }];
  }

  /**
   * Simple token estimation (4 chars per token approx)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Utility: Add keepContext tags to a code section
   */
  static wrapKeepContext(code: string): string {
    return `<keepContext>\n${code}\n</keepContext>`;
  }

  /**
   * Utility: Remove keepContext tags from output
   */
  static unwrapKeepContext(code: string): string {
    return code
      .replace(/<keepContext>\n?/g, '')
      .replace(/\n?<\/keepContext>/g, '');
  }
}

/**
 * Create compact tool for MCP integration
 */
export function createCompactTool(compact: CompactClient) {
  return {
    name: 'compact_context',
    description: `Compress chat history or code context to reduce token usage.
Removes irrelevant lines while preserving important content.
50-70% typical reduction, every surviving line is byte-identical.`,
    parameters: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Text to compress',
        },
        query: {
          type: 'string',
          description: 'Focus query (e.g., "authentication middleware")',
        },
        compression_ratio: {
          type: 'number',
          description: 'Fraction to keep (0.3-0.7, default: 0.5)',
        },
      },
      required: ['input'],
    },
    handler: async (params: { input: string; query?: string; compression_ratio?: number }) => {
      const result = await compact.compact({
        input: params.input,
        query: params.query,
        compressionRatio: params.compression_ratio,
      });
      
      const reduction = ((1 - result.usage.compressionRatio) * 100).toFixed(1);
      
      return {
        content: [{
          type: 'text',
          text: `Compressed ${reduction}% (${result.usage.inputTokens} → ${result.usage.outputTokens} tokens)\n\n${result.output.slice(0, 2000)}...`,
        }],
      };
    },
  };
}