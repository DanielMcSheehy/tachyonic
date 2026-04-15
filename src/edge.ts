/**
 * Edge/Serverless compatible Compact client
 * For Cloudflare Workers, Vercel Edge, etc.
 * 
 * Pure local implementation - no API calls required.
 */
import {
  CompactInput,
  CompactResult,
  SDKConfig,
  SDKError,
} from './types.js';
import { compact as engineCompact } from './core/compact-engine.js';

export class CompactEdgeClient {
  private config: SDKConfig;

  constructor(config: SDKConfig = {}) {
    this.config = config;
  }

  async compact(input: CompactInput): Promise<CompactResult> {
    const startTime = Date.now();

    try {
      // Normalize input to string
      const text = typeof input.input === 'string' 
        ? input.input 
        : JSON.stringify(input.input);

      // Use the local engine
      const engineResult = engineCompact(text, input.query, {
        targetRatio: input.compressionRatio ?? 0.5,
        preserveRecent: input.preserveRecent ?? 2,
        includeMarkers: input.includeMarkers ?? true,
      });

      return {
        id: `compact-edge-${Date.now()}`,
        output: engineResult.output,
        messages: [{
          role: 'assistant',
          content: engineResult.output,
          compacted_line_ranges: [],
          kept_line_ranges: [],
        }],
        usage: {
          inputTokens: Math.ceil(text.length / 4),
          outputTokens: Math.ceil(engineResult.output.length / 4),
          compressionRatio: engineResult.compressionRatio,
          processingTimeMs: Date.now() - startTime,
        },
        model: 'local-tf-idf',
      };
    } catch (error) {
      throw new SDKError(
        `Compact failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }
}

// Re-export for edge bundle
export { CompactEdgeClient as CompactClient };