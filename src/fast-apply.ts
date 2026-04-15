/**
 * Fast Apply - Local deterministic edit merging
 * 
 * Pure algorithm implementation using the fast-apply-engine.
 * Zero API calls - runs entirely locally.
 * 
 * Uses 3-way merge with Levenshtein distance fuzzy matching.
 */
import {
  FastApplyInput,
  FastApplyResult,
  SDKError,
} from './types.js';
import { 
  fastApply as engineFastApply, 
  batchApply as engineBatchApply,
} from './core/fast-apply-engine.js';
import { promises as fs } from 'fs';

export class FastApplyClient {
  private config: { debug?: boolean };

  constructor(config: { debug?: boolean } = {}) {
    this.config = config;
  }

  /**
   * Apply an edit snippet to a file using local deterministic merge
   * 
   * Example:
   * ```typescript
   * const result = await client.execute({
   *   target_filepath: 'src/auth.ts',
   *   instructions: 'Add null check before session creation',
   *   code_edit: `
   * // ... existing code ...
   * if (!user) throw new Error("Not found");
   * // ... existing code ...
   * `
   * });
   * ```
   */
  async execute(input: FastApplyInput): Promise<FastApplyResult> {
    const startTime = Date.now();
    
    try {
      // Read original file if not provided
      let originalCode = input.originalCode;
      if (!originalCode) {
        try {
          originalCode = await fs.readFile(input.targetFilepath, 'utf-8');
        } catch (err) {
          throw new SDKError(
            `Failed to read file ${input.targetFilepath}: ${err}`,
            400
          );
        }
      }

      // Use the local engine for deterministic merging
      const engineResult = engineFastApply(originalCode, input.codeEdit, {
        fuzzyMatching: true,
        preserveIndentation: true,
      });

      const processingTimeMs = Date.now() - startTime;

      return {
        output: engineResult.output,
        success: engineResult.success,
        usage: {
          inputTokens: this.estimateTokens(originalCode + input.codeEdit),
          outputTokens: this.estimateTokens(engineResult.output),
          processingTimeMs,
        },
      };
    } catch (error) {
      if (error instanceof SDKError) {
        throw error;
      }
      throw new SDKError(
        `Fast Apply failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * Direct apply without file I/O - useful for in-memory processing
   */
  async applyDirect(
    originalCode: string,
    _instructions: string,
    codeEdit: string
  ): Promise<FastApplyResult> {
    const startTime = Date.now();
    
    const engineResult = engineFastApply(originalCode, codeEdit, {
      fuzzyMatching: true,
      preserveIndentation: true,
    });

    return {
      output: engineResult.output,
      success: engineResult.success,
      usage: {
        inputTokens: this.estimateTokens(originalCode + codeEdit),
        outputTokens: this.estimateTokens(engineResult.output),
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Apply edit and write back to file
   */
  async applyAndSave(input: FastApplyInput): Promise<FastApplyResult & { saved: boolean }> {
    const result = await this.execute(input);
    
    let saved = false;
    if (result.success && input.targetFilepath !== 'inline') {
      await fs.writeFile(input.targetFilepath, result.output, 'utf-8');
      saved = true;
    }

    return { ...result, saved };
  }

  /**
   * Batch apply multiple edits to the same file
   */
  async batchApply(
    targetFilepath: string,
    edits: Array<{ instructions: string; codeEdit: string }>,
    options: { writeBack?: boolean } = {}
  ): Promise<{ results: FastApplyResult[]; finalOutput: string }> {
    let currentCode = await fs.readFile(targetFilepath, 'utf-8');
    const results: FastApplyResult[] = [];

    for (const edit of edits) {
      const result = await this.applyDirect(
        currentCode,
        edit.instructions,
        edit.codeEdit
      );
      results.push(result);
      
      if (result.success) {
        currentCode = result.output;
      }
    }

    if (options.writeBack) {
      await fs.writeFile(targetFilepath, currentCode, 'utf-8');
    }

    return { results, finalOutput: currentCode };
  }

  /**
   * Check if a code snippet uses proper markers
   */
  static hasValidMarkers(codeEdit: string): boolean {
    const markers = [
      '// ... existing code ...',
      '/* ... existing code ... */',
      '# ... existing code ...',
      '<!-- ... existing code ... -->',
    ];
    return markers.some(marker => codeEdit.includes(marker));
  }

  /**
   * Add markers to a raw edit snippet if missing
   */
  static addMarkers(
    editSnippet: string,
    language: 'typescript' | 'python' | 'javascript' | 'html' | 'css' = 'typescript'
  ): string {
    if (FastApplyClient.hasValidMarkers(editSnippet)) {
      return editSnippet;
    }

    const markerMap: Record<string, string> = {
      typescript: '// ... existing code ...',
      javascript: '// ... existing code ...',
      python: '# ... existing code ...',
      html: '<!-- ... existing code ... -->',
      css: '/* ... existing code ... */',
    };

    const marker = markerMap[language];
    return `${marker}\n${editSnippet}\n${marker}`;
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}

/**
 * Utility to create an edit_file tool for MCP/AI agents
 */
export function createEditFileTool(fastApply: FastApplyClient) {
  return {
    name: 'edit_file',
    description: `Apply an AI-generated edit to a file using deterministic merge. 
Edit snippets must include '// ... existing code ...' markers to indicate unchanged sections.
Example:
// ... existing code ...
const x = 1;
// ... existing code ...`,
    parameters: {
      type: 'object',
      properties: {
        target_filepath: {
          type: 'string',
          description: 'Path to the file to edit',
        },
        instructions: {
          type: 'string',
          description: 'Natural language description of the change',
        },
        code_edit: {
          type: 'string',
          description: 'Edit snippet with // ... existing code ... markers',
        },
      },
      required: ['target_filepath', 'instructions', 'code_edit'],
    },
    handler: async (params: { target_filepath: string; instructions: string; code_edit: string }) => {
      const result = await fastApply.execute(params);
      return {
        content: [{ type: 'text', text: result.success ? 'Edit applied successfully' : 'Edit failed' }],
        isError: !result.success,
      };
    },
  };
}